"""Assembles the English story reel: sofa take A, the real app, sofa take B.

  python3 tools/reels/story/assemble.py partA.mp4 partB.mp4 app.mp4 build/
  python3 tools/brand-video.py build/story-captioned.mp4 --out build/story-en.mp4 --lang en --no-bug

The cut points and caption times below belong to the takes f6b34188 (A) and
2328bdcc (B), measured from their audio. A finished (sharpened) take keeps
the performance, so they should still fit; re-measure if the voices move.

Audio is kept throughout. Under the app insert the sound is A's real tail, then
room tone taken from a quiet stretch of B, then B's real start, so the room
never drops to digital silence. Dialogue captions are burned in on a navy
plate, his on the left, hers on the right, timed to the measured speech.
"""
import pathlib, subprocess, sys, json
from importlib import import_module
from PIL import Image, ImageDraw

REPO = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO / 'tools'))
cut = import_module('make-cut')
FF = cut.FFMPEG
if len(sys.argv) != 5:
    sys.exit('usage: assemble.py takeA.mp4 takeB.mp4 app.mp4 outdir')
TAKE_A, TAKE_B, APP, OUT = (pathlib.Path(x) for x in sys.argv[1:])
OUT.mkdir(parents=True, exist_ok=True)
W, H = 1080, 1920

A_SRC, A_END = TAKE_A, 9.6          # cut as she lifts the phone
B_SRC, B_IN, B_END = TAKE_B, 2.2, 9.85  # back in as he leans over
# Take B ends with him gaping and half winking after "You said that in March"
# (9.9 to 10.4 s), which the owner rightly called weird. The scene stops at
# 9.85 on her knowing look and him staring ahead, and that frame holds while
# the room sound fades, long enough to read the line before the end card.
FREEZE = 0.6
APP_IN, APP_LIST_END, APP_END = 0.45, 6.95, 8.37     # form, search, save, list
APP_SPEED, HOLD = 1.5, 1.3                           # then dashboard at 1x, held
A_TAIL = 10.04 - A_END

seg1 = (APP_LIST_END - APP_IN) / APP_SPEED
INSERT_FRAMES = round((seg1 + (APP_END - APP_LIST_END) + HOLD) * 30)
INSERT = INSERT_FRAMES / 30   # whole frames, so sound and picture stay in step
TONE = INSERT - A_TAIL - B_IN
B_OFF = A_END + INSERT - B_IN        # output time of B's t=0

# Dialogue, timed to the measured speech (pitch track and energy, 0.1 s windows).
# who: M left, F right. Times are in the source take.
LINES = [
    ('A', 'M', 0.0, 1.4, 'We only pay for Netflix.'),
    ('A', 'F', 1.4, 2.6, 'And Spotify.'),
    ('A', 'M', 2.75, 3.9, '…and Spotify.'),
    ('A', 'F', 3.95, 6.6, 'And Disney.\nThe gym. Your Xbox.'),
    ('A', 'M', 7.4, 9.0, 'Okay. Five.'),
    ('B', 'M', 3.05, 4.0, 'A year?'),
    ('B', 'F', 4.0, 5.0, 'A year.'),
    ('B', 'F', 5.45, 7.2, 'So. The gym?'),
    ('B', 'M', 7.5, 8.9, 'I’m going tomorrow.'),
    ('B', 'F', 8.95, 10.45, 'You said that in March.'),
]
MAX_CPS, MIN_DUR = 17.5, 0.9


def run(args):
    p = subprocess.run(args, capture_output=True, text=True)
    if p.returncode:
        sys.exit('ffmpeg failed:\n' + p.stderr[-1500:])


def plate(text, who, idx):
    where = f'line {idx}'
    cut.check_copy(text.replace('\n', ' '), 'en', where)
    img = Image.new('RGBA', (W * cut.SS, H * cut.SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = W * 0.045
    left_edge, right_edge = W * cut.SIDE_MARGIN, W * cut.RIGHT_LIMIT
    limit = W * 0.62
    if '\n' in text:                  # a break chosen by sense, not by width
        f, lines = cut.font('SemiBold', 54), text.split('\n')
        assert max(d.textlength(l, font=f) for l in lines) <= limit * cut.SS, f'{where}: line too wide'
    else:
        f, lines = cut.typeset(d, text, 'SemiBold', 54, limit, W)
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
    run([FF, '-y', '-v', 'error', '-i', str(A_SRC), '-t', str(A_END), '-vf', up,
         '-af', 'aresample=48000', '-c:v', 'libx264', '-crf', '17', '-c:a', 'pcm_s16le', str(OUT / 'a.mov')])
    b_len = B_END - B_IN + FREEZE
    run([FF, '-y', '-v', 'error', '-ss', str(B_IN), '-i', str(B_SRC), '-t', f'{b_len:.3f}',
         '-vf', f'trim=0:{B_END - B_IN:.3f},' + up + f',tpad=stop_mode=clone:stop_duration={FREEZE},trim=end_frame={round(b_len * 30)}',
         '-af', f'aresample=48000,apad,atrim=0:{b_len:.3f},afade=t=out:st={b_len - 0.45:.3f}:d=0.45', '-c:v', 'libx264', '-crf', '17', '-c:a', 'pcm_s16le', str(OUT / 'b.mov')])
    # The app: form to list sped up, the dashboard at real speed, then held.
    fc = (f'[0:v]setsar=1,trim={APP_IN}:{APP_LIST_END},setpts=(PTS-STARTPTS)/{APP_SPEED}[s1];'
          f'[0:v]setsar=1,trim={APP_LIST_END}:{APP_END},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration={HOLD}[s2];'
          f'[s1][s2]concat=n=2:v=1:a=0,fps=30,setsar=1,format=yuv420p,tpad=stop_mode=clone:stop_duration=1,trim=end_frame={INSERT_FRAMES}[v]')
    run([FF, '-y', '-v', 'error', '-i', str(APP), '-filter_complex', fc, '-map', '[v]',
         '-c:v', 'libx264', '-crf', '17', str(OUT / 'app_v.mov')])
    # Sound under the insert: A's real tail, room tone from B's quiet lean, B's real start.
    fa = (f'[0:a]atrim={A_END}:10.04,asetpts=PTS-STARTPTS,aresample=48000[a1];'
          f'[1:a]atrim=0.6:2.4,asetpts=PTS-STARTPTS,aresample=48000,aloop=loop=3:size=86400,'
          f'atrim=0:{TONE + 0.3:.3f}[t];'
          f'[1:a]atrim=0:{B_IN},asetpts=PTS-STARTPTS,aresample=48000[b1];'
          f'[a1][t]acrossfade=d=0.15[x];[x][b1]acrossfade=d=0.15,apad,atrim=0:{INSERT:.4f}[out]')
    run([FF, '-y', '-v', 'error', '-i', str(A_SRC), '-i', str(B_SRC), '-filter_complex', fa,
         '-map', '[out]', '-c:a', 'pcm_s16le', str(OUT / 'app_a.wav')])
    run([FF, '-y', '-v', 'error', '-i', str(OUT / 'app_v.mov'), '-i', str(OUT / 'app_a.wav'),
         '-c:v', 'copy', '-c:a', 'pcm_s16le', str(OUT / 'app.mov')])
    run([FF, '-y', '-v', 'error', '-i', str(OUT / 'a.mov'), '-i', str(OUT / 'app.mov'), '-i', str(OUT / 'b.mov'),
         '-filter_complex', '[0:v][0:a][1:v][1:a][2:v][2:a]concat=n=3:v=1:a=1[v][a]',
         '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-crf', '17', '-c:a', 'pcm_s16le', str(OUT / 'joined.mov')])

    # Captions.
    inputs, chain, prev, report = [], [], '0:v', []
    for i, (take, who, s, e, text) in enumerate(LINES, 1):
        dur = e - s
        cps = len(text.replace('\n', ' ')) / dur
        assert dur >= MIN_DUR and cps <= MAX_CPS, f'line {i} "{text}": {dur:.2f}s, {cps:.1f} cps'
        off = 0 if take == 'A' else B_OFF
        t0, t1 = s + off, e + off
        if take == 'A':
            assert t1 <= A_END + 1e-6, f'line {i} runs into the insert'
        else:
            assert t0 >= A_END + INSERT - 1e-6, f'line {i} starts over the insert'
            assert e <= B_END + FREEZE + 1e-6, f'line {i} outlasts the scene'
        p = OUT / f'cap{i:02d}.png'
        plate(text, who, i).save(p)
        inputs += ['-i', str(p)]
        chain.append(f"[{prev}][{i}:v]overlay=0:0:enable='between(t,{t0:.3f},{t1:.3f})'[c{i}]")
        prev = f'c{i}'
        report.append((round(t0, 2), round(t1, 2), who, text))
    run([FF, '-y', '-v', 'error', '-i', str(OUT / 'joined.mov'), *inputs, '-filter_complex', ';'.join(chain),
         '-map', f'[{prev}]', '-map', '0:a', '-c:v', 'libx264', '-crf', '17', '-preset', 'slow',
         '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', str(OUT / 'story-captioned.mp4')])
    json.dump({'insert': INSERT, 'b_off': B_OFF, 'lines': report}, open(OUT / 'timeline.json', 'w'), indent=1)
    print(f'A 0-{A_END}  app {A_END}-{A_END + INSERT:.2f}  B {A_END + INSERT:.2f}-{B_OFF + B_END + FREEZE:.2f} (held {FREEZE}s)')
    for r in report:
        print(r)


main()
