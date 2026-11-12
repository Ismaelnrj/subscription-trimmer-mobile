# Trimio palette, measured

Every ratio here was computed, not estimated. Recompute with
`scripts/check_contrast.py --palette` rather than trusting this table if you
suspect drift.

## Values

| Role | Hex | Where it lives |
|---|---|---|
| Ink Navy | `#142B3A` | Light theme primary and text, app.json primaryColor, headings, fills behind white |
| Ground | `#F3F5F6` | The page and app ground since 2026-11-12, mixed from Ink Navy's hue. Was the cream `#F7F6F1` |
| Card | `#FFFFFF` | Card surfaces, no outline in light. Was the warm paper `#FCFBF8` |
| Rule | `#E2E6E9` | Hairlines, dividers, control borders. Was `#DCDEDB` |
| Slate | `#52616B` | Secondary and supporting text |
| Soft Mint | `#55C6A3` | The logo, and good news only. Never text, never behind white |
| Deepened Mint | `#1F7A62` | Good news that is text, on a light ground |
| Dark ink | `#F2F1EC` | Dark theme text AND primary since 2026-11-12. Dark primary was `#2F8E71`, still the notification tint in app.json |
| Warm Amber | `#E6A34A` | Ornament |
| Amber text | `#96631B` | Amber that carries text on light |
| Muted Coral | `#D96B62` | Ornament |
| Coral text | `#B8473D` | Coral that carries text on light (`danger`). Not `#C4544A`, see below |

The app's light theme deliberately uses the same values as the landing page,
the guide pages and the emails for ground, card, rule, ink, slate and mint. If
either side changes, change both, or the site and the app stop looking like
one product. Both moved together on 2026-11-12.

## Measured pairings

Floors: 4.5:1 normal text, 3:1 large text and UI boundaries. Recomputed
2026-11-12 with `scripts/check_contrast.py --palette`.

### On the light ground `#F3F5F6`

| Colour | Ratio | Verdict |
|---|---|---|
| Ink Navy | 13.37:1 | Safe for anything |
| Slate | 5.85:1 | Body text fine |
| Deepened Mint | 4.78:1 | Body text fine |
| Amber text `#96631B` | 4.69:1 | Body text fine |
| Coral text `#B8473D` | 4.79:1 | Body text fine |
| **Muted Coral** | **3.08:1** | Large text only, barely |
| **Soft Mint** | **1.92:1** | **Fails every floor** |
| **Warm Amber** | **1.98:1** | **Fails every floor** |

On a white card every one of these is higher (Ink Navy 14.62, Slate 6.40,
Deepened Mint 5.23).

### White text on fills

| Fill | Ratio | Verdict |
|---|---|---|
| Ink Navy | 14.62:1 | Safe |
| Deepened Mint | 5.23:1 | Safe for anything |
| **Muted Coral** | **3.37:1** | Large text only |
| **Soft Mint** | **2.10:1** | **Fails every floor** |
| **Warm Amber** | **2.16:1** | **Fails every floor** |

### The coral text colour did not reach the body floor (RESOLVED 2026-09-21: the app uses `#B8473D`)

`#C4544A` is documented as the coral to use when coral must carry text on a
light ground, by analogy with `#96631B` for amber. Amber's version works:
4.74:1, comfortably past 4.5. Coral's lands at **4.12:1**, which is large text
only.

That is fine wherever coral is used the way it currently is, as an alert
accent on headings and badges rather than body copy. But it is not the
drop-in equivalent of the amber value, and treating it as one would put body
text under the floor. If coral ever needs to carry running text, darken it
further rather than assuming parity with amber.

### The sanctioned mint pill

Navy on Soft Mint is **6.96:1**. That is the one comfortable way to use mint
behind type, and it is why pills and trim tabs put navy on mint rather than
white.

## Why Soft Mint is the recurring trap

It reads as a confident brand colour, so the instinct is to set headings in it
or put white on it. Both fail, and they fail in a way good eyesight on a good
screen does not notice. At 21px a 1.9:1 mint triangle is a ghost, which is why
the site header uses Deepened Mint and the navy footer uses the bright one.

The rule that resolves it: **mint marks things, it never carries them.**

## lib/theme.ts, primary is for marks

`primary` used to be a fill behind white text and a text colour at once, and
dark mode's mint `#2F8E71` (4.0:1 under white, 3.9:1 on the card) passed
neither for text. Since 2026-11-08 no screen puts text on or in it, and since
2026-11-12 it is ink in both themes: Ink Navy in light, `#F2F1EC` in dark. It
colours spinners, the limit meter and the top weekly bar. Bright mint lives in
`accent`, which no screen uses; the mint guard test keeps it that way.

## lib/categories.ts and the adjacency constraint

Ten real categories plus `other`. The set was validated against the warm white
ground (and on 2026-11-12 against `#F3F5F6` and white, same results) on the **adjacent** pairlist, which is the correct test for a donut:
slices only ever touch their neighbours, so non-adjacent pairs may legitimately
look similar.

Two pairs fail when adjacent and are currently kept apart by declaration order:

- red with olive-green
- orange with green

**This makes the order part of the validated result, not a cosmetic detail.**
Reordering the map without re-running the adjacency check silently reintroduces
both failures, and the failure mode is invisible to anyone with normal colour
vision.

`other` is the one deliberate neutral and should stay neutral, because it is
the slice that means "nothing specific".

These colours drive four surfaces simultaneously: quick-add icons, subscription
card icons, the Stats donut and legend, and calendar day dots. There is no such
thing as a local change here.

## The donut cap

Six named slices plus a labelled Other row, set by `DONUT_SLICES` in
`app/(tabs)/analytics.tsx`.

Three was tried and rejected: it was tighter than the colours require and hid
real categories, which defeats the purpose of the chart. Eleven fails the other
way, because the colours stop being distinguishable. Six is where both
constraints are satisfied at once.

Always label the folded remainder. An unexplained wedge reads as a bug rather
than as a summary.

## The mark

A chevron pointing right, inner edge a V, outer edge a circular arc, with a
mint triangle nesting into the V.

It is never redrawn. `tools/trace-mark.py` lifts the two shapes out of the
approved artwork as soft alpha masks and records their proportions; every
generator scales and tints those masks. Two earlier attempts redrew the outline
from measurements and then from a simplified polygon, and both drifted into an
inverted Pac-Man.

Three details that are easy to miss and each caused a visible error:

- The mark is **not centred** in its tile. It sits 2.20% right and 1.29% high.
  Fixing that alone took the difference from the artwork from 24.1 to 3.9 mean
  per channel.
- The icon field is a diagonal far deeper than the UI's Ink Navy, running
  `#051E2F` top left to `#00101E` bottom left.
- The triangle carries a vertical ramp, `#4FEEC3` down to `#24D2A4`. The
  chevron is flat warm white.

The mint triangle sits on the page ground rather than on the chevron, so it
takes `#1F7A62` on light grounds and `#55C6A3` on navy.
