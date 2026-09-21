#!/usr/bin/env python3
"""Sweep Trimio's screens for the defects that only measurement finds.

    check_screens.py app/ components/          all three checks
    check_screens.py --targets app/            touch targets only
    check_screens.py --type app/               type scale only
    check_screens.py --hex app/                hardcoded colours only

WHY THIS EXISTS. Every defect it looks for shipped, survived months, and was
found by measuring rather than by looking:

  A cancellation guide link with a 14dp touch target, nested inside the card's
  own touchable, so a miss opened a different screen and the failure read as
  the button doing nothing.

  A calendar day cell at 40dp, where the EMPTY days were the hard ones to hit
  and empty days are exactly what somebody taps to ask whether anything is due.

  A muted grey at 2.85:1 carrying text in 27 places across 19 files.

The pattern in all three: they look correct on a good screen in good light, and
good light has been the acceptance test. So the sweep is the acceptance test
now.

WHAT IT IS AND IS NOT. This is a REPORT, not a compiler. It reads source rather
than a rendered tree, so it cannot know a real dp height. It is deliberately
CONSERVATIVE: it only flags a touchable whose style can be shown to have no
height floor at all, which is the case that is provably wrong rather than
merely suspicious. Read every finding before acting, and prefer minHeight over
padding when fixing one, because padding leaves the height at the mercy of the
font's line metrics and minHeight makes it provable.
"""

import argparse
import pathlib
import re
import sys

# Android's minimum touch target. Also Material's, also the WCAG 2.5.8 target
# size floor at AA (24dp) with room to spare, which is the right side to err on
# for a thumb on a phone.
MIN_TARGET_DP = 48

# Material's floor for body text. Below this it is texture, not text.
MIN_FONT_PX = 12

TOUCHABLES = ("TouchableOpacity", "Pressable", "TouchableHighlight",
              "TouchableWithoutFeedback")


def matched_block(src: str, start: int) -> str:
    """From the first `{` at or after `start`, the brace-matched block.

    NOT a regex. These files are full of template literals and nested objects,
    and a negated character class stops at the first inner `}`: that trap has
    cost wrong measurements in this repo five separate times, most memorably a
    cell reported 8dp shorter than it was because `width: `${100 / 7}%`` ended
    the match.
    """
    open_at = src.find("{", start)
    if open_at == -1:
        return ""
    depth = 0
    for i in range(open_at, len(src)):
        if src[i] == "{":
            depth += 1
        elif src[i] == "}":
            depth -= 1
            if depth == 0:
                return src[open_at:i + 1]
    return ""


def style_block(src: str, name: str) -> str:
    """The StyleSheet entry called `name`, or "" when there is none."""
    m = re.search(r"\b" + re.escape(name) + r":\s*\{", src)
    return matched_block(src, m.start()) if m else ""


def opening_tag(src: str, at: int) -> str:
    """The JSX opening tag containing offset `at`, from `<` to its own `>`.

    Brace-counted, so the `>` inside `() => ...` does not end the tag.
    """
    start = src.rfind("<", 0, at)
    if start == -1:
        return ""
    depth = 0
    for i in range(start, len(src)):
        if src[i] == "{":
            depth += 1
        elif src[i] == "}":
            depth -= 1
        elif src[i] == ">" and depth == 0 and i > start:
            return src[start:i + 1]
    return ""


def line_of(src: str, at: int) -> int:
    return src.count("\n", 0, at) + 1


def check_targets(path: pathlib.Path, src: str):
    """Touchables whose style can be shown to have NO height floor.

    Conservative on purpose. A touchable is reported only when its resolved
    style block sets none of minHeight, height, padding, paddingVertical,
    paddingTop or paddingBottom, AND the tag carries no hitSlop. Such a control
    is exactly as tall as whatever is inside it, so an icon-and-small-text row
    lands around 14dp. Anything that sets one of those is left alone: it may
    still be under 48dp, and this cannot tell, which is the honest limit.
    """
    findings = []
    for m in re.finditer(r"<(" + "|".join(TOUCHABLES) + r")\b", src):
        tag = opening_tag(src, m.start() + 1)
        if not tag:
            continue
        if "hitSlop" in tag:
            continue
        sm = re.search(r"style=\{(?:\[)?\s*styles\.(\w+)", tag)
        if not sm:
            # No named style at all, so nothing to resolve. An inline style
            # object is left to the reader rather than guessed at.
            continue
        block = style_block(src, sm.group(1))
        if not block:
            continue
        if re.search(r"\b(minHeight|height|padding|paddingVertical|paddingTop|paddingBottom)\s*:", block):
            continue
        findings.append((line_of(src, m.start()), f"{m.group(1)} styles.{sm.group(1)} "
                        f"sets no height floor and has no hitSlop, so it is as "
                        f"tall as its contents (target likely under {MIN_TARGET_DP}dp)"))
    return findings


def check_type(path: pathlib.Path, src: str):
    """Text set below the readable floor."""
    findings = []
    for m in re.finditer(r"fontSize:\s*(\d+)", src):
        size = int(m.group(1))
        if size < MIN_FONT_PX:
            findings.append((line_of(src, m.start()),
                             f"fontSize {size} is under the {MIN_FONT_PX}px floor for body text"))
    return findings


def check_hex(path: pathlib.Path, src: str):
    """Colours written into a screen instead of taken from lib/theme.ts.

    A hardcoded hex cannot follow the theme, so it is the same colour in light
    and dark mode, and it is invisible to the contrast gate in
    __tests__/theme-contrast.test.js, which only knows about tokens.

    White and black are skipped: `#fff` on a primary fill is idiomatic here and
    the theme has no token for it.

    A line that also declares a `Dark` counterpart is skipped, because that is
    already theme-aware by hand rather than by token. app/onboarding.tsx's
    SLIDE_ICONS is the case that taught this: every entry carries `colorDark`
    and `bgDark` beside `color` and `bg`, so the slides do follow the theme and
    flagging them was pure noise.

    THIS IS THE NOISIEST OF THE THREE CHECKS and should be read as an
    INVENTORY, not a verdict. Roughly half of what it finds is deliberate:
    gradient stops, and the ErrorBoundary's styles in app/_layout.tsx, which
    cannot use the theme hook because it may be catching an error thrown above
    the provider. That one is worth knowing anyway, since it means the crash
    screen is light-theme only.

    A hex that MATCHES a palette token is the more suspicious case, not the
    less: a hardcoded #142B3A means dark mode renders ink navy where the theme
    would have sent something else.
    """
    findings = []
    lines = src.split("\n")
    for m in re.finditer(r'"(#[0-9A-Fa-f]{3,8})"', src):
        hex_v = m.group(1).lower()
        if hex_v in ("#fff", "#ffffff", "#000", "#000000"):
            continue
        if "Dark:" in lines[line_of(src, m.start()) - 1]:
            continue
        findings.append((line_of(src, m.start()),
                         f"{m.group(1)} is hardcoded, so it cannot follow the theme "
                         f"and the contrast gate cannot see it"))
    return findings


CHECKS = {"targets": check_targets, "type": check_type, "hex": check_hex}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("paths", nargs="+", help="files or directories of .tsx")
    for name in CHECKS:
        ap.add_argument(f"--{name}", action="store_true", help=f"only the {name} check")
    args = ap.parse_args()

    wanted = [n for n in CHECKS if getattr(args, n)] or list(CHECKS)

    files = []
    for p in args.paths:
        path = pathlib.Path(p)
        if path.is_dir():
            files.extend(sorted(path.rglob("*.tsx")))
        elif path.suffix == ".tsx":
            files.append(path)
    if not files:
        print("no .tsx files found", file=sys.stderr)
        return 2

    total = 0
    for f in files:
        src = f.read_text(encoding="utf-8")
        rows = []
        for name in wanted:
            rows.extend((line, name, msg) for line, msg in CHECKS[name](f, src))
        if rows:
            print(f"\n{f}")
            for line, name, msg in sorted(rows):
                print(f"  {f}:{line}  [{name}] {msg}")
            total += len(rows)

    print(f"\n{len(files)} files, {total} findings across: {', '.join(wanted)}")
    if total:
        print("These are a REPORT, not a verdict. Read each one: this reads source,\n"
              "not a rendered tree, so it cannot know a real dp height. Prefer\n"
              "minHeight over padding when fixing a target, because padding leaves\n"
              "the height at the mercy of the font.")
    # Exit 0 either way. A report that fails the build gets disabled, and a
    # disabled check is the shape this project already has on record from a
    # workflow that was red on every push until nobody read red any more.
    return 0


if __name__ == "__main__":
    sys.exit(main())
