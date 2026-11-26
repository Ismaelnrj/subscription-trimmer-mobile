"""Draws the brand pieces the app shows inside its screens.

assets/brand/mark-on-light.png   Ink Navy chevron, mint triangle (light theme)
assets/brand/mark-on-dark.png    light ink chevron, mint triangle (dark theme)
assets/brand/corner-on-*.png     the sign in flow's top right art (light, dark)
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
# version on a phone as "really bad and generic". Two pieces, deep teal and
# mint, the brand's own colours, after the owner's mock:
#   corner-on-*  a deep disc off the top right corner, ringed like the launch
#                screen (one ring per renewal), with a mint lens over its edge;
#   waves-on-*   a mint wave rising from the left under a deep wave rising to
#                the right, at the foot.
# Mint as brand art, like the launch screen and the mark, never as a UI signal:
# that rule (__tests__/mint-only-for-good-news.test.js) governs the screens.
NAVY_DEEP = (20, 43, 58)       # Ink Navy
TEAL_DEEP = (31, 94, 88)       # navy mixed toward deepened mint #1F7A62
MINT_PALE = (166, 231, 211)
MINT_DEEP = (47, 142, 113)     # #2F8E71

ART = {
    "light": {"disc": (NAVY_DEEP, TEAL_DEEP), "ring": 22, "lens": (MINT_PALE, MINT, MINT_DEEP),
              "back": (MINT_PALE, MINT), "front": (TEAL_DEEP, NAVY_DEEP)},
    # Against the dark ground #0E1A22: the same shapes, held low.
    "dark": {"disc": ((22, 46, 58), (26, 70, 68)), "ring": 16, "lens": ((88, 170, 142), (52, 140, 112), (32, 100, 82)),
             "back": ((36, 96, 84), (44, 124, 102)), "front": ((24, 54, 62), (19, 38, 48))},
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


# Corner: 220 x 176 dp at 3x, shown at 56% of the screen's width. A band
# beside the lockup and the label, ending above the headline, so no text
# ever sits on it at any width (the first draft ran under the lead).
CW, CH = 660, 528
for theme, a in ART.items():
    big = Image.new("RGBA", (CW * S, CH * S), (0, 0, 0, 0))
    cx, cy, r = CW * S * 1.05, -CH * S * 0.45, CW * S * 0.95
    disc = Image.new("L", big.size, 0)
    ImageDraw.Draw(disc).ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
    paint(big, disc, a["disc"][::-1], 225)
    rings = Image.new("RGBA", big.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(rings)
    k = 0.34
    while k < 0.99:
        rr = r * k
        d.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), outline=(255, 255, 255, a["ring"]), width=round(1.4 * S))
        k += 0.052
    big.alpha_composite(Image.composite(rings, Image.new("RGBA", big.size), disc))
    lx, ly, lr = CW * S * 1.0, CH * S * 0.70, CW * S * 0.22
    lens = Image.new("L", big.size, 0)
    ImageDraw.Draw(lens).ellipse((lx - lr, ly - lr, lx + lr, ly + lr), fill=255)
    paint(big, lens, a["lens"], 60)
    img = big.convert("RGBa").reduce(S).convert("RGBA")
    img.save(out / f"corner-on-{theme}.png", optimize=True)
    print("wrote", out / f"corner-on-{theme}.png", img.size)

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
