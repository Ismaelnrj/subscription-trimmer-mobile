"""Puts the Trimio mark onto a finished video, without a model ever drawing it.

WHY THIS EXISTS. Generated video must never render the mark or the app screen.
Every model smears text, and the mark has already drifted into an inverted
Pac-Man twice when anything tried to redraw it from description. A UGC tool like
Zeely cannot be told "use exactly these pixels" either: asked for a logo it
invents one, which in the 2026-09-18 English render came out as an embroidered
sweater patch with the mint triangle crossing into the chevron's notch.

So the mark is never generated. It is composited afterwards from the same masks
every other Trimio surface uses, through `make-icons.draw_mark`, which scales
and tints `tools/mark-chevron.png` and `tools/mark-triangle.png` rather than
redrawing an outline.

WHY NOT make-cut.py. That pipeline passes `-an` to every scene and its concat
carries no audio stream at all, because it was built for silent screen
recordings with burned captions. Run a talking head through it and the captions
land correctly and the voiceover disappears, which is the entire content. This
keeps the audio and appends a silent tail for the end card.

WHAT IT ADDS, either or both:
  a corner bug   the mark on a small navy plate, top left
  an end card    mark, wordmark, one call to action, from make-cut's renderer

TOP LEFT IS NOT AN AESTHETIC CHOICE. Shorts, Reels and TikTok paint their own UI
over roughly the bottom 20% and right 15% of a vertical frame, so those are the
two places a watermark must not go. Top left is what is left.

  python3 tools/brand-video.py in.mp4 --out build/out.mp4 --lang en
  python3 tools/brand-video.py in.mp4 --no-endcard          # corner bug only
  python3 tools/brand-video.py in.mp4 --no-bug --cta "..."  # end card only
"""
import argparse
import pathlib
import subprocess
import sys
import tempfile
from importlib import import_module

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from PIL import Image, ImageDraw

cut = import_module("make-cut")
icons = import_module("make-icons")

FFMPEG = cut.FFMPEG
FPS = cut.FPS
SS = cut.SS
NAVY = cut.NAVY
PAPER = cut.PAPER

# The two strips the platform is entitled to cover, from make-cut's own numbers.
BUG_MARGIN = 0.055          # of frame width, from the left and top edges
BUG_HEIGHT = 0.052          # of frame height, the plate


def render_bug(W, H):
    """The mark on a navy plate, top left, as a transparent overlay.

    The plate is the same reasoning as the caption plate in make-cut: the mark
    in warm white straight onto footage has whatever contrast the frame
    underneath happens to give it, which changes every frame and is
    unmeasurable. A bright kitchen makes a warm white mark vanish entirely."""
    img = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    plate_h = H * BUG_HEIGHT
    mark_h = plate_h * 0.56
    mark_w = icons.MARK_W / icons.MARK_H * mark_h
    pad = plate_h * 0.30
    plate_w = mark_w + 2 * pad

    x0, y0 = W * BUG_MARGIN, H * BUG_MARGIN
    d.rounded_rectangle([x0 * SS, y0 * SS, (x0 + plate_w) * SS, (y0 + plate_h) * SS],
                        radius=int(plate_h * 0.26 * SS), fill=NAVY + (235,))
    icons.draw_mark(img, (x0 + plate_w / 2) * SS, (y0 + plate_h / 2) * SS,
                    mark_h * SS, PAPER, (icons.TRI_TOP, icons.TRI_BOT))

    # Warm white on the navy plate, measured rather than assumed. Same floor the
    # captions are held to.
    cut.check_contrast(PAPER, NAVY, "corner bug")
    return img.resize((W, H), Image.LANCZOS)


def probe_audio(src):
    """Whether the input actually carries sound.

    Worth asking rather than assuming: this tool exists because the other
    pipeline silently dropped audio, and a branch that assumed audio would fail
    the same way in reverse on a clip that has none."""
    p = subprocess.run([FFMPEG, "-i", str(src)], capture_output=True, text=True)
    return "Audio:" in p.stderr


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src")
    ap.add_argument("--out")
    ap.add_argument("--lang", default="en", choices=["en", "de"])
    ap.add_argument("--cta", help="end card line; defaults per language")
    ap.add_argument("--endcard-seconds", type=float, default=2.6)
    ap.add_argument("--no-bug", action="store_true")
    ap.add_argument("--no-endcard", action="store_true")
    a = ap.parse_args()

    src = pathlib.Path(a.src)
    if not src.exists():
        print(f"REFUSED: {src} not found.", file=sys.stderr)
        return 2
    if a.no_bug and a.no_endcard:
        print("REFUSED: nothing to add. Drop one of the two flags.", file=sys.stderr)
        return 2

    out = pathlib.Path(a.out or f"build/{src.stem}-branded.mp4")
    out.parent.mkdir(parents=True, exist_ok=True)
    cta = a.cta or ("Free on Google Play" if a.lang == "en" else "Kostenlos bei Google Play")

    W, H = cut.FORMATS["9:16"]
    has_audio = probe_audio(src)

    with tempfile.TemporaryDirectory() as tmp:
        d = pathlib.Path(tmp)
        inputs, filters, n = ["-i", str(src)], [], 1

        v = f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase," \
            f"crop={W}:{H},fps={FPS},setsar=1[v0]"
        filters.append(v)
        last = "v0"

        if not a.no_bug:
            bug = d / "bug.png"
            render_bug(W, H).save(bug)
            inputs += ["-i", str(bug)]
            filters.append(f"[{last}][{n}:v]overlay=0:0[vb]")
            last, n = "vb", n + 1

        if a.no_endcard:
            filters.append(f"[{last}]null[v]")
            maps = ["-map", "[v]"] + (["-map", "0:a"] if has_audio else [])
        else:
            card = d / "endcard.png"
            # Rendered by make-cut, so the copy rules, the contrast floor and
            # the caption band are all enforced by the same code that guards
            # every other Trimio cut. A bad CTA raises here, before ffmpeg runs.
            cut.render_endcard({"dur": a.endcard_seconds, "cta": cta},
                               (W, H), a.lang, "endcard").save(card)
            inputs += ["-loop", "1", "-t", str(a.endcard_seconds), "-i", str(card)]
            card_idx = n
            n += 1
            filters.append(f"[{card_idx}:v]scale={W}:{H},fps={FPS},setsar=1,"
                           f"format=yuv420p[vc]")
            if has_audio:
                # The tail needs a matching silent track or concat drops audio
                # from the whole output rather than just the tail.
                inputs += ["-f", "lavfi", "-t", str(a.endcard_seconds),
                           "-i", "anullsrc=r=44100:cl=stereo"]
                filters.append(f"[{last}][0:a][vc][{n}:a]concat=n=2:v=1:a=1[v][a]")
                maps = ["-map", "[v]", "-map", "[a]"]
            else:
                filters.append(f"[{last}][vc]concat=n=2:v=1:a=0[v]")
                maps = ["-map", "[v]"]

        cmd = ([FFMPEG, "-y"] + inputs +
               ["-filter_complex", ";".join(filters)] + maps +
               ["-c:v", "libx264", "-preset", "slow", "-crf", "18",
                "-profile:v", "high", "-pix_fmt", "yuv420p",
                "-movflags", "+faststart", "-r", str(FPS)] +
               (["-c:a", "aac", "-b:a", "192k"] if has_audio else []) +
               [str(out)])
        p = subprocess.run(cmd, capture_output=True, text=True)
        if p.returncode:
            print(f"REFUSED: ffmpeg failed\n{p.stderr[-1500:]}", file=sys.stderr)
            return 1

    added = ", ".join(x for x in [None if a.no_bug else "corner bug",
                                  None if a.no_endcard else "end card"] if x)
    print(f"wrote {out}  {W}x{H}  {added}  audio {'kept' if has_audio else 'none in source'}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except cut.CutError as e:
        print(f"\n  REFUSED: {e}\n", file=sys.stderr)
        sys.exit(1)
