"""Assembles Part 7 of the story reel: "You're still paying for Tinder?"

  python3 tools/reels/story/assemble-part7.py take.mp4 <dashboard still> build/
  python3 tools/brand-video.py build/part7-captioned.mp4 --out build/part7-en.mp4 --lang en --no-bug

Built for the hook, at the owner's word (2026-11-18: "the best hook ever and be
catchy as well. Also using less tokens keeping the quality"). The first line is
the hook and is spoken in the first 1.6 s. Same Lisbon terrace, straight on from
Part 6's toast: ONE Seedance 2.5 forward extension of Part 6's take
(`9b6e7df8-...`), 9 s, no start frame, no references. The app is one held 3x
still of the real dashboard (shoot-still.js), no recording: his own Tinder row,
"Due tomorrow", at the top of Upcoming. The joke keeps the claim to what Trimio
does: it remembers what he added (Part 4), nothing more.

  picture  take 0-CUT1 | the dashboard, held, pushed in on the Tinder row | take CUT2-end, held
  sound    the take, unbroken
"""
import json, pathlib, subprocess, sys
from importlib import import_module
from PIL import Image, ImageDraw

REPO = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO / 'tools'))
cut = import_module('make-cut')
FF = cut.FFMPEG
if len(sys.argv) != 4:
    sys.exit('usage: assemble-part7.py take.mp4 dashboard.png outdir')
TAKE, STILL, OUT = (pathlib.Path(x) for x in sys.argv[1:])
OUT.mkdir(parents=True, exist_ok=True)
W, H, FPS = 1080, 1920, 30

HEAD_S = 0.80          # the take's first 0.8 s is her turning to him: cut it, so the hook
                       # ("You're still paying for Tinder?", 0.95-1.90 in the take) starts at 0.15
# Everything below is in seconds of the TRIMMED take, which are also output seconds.
CUT1_F = 111           # take to 3.70: the hook, his freeze, "That's from before we met!" (2.65-3.65)
STILL_F = 40           # the dashboard, 3.70-5.03, under "It renews tomorrow." (3.75-4.95)
END_F, FREEZE_F = 246, 12   # take 5.03-8.20: "I forgot it existed." (5.50-6.50), "Trimio didn't."
                            # (6.85-7.55), her sip, then held

if not (CUT1_F and STILL_F and END_F):
    sys.exit('assemble-part7.py: fill CUT1_F, STILL_F, END_F and LINES from the measured take first')
A_END_F = CUT1_F + STILL_F
END = (END_F + FREEZE_F) / FPS

# who: M left, F right. Measured with Whisper small.en and who-speaks.py; the hook and
# "Trimio didn't." were ties on the voice score and were read on a mouth sheet (hers move).
# "From before we met!" drops his "That's" so it reads in the 1.15 s before her line.
LINES = [
    ('F', 0.10, 2.55, "You're still paying for Tinder?", 0.66),
    ('M', 2.60, 3.70, 'From before we met!', 0.66),
    ('F', 3.75, 5.00, 'It renews tomorrow.', 0.70),
    ('M', 5.45, 6.65, 'I forgot it existed.', 0.66),
    ('F', 6.85, 8.05, "Trimio didn't.", 0.66),
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


def anchored_push(src, frames, outdir, fit, anchor, amount):
    """A held still pushed in by `amount` about `anchor` (source pixels), which stays put on
    screen. Drawn at 2x and reduced, so the push never steps a pixel."""
    outdir.mkdir(exist_ok=True)
    S = 2
    ax, ay = anchor
    for k in range(frames):
        s = fit * (1 + amount * ease(k, frames))
        a, c = 1 / (s * S), ax - ax * fit / s
        e, f = 1 / (s * S), ay - ay * fit / s
        big = src.transform((W * S, H * S), Image.AFFINE, (a, 0, c, 0, e, f), resample=Image.BICUBIC,
                            fillcolor=(0xF3, 0xF5, 0xF6))
        big.resize((W, H), Image.LANCZOS).save(outdir / f'{k:04d}.png')


def main():
    up = f'scale={W}:{H}:flags=lanczos,unsharp=5:5:0.5:5:5:0,fps={FPS},setsar=1,format=yuv420p'
    enc = ['-c:v', 'libx264', '-crf', '17']
    # The head trim, picture and sound together, so every later time is output time.
    trimmed = OUT / 'take_trimmed.mov'
    run([FF, '-y', '-v', 'error', '-i', str(TAKE), '-ss', f'{HEAD_S:.3f}', '-c:v', 'libx264', '-crf', '12',
         '-c:a', 'pcm_s16le', str(trimmed)])
    take_full = OUT / 'take_full.mov'
    run([FF, '-y', '-v', 'error', '-i', str(trimmed), '-an', '-vf', up + f',trim=end_frame={END_F}', *enc, str(take_full)])

    def piece(name, a, b, freeze=0):
        vf = f'trim=start_frame={a}:end_frame={b},setpts=PTS-STARTPTS'
        if freeze:
            vf += f',tpad=stop_mode=clone:stop_duration={freeze / FPS:.4f},trim=end_frame={b - a + freeze}'
        run([FF, '-y', '-v', 'error', '-i', str(take_full), '-vf', vf, *enc, str(OUT / f'{name}.mov')])

    piece('e1', 0, CUT1_F)
    piece('e2', A_END_F, END_F, FREEZE_F)
    # The dashboard: fitted to the width, pushed 8% about the Tinder row (its line sits at
    # 0.45 of the height), which stays where it is on screen while the rest grows.
    still = Image.open(STILL).convert('RGB')
    fit = W / still.width
    anchored_push(still, STILL_F, OUT / 'held', fit, (0.45 * still.width, 0.455 * still.height), 0.08)
    run([FF, '-y', '-v', 'error', '-framerate', str(FPS), '-i', str(OUT / 'held' / '%04d.png'),
         '-vf', 'format=yuv420p', *enc, str(OUT / 'held.mov')])
    parts = ['e1', 'held', 'e2']
    ins = sum((['-i', str(OUT / f'{p}.mov')] for p in parts), [])
    run([FF, '-y', '-v', 'error', *ins, '-filter_complex',
         ''.join(f'[{i}:v]' for i in range(len(parts))) + f'concat=n={len(parts)}:v=1:a=0[v]',
         '-map', '[v]', *enc, str(OUT / 'pic.mov')])
    fa = (f'[0:a]atrim=0:{END_F / FPS:.4f},asetpts=PTS-STARTPTS,aresample=48000,apad,'
          f'atrim=0:{END:.4f},afade=t=out:st={END - 0.45:.4f}:d=0.45[out]')
    run([FF, '-y', '-v', 'error', '-i', str(trimmed), '-filter_complex', fa, '-map', '[out]', '-c:a', 'pcm_s16le', str(OUT / 'snd.wav')])
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
         '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', str(OUT / 'part7-captioned.mp4')])
    json.dump({'end': END, 'lines': report}, open(OUT / 'timeline.json', 'w'), indent=1)
    print(f'take 0-{CUT1_F / FPS:.2f}  held -{A_END_F / FPS:.2f}  terrace -{END:.2f}')
    for r in report:
        print(r)


main()
