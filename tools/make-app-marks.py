"""Draws the brand pieces the app shows inside its screens.

assets/brand/mark-on-light.png   Ink Navy chevron, mint triangle (light theme)
assets/brand/mark-on-dark.png    light ink chevron, mint triangle (dark theme)
assets/brand/stage.png           the navy stage atop sign in and sign up
assets/brand/waves-on-*.png      the sign in flow's foot (light, dark)

Drawn by make-icons.draw_mark, the same code as the icon and the launch
screen, so the mark is never redrawn by hand. 3x for a 48 dp tall mark.
Kept apart from make-icons.py on purpose: running that rewrites the app
icons, which are native assets and need a build.
"""
import math, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from importlib import import_module
from PIL import Image, ImageDraw
icons = import_module("make-icons")

H = 144            # 48 dp at 3x
S = 4              # supersample
PAD = 4            # transparent margin, so whole pixel rounding never crops ink
NAVY = (20, 43, 58)
LIGHT_INK = (242, 241, 236)   # lib/theme.ts dark `text`, #F2F1EC
MINT = (85, 198, 163)

out = pathlib.Path("assets/brand")
out.mkdir(exist_ok=True)
w = round(icons.MARK_W * H / icons.MARK_H)
for name, chevron in (("mark-on-light", NAVY), ("mark-on-dark", LIGHT_INK)):
    big = Image.new("RGBA", ((w + 2 * PAD) * S, (H + 2 * PAD) * S), (0, 0, 0, 0))
    icons.draw_mark(big, big.width / 2, big.height / 2, H * S, chevron, MINT)
    img = big.convert("RGBa").reduce(S).convert("RGBA")
    img.save(out / f"{name}.png", optimize=True)
    print("wrote", out / f"{name}.png", img.size)


# THE SIGN IN FLOW'S ART, redrawn 2026-11-26 after the owner read the pale
# version on a phone as "really bad and generic", in the brand's own deep teal
# and mint: the stage (below) atop sign in and sign up, and the waves at the
# foot of forgot password, a mint wave rising from the left under a deep wave
# rising to the right.
# Mint as brand art, like the launch screen and the mark, never as a UI signal:
# that rule (__tests__/mint-only-for-good-news.test.js) governs the screens.
NAVY_DEEP = (20, 43, 58)       # Ink Navy
TEAL_DEEP = (31, 94, 88)       # navy mixed toward deepened mint #1F7A62
MINT_PALE = (166, 231, 211)
MINT_DEEP = (47, 142, 113)     # #2F8E71

ART = {
    "light": {"back": (MINT_PALE, MINT), "front": (TEAL_DEEP, NAVY_DEEP)},
    # Against the dark ground #0E1A22: the same shapes, held low.
    "dark": {"back": ((36, 96, 84), (44, 124, 102)), "front": ((24, 54, 62), (19, 38, 48))},
}


def gradient(size, stops, angle):
    """A linear gradient across `size`, through `stops`, at `angle` degrees."""
    w, h = size
    g = Image.new("RGBA", size)
    px = g.load()
    ca, sa = math.cos(math.radians(angle)), math.sin(math.radians(angle))
    span = abs(w * ca) + abs(h * sa)
    lo = min(0, w * ca) + min(0, h * sa)
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            f = min(1.0, max(0.0, ((x * ca + y * sa) - lo) / span)) * (len(stops) - 1)
            i = min(int(f), len(stops) - 2)
            a, b = stops[i], stops[i + 1]
            k = f - i
            c = tuple(round(a[j] + (b[j] - a[j]) * k) for j in range(3)) + (255,)
            px[x, y] = c
            if x + 1 < w: px[x + 1, y] = c
            if y + 1 < h:
                px[x, y + 1] = c
                if x + 1 < w: px[x + 1, y + 1] = c
    return g


def paint(canvas, mask, stops, angle):
    canvas.alpha_composite(Image.composite(gradient(canvas.size, stops, angle), Image.new("RGBA", canvas.size), mask))


# THE STAGE, 2026-11-26, the owner's pick of ten ("Brand panel"): the top of
# sign in and sign up, the same in both themes. Ink Navy at the top edge,
# where it meets a status bar of the same colour, deepening to teal; rings
# off the top right corner, one per renewal, as on the launch screen. The
# mint lens is its own file, below. No text is drawn here: the screen sets
# its own.
# 428 x 560 dp at 3x. The screen anchors it at the top, at the screen's
# width or wider, so a shorter stage crops the bottom, never the rings.
STAGE_TOP = (20, 43, 58)       # lib/theme.ts STAGE.top, #142B3A
STAGE_BOTTOM = (27, 74, 76)    # lib/theme.ts STAGE.bottom, #1B4A4C
SW, SH = 1284, 1680
W, H = SW * S, SH * S
fall = Image.linear_gradient("L").resize((W, H))
big = Image.composite(Image.new("RGBA", (W, H), STAGE_BOTTOM + (255,)), Image.new("RGBA", (W, H), STAGE_TOP + (255,)), fall)
rings = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(rings)
cx, cy = W * 1.10, -H * 0.08
rr = 42 * S
while rr < 2400 * S:
    d.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), outline=(255, 255, 255, 18), width=round(1.4 * S))
    rr += 42 * S
big.alpha_composite(rings)
img = big.convert("RGB").reduce(S)
img.save(out / "stage.png", optimize=True)
print("wrote", out / "stage.png", img.size)

# The mint lens, apart from the stage so the screen can keep it clear of the
# headline: drawn into the stage, it sat at a fixed height in the picture, and
# on a short phone the German headline climbed into it. 171 dp at 3x.
LS = 513
big = Image.new("RGBA", (LS * S, LS * S), (0, 0, 0, 0))
tint = gradient((64, 64), (MINT_PALE, MINT, MINT_DEEP), 60).resize(big.size, Image.BILINEAR)
mask = Image.new("L", big.size, 0)
ImageDraw.Draw(mask).ellipse((0, 0, big.width - 1, big.height - 1), fill=255)
big.paste(tint, (0, 0), mask)
img = big.convert("RGBa").reduce(S).convert("RGBA")
img.save(out / "stage-lens.png", optimize=True)
print("wrote", out / "stage-lens.png", img.size)

# Waves: a band 1284 x 240, stretched to the screen's width (about 73 dp
# tall on a 393 dp phone, so the whole band shows on the owner's).
BW, BH = 1284, 240
for theme, a in ART.items():
    big = Image.new("RGBA", (BW * S, BH * S), (0, 0, 0, 0))
    W, H = BW * S, BH * S
    back = [(i, H * (0.10 + 0.52 * (i / W) ** 1.15) + math.sin(i / W * math.pi * 2.2) * H * 0.05) for i in range(0, W + 1, 8)]
    # The deep wave swells once before it climbs, so it reads as a wave
    # rather than a ramp: a smoothstep rise plus one slow sine.
    front = [(i, H * (0.97 - 0.70 * (3 * (i / W) ** 2 - 2 * (i / W) ** 3)) + math.sin(i / W * math.pi * 2 + 0.2) * H * 0.07) for i in range(0, W + 1, 8)]
    for pts, stops, angle in ((back, a["back"], 0), (front, a["front"], 0)):
        m = Image.new("L", big.size, 0)
        ImageDraw.Draw(m).polygon(pts + [(W, H), (0, H)], fill=255)
        paint(big, m, stops, angle)
    img = big.convert("RGBa").reduce(S).convert("RGBA")
    img.save(out / f"waves-on-{theme}.png", optimize=True)
    print("wrote", out / f"waves-on-{theme}.png", img.size)
