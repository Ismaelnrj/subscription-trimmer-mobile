"""Assembles Part 5 of the story reel: Netflix went up, and he will not cancel it.

  python3 tools/reels/story/assemble-part5.py take.mp4 <price recording dir> <card still> build/
  python3 tools/brand-video.py build/part5-captioned.mp4 --out build/part5-en.mp4 --lang en --no-bug

The funny one, at the owner's request (2026-11-18: "a bit comedy or funny as well").
It carries straight on from Part 4's last line ("Okay, that was easy."). ONE take,
Seedance 2.5 job `a1bdc176-1677-4857-8b39-2484c00ea02f`, a 12 s forward extension
of Part 4's take (`75c2b3bd-...`): same kitchen, same people, same voices, no new
start frame, 36 credits. Whisper small.en heard every line as written (base.en
misheard three short ones); who-speaks.py was clear on the last two lines and a
tie on the first four, so those were read on a mouth sheet: his mouth moves on
lines 1 and 3, hers on 2 and 4.

  picture  take 0-2.2 | the price card, held | take 3.53-9.0 | the tap on "Update to €15.99" | take 10.6-11.93, held
  sound    the take, unbroken

The card is the dashboard's real price card (record-price.js): a Netflix Standard
row tracked at the character's older 13.99 against the checked 15.99 (DACH,
verified 2026-09-05), so "Two euros." plays over the card that says so. Its
caption sits at 0.30 of the height, above the card's title. "I'll just update the
price." sits at 0.70 so it clears "My price is right" when the tap shot cuts in.
"""
import json, pathlib, subprocess, sys
from importlib import import_module
from PIL import Image, ImageDraw

REPO = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO / 'tools'))
cut = import_module('make-cut')
FF = cut.FFMPEG
if len(sys.argv) != 5:
    sys.exit('usage: assemble-part5.py take.mp4 price-dir card.png outdir')
TAKE, PRICE, STILL, OUT = (pathlib.Path(x) for x in sys.argv[1:])
OUT.mkdir(parents=True, exist_ok=True)
W, H, FPS = 1080, 1920, 30

CUT1_F = 66            # take to 2.20 s: "Netflix went up!" ends 2.12, her line starts 2.65
STILL_F = 40           # the card, 2.20-3.53, under "Two euros." (2.65-3.33)
CUT2_F = 270           # take 3.53-9.00: "It feels personal.", "So cancel it.", the frozen
                       # beat, and most of "I'll just update the price." (8.12-9.78)
TAP_IN, TAP_F = 0.40, 48    # recording 0.40-2.00: the card, the tap (1.20, so 9.80 here),
                            # the card gone (1.28) and the new total; ends 10.60
END_F, FREEZE_F = 358, 12   # take 10.60-11.93 ("Coward." 10.62-11.10, the shrug), then held

A_END_F = CUT1_F + STILL_F
B_END_F = CUT2_F + TAP_F
END = (END_F + FREEZE_F) / FPS

# who: M left, F right. Times are take seconds, which are also output seconds.
LINES = [
    ('M', 0.05, 2.10, 'Netflix went up!', 0.66),
    ('F', 2.55, 3.50, 'Two euros.', 0.30),
    ('M', 3.75, 4.90, 'It feels personal.', 0.66),
    ('F', 4.95, 5.95, 'So cancel it.', 0.66),
    ('M', 8.10, 9.80, "I'll just update the price.", 0.70),
    ('F', 10.60, 11.50, 'Coward.', 0.66),
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


def still_frames(src, frames, outdir, scale_at):
    """A held still with a slow push about its centre, drawn at 2x so it never steps a pixel."""
    outdir.mkdir(exist_ok=True)
    S = 2
    cx, cy = src.width / 2, src.height / 2
    for k in range(frames):
        s = scale_at(k) * S
        a, c = 1 / s, cx - (W * S / 2) / s
        e, f = 1 / s, cy - (H * S / 2) / s
        big = src.transform((W * S, H * S), Image.AFFINE, (a, 0, c, 0, e, f), resample=Image.BICUBIC,
                            fillcolor=(0xF3, 0xF5, 0xF6))
        big.resize((W, H), Image.LANCZOS).save(outdir / f'{k:04d}.png')


def main():
    up = f'scale={W}:{H}:flags=lanczos,unsharp=5:5:0.5:5:5:0,fps={FPS},setsar=1,format=yuv420p'
    enc = ['-c:v', 'libx264', '-crf', '17']
    take_full = OUT / 'take_full.mov'
    run([FF, '-y', '-v', 'error', '-i', str(TAKE), '-an', '-vf', up + f',trim=end_frame={END_F}', *enc, str(take_full)])

    def piece(name, a, b, freeze=0):
        vf = f'trim=start_frame={a}:end_frame={b},setpts=PTS-STARTPTS'
        if freeze:
            vf += f',tpad=stop_mode=clone:stop_duration={freeze / FPS:.4f},trim=end_frame={b - a + freeze}'
        run([FF, '-y', '-v', 'error', '-i', str(take_full), '-vf', vf, *enc, str(OUT / f'{name}.mov')])

    piece('e1', 0, CUT1_F)
    piece('e2', A_END_F, CUT2_F)
    piece('e3', B_END_F, END_F, FREEZE_F)
    run([FF, '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(PRICE / 'list.txt'), '-vf',
         f'fps={FPS},trim=start={TAP_IN},setpts=PTS-STARTPTS,{up},trim=end_frame={TAP_F}', *enc, str(OUT / 'tap.mov')])
    # The card: fitted to the width, pushed 3% about the centre, which keeps the card's
    # title below the 0.30 caption the whole time (measured on the last frame).
    still = Image.open(STILL).convert('RGB')
    fit = W / still.width
    still_frames(still, STILL_F, OUT / 'card', lambda k: fit * (1 + 0.03 * ease(k, STILL_F)))
    run([FF, '-y', '-v', 'error', '-framerate', str(FPS), '-i', str(OUT / 'card' / '%04d.png'),
         '-vf', 'format=yuv420p', *enc, str(OUT / 'card.mov')])
    parts = ['e1', 'card', 'e2', 'tap', 'e3']
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
         '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', str(OUT / 'part5-captioned.mp4')])
    json.dump({'end': END, 'lines': report}, open(OUT / 'timeline.json', 'w'), indent=1)
    print(f'take 0-{CUT1_F / FPS:.2f}  card -{A_END_F / FPS:.2f}  take -{CUT2_F / FPS:.2f}  '
          f'tap -{B_END_F / FPS:.2f}  kitchen -{END:.2f}')
    for r in report:
        print(r)


main()
