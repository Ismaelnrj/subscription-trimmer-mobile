"""Draws the Trimio mark and every icon that uses it.

The mark is a chevron pointing right: its inner edge is a V, its outer
edge a circular arc, and a mint triangle nests into the V with a gap. Two
forward-pointing forms, one behind the other, which is the product: you
see the charge before it arrives.

Corners are rounded by blurring the mask and thresholding it, so convex
and concave corners round by the same radius the way the reference does.

Geometry is expressed in units of the chevron's height, measured off the
brand sheet, so every size renders from the same numbers.
"""
from PIL import Image, ImageDraw, ImageFilter
import json, pathlib

NAVY      = (20, 43, 58)
NAVY_HI   = (28, 60, 79)
NAVY_LO   = (13, 30, 41)
PAPER     = (247, 246, 241)
MINT      = (85, 198, 163)

# --- mark geometry -----------------------------------------------------
# Traced out of the approved artwork by tools/trace-mark.py rather than
# fitted by hand: an earlier pass re-derived the outline from measurements
# and drifted into reading as an inverted Pac-Man. mark.json holds both
# outlines in units where the chevron is 100 tall.
_MARK = json.loads((pathlib.Path(__file__).parent / "mark.json").read_text())
CHEVRON = [tuple(p) for p in _MARK["chevron"]]
TRIANGLE = [tuple(p) for p in _MARK["triangle"]]
MARK_W, MARK_H = _MARK["meta"]["width"], _MARK["meta"]["height"]
ROUND_R = 3.2          # the design rounds every corner; the chevron
                       # arrives already rounded, the triangle does not


def _rounded(mask, r_px):
    """Knock the stair-stepping off the traced outline."""
    if r_px <= 0:
        return mask
    return mask.filter(ImageFilter.GaussianBlur(r_px * 0.62)).point(
        lambda v: 255 if v >= 128 else 0)


def _poly_mask(size, pts, s, ox, oy):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).polygon([(ox + x * s, oy + y * s) for x, y in pts], fill=255)
    return _rounded(m, ROUND_R * s)


def draw_mark(img, cx, cy, height, chevron_fill, tri_fill):
    """Places the mark centred on (cx, cy) at the given chevron height."""
    s = height / MARK_H
    ox, oy = cx - MARK_W * s / 2, cy - MARK_H * s / 2
    for pts, fill in ((CHEVRON, chevron_fill), (TRIANGLE, tri_fill)):
        layer = Image.new("RGBA", img.size, fill + (255,))
        layer.putalpha(_poly_mask(img.size, pts, s, ox, oy))
        img.alpha_composite(layer)


def ground(size):
    """Navy, warmed slightly toward the top so the mark is not on a flat field."""
    img = Image.new("RGBA", (size, size), NAVY)
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / size
        d.line([(0, y), (size, y)],
               fill=tuple(round(NAVY_HI[i] + (NAVY_LO[i] - NAVY_HI[i]) * t)
                          for i in range(3)) + (255,))
    return img


def build(size, out, frac, transparent=False, chevron=PAPER, tri=MINT, S=4):
    big = size * S
    img = (Image.new("RGBA", (big, big), (0, 0, 0, 0)) if transparent
           else ground(big))
    draw_mark(img, big / 2, big / 2, big * frac, chevron, tri)
    img.resize((size, size), Image.LANCZOS).save(out)
    print("wrote", out, size)


if __name__ == "__main__":
    D = "assets/"
    build(1024, D + "icon.png", 0.58)
    build(1024, D + "adaptive-icon.png", 0.42, transparent=True)   # adaptive safe zone
    build(192,  D + "favicon.png", 0.58)
    # Android tints a single-colour silhouette, so both parts are opaque white
    # and the gap between them carries the shape.
    build(192,  D + "notification-icon.png", 0.62, transparent=True,
          chevron=(255, 255, 255), tri=(255, 255, 255))
