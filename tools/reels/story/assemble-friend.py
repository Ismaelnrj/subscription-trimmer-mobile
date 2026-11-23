"""Assembles "The friend": the friend who has no subscriptions.

  python3 tools/reels/story/assemble-friend.py take.mp4 <dashboard still> build/
  python3 tools/brand-video.py build/friend-captioned.mp4 --out build/friend-en.mp4 --lang en --no-bug

The first of the "one new friend at a time" reels (owner, 2026-11-23: "create the
one with the new character!"). The customer's problem is the subject: people
think they have fewer subscriptions than they pay for. The couple's sofa, a new
friend in the armchair, ONE Seedance 2.5 omni_reference take (12 s) from a new
start frame; the friend's five lines were revoiced (Higgsfield voice_change,
preset "Benji") and spliced back over his spans only, because the model gave him
the bearded man's voice (README item 43). The app is the last beat: one held
still of the real dashboard for his four rows, "€825.96 a year for 4 active
subscriptions", with the callback caption.

  picture  take 0-end, held on the couple's look | the dashboard, held, pushed in 8% on the year line
  sound    the take, then its own room tone under the still
"""
import json, pathlib, subprocess, sys
from importlib import import_module
from PIL import Image, ImageDraw

REPO = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO / 'tools'))
cut = import_module('make-cut')
FF = cut.FFMPEG
if len(sys.argv) != 4:
    sys.exit('usage: assemble-friend.py take.mp4 dashboard.png outdir')
TAKE, STILL, OUT = (pathlib.Path(x) for x in sys.argv[1:])
OUT.mkdir(parents=True, exist_ok=True)
W, H, FPS = 1080, 1920, 30

HEAD_S = 0.35          # his line starts at 0.57 in the take; cut so it starts at 0.22
# Everything below is in seconds of the TRIMMED take, which are also output seconds.
TAKE_F = 348           # the whole take after the trim: his line, the quiz, "That's a book.", their look
STILL_F = 72           # the dashboard, 2.4 s, pushed in 8% on the year line
END_F, FREEZE_F = TAKE_F, 0
A_END_F = TAKE_F
END = (TAKE_F + STILL_F) / FPS

# who: F is the friend (armchair, right), M and W the couple (sofa, left). Measured with
# Whisper small.en, who-speaks.py and a mouth sheet. "Yes." is one word, so its floor is
# 0.6 s rather than 0.9. The first plate drops "any" and "I'm" to stay under 17.5 cps.
LINES = [
    ('F', 0.00, 2.54, "I don't have subscriptions. Good with money.", 0.62),
    ('M', 2.55, 3.68, 'Netflix?', 0.62),
    ('F', 3.70, 4.32, 'Yes.', 0.62),
    ('M', 4.34, 5.33, 'Spotify?', 0.62),
    ('F', 5.35, 6.27, 'Yes.', 0.62),
    ('M', 6.29, 7.55, 'The gym?', 0.62),
    ('F', 7.57, 8.53, 'Yes.', 0.62),
    ('M', 8.54, 9.45, 'Audible?', 0.62),
    ('F', 9.46, 10.90, "That's a book.", 0.62),
    ('F', TAKE_F / FPS + 0.15, END, '\u201cNo subscriptions.\u201d', 0.345),
]
MAX_CPS, MIN_DUR = 17.5, 0.6


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

    piece('e1', 0, TAKE_F)
    # The dashboard fitted to the width, pushed 8% about the year line (0.28 of the still, 0.37 across: the most
    # that keeps both the left aligned total and the right aligned prices in frame),
    # which stays put while the rows below grow; the callback plate sits between the year
    # line and "Upcoming".
    still = Image.open(STILL).convert('RGB')
    fit = W / still.width
    anchored_push(still, STILL_F, OUT / 'held', fit, (0.37 * still.width, 0.28 * still.height), 0.08)
    run([FF, '-y', '-v', 'error', '-framerate', str(FPS), '-i', str(OUT / 'held' / '%04d.png'),
         '-vf', 'format=yuv420p', *enc, str(OUT / 'held.mov')])
    parts = ['e1', 'held']
    ins = sum((['-i', str(OUT / f'{p}.mov')] for p in parts), [])
    run([FF, '-y', '-v', 'error', *ins, '-filter_complex',
         ''.join(f'[{i}:v]' for i in range(len(parts))) + f'concat=n={len(parts)}:v=1:a=0[v]',
         '-map', '[v]', *enc, str(OUT / 'pic.mov')])
    T = TAKE_F / FPS
    fa = (f'[0:a]atrim=0:{T:.4f},asetpts=PTS-STARTPTS,aresample=48000[a];'
          f'[0:a]atrim={T - 0.6:.4f}:{T:.4f},asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:d=0.05,'
          f'afade=t=out:st=0.55:d=0.05,aloop=loop=5:size=28800[r];'
          f'[a][r]concat=n=2:v=0:a=1,atrim=0:{END:.4f},afade=t=out:st={END - 0.6:.4f}:d=0.6[out]')
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
         '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', str(OUT / 'friend-captioned.mp4')])
    json.dump({'end': END, 'lines': report}, open(OUT / 'timeline.json', 'w'), indent=1)
    print(f'take 0-{TAKE_F / FPS:.2f}  held -{END:.2f}')
    for r in report:
        print(r)


main()
