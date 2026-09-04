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

# --- the mark ----------------------------------------------------------
# Two soft alpha masks lifted straight out of the approved artwork by
# tools/trace-mark.py. Nothing here redraws the shape: it is scaled and
# tinted, so the curves, the notch and the triangle's rounded corners are
# the artwork's own. Do not replace this with a redrawn outline.
_DIR = pathlib.Path(__file__).parent
_META = json.loads((_DIR / "mark.json").read_text())
_CHEVRON = Image.open(_DIR / "mark-chevron.png").convert("L")
_TRIANGLE = Image.open(_DIR / "mark-triangle.png").convert("L")
MARK_W, MARK_H = _META["mark_w"], _META["mark_h"]
MARK_OVER_TILE = _META["mark_h_over_tile"]
OFFSET_X = _META["offset_x_over_tile"]   # the artwork sits right of centre
OFFSET_Y = _META["offset_y_over_tile"]   # and a little high


def draw_mark(img, cx, cy, height, chevron_fill, tri_fill, shadow=False):
    """Places the mark centred on (cx, cy) at the given overall height.

    `shadow` reproduces the soft drop the artwork carries under both
    shapes. It belongs on the icon tile only: the launch screen and the
    website set the mark flat on their own ground."""
    w = max(1, round(MARK_W * height / MARK_H))
    h = max(1, round(height))
    ox, oy = round(cx - w / 2), round(cy - h / 2)
    if shadow:
        off = max(1, round(h * 0.018))
        blur = max(1, h * 0.022)
        for mask in (_CHEVRON, _TRIANGLE):
            sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
            layer = Image.new("RGBA", (w, h), (0, 8, 16, 255))
            layer.putalpha(mask.resize((w, h), Image.LANCZOS))
            sh.alpha_composite(layer, (ox + off, oy + off))
            sh = sh.filter(ImageFilter.GaussianBlur(blur))
            sh.putalpha(sh.getchannel("A").point(lambda v: int(v * 0.55)))
            img.alpha_composite(sh)
    for mask, fill in ((_CHEVRON, chevron_fill), (_TRIANGLE, tri_fill)):
        m = mask.resize((w, h), Image.LANCZOS)
        if isinstance(fill, tuple) and len(fill) == 2:      # (top, bottom) ramp
            layer = vertical((w, h), *fill).convert("RGBA")
        else:
            layer = Image.new("RGBA", (w, h), fill + (255,))
        layer.putalpha(m)
        img.alpha_composite(layer, (ox, oy))


# Sampled off the approved artwork rather than invented. The field is a
# diagonal that lifts toward the top right, and it is far deeper than the
# UI's Ink Navy: an icon carries more contrast than a screen does.
TILE_TL, TILE_TR = (5, 30, 47), (15, 42, 61)
TILE_BL, TILE_BR = (0, 16, 30), (1, 21, 36)
# The triangle is not flat either: it runs bright at the top to deep at
# the foot. The chevron is effectively flat warm white.
TRI_TOP, TRI_BOT = (79, 238, 195), (36, 210, 164)


def ground(size):
    """The artwork's field, bilinear between its four sampled corners."""
    img = Image.new("RGBA", (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        v = y / max(size - 1, 1)
        left = [TILE_TL[i] + (TILE_BL[i] - TILE_TL[i]) * v for i in range(3)]
        right = [TILE_TR[i] + (TILE_BR[i] - TILE_TR[i]) * v for i in range(3)]
        for seg in range(0, size, 4):
            u = seg / max(size - 1, 1)
            d.rectangle([seg, y, seg + 3, y],
                        fill=tuple(round(left[i] + (right[i] - left[i]) * u)
                                   for i in range(3)) + (255,))
    return img


def vertical(size_wh, top, bottom):
    """A vertical ramp, used to give the triangle the artwork's shading."""
    w, h = size_wh
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        v = y / max(h - 1, 1)
        d.line([(0, y), (w, y)],
               fill=tuple(round(top[i] + (bottom[i] - top[i]) * v) for i in range(3)))
    return img


def build(size, out, frac, transparent=False, chevron=PAPER, tri=MINT, S=4,
          shadow=False, offset=False):
    """`offset` reproduces the artwork's own placement inside the tile. The
       adaptive icon stays centred instead, because Android masks it to a
       centred circle and an offset mark would crop unevenly."""
    big = size * S
    img = (Image.new("RGBA", (big, big), (0, 0, 0, 0)) if transparent
           else ground(big))
    dx = big * OFFSET_X if offset else 0
    dy = big * OFFSET_Y if offset else 0
    draw_mark(img, big / 2 + dx, big / 2 + dy, big * frac, chevron, tri, shadow=shadow)
    img.resize((size, size), Image.LANCZOS).save(out)
    print("wrote", out, size)


if __name__ == "__main__":
    D = "assets/"
    build(1024, D + "icon.png", MARK_OVER_TILE, tri=(TRI_TOP, TRI_BOT),
          shadow=True, offset=True)
    build(1024, D + "adaptive-icon.png", 0.42, transparent=True)   # adaptive safe zone
    build(192,  D + "favicon.png", MARK_OVER_TILE, tri=(TRI_TOP, TRI_BOT),
          shadow=True, offset=True)
    # Android tints a single-colour silhouette, so both parts are opaque white
    # and the gap between them carries the shape.
    build(192,  D + "notification-icon.png", 0.62, transparent=True,
          chevron=(255, 255, 255), tri=(255, 255, 255))
