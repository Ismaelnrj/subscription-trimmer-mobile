"""Draws the two copies of the mark the app shows inside its screens.

assets/brand/mark-on-light.png  Ink Navy chevron, mint triangle (light theme)
assets/brand/mark-on-dark.png   light ink chevron, mint triangle (dark theme)

Drawn by make-icons.draw_mark, the same code as the icon and the launch
screen, so the mark is never redrawn by hand. 3x for a 48 dp tall mark.
Kept apart from make-icons.py on purpose: running that rewrites the app
icons, which are native assets and need a build.
"""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from importlib import import_module
from PIL import Image
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
