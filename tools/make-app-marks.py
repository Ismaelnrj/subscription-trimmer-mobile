"""Draws the brand pieces the app shows inside its screens.

assets/brand/mark-on-light.png   Ink Navy chevron, mint triangle (light theme)
assets/brand/mark-on-dark.png    light ink chevron, mint triangle (dark theme)
assets/brand/waves-on-light.png  the launch screen's two waves, as a band
assets/brand/waves-on-dark.png   the same band in deep teal, for dark mode

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


# The waves at the foot of the sign in flow: the launch screen's formula
# (make-splash.py `wave`: two sines, the second at twice the frequency and
# 0.35 of the height) and its two pale mints, in a band 1284 wide, so the
# sign in screens read as the launch screen continued. The dark pair mixes
# mint into the dark ground (#0E1A22) at about 8 and 14 per cent.
BW, BH = 1284, 300
WAVES = {
    "waves-on-light": ((223, 242, 235), (206, 235, 224)),
    "waves-on-dark": ((19, 40, 44), (24, 50, 52)),
}
for name, (back, front) in WAVES.items():
    big = Image.new("RGBA", (BW * S, BH * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    for y_frac, colour, amp, phase in ((0.30, back, 0.085, 0.0), (0.58, front, 0.07, 2.2)):
        pts, y0, a = [], BH * S * y_frac, BH * S * amp
        for i in range(0, BW * S + 1, 8):
            t = i / (BW * S)
            pts.append((i, y0 + math.sin(t * math.pi * 2 + phase) * a
                            + math.sin(t * math.pi * 4 + phase) * a * 0.35))
        d.polygon(pts + [(BW * S, BH * S), (0, BH * S)], fill=colour + (255,))
    img = big.convert("RGBa").reduce(S).convert("RGBA")
    img.save(out / f"{name}.png", optimize=True)
    print("wrote", out / f"{name}.png", img.size)
