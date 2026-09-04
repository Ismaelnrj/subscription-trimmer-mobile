"""Builds the two images the website serves: the browser-tab icon and the
link-share card. Both come from the same mark the app uses, so a link
preview, a tab and the home-screen icon all agree.

The site sets Fraunces for display type, but no display serif ships with
this machine and the substitutes are all Times clones, which read as
cheap at headline size. The card uses Montserrat instead, which the app
already bundles. A share card is a thumbnail: the palette and the mark
carry the recognition, not the typeface.
"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from PIL import Image, ImageDraw, ImageFont
from importlib import import_module
icons = import_module("make-icons")

M = "/usr/share/fonts/opentype/montserrat/Montserrat-%s.otf"
S = 2
W, H = 1200, 630

PAPER = (247, 246, 241)
MINT  = (85, 198, 163)
DIM   = (169, 184, 194)


def font(weight, size):
    return ImageFont.truetype(M % weight, size * S)


def og():
    img = icons.ground(W * S)                       # navy, warmed toward the top
    img = img.crop((0, 0, W * S, H * S))
    d = ImageDraw.Draw(img)

    icons.draw_mark(img, W * S * 0.815, H * S * 0.50, H * S * 0.46, PAPER, MINT)
    d = ImageDraw.Draw(img)

    x = 78 * S
    icons.draw_mark(img, x + 14 * S, 71 * S, 34 * S, PAPER, MINT)
    d = ImageDraw.Draw(img)
    d.text((x + 38 * S, 55 * S), "Trimio", font=font("Medium", 27), fill=PAPER)

    d.text((x, 168 * S), "Know before", font=font("ExtraBold", 74), fill=PAPER)
    d.text((x, 258 * S), "you pay.",     font=font("ExtraBold", 74), fill=PAPER)

    d.line([(x, 386 * S), (x + 92 * S, 386 * S)], fill=MINT, width=6 * S)

    d.text((x, 424 * S), "The subscription reminder that arrives", font=font("Medium", 25), fill=DIM)
    d.text((x, 464 * S), "before the charge, not after.",           font=font("Medium", 25), fill=DIM)
    d.text((x, 536 * S), "SUBTRIMIO.COM   ·   FREE ON GOOGLE PLAY", font=font("SemiBold", 16), fill=MINT)

    img.convert("RGB").resize((W, H), Image.LANCZOS).save("backend/og.png")
    print("wrote backend/og.png", (W, H))


def tab_icon():
    Image.open("assets/icon.png").resize((256, 256), Image.LANCZOS).save("backend/icon.png")
    print("wrote backend/icon.png (256, 256)")


if __name__ == "__main__":
    og()
    tab_icon()
