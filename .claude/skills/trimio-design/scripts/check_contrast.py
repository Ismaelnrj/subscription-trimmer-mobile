#!/usr/bin/env python3
"""Measure contrast against Trimio's palette instead of guessing at it.

Three modes:

    check_contrast.py "#55C6A3" "#F7F6F1"   one pairing
    check_contrast.py --palette             every pairing that matters
    check_contrast.py --image frame.jpg     sample a screenshot or video frame

The image mode exists because reviewing a promo frame or a store screenshot by
eye is exactly where mint-on-warm-white slips through: it looks fine and
measures 1.9:1.
"""

import argparse
import re
import sys

PALETTE = {
    "Ink Navy":       "#142B3A",
    "Warm White":     "#F7F6F1",
    "Card":           "#FCFBF8",
    "Rule":           "#DCDEDB",
    "Slate":          "#52616B",
    "Soft Mint":      "#55C6A3",
    "Deepened Mint":  "#1F7A62",
    "Warm Amber":     "#E6A34A",
    "Amber text":     "#96631B",
    "Muted Coral":    "#D96B62",
    "Coral text":     "#C4544A",
    "Dark primary":   "#2F8E71",
    "White":          "#FFFFFF",
}

NORMAL_TEXT = 4.5   # WCAG AA body text
LARGE_TEXT = 3.0    # >=18pt, or >=14pt bold, and UI boundaries


def parse_hex(s):
    s = s.strip().lstrip("#")
    if len(s) == 3:
        s = "".join(c * 2 for c in s)
    if not re.fullmatch(r"[0-9A-Fa-f]{6}", s):
        raise ValueError(f"not a hex colour: {s!r}")
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def to_hex(rgb):
    return "#%02X%02X%02X" % tuple(int(round(v)) for v in rgb)


def luminance(rgb):
    def channel(v):
        v /= 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = rgb[:3]
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def verdict(ratio):
    if ratio >= NORMAL_TEXT:
        return "PASS       any text"
    if ratio >= LARGE_TEXT:
        return "large only >=18pt or 14pt bold, and UI boundaries"
    return "FAIL       under every floor"


def report_pair(fg_name, fg, bg_name, bg):
    r = contrast(fg, bg)
    print(f"  {fg_name:>14} on {bg_name:<14} {r:5.2f}:1   {verdict(r)}")
    return r


def mode_pair(a, b):
    fg, bg = parse_hex(a), parse_hex(b)
    r = contrast(fg, bg)
    print(f"\n  {to_hex(fg)} on {to_hex(bg)}")
    print(f"  ratio {r:.2f}:1")
    print(f"  normal text (4.5:1) {'pass' if r >= NORMAL_TEXT else 'FAIL'}")
    print(f"  large text  (3.0:1) {'pass' if r >= LARGE_TEXT else 'FAIL'}")
    if r < LARGE_TEXT:
        print("\n  Under every floor. If this needs to read as mint, "
              "use Deepened Mint #1F7A62 (4.83:1 on warm white).")
        print("  A decorative rule or dot is exempt: contrast floors apply to "
              "text, not ornament.")
    print()
    return 0 if r >= LARGE_TEXT else 1


def mode_palette():
    ww = parse_hex(PALETTE["Warm White"])
    card = parse_hex(PALETTE["Card"])
    navy = parse_hex(PALETTE["Ink Navy"])
    white = parse_hex(PALETTE["White"])
    mint = parse_hex(PALETTE["Soft Mint"])

    print("\nText on the warm white ground")
    for name in ("Ink Navy", "Slate", "Soft Mint", "Deepened Mint",
                 "Warm Amber", "Amber text", "Muted Coral", "Coral text"):
        report_pair(name, parse_hex(PALETTE[name]), "Warm White", ww)

    print("\nText on the card")
    for name in ("Ink Navy", "Slate", "Dark primary"):
        report_pair(name, parse_hex(PALETTE[name]), "Card", card)

    print("\nWhite text on fills")
    for name in ("Ink Navy", "Soft Mint", "Deepened Mint", "Dark primary",
                 "Warm Amber", "Muted Coral"):
        report_pair("White", white, name, parse_hex(PALETTE[name]))

    print("\nNavy on mint, the sanctioned pill")
    report_pair("Ink Navy", navy, "Soft Mint", mint)

    print("\nThe two traps")
    print("  White on Soft Mint and Soft Mint as text on warm white are both")
    print("  under 3:1. Mint marks things, it never carries them.")
    print()
    return 0


def mode_image(path, top):
    try:
        from PIL import Image
    except ImportError:
        print("Pillow is needed for --image:  pip install pillow", file=sys.stderr)
        return 2

    im = Image.open(path).convert("RGB")
    im.thumbnail((900, 900))
    pixels = list(im.getdata())
    counts = {}
    for p in pixels:
        q = tuple(v & 0xF8 for v in p)          # quantise to cut JPEG noise
        counts[q] = counts.get(q, 0) + 1

    ranked = sorted(counts.items(), key=lambda kv: -kv[1])
    total = len(pixels)
    bg = ranked[0][0]
    print(f"\n  {path}")
    print(f"  background {to_hex(bg)}  ({100*ranked[0][1]/total:.1f}% of frame)")

    # Ranking by area finds the wrong things. Ornament is large and low
    # contrast; text is small and deliberately visible, which is exactly the
    # combination that hides a failing caption behind a pile of pale blobs.
    # So drop anything too close to the background to be ink (INK_FLOOR), and
    # rank what remains by how badly it fails rather than by how much of the
    # frame it covers.
    INK_FLOOR = 1.25
    AREA_FLOOR = 0.02

    candidates = []
    for colour, n in ranked[1:]:
        share = 100 * n / total
        if share < AREA_FLOOR:
            continue
        r = contrast(colour, bg)
        if r < INK_FLOOR:
            continue                 # ornament, tint, anti-aliasing
        candidates.append((colour, share, r))

    failing = sorted([c for c in candidates if c[2] < LARGE_TEXT],
                     key=lambda c: c[2])
    passing = sorted([c for c in candidates if c[2] >= LARGE_TEXT],
                     key=lambda c: -c[2])

    if failing:
        print(f"\n  {len(failing)} colour(s) visible enough to be text, "
              f"but under every floor:\n")
        for colour, share, r in failing[:top]:
            print(f"    {to_hex(colour)}  {r:5.2f}:1   {share:5.2f}% of frame")
        print("\n  If any of these carries text, that is the thing to change.")
        print("  Mint text on warm white lands here every time: it looks fine")
        print("  and measures about 2:1. Deepened Mint #1F7A62 is the fix.")
    else:
        print("\n  No text-weight colour falls under the floors.")

    if passing:
        print(f"\n  Passing ink, for reference:\n")
        for colour, share, r in passing[:max(3, top // 2)]:
            print(f"    {to_hex(colour)}  {r:5.2f}:1   {share:5.2f}% of frame")

    print("\n  Colours within %.2f:1 of the background were skipped as"
          % INK_FLOOR)
    print("  ornament. A mint rule or a tinted blob is meant to be quiet and")
    print("  contrast floors do not apply to it.\n")
    return 1 if failing else 0


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("colours", nargs="*", metavar="HEX",
                    help="foreground and background, e.g. '#55C6A3' '#F7F6F1'")
    ap.add_argument("--palette", action="store_true",
                    help="check every pairing that matters in Trimio")
    ap.add_argument("--image", metavar="PATH",
                    help="sample a screenshot or video frame")
    ap.add_argument("--top", type=int, default=8,
                    help="how many colours to report for --image (default 8)")
    a = ap.parse_args()

    if a.palette:
        return mode_palette()
    if a.image:
        return mode_image(a.image, a.top)
    if len(a.colours) == 2:
        return mode_pair(*a.colours)
    ap.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
