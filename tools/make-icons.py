from PIL import Image, ImageDraw, ImageFilter

S = 4            # supersample factor
NAVY      = (20, 43, 58)
NAVY_HI   = (28, 60, 79)
NAVY_LO   = (13, 30, 41)
PAPER     = (247, 246, 241)
PAPER_DIM = (219, 222, 220)
MINT      = (85, 198, 163)
MINT_2    = (150, 219, 195)
MINT_3    = (201, 236, 224)
BAR       = (200, 209, 214)
BAR_2     = (222, 228, 231)

def rounded(d, box, r, fill):
    d.rounded_rectangle(box, radius=r, fill=fill)

def trim_tab(d, x, y, w, h, fill):
    """The brand mark: a bar that squares off into a check at the right edge.
       Same polygon as .signal-dot on the landing page."""
    d.polygon([(x, y), (x + w, y), (x + w, y + h * .62),
               (x + w * .67, y + h * .62), (x + w * .67, y + h), (x, y + h)], fill=fill)

def receipt(img, cx, cy, w, h, shadow=True):
    """A paper receipt with a torn bottom edge, one mint trim tab, and three
       charge rows. The torn edge and the tab are the two things that make it
       Trimio's rather than a generic document glyph."""
    d = ImageDraw.Draw(img)
    x0, y0 = cx - w / 2, cy - h / 2
    teeth, tooth_h = 5, h * .058
    body_h = h - tooth_h

    def paper_shape(ox, oy):
        pts = [(x0 + ox, y0 + oy + w * .05)]
        pts += [(x0 + ox, y0 + oy + body_h)]
        step = w / teeth
        for i in range(teeth):
            pts.append((x0 + ox + step * i + step / 2, y0 + oy + body_h + tooth_h))
            pts.append((x0 + ox + step * (i + 1), y0 + oy + body_h))
        pts += [(x0 + ox + w, y0 + oy + w * .05)]
        return pts

    if shadow:
        sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(sh).polygon(paper_shape(-w * .07, h * .055), fill=(6, 16, 23, 150))
        img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(w * .045)))
        d = ImageDraw.Draw(img)

    d.polygon(paper_shape(0, 0), fill=PAPER)
    r = w * .05
    d.rounded_rectangle([x0, y0, x0 + w, y0 + h * .3], radius=r, fill=PAPER)
    # folded top-right corner, the one thing that says "paper" not "card"
    fold = w * .19
    d.polygon([(x0 + w - fold, y0), (x0 + w, y0), (x0 + w, y0 + fold)], fill=PAPER_DIM)

    pad = w * .13
    trim_tab(d, x0 + pad, y0 + h * .135, w * .175, w * .12, MINT)

    row_y = y0 + h * .40
    gap = h * .175
    cr = w * .082
    for i, dot in enumerate((MINT, MINT_2, MINT_3)):
        cy_r = row_y + gap * i
        d.ellipse([x0 + pad, cy_r - cr, x0 + pad + cr * 2, cy_r + cr], fill=dot)
        if i == 0:
            # The top charge is the decided one. That is the whole product.
            ccx = x0 + pad + cr
            d.line([(ccx - cr * .42, cy_r + cr * .02), (ccx - cr * .10, cy_r + cr * .36),
                    (ccx + cr * .46, cy_r - cr * .38)],
                   fill=PAPER, width=int(cr * .30), joint="curve")
        bx = x0 + pad + cr * 2 + w * .085
        bh = w * .052
        rounded(d, [bx, cy_r - bh * 1.45, bx + w * (.40 - i * .045), cy_r - bh * .35], bh / 2, BAR)
        rounded(d, [bx, cy_r + bh * .35, bx + w * (.25 - i * .03), cy_r + bh * 1.45], bh / 2, BAR_2)

def ground(size):
    """Navy, warmed slightly toward the top so the mark doesn't sit on a flat field."""
    img = Image.new("RGBA", (size, size), NAVY)
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / size
        d.line([(0, y), (size, y)],
               fill=tuple(round(NAVY_HI[i] + (NAVY_LO[i] - NAVY_HI[i]) * t) for i in range(3)) + (255,))
    return img

def build(size, transparent, receipt_frac, out):
    big = size * S
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0)) if transparent else ground(big)
    w = big * receipt_frac
    receipt(img, big / 2, big / 2, w, w * 1.42, shadow=not transparent)
    img.resize((size, size), Image.LANCZOS).save(out)
    print("wrote", out, size)

D = "/home/user/subscription-trimmer-mobile/assets/"
build(1024, False, 0.455, D + "icon.png")
build(1024, True,  0.335, D + "adaptive-icon.png")   # 66% adaptive safe zone
build(192,  False, 0.455, D + "favicon.png")
