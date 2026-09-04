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
import math

NAVY      = (20, 43, 58)
NAVY_HI   = (28, 60, 79)
NAVY_LO   = (13, 30, 41)
PAPER     = (247, 246, 241)
MINT      = (85, 198, 163)

# --- mark geometry, in units where the chevron is 100 tall -------------
CH_TIP_TOP    = (11.2, 0.0)      # upper tip of the chevron
CH_TIP_BOT    = (10.4, 100.0)    # lower tip
CH_APEX       = (49.2, 50.0)     # inner point of the V
ARC_C         = (37.7, 50.0)     # centre of the outer arc
ARC_R         = 56.6
TRI           = [(0.0, 14.9), (0.0, 84.2), (38.8, 50.0)]   # mint triangle
MARK_W, MARK_H = 94.3, 100.0
ROUND_R = 3.4                    # corner radius in the same units


def _rounded(mask, r_px):
    """Round every corner by blurring the mask and cutting at half."""
    if r_px <= 0:
        return mask
    return mask.filter(ImageFilter.GaussianBlur(r_px * 0.62)).point(
        lambda v: 255 if v >= 128 else 0)


def _chevron_mask(size, s, ox, oy):
    m = Image.new("L", size, 0)
    d = ImageDraw.Draw(m)
    a0 = math.atan2(CH_TIP_TOP[1] - ARC_C[1], CH_TIP_TOP[0] - ARC_C[0])
    a1 = math.atan2(CH_TIP_BOT[1] - ARC_C[1], CH_TIP_BOT[0] - ARC_C[0])
    pts = [CH_TIP_TOP]
    steps = 220
    for i in range(steps + 1):                     # outer arc, through the right
        a = a0 + (a1 - a0 + 2 * math.pi) % (2 * math.pi) * i / steps
        pts.append((ARC_C[0] + ARC_R * math.cos(a), ARC_C[1] + ARC_R * math.sin(a)))
    pts += [CH_TIP_BOT, CH_APEX]
    d.polygon([(ox + x * s, oy + y * s) for x, y in pts], fill=255)
    return _rounded(m, ROUND_R * s)


def _triangle_mask(size, s, ox, oy):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).polygon([(ox + x * s, oy + y * s) for x, y in TRI], fill=255)
    return _rounded(m, ROUND_R * s)


def draw_mark(img, cx, cy, height, chevron_fill, tri_fill):
    """Places the mark centred on (cx, cy) at the given chevron height."""
    s = height / MARK_H
    ox, oy = cx - MARK_W * s / 2, cy - MARK_H * s / 2
    for mask, fill in ((_chevron_mask(img.size, s, ox, oy), chevron_fill),
                       (_triangle_mask(img.size, s, ox, oy), tri_fill)):
        layer = Image.new("RGBA", img.size, fill + (255,))
        layer.putalpha(mask)
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
