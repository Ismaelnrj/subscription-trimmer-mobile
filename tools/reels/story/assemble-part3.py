"""Assembles Part 3 of the story reel: the trial in the kitchen.

  python3 tools/reels/story/assemble-part3.py takeA.mp4 takeB.mp4 <guide recording dir> <stills dir> build/
  python3 tools/brand-video.py build/part3-captioned.mp4 --out build/part3-en.mp4 --lang en --no-bug

The same couple as Parts 1 and 2, in a kitchen, the next morning. Take A is
Seedance 2.5 job `60f6142d-bc84-447a-a897-9d849d94eeb4` (10 s), started from a
gpt_image_2_6 frame built from Part 1 stills, with his and her Part 2 voices as
audio references. Take B is a forward extension of it,
`811384b9-68f6-4c03-bf8e-67f28ee98a93` (8 s). Speakers were checked with
speaker embeddings (README item 21), faces against Part 1, and her phone shows
its back to the camera throughout.

  picture  A 0-3.3 | dashboard still (her line) | A 5.67-8.47 | the taps | the steps | B 0.35-7.58, held
  sound    A 0-8.47 unbroken                    | room tone            | B

The guide recording is record-trial.js's `guide-*` frame folder; the stills
come from stills-part3.js. The guide's note above the steps names Apple ("billed
through Apple or Google Play") and the page ends before it can scroll away, so
the taps stop the frame before the guide opens and the steps are shown as a
crop of the still from below that note. Nothing in a screen is changed.

Line times were measured from the takes' audio: 50 ms energy, then Whisper
base.en through sherpa-onnx on each span.
"""
import json, pathlib, subprocess, sys
from importlib import import_module
from PIL import Image, ImageDraw

REPO = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO / 'tools'))
cut = import_module('make-cut')
FF = cut.FFMPEG
if len(sys.argv) != 6:
    sys.exit('usage: assemble-part3.py takeA.mp4 takeB.mp4 guide-dir stills-dir outdir')
TA, TB, GUIDE, STILLS, OUT = (pathlib.Path(x) for x in sys.argv[1:])
OUT.mkdir(parents=True, exist_ok=True)
W, H, FPS = 1080, 1920, 30
GROUND = (0xF3, 0xF5, 0xF6)     # the app's light ground, sampled off the still

# Everything on a 30 fps frame grid.
CUT1_F = 99            # A to 3.30 s: "Your YouTube trial ends tomorrow." / "What trial?"
DASH_F = 71            # the dashboard under "The free month. Then it's 14.99." (A 3.4-5.5)
A_END_F = 254          # A to 8.47 s, after "Doing it now." (ends 8.0)
TAP_IN, TAP_F = 0.35, 40    # recording: the list, the "..." tap, the menu; stops at 1.683,
                            # one frame before the guide (and its note) appears at 1.693
PUNCH_F = 72           # the four steps, 2.4 s
B_IN, B_F, FREEZE_F = 0.35, 217, 18   # B from 0.35 (before "How did it know?" at 0.6) to 7.58
TONE = (8.05, 9.05)    # a quiet second of A, looped under the app

A_END = A_END_F / FPS
INSERT = (TAP_F + PUNCH_F) / FPS
B_OFF = A_END + INSERT - B_IN          # output time of B's t = 0
END = A_END + INSERT + (B_F + FREEZE_F) / FPS

# who: M left, F right. Times in take A seconds ('A') or take B seconds ('B').
LINES = [
    ('A', 'F', 0.0, 1.95, 'Your YouTube trial ends tomorrow.'),
    ('A', 'M', 2.4, 3.3, 'What trial?'),
    ('A', 'F', 3.35, 5.6, "The free month. Then it's €14.99."),
    ('A', 'M', 6.15, 7.05, 'Cancel it.'),
    ('A', 'F', 7.35, 8.4, 'Doing it now.'),
    ('B', 'M', 0.55, 1.6, 'How did it know?'),
    ('B', 'F', 2.1, 3.9, 'I added it when you signed up.'),
    ('B', 'M', 4.45, 5.7, 'Add the rest of mine.'),
    ('B', 'F', 5.85, 7.0, 'Add them yourself.'),
]
MAX_CPS, MIN_DUR = 17.5, 0.9


def run(args):
    p = subprocess.run(args, capture_output=True, text=True)
    if p.returncode:
        sys.exit('ffmpeg failed:\n' + p.stderr[-1500:])


def plate(text, who, idx):
    """The story reel's caption plate: under the speaker, at 0.66 of the height."""
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
    top = H * cut.SS * 0.66 - block / 2
    x0 = left_edge * cut.SS if who == 'M' else right_edge * cut.SS - widest - 2 * pad * cut.SS
    box = [x0, top - pad * cut.SS, x0 + widest + 2 * pad * cut.SS, top + block + pad * cut.SS]
    cut.check_band(box[1] / cut.SS, box[3] / cut.SS, H, where)
    assert box[2] / cut.SS <= right_edge + 0.5, f'{where}: plate crosses the right strip'
    d.rounded_rectangle(box, radius=int(W * 0.022 * cut.SS), fill=cut.NAVY + (240,))
    for i, line in enumerate(lines):
        d.text((x0 + pad * cut.SS, top + i * lh), line, font=f, fill=cut.PAPER)
    return img.resize((W, H), Image.LANCZOS)


def still_frames(src, frames, outdir, scale_at, centre_at):
    """A held still with a slow push. scale_at(k) is output pixels per source pixel and
    centre_at(k) the source point at the frame's centre; drawn at 2x, then reduced, so the
    push moves by fractions of a pixel instead of jumping."""
    outdir.mkdir(exist_ok=True)
    S = 2
    for k in range(frames):
        s = scale_at(k) * S
        cx, cy = centre_at(k)
        # output (x, y) -> source (x / s + cx - W*S/2/s, ...)
        a, c = 1 / s, cx - (W * S / 2) / s
        e, f = 1 / s, cy - (H * S / 2) / s
        big = src.transform((W * S, H * S), Image.AFFINE, (a, 0, c, 0, e, f), resample=Image.BICUBIC, fillcolor=GROUND)
        big.resize((W, H), Image.LANCZOS).save(outdir / f'{k:04d}.png')


def ease(k, n):
    t = k / max(1, n - 1)
    return t * t * (3 - 2 * t)


def main():
    up = f'scale={W}:{H}:flags=lanczos,unsharp=5:5:0.5:5:5:0,fps={FPS},setsar=1,format=yuv420p'
    enc = ['-c:v', 'libx264', '-crf', '17']
    # 1. A, in two pieces around the dashboard.
    run([FF, '-y', '-v', 'error', '-i', str(TA), '-an', '-vf', up + f',trim=end_frame={A_END_F}', *enc, str(OUT / 'a_full.mov')])
    run([FF, '-y', '-v', 'error', '-i', str(OUT / 'a_full.mov'), '-vf', f'trim=end_frame={CUT1_F}', *enc, str(OUT / 'a1.mov')])
    run([FF, '-y', '-v', 'error', '-i', str(OUT / 'a_full.mov'), '-vf',
         f'trim=start_frame={CUT1_F + DASH_F}:end_frame={A_END_F},setpts=PTS-STARTPTS', *enc, str(OUT / 'a2.mov')])
    # 2. The dashboard: fitted to the width, pushed 5% towards the trial card.
    dash = Image.open(STILLS / 'dashboard.png').convert('RGB')
    fit = W / dash.width
    card = (dash.width / 2, 952)       # the "Trials ending soon" card, in still pixels
    def dash_centre(k):
        sc = fit * (1 + 0.05 * ease(k, DASH_F))
        half_h = H / 2 / sc
        cy = dash.height / 2 + (card[1] - dash.height / 2) * ease(k, DASH_F)
        return card[0], min(max(cy, half_h), dash.height - half_h)
    still_frames(dash, DASH_F, OUT / 'dash', lambda k: fit * (1 + 0.05 * ease(k, DASH_F)), dash_centre)
    run([FF, '-y', '-v', 'error', '-framerate', str(FPS), '-i', str(OUT / 'dash' / '%04d.png'),
         '-vf', 'format=yuv420p', *enc, str(OUT / 'dash.mov')])
    # 3. The taps, from the recording (390 wide, so upscaled like the takes).
    run([FF, '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(GUIDE / 'list.txt'), '-vf',
         f'fps={FPS},trim=start={TAP_IN},setpts=PTS-STARTPTS,{up},trim=end_frame={TAP_F}', *enc, str(OUT / 'taps.mov')])
    # 4. The steps: a crop from below the note (it ends at row 325) to above the footnote,
    #    on the app's ground, pushed from 0.84 to 0.87 (the full screen app is 0.92). The
    #    push is centred left of the frame's middle so the step text, which ends at x 1058,
    #    stays left of the strip the platform covers (x 918) at the largest.
    guide = Image.open(STILLS / 'guide.png').convert('RGB')
    crop = guide.crop((20, 345, 1150, 1795))
    canvas = Image.new('RGB', (crop.width + 400, crop.height + 1600), GROUND)
    ox, oy = 200, 800
    canvas.paste(crop, (ox, oy))
    FX, FY = 482, 800                  # where the crop's centre sits in the frame
    src_cx = 20 + crop.width / 2       # the crop's centre in still pixels (585)
    def punch_scale(k):
        return 0.84 + 0.03 * ease(k, PUNCH_F)
    def punch_centre(k):
        s = punch_scale(k)
        return ox + crop.width / 2 + (W / 2 - FX) / s, oy + crop.height / 2 + (H / 2 - FY) / s
    for k in (0, PUNCH_F - 1):
        s = punch_scale(k)
        right_text = FX + (1058 - src_cx) * s
        card_left = FX - (src_cx - 48) * s
        assert right_text <= W * 0.85, f'step text reaches x {right_text:.0f}, into the right strip'
        assert card_left >= 0, f'the card starts off screen at x {card_left:.0f}'
        assert FY - crop.height / 2 * s > 0 and FY + crop.height / 2 * s < H * 0.8, 'the steps leave the safe band'
    still_frames(canvas, PUNCH_F, OUT / 'punch', punch_scale, punch_centre)
    run([FF, '-y', '-v', 'error', '-framerate', str(FPS), '-i', str(OUT / 'punch' / '%04d.png'),
         '-vf', 'format=yuv420p', *enc, str(OUT / 'punch.mov')])
    # 5. B, then held.
    run([FF, '-y', '-v', 'error', '-ss', str(B_IN), '-i', str(TB), '-an', '-vf',
         f'{up},trim=end_frame={B_F},tpad=stop_mode=clone:stop_duration={FREEZE_F / FPS:.4f},trim=end_frame={B_F + FREEZE_F}',
         *enc, str(OUT / 'b.mov')])
    parts = ['a1', 'dash', 'a2', 'taps', 'punch', 'b']
    ins = sum((['-i', str(OUT / f'{p}.mov')] for p in parts), [])
    run([FF, '-y', '-v', 'error', *ins, '-filter_complex',
         ''.join(f'[{i}:v]' for i in range(len(parts))) + f'concat=n={len(parts)}:v=1:a=0[v]',
         '-map', '[v]', *enc, str(OUT / 'pic.mov')])
    # Sound: A unbroken under the dashboard, room tone under the app, then B.
    t0, t1 = TONE
    b_len = (B_F + FREEZE_F) / FPS
    fa = (f'[0:a]atrim=0:{A_END:.4f},asetpts=PTS-STARTPTS,aresample=48000,afade=t=out:st={A_END - 0.15:.4f}:d=0.15[s1];'
          f'[0:a]atrim={t0}:{t1},asetpts=PTS-STARTPTS,aresample=48000,aloop=loop=8:size={int((t1 - t0) * 48000)},'
          f'atrim=0:{INSERT:.4f},afade=t=in:d=0.15,afade=t=out:st={INSERT - 0.15:.4f}:d=0.15[s2];'
          f'[1:a]atrim={B_IN}:{B_IN + B_F / FPS:.4f},asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:d=0.1[s3];'
          f'[s1][s2][s3]concat=n=3:v=0:a=1,apad,atrim=0:{END:.4f},afade=t=out:st={END - 0.45:.4f}:d=0.45[out]')
    run([FF, '-y', '-v', 'error', '-i', str(TA), '-i', str(TB), '-filter_complex', fa, '-map', '[out]',
         '-c:a', 'pcm_s16le', str(OUT / 'snd.wav')])
    run([FF, '-y', '-v', 'error', '-i', str(OUT / 'pic.mov'), '-i', str(OUT / 'snd.wav'), '-map', '0:v', '-map', '1:a',
         '-c:v', 'copy', '-c:a', 'pcm_s16le', str(OUT / 'joined.mov')])

    inputs, chain, prev, report = [], [], '0:v', []
    for i, (seg, who, s, e, text) in enumerate(LINES, 1):
        dur = e - s
        cps = len(text) / dur
        assert dur >= MIN_DUR - 1e-9 and cps <= MAX_CPS, f'line {i} "{text}": {dur:.2f}s, {cps:.1f} cps'
        if seg == 'A':
            t0, t1 = s, e
            assert t1 <= A_END + 1e-6, f'line {i} runs into the app'
        else:
            t0, t1 = s + B_OFF, e + B_OFF
            assert t0 >= A_END + INSERT - 1e-6, f'line {i} starts before the cut back to the kitchen'
            assert t1 <= END + 1e-6, f'line {i} outlasts the scene'
        p = OUT / f'cap{i:02d}.png'
        plate(text, who, i).save(p)
        inputs += ['-i', str(p)]
        chain.append(f"[{prev}][{i}:v]overlay=0:0:enable='between(t,{t0:.3f},{t1:.3f})'[c{i}]")
        prev = f'c{i}'
        report.append((round(t0, 2), round(t1, 2), who, text))
    run([FF, '-y', '-v', 'error', '-i', str(OUT / 'joined.mov'), *inputs, '-filter_complex', ';'.join(chain),
         '-map', f'[{prev}]', '-map', '0:a', '-c:v', 'libx264', '-crf', '17', '-preset', 'slow',
         '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', str(OUT / 'part3-captioned.mp4')])
    json.dump({'a_end': A_END, 'insert': INSERT, 'b_off': B_OFF, 'end': END, 'lines': report},
              open(OUT / 'timeline.json', 'w'), indent=1)
    print(f'A 0-{CUT1_F / FPS:.2f}  dashboard -{(CUT1_F + DASH_F) / FPS:.2f}  A -{A_END:.2f}  '
          f'taps -{A_END + TAP_F / FPS:.2f}  steps -{A_END + INSERT:.2f}  kitchen -{END:.2f}')
    for r in report:
        print(r)


main()
