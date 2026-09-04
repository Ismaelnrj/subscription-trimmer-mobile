"""Lifts the Trimio mark out of the approved artwork at full fidelity.

Earlier passes traced the outline to a simplified polygon and rebuilt the
corners, which drifted from the artwork. This keeps the artwork's own
antialiased edges instead: it separates the two shapes into soft alpha
masks, crops them to the mark, and writes them next to a small JSON of
the proportions. draw_mark then tints and scales those masks, so what
ships is the shape that was approved rather than a redrawing of it.
"""
from PIL import Image
import json, pathlib

SRC = "/root/.claude/uploads/572e8a57-90e7-50e4-9543-30207f74f2cf/610e4bc3-image.png"
OUT = pathlib.Path("tools")

im = Image.open(SRC).convert("RGB")
W, H = im.size
px = im.load()

NAVY = (17, 34, 48)
PAPER = (246, 245, 240)
MINT = (61, 209, 160)


def near(p, q, tol):
    return sum((a - b) ** 2 for a, b in zip(p, q)) < tol * tol * 3


# The tile: the navy field. Sampled coarsely, then trimmed in from its
# rounded corners so the page behind them is never mistaken for the mark.
xs = [x for y in range(0, H, 2) for x in range(0, W, 2) if near(px[x, y], NAVY, 46)]
ys = [y for y in range(0, H, 2) for x in range(0, W, 2) if near(px[x, y], NAVY, 46)]
tx0, tx1, ty0, ty1 = min(xs), max(xs), min(ys), max(ys)
tile = tx1 - tx0
inset = int(tile * 0.10)
IX0, IX1, IY0, IY1 = tx0 + inset, tx1 - inset, ty0 + inset, ty1 - inset
print(f"tile {tx0}..{tx1} x {ty0}..{ty1}  ({tile}px)")


def split():
    """Separate the two shapes by greenness, not by colour distance.

    Distance misclassifies: a half covered white edge over navy is a mid
    grey, which sits nearer mint than paper and leaks the whole chevron
    outline into the triangle. Greenness does not have that problem.
    Mint over navy runs green 2 to 98; paper over navy stays flat at 2,
    so the triangle is isolated first and subtracted from the chevron.
    """
    ca = Image.new("L", (W, H), 0)
    ta = Image.new("L", (W, H), 0)
    cp, tp = ca.load(), ta.load()
    for y in range(IY0, IY1):
        for x in range(IX0, IX1):
            r, g, b = px[x, y]
            green = g - (r + b) / 2
            tri = max(0.0, min(1.0, (green - 4) / 92.0))
            lum = (r + g + b) / 3
            chev = max(0.0, min(1.0, (lum - 33) / 205.0)) * (1 - tri)
            tp[x, y] = int(tri * 255)
            cp[x, y] = int(chev * 255)
    return ca, ta


chev, tri = split()

# crop both to the union of the two shapes, so their relative placement is kept
def bbox(m, thresh=40):
    mp = m.load()
    xs = [x for y in range(IY0, IY1) for x in range(IX0, IX1) if mp[x, y] > thresh]
    ys = [y for y in range(IY0, IY1) for x in range(IX0, IX1) if mp[x, y] > thresh]
    return min(xs), max(xs), min(ys), max(ys)


cb, tb = bbox(chev), bbox(tri)
ux0, ux1 = min(cb[0], tb[0]), max(cb[1], tb[1])
uy0, uy1 = min(cb[2], tb[2]), max(cb[3], tb[3])
box = (ux0, uy0, ux1 + 1, uy1 + 1)
chev.crop(box).save(OUT / "mark-chevron.png")
tri.crop(box).save(OUT / "mark-triangle.png")

# The artwork does not centre the mark in the tile: it sits slightly right
# and slightly high. Carry that offset or the mark lands a hair off.
tcx, tcy = (tx0 + tx1) / 2, (ty0 + ty1) / 2
meta = {
    "mark_w": ux1 - ux0 + 1,
    "mark_h": uy1 - uy0 + 1,
    "offset_x_over_tile": round(((ux0 + ux1) / 2 - tcx) / tile, 5),
    "offset_y_over_tile": round(((uy0 + uy1) / 2 - tcy) / tile, 5),
    "chevron_h_over_mark_h": round((cb[3] - cb[2] + 1) / (uy1 - uy0 + 1), 5),
    "mark_h_over_tile": round((uy1 - uy0 + 1) / tile, 5),
    "mark_w_over_tile": round((ux1 - ux0 + 1) / tile, 5),
    "tile_px": tile,
}
(OUT / "mark.json").write_text(json.dumps(meta, indent=1))
print("chevron bbox", cb, "\ntriangle bbox", tb)
print("mark", meta["mark_w"], "x", meta["mark_h"],
      "| mark height is", f'{meta["mark_h_over_tile"]:.1%}', "of the tile")
print("wrote tools/mark-chevron.png, tools/mark-triangle.png, tools/mark.json")
