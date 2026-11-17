"""Assembles Part 4 of the story reel: he adds his own by pasting an email.

  python3 tools/reels/story/assemble-part4.py take.mp4 <paste recording dir> <filled still> build/
  python3 tools/brand-video.py build/part4-captioned.mp4 --out build/part4-en.mp4 --lang en --no-bug

It carries straight on from Part 3's last line ("Add them yourself."). ONE take,
Seedance 2.5 job `75c2b3bd-c64b-489c-9212-0741adc07236`, a 12 s forward extension
of Part 3's take B (`811384b9-...`): same kitchen, same people, same voices, no
new start frame, 36 credits. Every line was checked with Whisper base.en and
who-speaks.py (README item 23), and the faces and phones on a frame sheet.

  picture  take 0-4.3 | the taps (Paste email, the email, the form fills) | the filled form, held | take 8.07-11.9, held
  sound    the take, unbroken

The recording and the 3x still come from record-paste.js. Nothing is saved in the
app, and the pasted email is a short demo text at the catalogue's checked price.
"It filled it all in." plays over the filled form, so its caption sits high
(0.30 of the height), over the instruction line, and leaves the detected line,
the name, the price and the cycle clear.
"""
import json, pathlib, subprocess, sys
from importlib import import_module
from PIL import Image, ImageDraw

REPO = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO / 'tools'))
cut = import_module('make-cut')
FF = cut.FFMPEG
if len(sys.argv) != 5:
    sys.exit('usage: assemble-part4.py take.mp4 paste-dir filled.png outdir')
TAKE, PASTE, STILL, OUT = (pathlib.Path(x) for x in sys.argv[1:])
OUT.mkdir(parents=True, exist_ok=True)
W, H, FPS = 1080, 1920, 30

CUT1_F = 129           # take to 4.30 s: her line ends 3.9, his hand goes to his pocket
TAP_IN, TAP_F = 0.35, 63    # recording 0.35-2.45: the list, the "Paste email" tap (0.60), the
                            # sheet, the email (1.36), "Detected" (1.41), the scroll to the fields
STILL_F = 50           # the filled form, 6.40-8.07, under "It filled it all in." (6.7-7.95)
END_F, FREEZE_F = 357, 15   # take to 11.9 s (after "Okay, that was easy."), then held

INSERT_END_F = CUT1_F + TAP_F + STILL_F
END = (END_F + FREEZE_F) / FPS

# who: M left, F right. Times are take seconds, which are also output seconds.
LINES = [
    ('M', 0.05, 2.25, 'Fine. How do I add mine?', 0.66),
    ('F', 2.55, 4.25, 'Paste the confirmation email.', 0.66),
    ('M', 6.65, 8.0, 'It filled it all in.', 0.30),
    ('F', 8.3, 9.45, 'And no bank login.', 0.66),
    ('M', 9.95, 11.25, 'Okay, that was easy.', 0.66),
]
MAX_CPS, MIN_DUR = 17.5, 0.9


def run(args):
    p = subprocess.run(args, capture_output=True, text=True)
    if p.returncode:
        sys.exit('ffmpeg failed:\n' + p.stderr[-1500:])


def plate(text, who, idx, at):
    """The story reel's caption plate, under the speaker, centred at `at` of the height."""
    where = f'line {idx}'
    cut.check_copy(text, 'en', where)
    img = Image.new('RGBA', (W * cut.SS, H * cut.SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = W * 0.045
    left_edge, right_edge = W * cut.SIDE_MARGIN, W * cut.RIGHT_LIMIT
    f, lines = cut.typeset(d, text, 'SemiBold', 54, W * 0.62, W)
    cut.check_contrast(cut.PAPER, cut.NAVY, where)
    lh = f.size * 1.3
    block = lh * len(lines)
    widest = max(d.textlength(l, font=f) for l in lines)
    top = H * cut.SS * at - block / 2
    x0 = left_edge * cut.SS if who == 'M' else right_edge * cut.SS - widest - 2 * pad * cut.SS
    box = [x0, top - pad * cut.SS, x0 + widest + 2 * pad * cut.SS, top + block + pad * cut.SS]
    cut.check_band(box[1] / cut.SS, box[3] / cut.SS, H, where)
    assert box[2] / cut.SS <= right_edge + 0.5, f'{where}: plate crosses the right strip'
    d.rounded_rectangle(box, radius=int(W * 0.022 * cut.SS), fill=cut.NAVY + (240,))
    for i, line in enumerate(lines):
        d.text((x0 + pad * cut.SS, top + i * lh), line, font=f, fill=cut.PAPER)
    return img.resize((W, H), Image.LANCZOS)


def ease(k, n):
    t = k / max(1, n - 1)
    return t * t * (3 - 2 * t)


def still_frames(src, frames, outdir, scale_at, centre_at):
    """A held still with a slow push, drawn at 2x and reduced so it never steps a pixel."""
    outdir.mkdir(exist_ok=True)
    S = 2
    for k in range(frames):
        s = scale_at(k) * S
        cx, cy = centre_at(k)
        a, c = 1 / s, cx - (W * S / 2) / s
        e, f = 1 / s, cy - (H * S / 2) / s
        big = src.transform((W * S, H * S), Image.AFFINE, (a, 0, c, 0, e, f), resample=Image.BICUBIC,
                            fillcolor=(0xF3, 0xF5, 0xF6))
        big.resize((W, H), Image.LANCZOS).save(outdir / f'{k:04d}.png')


def main():
    up = f'scale={W}:{H}:flags=lanczos,unsharp=5:5:0.5:5:5:0,fps={FPS},setsar=1,format=yuv420p'
    enc = ['-c:v', 'libx264', '-crf', '17']
    run([FF, '-y', '-v', 'error', '-i', str(TAKE), '-an', '-vf', up + f',trim=end_frame={END_F}', *enc, str(OUT / 'take_full.mov')])
    run([FF, '-y', '-v', 'error', '-i', str(OUT / 'take_full.mov'), '-vf', f'trim=end_frame={CUT1_F}', *enc, str(OUT / 'e1.mov')])
    run([FF, '-y', '-v', 'error', '-i', str(OUT / 'take_full.mov'), '-vf',
         f'trim=start_frame={INSERT_END_F}:end_frame={END_F},setpts=PTS-STARTPTS,'
         f'tpad=stop_mode=clone:stop_duration={FREEZE_F / FPS:.4f},trim=end_frame={END_F - INSERT_END_F + FREEZE_F}',
         *enc, str(OUT / 'e2.mov')])
    run([FF, '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(PASTE / 'list.txt'), '-vf',
         f'fps={FPS},trim=start={TAP_IN},setpts=PTS-STARTPTS,{up},trim=end_frame={TAP_F}', *enc, str(OUT / 'taps.mov')])
    # The filled form: fitted to the width, pushed 6% towards the detected line (y 988).
    still = Image.open(STILL).convert('RGB')
    fit = W / still.width
    target = (still.width / 2, 988)
    def centre(k):
        sc = fit * (1 + 0.06 * ease(k, STILL_F))
        half_h = H / 2 / sc
        cy = still.height / 2 + (target[1] - still.height / 2) * ease(k, STILL_F)
        return target[0], min(max(cy, half_h), still.height - half_h)
    still_frames(still, STILL_F, OUT / 'filled', lambda k: fit * (1 + 0.06 * ease(k, STILL_F)), centre)
    run([FF, '-y', '-v', 'error', '-framerate', str(FPS), '-i', str(OUT / 'filled' / '%04d.png'),
         '-vf', 'format=yuv420p', *enc, str(OUT / 'filled.mov')])
    parts = ['e1', 'taps', 'filled', 'e2']
    ins = sum((['-i', str(OUT / f'{p}.mov')] for p in parts), [])
    run([FF, '-y', '-v', 'error', *ins, '-filter_complex',
         ''.join(f'[{i}:v]' for i in range(len(parts))) + f'concat=n={len(parts)}:v=1:a=0[v]',
         '-map', '[v]', *enc, str(OUT / 'pic.mov')])
    fa = (f'[0:a]atrim=0:{END_F / FPS:.4f},asetpts=PTS-STARTPTS,aresample=48000,apad,'
          f'atrim=0:{END:.4f},afade=t=out:st={END - 0.45:.4f}:d=0.45[out]')
    run([FF, '-y', '-v', 'error', '-i', str(TAKE), '-filter_complex', fa, '-map', '[out]', '-c:a', 'pcm_s16le', str(OUT / 'snd.wav')])
    run([FF, '-y', '-v', 'error', '-i', str(OUT / 'pic.mov'), '-i', str(OUT / 'snd.wav'), '-map', '0:v', '-map', '1:a',
         '-c:v', 'copy', '-c:a', 'pcm_s16le', str(OUT / 'joined.mov')])

    inputs, chain, prev, report = [], [], '0:v', []
    for i, (who, s, e, text, at) in enumerate(LINES, 1):
        dur = e - s
        assert dur >= MIN_DUR - 1e-9 and len(text) / dur <= MAX_CPS, f'line {i} "{text}": {dur:.2f}s, {len(text) / dur:.1f} cps'
        assert e <= END + 1e-6, f'line {i} outlasts the scene'
        p = OUT / f'cap{i:02d}.png'
        plate(text, who, i, at).save(p)
        inputs += ['-i', str(p)]
        chain.append(f"[{prev}][{i}:v]overlay=0:0:enable='between(t,{s:.3f},{e:.3f})'[c{i}]")
        prev = f'c{i}'
        report.append((s, e, who, text))
    run([FF, '-y', '-v', 'error', '-i', str(OUT / 'joined.mov'), *inputs, '-filter_complex', ';'.join(chain),
         '-map', f'[{prev}]', '-map', '0:a', '-c:v', 'libx264', '-crf', '17', '-preset', 'slow',
         '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', str(OUT / 'part4-captioned.mp4')])
    json.dump({'end': END, 'lines': report}, open(OUT / 'timeline.json', 'w'), indent=1)
    print(f'take 0-{CUT1_F / FPS:.2f}  taps -{(CUT1_F + TAP_F) / FPS:.2f}  form -{INSERT_END_F / FPS:.2f}  kitchen -{END:.2f}')
    for r in report:
        print(r)


main()
