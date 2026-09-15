#!/usr/bin/env python3
"""Renders a Trimio video cut from a JSON spec, with the brand rules enforced.

    python3 tools/make-cut.py cuts/monday-pain.json

Two kinds of scene, mixed freely in one cut:

  card     A full brand frame: the navy field, the mark, and one to three
           lines of type. No footage needed, which is what the Monday post
           and the Friday price beats actually are.
  footage  A clip from the phone, with a caption burned onto a navy plate
           and an optional slow push in.

WHY THIS EXISTS RATHER THAN A VIDEO EDITOR. Every rule below has already been
broken once by hand, and none of them is visible in a preview window at desk
size. A caption that clears the phone's own UI by 7px looks identical to one
that clears it by 60. Mint behind white text looks fine and measures 2.1:1.
A line held 0.4s short reads fine to someone who already knows what it says.
So the checks run before a frame is rendered and they fail the build, rather
than producing a file that looks right and is not.

WHAT IT DELIBERATELY DOES NOT DO. It does not generate footage, voice, or
music. Trimio's whole shot list is the owner's real phone and the owner's real
voice, and the Sunday post's lack of production is the point of the Sunday
post. A tool that made it easy to fake those would be a tool for making the
wrong video faster.
"""
import json
import pathlib
import re
import subprocess
import sys
from importlib import import_module

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from PIL import Image, ImageDraw, ImageFont

icons = import_module("make-icons")

try:
    import imageio_ffmpeg
    FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:                                  # a system ffmpeg is fine too
    FFMPEG = "ffmpeg"

M = "/usr/share/fonts/opentype/montserrat/Montserrat-%s.otf"
SS = 2                                             # supersample for type

FORMATS = {"9:16": (1080, 1920), "16:9": (1920, 1080), "1:1": (1080, 1080)}
FPS = 30

PAPER = (247, 246, 241)
MINT = (85, 198, 163)
MINT_DEEP = (31, 122, 98)
DIM = (169, 184, 194)
NAVY = (20, 43, 58)

# --- the rules, as numbers -------------------------------------------------
# Shorts, Reels and TikTok all paint their own UI over roughly the bottom 20%
# and right 15% of a vertical frame. Type outside this box is type the platform
# is entitled to cover, and it will.
BAND_TOP, BAND_BOTTOM = 0.25, 0.75
RIGHT_LIMIT = 0.85
SIDE_MARGIN = 0.083                                # ~90px at 1080 wide
# "Hold each line long enough to read twice." Measured at roughly a second per
# five words, and the most common mistake is cutting a second early.
SECONDS_PER_WORD = 2 / 5
MIN_HOLD = 1.2


class CutError(Exception):
    pass


def font(weight, size):
    return ImageFont.truetype(M % weight, int(size * SS))


# --- validation ------------------------------------------------------------

DASH = re.compile(r"[–—]|\s-\s")
DECIMAL_POINT = re.compile(r"\b\d+\.\d\d\b")
BANNED = re.compile(r"app\s*store|apple", re.I)


def check_copy(text, lang, where):
    """The store's copy rules, applied to a caption. Same rules, same reasons.

    The decimal check is not pedantry: 15.99 reads to a German eye as a
    thousands separator, and it is the single clearest tell that a caption was
    translated rather than written."""
    if DASH.search(text):
        raise CutError(f"{where}: dash used as clause punctuation in {text!r}. "
                       f"Use a colon, comma or period.")
    if BANNED.search(text):
        raise CutError(f"{where}: {text!r} names Apple or the App Store. "
                       f"There is no iOS build.")
    if lang == "de" and DECIMAL_POINT.search(text):
        raise CutError(f"{where}: {text!r} uses a decimal point. German writes "
                       f"a comma: 15,99 €.")


def check_hold(text, dur, where):
    need = max(MIN_HOLD, len(text.split()) * SECONDS_PER_WORD)
    if dur + 1e-6 < need:
        raise CutError(f"{where}: {dur}s is too short to read {len(text.split())} "
                       f"words twice. Needs {need:.1f}s.")


def luminance(c):
    def ch(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2])


def contrast(fg, bg):
    a, b = luminance(fg), luminance(bg)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


def check_contrast(fg, bg, where, floor=4.5):
    r = contrast(fg, bg)
    if r < floor:
        raise CutError(f"{where}: {r:.2f}:1 is under the {floor}:1 floor. "
                       f"Soft Mint behind white lands here every time: it looks "
                       f"fine and measures about 2:1. Use navy behind white, or "
                       f"#1F7A62 for type that has to read as mint.")


def check_band(top, bottom, H, where):
    if top < BAND_TOP * H or bottom > BAND_BOTTOM * H:
        raise CutError(
            f"{where}: type spans {top:.0f}..{bottom:.0f}px of {H}, outside the "
            f"{BAND_TOP:.0%}..{BAND_BOTTOM:.0%} caption band "
            f"({BAND_TOP * H:.0f}..{BAND_BOTTOM * H:.0f}). The platform paints "
            f"its own UI there. Shorten the text or drop a line.")


# --- drawing ---------------------------------------------------------------

def ground(W, H):
    """The brand field at an arbitrary aspect, from the square generator."""
    g = icons.ground(max(W, H))
    return g.crop(((g.width - W) // 2, 0, (g.width - W) // 2 + W, H))


def wrap(d, text, f, limit):
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if d.textlength(trial, font=f) <= limit * SS or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def balanced(d, text, f, limit):
    """Greedy wrapping leaves orphans: "Du zahlst für sieben / Abos." puts one
    short word on its own line and reads as a mistake at phone size. Once the
    line count is fixed, squeezing the limit down as far as it will go without
    adding a line spreads the words evenly instead, which costs nothing and is
    the difference between a caption that looks typeset and one that looks
    wrapped."""
    lines = wrap(d, text, f, limit)
    if len(lines) < 2:
        return lines
    lo, hi = 0.35, 1.0
    for _ in range(18):
        mid = (lo + hi) / 2
        if len(wrap(d, text, f, limit * mid)) <= len(lines):
            hi = mid
        else:
            lo = mid
    return wrap(d, text, f, limit * hi)


def typeset(d, text, weight, size, limit, W):
    """Largest size at or below `size` whose longest line clears `limit`."""
    while size > 12:
        f = font(weight, size)
        lines = balanced(d, text, f, limit)
        if max(d.textlength(l, font=f) for l in lines) <= limit * SS:
            return f, lines
        size -= 2
    raise CutError(f"{text!r} will not fit in {limit:.0f}px at any readable size.")


def render_card(scene, fmt, lang, idx):
    W, H = fmt
    text = " ".join(scene["lines"]) if isinstance(scene.get("lines"), list) \
        else scene["text"]
    where = f"scene {idx} (card)"
    check_copy(text, lang, where)
    check_hold(text, scene["dur"], where)

    img = ground(W * SS, H * SS)
    d = ImageDraw.Draw(img)

    left = W * SIDE_MARGIN
    limit = W * RIGHT_LIMIT - left
    weight = "ExtraBold" if scene.get("emphasis") else "SemiBold"
    base = scene.get("size", 76 if scene.get("emphasis") else 64)
    f, lines = typeset(d, text, weight, base, limit, W)

    fill = {"paper": PAPER, "mint": MINT, "dim": DIM}[scene.get("fill", "paper")]
    # Type sits on the navy field, so this is measured against the field, not
    # against an assumed background.
    check_contrast(fill, img.getpixel((int(W * SS / 2), int(H * SS / 2)))[:3], where)

    lh = f.size * 1.28
    block = lh * len(lines)
    top = (H * SS - block) / 2
    check_band(top / SS, (top + block) / SS, H, where)

    for i, line in enumerate(lines):
        d.text((left * SS, top + i * lh), line, font=f, fill=fill)

    if scene.get("mark", True):
        mh = H * 0.035
        icons.draw_mark(img, left * SS + (icons.MARK_W / icons.MARK_H * mh) * SS / 2,
                        H * SS * 0.14, mh * SS, PAPER, MINT)
    return img.convert("RGB").resize((W, H), Image.LANCZOS)


def render_endcard(scene, fmt, lang, idx):
    """The last two seconds: mark, wordmark, one line of call to action.

    A brand card is the one place the mark leads, so it is not the small
    corner watermark the caption cards carry. The call to action stays Dim
    rather than Mint: mint type on this field measures fine, but the eye
    should land on the name, and a mint line of the same size competes."""
    W, H = fmt
    cta = scene.get("cta", "Kostenlos bei Google Play")
    where = f"scene {idx} (endcard)"
    check_copy(cta, lang, where)
    check_hold(cta, scene["dur"], where)

    img = ground(W * SS, H * SS)
    mh = H * 0.13
    icons.draw_mark(img, W * SS / 2, (H * 0.42) * SS, mh * SS, PAPER,
                    (icons.TRI_TOP, icons.TRI_BOT))
    d = ImageDraw.Draw(img)

    # Positions come from the real glyph bounds, not from fractions of the
    # frame. Guessed fractions put the mint rule straight through the wordmark
    # on the first attempt, because a font's em box is taller than its caps and
    # the gap between the two is not a constant you can eyeball once.
    cx = W * SS / 2
    nf = font("ExtraBold", 84)
    nb = d.textbbox((0, 0), "Trimio", font=nf)
    ny = (H * 0.50) * SS
    d.text((cx - (nb[2] - nb[0]) / 2 - nb[0], ny - nb[1]), "Trimio",
           font=nf, fill=PAPER)
    name_bottom = ny + (nb[3] - nb[1])

    rule_y = name_bottom + 30 * SS
    d.line([(cx - 46 * SS, rule_y), (cx + 46 * SS, rule_y)],
           fill=MINT, width=5 * SS)

    cf = font("Medium", 40)
    cb = d.textbbox((0, 0), cta, font=cf)
    cy = rule_y + 34 * SS
    d.text((cx - (cb[2] - cb[0]) / 2 - cb[0], cy - cb[1]), cta, font=cf, fill=DIM)

    check_contrast(DIM, img.getpixel((int(cx), int(cy)))[:3], where)
    check_band(H * 0.42 - mh / 2, (cy + (cb[3] - cb[1])) / SS, H, where)
    return img.convert("RGB").resize((W, H), Image.LANCZOS)


def render_caption_plate(scene, fmt, lang, idx):
    """A transparent overlay: white type on a navy plate, for use over footage.

    The plate is not decoration. White type straight onto app footage has
    whatever contrast the frame underneath happens to give it, which changes
    every frame and is unmeasurable. A navy plate makes it 15.9:1 and keeps it
    there."""
    W, H = fmt
    text = scene["caption"]
    where = f"scene {idx} (footage caption)"
    check_copy(text, lang, where)
    check_hold(text, scene["dur"], where)

    img = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    left = W * SIDE_MARGIN
    pad = W * 0.045
    limit = W * RIGHT_LIMIT - left - 2 * pad
    f, lines = typeset(d, text, "SemiBold", scene.get("size", 54), limit, W)
    check_contrast(PAPER, NAVY, where)

    lh = f.size * 1.3
    block = lh * len(lines)
    widest = max(d.textlength(l, font=f) for l in lines)
    anchor = scene.get("anchor", 0.62)             # inside the band by default
    top = H * SS * anchor - block / 2

    box = [left * SS, top - pad * SS,
           left * SS + widest + 2 * pad * SS, top + block + pad * SS]
    check_band(box[1] / SS, box[3] / SS, H, where)
    d.rounded_rectangle(box, radius=int(W * 0.022 * SS), fill=NAVY + (240,))
    for i, line in enumerate(lines):
        d.text((left * SS + pad * SS, top + i * lh), line, font=f, fill=PAPER)

    return img.resize((W, H), Image.LANCZOS)


# --- assembly --------------------------------------------------------------

def run(args):
    p = subprocess.run(args, capture_output=True, text=True)
    if p.returncode:
        raise CutError(f"ffmpeg failed:\n{p.stderr[-2000:]}")
    return p


def build(spec_path):
    spec = json.loads(pathlib.Path(spec_path).read_text("utf-8"))
    fmt = FORMATS[spec.get("format", "9:16")]
    lang = spec.get("lang", "de")
    W, H = fmt
    work = pathlib.Path(spec.get("workdir", "build/cut")) / spec["name"]
    work.mkdir(parents=True, exist_ok=True)
    out = pathlib.Path(spec.get("out", f"build/{spec['name']}.mp4"))
    out.parent.mkdir(parents=True, exist_ok=True)

    segments = []
    for i, sc in enumerate(spec["scenes"]):
        seg = work / f"{i:02d}.mp4"
        if sc["type"] in ("card", "endcard"):
            png = work / f"{i:02d}.png"
            draw = render_endcard if sc["type"] == "endcard" else render_card
            draw(sc, fmt, lang, i).save(png)
            run([FFMPEG, "-y", "-loop", "1", "-i", str(png), "-t", str(sc["dur"]),
                 "-r", str(FPS), "-c:v", "libx264", "-preset", "slow", "-crf", "17",
                 "-pix_fmt", "yuv420p", str(seg)])
        elif sc["type"] == "footage":
            src = sc["src"]
            if not pathlib.Path(src).exists():
                raise CutError(f"scene {i}: {src} not found.")
            png = work / f"{i:02d}.png"
            render_caption_plate(sc, fmt, lang, i).save(png)
            # cover-fit to the frame, then an optional slow push. The push runs
            # on a 2x intermediate because zoompan steps in whole source pixels
            # and visibly judders otherwise.
            push = sc.get("push", 1.0)
            vf = (f"scale={W*2}:{H*2}:force_original_aspect_ratio=increase,"
                  f"crop={W*2}:{H*2},")
            if push > 1.0:
                frames = max(1, int(sc["dur"] * FPS))
                vf += (f"zoompan=z='min(zoom+{(push-1)/frames:.6f},{push})':d=1:"
                       f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
                       f"s={W}x{H}:fps={FPS},")
            else:
                vf += f"scale={W}:{H},"
            vf += "format=yuv420p"
            run([FFMPEG, "-y", "-ss", str(sc.get("in", 0)), "-t", str(sc["dur"]),
                 "-i", src, "-i", str(png),
                 "-filter_complex", f"[0:v]{vf}[v];[v][1:v]overlay=0:0[o]",
                 "-map", "[o]", "-an", "-r", str(FPS),
                 "-c:v", "libx264", "-preset", "slow", "-crf", "18",
                 "-pix_fmt", "yuv420p", str(seg)])
        else:
            raise CutError(f"scene {i}: unknown type {sc['type']!r}")
        segments.append(seg)

    lst = work / "concat.txt"
    lst.write_text("".join(f"file '{s.resolve()}'\n" for s in segments))
    # H.264 High, yuv420p, faststart. The existing promo exports are mpeg4,
    # which every platform re-encodes on upload and which costs a generation of
    # quality for nothing.
    run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", str(lst),
         "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-profile:v", "high",
         "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-r", str(FPS),
         str(out)])

    dur = sum(s["dur"] for s in spec["scenes"])
    print(f"wrote {out}  {W}x{H}  {dur:.1f}s  {len(segments)} scenes  H.264")
    return out


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    try:
        build(sys.argv[1])
    except CutError as e:
        print(f"\n  REFUSED: {e}\n", file=sys.stderr)
        sys.exit(1)
