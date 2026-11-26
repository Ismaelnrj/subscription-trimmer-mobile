"""Draws assets/splash.png, the launch screen.

Android 12+ will only let the OS splash be an icon on a solid colour, so
this illustration is not the OS splash: it is drawn by AnimatedSplash
once the app mounts, which is why it can hold rings, a wordmark and a
wave at all. The app draws it from the layers this script also writes,
on the ground of the OS splash the phone's build carries (app.json
splash.backgroundColor: the light grey from build 42, warm white before).
GROUND below only colours the flat reference picture, which the app no
longer loads.
"""
import sys, math, json, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from PIL import Image, ImageDraw, ImageFont
from importlib import import_module
icons = import_module("make-icons")
import fontpath

W, H = 1284, 2778
GROUND    = (247, 246, 241)
NAVY      = (20, 43, 58)
MINT      = (85, 198, 163)
MINT_DEEP = (31, 122, 98)          # mint that can legally carry text
RING      = (214, 236, 228)
CHIP      = (223, 241, 234)
WAVE_1    = (223, 242, 235)
WAVE_2    = (206, 235, 224)

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
# One function per element, so the flat launch screen and the separate
# layers AnimatedSplash moves come from the same drawing code. Order is
# paint order.

def on(canvas):
    global d
    d = ImageDraw.Draw(canvas)


def draw_dots(c):
    for ang, rr in ((18, R_OUT * 1.00), (168, R_OUT * 0.82)):
        a = math.radians(ang)
        px, py = CX + rr * math.cos(a), CY + rr * math.sin(a)
        r = R_OUT * 0.026
        d.ellipse([px - r, py - r, px + r, py + r], fill=MINT)


def draw_word(c):
    word_font = ImageFont.truetype(fontpath.montserrat("Medium"), int(H * S * 0.062))
    wy = H * S * 0.585
    tw = d.textlength("Trimio", font=word_font)
    d.text((W * S / 2 - tw / 2, wy), "Trimio", font=word_font, fill=NAVY)
    off = dot_offsets(word_font, "Trimio")
    if off:
        dx, dy, rr = off
        for idx in (2, 4):                                   # the two i's
            px = W * S / 2 - tw / 2 + d.textlength("Trimio"[:idx], font=word_font) + dx
            d.ellipse([px - rr, wy + dy - rr, px + rr, wy + dy + rr], fill=MINT)


def draw_tag(c):
    tag_font = ImageFont.truetype(fontpath.montserrat("SemiBold"), int(H * S * 0.0148))
    tag = "KNOW BEFORE YOU PAY."
    tracked_text(d, (W * S / 2, H * S * 0.665), tag, tag_font, NAVY,
                 tracking=H * S * 0.0042,
                 spans=[(tag.index("BEFORE"), tag.index("BEFORE") + 6, MINT_DEEP)])


PARTS = [
    ("wave_back",  lambda c: wave(0.855, WAVE_1, H * S * 0.020, 0.0)),
    ("wave_front", lambda c: wave(0.900, WAVE_2, H * S * 0.016, 2.2)),
    ("ring_outer", lambda c: ring(R_OUT * 1.00, 2 * S, RING)),
    ("ring_mid",   lambda c: ring(R_OUT * 0.82, 2 * S, RING)),
    ("ring_inner", lambda c: ring(R_OUT * 0.63, 2 * S, RING)),
    ("arcs",       lambda c: (ring(R_OUT * 0.91, 3 * S, (198, 231, 219), 200, 320),
                              ring(R_OUT * 0.72, 3 * S, (198, 231, 219), 20, 120))),
    ("mark",       lambda c: icons.draw_mark(c, CX, CY, H * S * 0.161, NAVY, MINT)),
    ("bell",       lambda c: chip(CX - R_OUT * 0.80, CY - R_OUT * 0.60, R_OUT * 0.135, "bell")),
    ("calendar",   lambda c: chip(CX + R_OUT * 0.78, CY + R_OUT * 0.62, R_OUT * 0.135, "calendar")),
    ("dots",       draw_dots),
    ("word",       draw_word),
    ("tag",        draw_tag),
]

for _, part in PARTS:
    on(img)
    part(img)

img.convert("RGB").resize((W, H), Image.LANCZOS).save("assets/splash.png")
print("wrote assets/splash.png", (W, H))

# The same parts on transparent canvases, cropped, for AnimatedSplash to
# move one by one. layout.json holds each crop box in the 1284 x 2778
# canvas, so the app can place them with the same cover scaling the flat
# image used. A premultiplied box average, not Lanczos: Lanczos rings, and
# on a transparent layer the ringing clips into a halo round thin lines.
layers = pathlib.Path("assets/splash-layers")
CENTRED = {"ring_outer", "ring_mid", "ring_inner", "arcs", "mark"}
# A transparent margin round every crop. A phone lays each layer out in whole
# pixels, and a crop cut tight to the ink lost ink to that rounding: on the
# owner's phone, 2026-11-26, the tagline showed "<NOW BEFORE YOU PAY" with no
# K stem and no full stop. Clamped at the canvas edge, where the waves sit.
PAD = 8
layers.mkdir(exist_ok=True)
layout = {"canvas": [W, H], "centre": [round(CX / S, 1), round(CY / S, 1)],
          "markHeight": round(H * 0.161, 1), "pad": PAD, "layers": {}}
for name, part in PARTS:
    c = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    on(c)
    part(c)
    small = c.convert("RGBa").reduce(S).convert("RGBA")
    box = small.getchannel("A").getbbox()
    if name in CENTRED:
        # Square on the ring centre, so a layer scaled or turned about its
        # own middle turns about the mark, which is what the app does.
        cx, cy = CX / S, CY / S
        hw = math.ceil(max(cx - box[0], box[2] - cx))
        hh = math.ceil(max(cy - box[1], box[3] - cy))
        box = (round(cx) - hw, round(cy) - hh, round(cx) + hw, round(cy) + hh)
    box = (max(0, box[0] - PAD), max(0, box[1] - PAD), min(W, box[2] + PAD), min(H, box[3] + PAD))
    small.crop(box).save(layers / f"{name}.png", optimize=True)
    layout["layers"][name] = list(box)
(layers / "layout.json").write_text(json.dumps(layout, indent=1) + "\n")
print("wrote", len(PARTS), "layers to", layers)

# The OS splash can only be an icon on a colour, so give it the navy mark
# on the same warm white ground: no colour flash into the screen above.
si = Image.new("RGBA", (1024 * 2, 1024 * 2), (0, 0, 0, 0))
icons.draw_mark(si, 1024, 1024, 1024 * 0.62, NAVY, MINT)
si.resize((1024, 1024), Image.LANCZOS).save("assets/splash-icon.png")
print("wrote assets/splash-icon.png")
