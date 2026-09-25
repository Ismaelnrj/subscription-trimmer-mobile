"""Builds the two images YouTube asks for when a channel is created.

Both come from the same mark every other surface uses, via make-icons, so
the channel, the Play listing, the site and the app icon all agree. Nothing
here redraws the shape.

THE BANNER'S SAFE AREA IS THE WHOLE PROBLEM. YouTube uploads one 2048x1152
image and then crops it differently on every surface: the full frame only on
a TV, roughly 2560x423 of it on desktop, 1855x423 on tablet, 1546x423 on
phone. The one box visible EVERYWHERE is 1235x338, centred. Anything outside
it is decoration that most viewers never see, so every word lives inside it
and the field is the only thing allowed to bleed to the edges.

THE AVATAR IS CROPPED TO A CIRCLE, which is why it does not reuse
assets/icon.png. That file carries the artwork's own offset, the mark sitting
+2.20% right and -1.29% high inside its tile, which is correct for a square
Play Store tile and wrong under a circular mask: the offset pushes the
chevron toward the crop on one side. Same reasoning as the adaptive icon,
which is centred for exactly this reason. Centred, and smaller, so the
inscribed circle never clips it.
"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from PIL import Image, ImageDraw, ImageFont
from importlib import import_module
icons = import_module("make-icons")
import fontpath

S = 2                                    # supersample, then LANCZOS down

BANNER_W, BANNER_H = 2048, 1152
SAFE_W, SAFE_H = 1235, 338               # visible on every device, centred
AVATAR = 800

PAPER = (247, 246, 241)
MINT  = (85, 198, 163)
DIM   = (169, 184, 194)


def font(weight, size):
    return ImageFont.truetype(fontpath.montserrat(weight), size * S)


def banner(out="assets/youtube-banner.png"):
    img = icons.ground(BANNER_W * S).crop((0, 0, BANNER_W * S, BANNER_H * S))

    cy = BANNER_H / 2                    # the safe box is vertically centred

    # 230px tall leaves 54px of clearance above and below inside a 338px box.
    mark_h = 230
    mark_w = icons.MARK_W * mark_h / icons.MARK_H
    gap = 56

    name_f, tag_f, cta_f = (font("ExtraBold", 96), font("Medium", 38),
                            font("SemiBold", 24))
    probe = ImageDraw.Draw(img)
    text_w = max(probe.textlength(t, font=f) for t, f in
                 (("Trimio", name_f), ("Wissen, bevor abgebucht wird.", tag_f),
                  ("KOSTENLOS BEI GOOGLE PLAY", cta_f))) / S

    # Centre the whole lockup in the safe box rather than in the frame. The
    # frame's centre is only ever seen on a TV; the safe box is what a phone
    # gets, and an off-centre lockup there reads as a mistake.
    lockup = mark_w + gap + text_w
    left = (BANNER_W - lockup) / 2
    mark_cx = left + mark_w / 2
    icons.draw_mark(img, mark_cx * S, cy * S, mark_h * S, PAPER,
                    (icons.TRI_TOP, icons.TRI_BOT))
    d = ImageDraw.Draw(img)

    x = left + mark_w + gap

    d.text((x * S, (cy - 118) * S), "Trimio", font=name_f, fill=PAPER)
    d.text((x * S, (cy + 6) * S), "Wissen, bevor abgebucht wird.",
           font=tag_f, fill=DIM)

    # Mint as a rule, never behind type: it reads at 1.9:1 on light and
    # carries white at 2.1:1, so it marks and does not carry.
    d.line([(x * S, (cy + 76) * S), ((x + 86) * S, (cy + 76) * S)],
           fill=MINT, width=5 * S)

    d.text((x * S, (cy + 100) * S), "KOSTENLOS BEI GOOGLE PLAY",
           font=cta_f, fill=MINT)

    img.convert("RGB").resize((BANNER_W, BANNER_H), Image.LANCZOS).save(out)
    print("wrote", out, (BANNER_W, BANNER_H), f"safe area {SAFE_W}x{SAFE_H}")


def avatar(out="assets/youtube-avatar.png"):
    big = AVATAR * 4
    img = icons.ground(big)
    # Centred, not offset: see the note at the top. 0.46 of the tile keeps the
    # mark clear of the inscribed circle on every side.
    icons.draw_mark(img, big / 2, big / 2, big * 0.46, PAPER,
                    (icons.TRI_TOP, icons.TRI_BOT))
    img.convert("RGB").resize((AVATAR, AVATAR), Image.LANCZOS).save(out)
    print("wrote", out, (AVATAR, AVATAR), "centred for the circular crop")


if __name__ == "__main__":
    banner()
    avatar()
