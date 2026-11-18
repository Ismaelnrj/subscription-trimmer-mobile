"""Assembles Part 6 of the story reel: Lisbon, and the gym paid for the coffee.

  python3 tools/reels/story/assemble-part6.py take.mp4 <cancelled recording dir> <cancelled still> build/
  python3 tools/brand-video.py build/part6-captioned.mp4 --out build/part6-en.mp4 --lang en --no-bug

The same couple in a new place, at the owner's request (2026-11-18: "number 6, in
another location same people"): the trip Part 2 ended on ("So... Lisbon?" /
"Lisbon."). He says the gym paid for it; the real Cancelled screen says what
cancelling it has avoided so far, one 29.90 charge. The joke is on him, never on
the app: the screen is honest, and he was early.

New place, so a new start frame (gpt_image_2_6 job `268123d1-57ab-4963-a673-2568752886d8`,
0.5 credits) from the series' own references, then ONE take, Seedance 2.5
`omni_reference`, 11 s, job `9b6e7df8-e400-47c5-83d9-705d990f53aa`, 33 credits, with
that start image, both face stills and a clip of each of their own Part 2 lines as
voice references (README item 21). Whisper small.en heard every line as written;
who-speaks.py was clear on four lines and close on her two short ones, whose
mouths were read on a frame sheet (hers move, his are shut).

  picture  take 0-1.93 | Settings, the tap on "Cancelled subscriptions" | the Cancelled
           screen, held | take 4.70-11.03, held
  sound    the take, unbroken

"Twenty-nine ninety" (4.10-4.65) plays over the screen that says it; the cut back
lands on her deadpan "so far". The screen's figure is the server's own
chargesAvoidedSince for a Gym (29.90 monthly, billed on the 19th) cancelled 33 days
before recording: one charge has passed, so one charge is counted.
"""
import json, pathlib, subprocess, sys
from importlib import import_module
from PIL import Image, ImageDraw

REPO = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO / 'tools'))
cut = import_module('make-cut')
FF = cut.FFMPEG
if len(sys.argv) != 5:
    sys.exit('usage: assemble-part6.py take.mp4 cancelled-dir cancelled.png outdir')
TAKE, REC, STILL, OUT = (pathlib.Path(x) for x in sys.argv[1:])
OUT.mkdir(parents=True, exist_ok=True)
W, H, FPS = 1080, 1920, 30

CUT1_F = 58            # take to 1.93 s: "The gym paid for this trip." ends 1.78
TAP_IN, TAP_F = 0.55, 24    # recording 0.55-1.35: Settings, the tap (1.00, so 2.38 here),
                            # the Cancelled screen (1.10); ends 2.73
STILL_F = 59           # the Cancelled screen, 2.73-4.70, under "Twenty-nine ninety" (4.10-4.65)
END_F, FREEZE_F = 331, 12   # take 4.70-11.03: "so far", "So... the coffee.", "The coffee.",
                            # the toast, then held

A_END_F = CUT1_F + TAP_F + STILL_F
END = (END_F + FREEZE_F) / FPS

# who: M left, F right. Times are take seconds, which are also output seconds.
LINES = [
    ('M', 0.05, 1.90, 'The gym paid for this trip.', 0.66),
    ('F', 3.55, 5.25, '€29.90 so far.', 0.70),
    ('M', 5.95, 7.65, 'So… the coffee.', 0.66),
    ('F', 7.85, 8.75, 'The coffee.', 0.66),
    ('M', 8.80, 9.95, 'To the gym.', 0.66),
    ('F', 10.30, 11.30, 'To the gym.', 0.66),
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
    take_full = OUT / 'take_full.mov'
    run([FF, '-y', '-v', 'error', '-i', str(TAKE), '-an', '-vf', up + f',trim=end_frame={END_F}', *enc, str(take_full)])

    def piece(name, a, b, freeze=0):
        vf = f'trim=start_frame={a}:end_frame={b},setpts=PTS-STARTPTS'
        if freeze:
            vf += f',tpad=stop_mode=clone:stop_duration={freeze / FPS:.4f},trim=end_frame={b - a + freeze}'
        run([FF, '-y', '-v', 'error', '-i', str(take_full), '-vf', vf, *enc, str(OUT / f'{name}.mov')])

    piece('e1', 0, CUT1_F)
    piece('e2', A_END_F, END_F, FREEZE_F)
    run([FF, '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(REC / 'list.txt'), '-vf',
         f'fps={FPS},trim=start={TAP_IN},setpts=PTS-STARTPTS,{up},trim=end_frame={TAP_F}', *enc, str(OUT / 'tap.mov')])
    # The Cancelled screen: fitted to the width, pushed 7% about the point between the
    # total and the Gym row, which stays where it is on screen while the rest grows.
    still = Image.open(STILL).convert('RGB')
    fit = W / still.width
    anchored_push(still, STILL_F, OUT / 'held', fit, (0.40 * still.width, 0.30 * still.height), 0.07)
    run([FF, '-y', '-v', 'error', '-framerate', str(FPS), '-i', str(OUT / 'held' / '%04d.png'),
         '-vf', 'format=yuv420p', *enc, str(OUT / 'held.mov')])
    parts = ['e1', 'tap', 'held', 'e2']
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
         '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', str(OUT / 'part6-captioned.mp4')])
    json.dump({'end': END, 'lines': report}, open(OUT / 'timeline.json', 'w'), indent=1)
    print(f'take 0-{CUT1_F / FPS:.2f}  tap -{(CUT1_F + TAP_F) / FPS:.2f}  '
          f'held -{A_END_F / FPS:.2f}  terrace -{END:.2f}')
    for r in report:
        print(r)


main()
