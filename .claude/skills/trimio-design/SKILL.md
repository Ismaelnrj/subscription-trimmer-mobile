---
name: trimio-design
description: Trimio's brand palette, contrast floors, category colour constraints and copy rules, with scripts that measure rather than eyeball. Use this whenever work touches how Trimio looks or reads: picking or changing any colour, editing lib/theme.ts or lib/categories.ts, designing or reviewing a screen, building the Stats donut or any chart, writing or reviewing Play Store copy, in-app strings, locale files, video captions, ad copy or landing page text, reviewing a screenshot or promo video frame, or answering "does this look right". Also use it before saying any colour pairing is fine, because several Trimio colours fail contrast in ways that look acceptable to the eye.
---

# Trimio design and copy rules

Trimio's palette has a specific trap in it: **Soft Mint looks like it should
carry text and cannot.** It reads as a confident brand colour, so people put
white text on it or set headings in it, and both fail contrast badly enough to
be unreadable for some users. Every rule below exists because something broke.

The single most useful habit this skill encodes: **measure, do not eyeball.**
Contrast is not intuitable. Soft Mint on warm white looks fine to most people
with good vision on a good screen and measures 1.9:1, which is under even the
loosest floor there is.

## Before you approve any colour pairing

Run the checker rather than guessing:

```bash
python3 scripts/check_contrast.py "#55C6A3" "#F7F6F1"     # two colours
python3 scripts/check_contrast.py --palette                # the whole palette
python3 scripts/check_contrast.py --image frame.jpg        # sample an image
```

It reports the WCAG ratio and which floors pass: 4.5:1 for normal text, 3:1
for large text and UI boundaries. `--image` finds the dominant text-like
colours in a screenshot or video frame and checks them against their
background, which is how you review a promo video or a store screenshot.

## The palette

| Role | Hex | Notes |
|---|---|---|
| Ink Navy | `#142B3A` | The workhorse. White on it is about 12:1, always safe |
| Warm White | `#F7F6F1` | The ground. Not pure white, which reads cold beside it |
| Card | `#FCFBF8` | Warm paper, not white, for the same reason |
| Rule | `#DCDEDB` | Hairlines and dividers |
| Slate | `#52616B` | Secondary text |
| Soft Mint | `#55C6A3` | **Marks things. Never carries them.** See below |
| Deepened Mint | `#1F7A62` | Use when type must read as mint. 4.8:1 on warm white |
| Warm Amber | `#E6A34A` | Text version `#96631B` |
| Muted Coral | `#D96B62` | Text version `#C4544A` |

Intended weighting is roughly 60% warm white, 25% navy, 10% mint, 5% the rest.
The restraint is the point. When a design feels flat, the fix is hierarchy and
spacing, not more mint.

## The mint rule, which is the one that keeps getting broken

Soft Mint `#55C6A3` measures **2.1:1 under white text** and **1.9:1 as text on
warm white**. Both are under the 3:1 large-text floor, so there is no size at
which either becomes acceptable.

**Mint is for:** fills, rules, underlines, offset shadows, dots, trim tabs,
progress tracks, and pills where navy sits on mint (7.0:1, comfortable).

**Mint is never:** a fill behind white text, running text, a heading, or a
caption over video.

When something must read as mint, use `#1F7A62`. It is close enough that
nobody notices the substitution and it measures 4.8:1 on warm white.

A decorative rule in mint is fine at any contrast, because a rule is not text
and contrast floors do not apply to it. Do not "fix" those.

## lib/theme.ts: primary works in both directions

`primary` is used both as a fill behind white text and as text on a surface,
so it has to pass in both directions at once. That is a tighter constraint
than it looks.

- Light theme primary is Ink Navy.
- Dark theme primary is `#2F8E71`, chosen because it balances both ways: 4.0:1
  under white, 3.9:1 on the card.
- The bright mint lives in the separate `accent` token.

**Do not set dark `primary` to `#55C6A3`.** Around 36 call sites put white on a
primary fill, and every one would drop to 2.1:1 at once. This is the single
highest-blast-radius colour change in the codebase.

## lib/categories.ts: declaration order is load bearing

The ten real categories are a validated categorical palette, checked against
the warm white ground on the **adjacent** pairlist, which is the right test
for a donut because slices only touch their neighbours.

**Reordering the map without re-validating silently reintroduces failures.**
Red with olive-green, and orange with green, both fail when adjacent. They are
currently kept apart by the declaration order alone, which means the order is
not cosmetic.

If you add, remove or reorder a category, re-run the adjacency check before
shipping. `other` is the one deliberate neutral and should stay that way.

These colours drive four surfaces at once: quick-add icons, subscription card
icons, the Stats donut and its legend, and calendar day dots. A change is
never local.

## The Stats donut caps at 6 named slices

Plus a labelled Other row. `DONUT_SLICES` in `app/(tabs)/analytics.tsx`.

Three was tried first and was wrong: tighter than the colours require, and it
hid real categories, which defeats the chart. Eleven is also wrong, because at
that count the colours stop being tellable apart. Six plus Other is the point
where both constraints are satisfied.

If a slice is folded into Other, say so in the legend. An unexplained wedge
reads as a bug.

## The copy rule: no dash as clause-separating punctuation

In anything a user reads (Play Store copy, in-app strings, locale files, video
captions, ASO copy, landing page, emails), a dash, en dash or em dash is never
used to separate clauses. Use a colon, comma or period.

```bash
python3 scripts/check_copy.py locales/en.json locales/de.json
python3 scripts/check_copy.py store-listing-de.md
```

This does not apply to code comments or internal docs. Hyphens inside compound
words are fine: "E-Mail", "Google-Konto", "opt-out". The checker knows the
difference, it looks for a dash with whitespace around it and for en/em dashes
anywhere.

When fixing English copy, check what the German counterpart does first. The
German locale was written to this rule and its punctuation choice is usually
the right answer. Watch for one trap: German tolerates a comma splice where
English needs a period, so a comma is not always the right port.

## Localisation parity needs two checks, not one

Matching key counts prove nothing. Both locale files sat at 562 keys with
nothing missing while a German string was still broken, because it had quietly
dropped a `{{symbol}}` placeholder that the English used. i18next ignores an
unused interpolation value in silence, so nothing crashes and nothing warns.

```bash
python3 scripts/check_copy.py --parity locales/en.json locales/de.json
```

That compares key names **and** the `{{...}}` tokens inside each value.

## Reviewing a screenshot or video frame

1. Run `check_contrast.py --image` on it, which surfaces text colours that
   fail against their background.
2. Check the device frame. Trimio is **Android only**, there is no iOS build,
   so an iPhone mockup or an Apple App Store badge is a factual error, not a
   style preference. It sends people to a store where the app does not exist.
3. Check the footage is current. Screens captured before a fix shipped will
   advertise bugs that no longer exist.
4. Check the mark: a chevron pointing right, inner edge a V, outer edge a
   circular arc, with a mint triangle nesting into the V.

## When a rule here conflicts with what looks good

Say so plainly and give the measured numbers, then offer the nearest option
that passes. "That mint heading is 1.9:1, which fails; `#1F7A62` looks
almost identical and passes at 4.8:1" is more useful than either silently
changing it or refusing.

The floors are not aesthetic preferences. They are the difference between
readable and unreadable for people with low vision, on a dim screen, or
outdoors.

## Further detail

`references/palette.md` has the full measured table, every pairing that has
been checked, and the reasoning behind the category ordering. Read it when you
need a value that is not above, or when changing `lib/categories.ts`.
