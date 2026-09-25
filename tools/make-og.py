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
import fontpath

S = 2
W, H = 1200, 630

PAPER = (247, 246, 241)
MINT  = (85, 198, 163)
DIM   = (169, 184, 194)


def font(weight, size):
    return ImageFont.truetype(fontpath.montserrat(weight), size * S)


# The big mark sits centred at 0.815 of the width, so type has to stop short
# of its left edge. Everything past this is the mark's, not the headline's.
TEXT_LEFT = 78
TEXT_RIGHT = W * 0.815 - (icons.MARK_W / icons.MARK_H * H * 0.46) / 2 - 34

COPY = {
    "en": dict(
        out="backend/og.png",
        head=("Know before", "you pay."),
        sub=("The subscription reminder that arrives", "before the charge, not after."),
        cta="SUBTRIMIO.COM   ·   FREE ON GOOGLE PLAY",
    ),
    # "Wissen, bevor abgebucht wird" is the live tagline and it stays the live
    # tagline here. The literal "bevor du zahlst" was rejected on 2026-09-14:
    # zahlen names an act you perform, and a renewal is precisely the charge
    # that happens while you do nothing, which is the whole product. abbuchen
    # is the automatic debit and the word a German bank statement uses.
    "de": dict(
        out="backend/og-de.png",
        head=("Wissen, bevor", "abgebucht wird."),
        sub=("Die Abo-Erinnerung, die vor der", "Abbuchung kommt, nicht danach."),
        cta="SUBTRIMIO.COM   ·   KOSTENLOS BEI GOOGLE PLAY",
    ),
}


def fitted(d, lines, weight, size, limit):
    """Largest size at or below `size` where every line clears `limit`.

    German runs longer than the English it is set from: "abgebucht wird." is
    nearly twice "you pay.". Hardcoding the English size silently pushes the
    German headline under the mark, and a share card is never looked at closely
    enough for anyone to notice. Measure instead."""
    while size > 8:
        f = font(weight, size)
        if max(d.textlength(t, font=f) for t in lines) <= limit * S:
            return f
        size -= 1
    return font(weight, 8)


def og(lang):
    c = COPY[lang]
    img = icons.ground(W * S).crop((0, 0, W * S, H * S))

    icons.draw_mark(img, W * S * 0.815, H * S * 0.50, H * S * 0.46, PAPER, MINT)
    d = ImageDraw.Draw(img)

    x = TEXT_LEFT * S
    icons.draw_mark(img, x + 14 * S, 71 * S, 34 * S, PAPER, MINT)
    d = ImageDraw.Draw(img)
    d.text((x + 38 * S, 55 * S), "Trimio", font=font("Medium", 27), fill=PAPER)

    avail = TEXT_RIGHT - TEXT_LEFT
    hf = fitted(d, c["head"], "ExtraBold", 74, avail)
    d.text((x, 168 * S), c["head"][0], font=hf, fill=PAPER)
    d.text((x, 258 * S), c["head"][1], font=hf, fill=PAPER)

    d.line([(x, 386 * S), (x + 92 * S, 386 * S)], fill=MINT, width=6 * S)

    sf = fitted(d, c["sub"], "Medium", 25, avail)
    d.text((x, 424 * S), c["sub"][0], font=sf, fill=DIM)
    d.text((x, 464 * S), c["sub"][1], font=sf, fill=DIM)
    d.text((x, 536 * S), c["cta"],
           font=fitted(d, (c["cta"],), "SemiBold", 16, avail), fill=MINT)

    img.convert("RGB").resize((W, H), Image.LANCZOS).save(c["out"])
    print(f"wrote {c['out']} {(W, H)} headline at {hf.size // S}pt")


def tab_icon():
    Image.open("assets/icon.png").resize((256, 256), Image.LANCZOS).save("backend/icon.png")
    print("wrote backend/icon.png (256, 256)")


if __name__ == "__main__":
    og("en")
    og("de")
    tab_icon()
