"""Assembles "The announcement", a standalone story reel built to be shared.

  python3 tools/reels/story/assemble-announce.py take.mp4 <dashboard still> <cancel card still> build/
  python3 tools/brand-video.py build/announce-captioned.mp4 --out build/announce-en.mp4 --lang en --no-bug

The owner asked for a reel that could go viral (2026-11-23). A vidIQ outlier search found
the shape that breaks out: a couple, money as the joke, one static shot, a serious
announcement whose news is trivial. Same couple, Part 1's sofa, both facing the camera.
ONE Seedance 2.5 omni_reference take (12 s) from a start frame, item 21's recipe. The app
is two held 3x stills of the real app: the dashboard with the three streaming rows and
their yearly total, and the card "I cancelled it" shows for Disney+. Prices are the
catalogue's checked DACH prices.

  picture  take 0-CUT1 | dashboard, pushed in on the total | take A_END-END | the card, pushed in
  sound    the take, unbroken, then quiet under the card
"""
import json, pathlib, subprocess, sys
from importlib import import_module
from PIL import Image, ImageDraw

REPO = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO / 'tools'))
cut = import_module('make-cut')
FF = cut.FFMPEG
if len(sys.argv) != 5:
    sys.exit('usage: assemble-announce.py take.mp4 dashboard.png card.png outdir')
TAKE, STILL, CARD, OUT = (pathlib.Path(x) for x in sys.argv[1:])
OUT.mkdir(parents=True, exist_ok=True)
W, H, FPS = 1080, 1920, 30

HEAD_S = 0.0           # the first word starts at 0.00: nothing to trim
CUT1_F = 142           # take to 4.73, inside "...we pay for three streaming services." (3.80-6.00)
STILL_F = 42           # the dashboard, 4.73-6.13, under the rest of that line
END_F = 361            # take 6.13-12.03: "We watch one." (6.20-7.43), the nods, "So we've
                       # decided to take a break." (8.88-10.31), "From Disney+." (11.04-11.97)
CARD_F = 72            # the cancel card, held 2.4 s after the punchline
FREEZE_F = 0
A_END_F = CUT1_F + STILL_F
END = (END_F + CARD_F) / FPS

# who: M left, F right, C centred (the hook's on screen text). Measured with Whisper
# small.en and who-speaks.py; "After three years together" tied on voice and was read on
# a mouth sheet (hers moves). Two captions drop words so they read in time: "we found out"
# and nothing else.
LINES = [
    ('C', 0.00, 1.95, 'Some hard news.', 0.52),
    ('M', 0.10, 1.95, 'We have something to tell you.', 0.66),
    ('F', 2.00, 3.70, 'After three years together\u2026', 0.66),
    ('M', 3.80, 6.15, '\u2026we pay for three streaming services.', 0.66),
    ('F', 6.20, 7.45, 'We watch one.', 0.66),
    ('M', 8.85, 10.95, "So we've decided to take a break.", 0.66),
    ('F', 11.00, 12.00, 'From Disney+.', 0.66),
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
    x0 = (left_edge * cut.SS if who == 'M' else right_edge * cut.SS - widest - 2 * pad * cut.SS if who == 'F'
          else (W * cut.SS - widest - 2 * pad * cut.SS) / 2)
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
    piece('e2', A_END_F, END_F)
    # The dashboard, raised 12% so its three rows sit clear of the caption plate (the gap it
    # leaves at the bottom falls in the strip the platform covers), pushed 8% about the
    # monthly and yearly total; then the card, pushed 6% about "\u20ac131.88". Both fitted to the width.
    for name, path, frames, anchor, amount, lift in (('held', STILL, STILL_F, (0.30, 0.13), 0.08, 0.12),
                                                      ('card', CARD, CARD_F, (0.30, 0.20), 0.06, 0.0)):
        img = Image.open(path).convert('RGB')
        if lift:
            raised = Image.new('RGB', img.size, (0xF3, 0xF5, 0xF6))
            raised.paste(img, (0, -round(lift * img.height)))
            img = raised
        anchored_push(img, frames, OUT / name, W / img.width, (anchor[0] * img.width, anchor[1] * img.height), amount)
        run([FF, '-y', '-v', 'error', '-framerate', str(FPS), '-i', str(OUT / name / '%04d.png'),
             '-vf', 'format=yuv420p', *enc, str(OUT / f'{name}.mov')])
    parts = ['e1', 'held', 'e2', 'card']
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
         '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', str(OUT / 'announce-captioned.mp4')])
    json.dump({'end': END, 'lines': report}, open(OUT / 'timeline.json', 'w'), indent=1)
    print(f'take 0-{CUT1_F / FPS:.2f}  dashboard -{A_END_F / FPS:.2f}  sofa -{END_F / FPS:.2f}  card -{END:.2f}')
    for r in report:
        print(r)


main()
