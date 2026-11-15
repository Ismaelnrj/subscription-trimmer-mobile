"""Assembles Part 2 of the story reel: he cancels the gym.

  python3 tools/reels/story/assemble-part2.py ext1.mp4 ext2.mp4 app-cancel.mp4 build/
  python3 tools/brand-video.py build/part2-captioned.mp4 --out build/part2-en.mp4 --lang en --no-bug

ext1 and ext2 are Seedance 2.5 forward extensions of the story reel's take B
(2328bdcc), so the same couple, room and voices carry over: ext1
`5f19b2c5-111d-4cdc-a04e-6099e675de6f` (10 s, 30 credits) and ext2
`181635ad-7313-4602-a1e6-7de30857b901` (8 s, 24 credits, extending ext1). A first
ext2 (`bc514b40-...`) was thrown away: she scowled and said "Lisbon?" into the
camera. The cut points and caption times below were measured from THESE takes'
audio (speech.py energy and pitch, then Whisper tiny.en through sherpa-onnx).

  picture  ext1 1.1-7.0 | the real app (Gym, Delete, "I cancelled it", the card) | ext2 2.6-7.8, held
  sound    ext1 1.1-7.0 | room tone | ext1 9.4-10.0 ("Done.") then ext2 0-7.8

The sound runs ahead of the picture: "Done." lands as the card appears and her
"359 euros?" plays over the card, so the picture returns to the sofa on "A
year." That hides her frown on the line, which even the retake kept.

ext1 opens on the tail of take B's jaw drop (him slumping forward), so the reel
starts at 1.1 s, once he has sat up. Between 7.0 and 9.4 he says "Done." too
early, so that stretch is never used. ext2 opens with a stray "Yeah." under the
card, muted. Room tone is a quiet second of ext1, joined with 0.15 s fades.
"""
import json, pathlib, subprocess, sys
from importlib import import_module
from PIL import Image, ImageDraw

REPO = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO / 'tools'))
cut = import_module('make-cut')
FF = cut.FFMPEG
if len(sys.argv) != 5:
    sys.exit('usage: assemble-part2.py ext1.mp4 ext2.mp4 app-cancel.mp4 outdir')
EXT1, EXT2, APP, OUT = (pathlib.Path(x) for x in sys.argv[1:])
OUT.mkdir(parents=True, exist_ok=True)
W, H = 1080, 1920

A_IN, A_OUT = 1.1, 7.0          # from him sitting up to the phone in his hand
APP_IN, CARD_AT = 0.6, 2.6      # app: just before the "..." tap; the card is up from 2.6 s
B_IN, EXT1_END = 9.4, 10.0      # sound: ext1's last 0.6 s carry "Done." (at 9.65)
PIC_BACK = 2.6                  # picture back on the sofa at ext2 2.6 s, before "A year."
B2_END, FREEZE = 7.8, 0.6       # ext2: end on them smiling at each other, then hold
MUTE = (0.35, 0.9)              # ext2's stray "Yeah." under the card
TONE = (8.0, 9.0)               # a quiet second of ext1, looped as room tone
DONE_AT = 9.65                  # "Done." starts 0.1 s after the card appears

# The app plays from APP_IN until the picture returns; the sound reaches "Done." as
# the card shows, so the room tone fills exactly the time before that.
INSERT_FRAMES = round(((CARD_AT - APP_IN) + 0.1 - (DONE_AT - B_IN) + (EXT1_END - B_IN) + PIC_BACK) * 30)
INSERT = INSERT_FRAMES / 30
TONE_LEN = INSERT - (EXT1_END - B_IN) - PIC_BACK
B_OFF = A_OUT - A_IN + TONE_LEN - B_IN     # output time of B's t = 0 (B time: ext1 t, or 10 + ext2 t)

# who: M left, F right. Times are ext1 seconds ('A') or B time ('B').
LINES = [
    ('A', 'M', 1.6, 3.3, "Fine. I'm cancelling the gym."),
    ('A', 'F', 3.3, 4.25, "You won't."),
    ('A', 'M', 4.25, 5.4, 'Give me the phone.'),
    ('B', 'M', 9.6, 10.5, 'Done.'),
    ('B', 'F', 10.95, 12.4, '359 euros?'),
    ('B', 'M', 12.95, 13.85, 'A year.'),
    ('B', 'F', 14.75, 16.2, 'So… Lisbon?'),
    ('B', 'M', 16.75, 17.75, 'Lisbon.'),
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


def main():
    up = f'scale={W}:{H}:flags=lanczos,unsharp=5:5:0.5:5:5:0,fps=30,setsar=1,format=yuv420p'
    a_len = A_OUT - A_IN
    b_pic = B2_END - PIC_BACK + FREEZE
    end = a_len + INSERT + b_pic
    # Picture: three parts, whole frames.
    run([FF, '-y', '-v', 'error', '-ss', str(A_IN), '-i', str(EXT1), '-t', f'{a_len:.3f}', '-an', '-vf',
         up + f',trim=end_frame={round(a_len * 30)}', '-c:v', 'libx264', '-crf', '17', str(OUT / 'a_v.mov')])
    hold = INSERT - (CARD_AT - APP_IN) + 1
    run([FF, '-y', '-v', 'error', '-i', str(APP), '-an', '-vf',
         f'setsar=1,trim={APP_IN},setpts=PTS-STARTPTS,fps=30,scale={W}:{H}:flags=lanczos,format=yuv420p,'
         f'tpad=stop_mode=clone:stop_duration={hold:.3f},trim=end_frame={INSERT_FRAMES}',
         '-c:v', 'libx264', '-crf', '17', str(OUT / 'app_v.mov')])
    run([FF, '-y', '-v', 'error', '-i', str(EXT2), '-an', '-vf',
         f'trim={PIC_BACK}:{B2_END},setpts=PTS-STARTPTS,{up},tpad=stop_mode=clone:stop_duration={FREEZE},trim=end_frame={round(b_pic * 30)}',
         '-c:v', 'libx264', '-crf', '17', str(OUT / 'b_v.mov')])
    run([FF, '-y', '-v', 'error', '-i', str(OUT / 'a_v.mov'), '-i', str(OUT / 'app_v.mov'), '-i', str(OUT / 'b_v.mov'),
         '-filter_complex', '[0:v][1:v][2:v]concat=n=3:v=1:a=0[v]', '-map', '[v]', '-c:v', 'libx264', '-crf', '17', str(OUT / 'pic.mov')])
    # Sound: ext1's real start, room tone, then "Done." and ext2, ahead of the picture.
    t0, t1 = TONE
    m0, m1 = MUTE
    b_snd = (EXT1_END - B_IN) + B2_END + FREEZE
    fa = (f'[0:a]atrim={A_IN}:{A_OUT},asetpts=PTS-STARTPTS,aresample=48000,afade=t=out:st={a_len - 0.15:.3f}:d=0.15[s1];'
          f'[0:a]atrim={t0}:{t1},asetpts=PTS-STARTPTS,aresample=48000,aloop=loop=8:size={int((t1 - t0) * 48000)},'
          f'atrim=0:{TONE_LEN:.4f},afade=t=in:d=0.15,afade=t=out:st={TONE_LEN - 0.15:.4f}:d=0.15[s2];'
          f'[0:a]atrim={B_IN}:{EXT1_END},asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:d=0.15[s3];'
          f"[1:a]atrim=0:{B2_END},asetpts=PTS-STARTPTS,aresample=48000,volume=enable='between(t,{m0},{m1})':volume=0[s4];"
          f'[s1][s2][s3][s4]concat=n=4:v=0:a=1,apad,atrim=0:{end:.4f},afade=t=out:st={end - 0.45:.4f}:d=0.45[out]')
    run([FF, '-y', '-v', 'error', '-i', str(EXT1), '-i', str(EXT2), '-filter_complex', fa, '-map', '[out]',
         '-c:a', 'pcm_s16le', str(OUT / 'snd.wav')])
    run([FF, '-y', '-v', 'error', '-i', str(OUT / 'pic.mov'), '-i', str(OUT / 'snd.wav'), '-map', '0:v', '-map', '1:a',
         '-c:v', 'copy', '-c:a', 'pcm_s16le', str(OUT / 'joined.mov')])
    assert abs(b_snd - (b_pic + INSERT - TONE_LEN)) < 1e-6, 'sound and picture lengths differ'

    inputs, chain, prev, report = [], [], '0:v', []
    for i, (seg, who, s, e, text) in enumerate(LINES, 1):
        dur = e - s
        cps = len(text) / dur
        assert dur >= MIN_DUR - 1e-9 and cps <= MAX_CPS, f'line {i} "{text}": {dur:.2f}s, {cps:.1f} cps'
        if seg == 'A':
            t0, t1 = s - A_IN, e - A_IN
            assert t0 >= 0 and t1 <= a_len + 1e-6, f'line {i} runs into the insert'
        else:
            t0, t1 = s + B_OFF, e + B_OFF
            assert t0 >= a_len - 1e-6, f'line {i} starts before the cut to the app'
            assert t1 <= end + 1e-6, f'line {i} outlasts the scene'
        p = OUT / f'cap{i:02d}.png'
        plate(text, who, i).save(p)
        inputs += ['-i', str(p)]
        chain.append(f"[{prev}][{i}:v]overlay=0:0:enable='between(t,{t0:.3f},{t1:.3f})'[c{i}]")
        prev = f'c{i}'
        report.append((round(t0, 2), round(t1, 2), who, text))
    run([FF, '-y', '-v', 'error', '-i', str(OUT / 'joined.mov'), *inputs, '-filter_complex', ';'.join(chain),
         '-map', f'[{prev}]', '-map', '0:a', '-c:v', 'libx264', '-crf', '17', '-preset', 'slow',
         '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', str(OUT / 'part2-captioned.mp4')])
    json.dump({'insert': INSERT, 'b_off': B_OFF, 'end': end, 'lines': report}, open(OUT / 'timeline.json', 'w'), indent=1)
    print(f'A 0-{a_len:.2f}  app {a_len:.2f}-{a_len + INSERT:.2f} (card from {a_len + CARD_AT - APP_IN:.2f})  '
          f'sofa {a_len + INSERT:.2f}-{end:.2f} (held {FREEZE}s)  room tone {TONE_LEN:.2f}s')
    for r in report:
        print(r)


main()
