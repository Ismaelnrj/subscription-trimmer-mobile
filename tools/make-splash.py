"""Draws assets/splash.png, the launch screen.

Android 12+ will only let the OS splash be an icon on a solid colour, so
this illustration is not the OS splash: it is drawn by AnimatedSplash
once the app mounts, which is why it can hold rings, a wordmark and a
wave at all. The OS splash is configured to the same warm white ground
with the navy mark, so the two frames read as one screen.
"""
import sys, math, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from PIL import Image, ImageDraw, ImageFont
from importlib import import_module
icons = import_module("make-icons")

W, H = 1284, 2778
GROUND    = (247, 246, 241)
NAVY      = (20, 43, 58)
MINT      = (85, 198, 163)
MINT_DEEP = (31, 122, 98)          # mint that can legally carry text
RING      = (214, 236, 228)
CHIP      = (223, 241, 234)
WAVE_1    = (223, 242, 235)
WAVE_2    = (206, 235, 224)
M = "/usr/share/fonts/opentype/montserrat/Montserrat-%s.otf"

S = 2                               # supersample
img = Image.new("RGBA", (W * S, H * S), GROUND + (255,))
d = ImageDraw.Draw(img)

CX, CY = W * S / 2, H * S * 0.388   # centre of the ring cluster and the mark
R_OUT = W * S * 0.34


def wave(y_frac, colour, amp, phase):
    pts, y0 = [], H * S * y_frac
    for i in range(0, W * S + 1, 8):
        t = i / (W * S)
        pts.append((i, y0 + math.sin(t * math.pi * 2 + phase) * amp
                        + math.sin(t * math.pi * 4 + phase) * amp * 0.35))
    d.polygon(pts + [(W * S, H * S), (0, H * S)], fill=colour)


def ring(r, width, colour, a0=0, a1=360):
    d.arc([CX - r, CY - r, CX + r, CY + r], a0, a1, fill=colour, width=width)


def chip(cx, cy, r, glyph):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=CHIP)
    w = max(2, int(r * 0.085))
    if glyph == "bell":
        d.arc([cx - r * .38, cy - r * .48, cx + r * .38, cy + r * .16], 180, 360, fill=NAVY, width=w)
        d.line([(cx - r * .38, cy - r * .16), (cx - r * .38, cy + r * .20)], fill=NAVY, width=w)
        d.line([(cx + r * .38, cy - r * .16), (cx + r * .38, cy + r * .20)], fill=NAVY, width=w)
        d.line([(cx - r * .50, cy + r * .20), (cx + r * .50, cy + r * .20)], fill=NAVY, width=w)
        d.arc([cx - r * .14, cy + r * .16, cx + r * .14, cy + r * .44], 0, 180, fill=NAVY, width=w)
    else:                                                   # calendar with a tick
        d.rounded_rectangle([cx - r * .45, cy - r * .38, cx + r * .45, cy + r * .46],
                            radius=r * .13, outline=NAVY, width=w)
        d.line([(cx - r * .45, cy - r * .13), (cx + r * .45, cy - r * .13)], fill=NAVY, width=w)
        for dx in (-.22, .22):
            d.line([(cx + r * dx, cy - r * .52), (cx + r * dx, cy - r * .30)], fill=NAVY, width=w)
        d.line([(cx - r * .18, cy + r * .14), (cx - r * .04, cy + r * .28), (cx + r * .22, cy - r * .01)],
               fill=NAVY, width=w, joint="curve")


def dot_offsets(font, word, letter="i"):
    """Finds each i-dot so it can be repainted mint: render the letter alone,
       and take the blob that sits above the gap."""
    probe = Image.new("L", (200, 300), 0)
    ImageDraw.Draw(probe).text((20, 40), letter, font=font, fill=255)
    rows = [y for y in range(300) if any(probe.getpixel((x, y)) > 100 for x in range(200))]
    gaps = [i for i in range(1, len(rows)) if rows[i] - rows[i - 1] > 3]
    if not gaps:
        return None
    top = rows[:gaps[0]]
    cols = [x for x in range(200) for y in top if probe.getpixel((x, y)) > 100]
    return ((min(cols) + max(cols)) / 2 - 20, (top[0] + top[-1]) / 2 - 40,
            (max(cols) - min(cols)) / 2 + 1)


def tracked_text(draw, xy, text, font, fill, tracking, anchor_centre=True, spans=None):
    widths = [draw.textlength(c, font=font) for c in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x = xy[0] - total / 2 if anchor_centre else xy[0]
    for i, c in enumerate(text):
        col = fill
        if spans:
            for a, b, f in spans:
                if a <= i < b:
                    col = f
        draw.text((x, xy[1]), c, font=font, fill=col)
        x += widths[i] + tracking
    return total


# --- the scene ---------------------------------------------------------
wave(0.855, WAVE_1, H * S * 0.020, 0.0)
wave(0.900, WAVE_2, H * S * 0.016, 2.2)

for f, wdt in ((1.00, 2), (0.82, 2), (0.63, 2)):
    ring(R_OUT * f, wdt * S, RING)
ring(R_OUT * 0.91, 3 * S, (198, 231, 219), 200, 320)
ring(R_OUT * 0.72, 3 * S, (198, 231, 219), 20, 120)

icons.draw_mark(img, CX, CY, H * S * 0.161, NAVY, MINT)
d = ImageDraw.Draw(img)

chip(CX - R_OUT * 0.80, CY - R_OUT * 0.60, R_OUT * 0.135, "bell")
chip(CX + R_OUT * 0.78, CY + R_OUT * 0.62, R_OUT * 0.135, "calendar")
for ang, rr in ((18, R_OUT * 1.00), (168, R_OUT * 0.82)):
    a = math.radians(ang)
    px, py = CX + rr * math.cos(a), CY + rr * math.sin(a)
    r = R_OUT * 0.026
    d.ellipse([px - r, py - r, px + r, py + r], fill=MINT)

word_font = ImageFont.truetype(M % "Medium", int(H * S * 0.062))
wy = H * S * 0.585
tw = d.textlength("Trimio", font=word_font)
d.text((W * S / 2 - tw / 2, wy), "Trimio", font=word_font, fill=NAVY)
off = dot_offsets(word_font, "Trimio")
if off:
    dx, dy, rr = off
    for idx in (2, 4):                                   # the two i's
        px = W * S / 2 - tw / 2 + d.textlength("Trimio"[:idx], font=word_font) + dx
        d.ellipse([px - rr, wy + dy - rr, px + rr, wy + dy + rr], fill=MINT)

tag_font = ImageFont.truetype(M % "SemiBold", int(H * S * 0.0148))
tag = "KNOW BEFORE YOU PAY."
tracked_text(d, (W * S / 2, H * S * 0.665), tag, tag_font, NAVY,
             tracking=H * S * 0.0042,
             spans=[(tag.index("BEFORE"), tag.index("BEFORE") + 6, MINT_DEEP)])

img.convert("RGB").resize((W, H), Image.LANCZOS).save("assets/splash.png")
print("wrote assets/splash.png", (W, H))

# The OS splash can only be an icon on a colour, so give it the navy mark
# on the same warm white ground: no colour flash into the screen above.
si = Image.new("RGBA", (1024 * 2, 1024 * 2), (0, 0, 0, 0))
icons.draw_mark(si, 1024, 1024, 1024 * 0.62, NAVY, MINT)
si.resize((1024, 1024), Image.LANCZOS).save("assets/splash-icon.png")
print("wrote assets/splash-icon.png")
