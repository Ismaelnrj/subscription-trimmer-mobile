---
name: trimio-design
description: Trimio's brand palette, contrast floors, category colour constraints and copy rules, with scripts that measure rather than eyeball. Use this whenever work touches how Trimio looks or reads: picking or changing any colour, editing lib/theme.ts or lib/categories.ts, designing or reviewing a screen, building the Stats donut or any chart, writing or reviewing Play Store copy, in-app strings, locale files, video captions, ad copy or landing page text, reviewing a screenshot or promo video frame, or answering "does this look right". Also use it before saying any colour pairing is fine, because several Trimio colours fail contrast in ways that look acceptable to the eye. Also use it before adding or editing a text field (login, signup, password, codes), and before changing the landing page or the cancellation guide pages.
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

## Before you approve any screen, sweep it

Contrast is one of three things that only measurement finds. The other two are
touch targets and type size, and all three have shipped defects that survived
months of looking at the app.

```bash
python3 .claude/skills/trimio-design/scripts/check_screens.py app/ components/
python3 .claude/skills/trimio-design/scripts/check_screens.py --targets app/
python3 .claude/skills/trimio-design/scripts/check_screens.py --type app/
python3 .claude/skills/trimio-design/scripts/check_screens.py --hex app/
python3 .claude/skills/trimio-design/scripts/check_screens.py --forms app/
```

Note the FULL path. Releases are run from the repo root, where a bare
`scripts/...` fails: the release skill already made exactly that mistake.

**targets** flags a touchable whose resolved style sets no minHeight, height or
vertical padding and whose tag carries no hitSlop. Such a control is exactly as
tall as its contents, so an icon beside small text lands around 14dp against a
48dp floor. Deliberately conservative: it reports only the provably wrong case,
so a control that sets padding is left alone even though it may still be short.
When fixing one, prefer `minHeight` over padding, because padding leaves the
height at the mercy of the font's line metrics and minHeight makes it provable.

**type** flags `fontSize` under 12, Material's floor for body text.

**hex** inventories colours written into a screen rather than taken from
lib/theme.ts. This is the noisy one: roughly half of what it finds is
deliberate. A hex that MATCHES a palette token is the more suspicious case, not
the less, because a hardcoded `#142B3A` means dark mode renders ink navy where
the theme would have sent something else.

**forms** flags a text field that holds a credential or a code and does not
say so. A password field (secureTextEntry) needs `autoComplete`
`current-password` (sign in, confirming) or `new-password` (sign up, change);
an email field needs `autoComplete="email"`, `keyboardType="email-address"` and
`autoCapitalize="none"`; a numeric code field needs
`autoComplete="one-time-code"`. Any field with `contextMenuHidden` is flagged,
because that blocks paste. Android's autofill, Google Password Manager for most
people, finds these fields ONLY through the hint: until 2026-11-01 none of the
app's 25 fields carried one, so signing in on a new phone meant typing both
from memory. The values are React Native's cross platform names, which
TextInput.js maps on Android to `password`, `password-new` and `sms-otp`; that
was read from the v0.79.6 source rather than remembered. An unknown value is
not a crash there (it logs and switches autofill off for that field), but it
silently does nothing, so use the names above.

None of the four exits non-zero. A report that fails the build gets disabled,
and this repo already has a workflow that was red on every push until nobody
read red any more. The forms rule is the exception that proves the point: it
has no noise, so its gate is a test, `__tests__/form-autofill-and-ellipsis.test.js`,
not this script's exit code.

## Redesigning a screen: the generated look, and how to tell (2026-11-07)

The owner's brief for the redesign: the app "looks AI generated" and must look
"expensive, premium and professional". Two GitHub skills were read in full for
it and NEITHER IS INSTALLED, for the same reason as the Vercel rules above:

- `anthropics/skills` `frontend-design` (read at `2c5958e`). Web focused, but
  its list of what generated interfaces cluster on is the most precise
  description of the owner's complaint there is. The rules taken from it:
  1. **No middle dots joining meta text** ("A · B · C"). Use a comma, a
     preposition ("a year for 5 subscriptions") or two lines.
  2. **No arrow appended to link or button text.** A chevron icon carries
     "goes somewhere" in this app, as the View all row already does.
  3. **No all caps labels, no eyebrow above every heading.** Same rule as the
     site's, now for the app.
  4. **Not the card kit:** identical rounded cards, one radius on everything,
     the same soft grey shadow under each. Cards here are hairline bordered
     with no shadow, and a card exists only to group rows.
  5. **Spend boldness in one place.** One element per screen leads (the
     dashboard's monthly total, in `type.display`); everything around it is
     quiet. "Remove one accessory" before calling a screen done.
  6. **Copy:** the button names the action, the toast repeats the button's
     verb, an empty state says what to do next.
  Rules 1 and 2 are text and are GATED: `__tests__/redesign-tells.test.js`
  scans every screen in its `REDONE` list. Add each screen there when its
  redesign lands. The rest are a review, done on the rendered screen.
  ITS OWN FIRST RUN FOUND THREE TELLS IN THE FIRST REDESIGNED SCREEN, written
  by the same session that later read the list: two middle dots and an arrow
  on the dashboard. Check a screen against this list BEFORE showing it.
  ONE TELL IS THE BRAND AND STAYS: a warm cream ground near `#F4F1EA` is
  trait one on that list, and Trimio's Warm White is `#F7F6F1`. The palette is
  the brief, so it wins; the cure is everything else on this list.
- `nextlevelbuilder/ui-ux-pro-max-skill` (read at `b7d5353`). A searchable
  database of styles and palettes for generating a design system from
  nothing, which Trimio does not need, plus a React Native file of generic
  coding advice. Its `references/pro-rules.md` app checklist overlaps what
  this skill already measures (contrast, 48dp targets, safe areas, a 4/8 point
  rhythm, one icon family). Its search script was not run: a safety check
  refused executing code from outside the repo.

The scale every redone screen takes its numbers from is `space`, `radius`,
`type` and `tabular` in `lib/theme.ts`. A number off that scale is a decision.

## The theme's own contrast is a CI gate, not a habit

`__tests__/theme-contrast.test.js` computes the WCAG ratio of every
text-bearing token against the ground it actually renders on, in both themes,
from `lib/theme.ts`. It is the reason the quiet grey cannot fail again: three
tokens shared one hex per theme and all six pairings were under 4.5:1, with the
light one at 2.85:1, under even the 3:1 floor.

Do not duplicate that here. Use `check_contrast.py` for a pairing that is not
yet in the theme, and `check_screens.py` for what the gate cannot see.

ONE GAP IS OPEN AND NAMED RATHER THAN HIDDEN: white on dark `primary` #2F8E71
is 4.02:1, under the 4.5:1 text floor and over the 3:1 large-text one. It was
chosen to balance both directions the way the old violet did, and 36 call sites
put white on a primary fill, so raising it is a product decision. The test
asserts it at 3:1 AND asserts it is still under 4.5, so closing the gap means
tightening that assertion in the same commit.

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
| Muted Coral | `#D96B62` | Text version `#B8473D`. **Not `#C4544A`**, which this table claimed for months: measured it is 4.12:1 on the ground and 3.93:1 on `dangerLight`, where an error message actually sits |

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

**The same pass enforces the ellipsis: "…", never "...".** One character cannot
break across a line, and it is the form a screen reader treats as a pause. All
18 loading and search strings in the two locale files used three full stops
until 2026-11-01. `check_copy.py` reports both rules together, and
`__tests__/form-autofill-and-ellipsis.test.js` gates the locale files in CI.

## The site: landing and guide pages, measured in Chromium

Taken on 2026-10-11 from the taste-skill project (Leonxlnx/taste-skill), which
was read in full and deliberately NOT installed: its defaults are React,
Tailwind and heavy motion, and its sibling skills pull photos and logos from
third party CDNs, which this site self hosts its fonts to avoid. These four
rules were the part worth keeping, because each one is a fact about the page
rather than a taste.

```bash
node .claude/skills/trimio-design/scripts/check_landing.js
node .claude/skills/trimio-design/scripts/check_landing.js backend/landing-de.html
```

It measures the GENERATED pages, both languages by default, in a real
Chromium with Montserrat actually loaded from `backend/fonts/`. It refuses to
measure (exit 2) if the font fails to load, because a fallback font gives the
numbers of a different page. Exit 1 means a rule failed. Playwright and
Chromium are preinstalled in cloud sessions; on another machine it exits 2 and
says why. Fixes go into `tools/landing-source.html` or `tools/landing-de.json`
and then `tools/build-landing.py`, never into the generated HTML.

1. **The hero fits the first screen.** The headline and the first call to
   action both end inside the viewport at 360x640, 390x844 and 1280x800. A
   button below the fold is a button most visitors never see.
2. **The hero lead is 20 words or fewer.** If the value cannot be said in 20
   words, the value is unclear, not the limit too tight. German runs about a
   fifth longer than English, so write the German to the limit, not the
   English with a translation.
3. **Eyebrow labels are rare.** An eyebrow is the small uppercase label with
   letter spacing above a section heading (`.eyebrow` and `.kicker` here). One
   on every section is the most recognisable template look there is. After a
   section with one, the next two sections carry none. The script finds them
   by how they look, not by class name, so a new class does not hide one.
4. **Every multi column layout collapses on a phone.** At 320 and 360 wide the
   page must not scroll sideways (that fails). Grids still running several
   columns at 360 are listed for a person to look at, not failed, because
   some are intentional: the rows inside the phone mockup are icon, name,
   price, and that is correct.

FIRST MEASUREMENT, 2026-10-11, before anything was changed: both pages pass
collapse; both hero leads fail (25 words English, 24 German); both pages carry
an eyebrow on 8 of 9 sections; and the GERMAN hero does not fit at 360x640
(button ends at 793px) or at 1280x800 (button ends at 828px), so a German
visitor on a laptop sees no signup button without scrolling. English fits at
all three sizes.

### Six more rules, on every page including the guides (2026-11-01)

Taken from Vercel's Web Interface Guidelines
(`vercel-labs/web-interface-guidelines`, `command.md`, 104 rules), read in full
and NOT installed as a skill. Its skill file tells the agent to download the
rules afresh from that URL on every run, unpinned, which hands whoever controls
the file a say in what runs in a repo that deploys on push. Most of the 104 are
written for React web apps; these six apply to a static page and can be
measured, so they live in `check_landing.js`, which now also covers every page
under `backend/guides/`:

5. **names.** Every form control has a label (a placeholder is not one), every
   link and button has something a screen reader can say, every image has an
   `alt` (empty is right for a decorative one). Content inside `role="img"` is
   skipped, since a screen reader never reaches it. `aria-hidden` is NOT
   skipped: the account dialog is aria-hidden while closed, and skipping it
   meant the first draft never looked at the signup form and passed a copy
   with a label removed.
6. **headings.** One h1, no level skipped. The hero's phone mockup broke this
   with a fake "Your upcoming" h3; it is now `role="img"` with a label, which
   also stops a screen reader reading "9:41 ● ● ●" aloud.
7. **focus.** Tab through the page, and through each account dialog mode
   opened in turn, and every stop must look different from at rest: an
   outline, or a changed shadow, border, background or text colour.
   Transitions are switched off first so the end state is what gets read.
8. **motion.** With the phone set to reduce motion, scrolled top to bottom,
   nothing animates. The floating notification card ignored it until
   2026-11-01; `tools/build-landing.py` now stops every animation and
   transition under that setting, not only the scroll reveal.
9. **shift.** Layout shift at 360x640 with every asset held back 150ms.
   REPORTED, never failed: the number depends on the fallback font of the
   machine measuring, and a phone's fallback is not the sandbox's. Measured
   2026-11-01: German landing 0.244, English 0.032, guides at most 0.068,
   against Google's good line of 0.1. The German one is the hero re-wrapping
   when Montserrat replaces the fallback. The cheap fix is
   `font-display: optional` on the two preloaded hero weights, at the cost of
   the system font on a slow first visit; not done, since with no field data
   at this traffic the trade is not yet worth making.
10. **language.** The German twin of a page carries no label, placeholder,
    alt, title or description identical to the English page's, counting only
    strings of two words or more so "Name" and "Trimio" pass. Its first run
    found SEVEN on the German landing page, every one a screen reader label or
    placeholder ("Primary navigation", "Your password", "Trimio home"...), and
    "Your name" had been fixed by hand an hour earlier. That is the bare
    English JSX text node class again, on the web side: words nobody sees, so
    nobody reads them in German.

Negative tested against the real defects: the pages before the fix fail
headings, motion and language; a copy with focus styles stripped fails focus on
21 of 23 stops; a copy with one label removed fails names.

### What else was looked at and left out (2026-11-01)

From the same list of "Claude Code plugins for better websites": the taste
skill and its image to code skill are the project already read and declined on
2026-10-11 (above). Awesome DESIGN.md is a collection of OTHER companies'
design systems written for an agent to copy; this skill is Trimio's own, and
borrowing another brand's look is the opposite of what it is for. Playwright
CLI adds nothing: every cloud session already has Playwright and Chromium, and
this script and CI already drive them.

## Store copy: count the head terms, do not read for them

A Play short description does TWO jobs at once, discovery and conversion, and
the second is the one you can see. Copy written only for conversion silently
pays for it out of the first.

```bash
python3 scripts/check_copy.py --keywords de "Abos, Kosten, Testphasen. ..."
python3 scripts/check_copy.py --keywords en "..." --against "the line it replaces"
```

It reports the character count against Play's 80 limit, applies the dash rule,
and splits terms into two tiers. **Zero CATEGORY terms fails.** Supporting
terms never substitute for one, because somebody searching for this app does
not yet know what makes it different.

WHY IT EXISTS: on 2026-09-22 a proposed German line, `Jede Verlängerung im
Blick. Über 30 Anleitungen zum Kündigen. Ohne Bankzugang.`, carried none of
Abo, Abos, Abonnement, Tracker, Kosten or Testphase. It spent 78 characters of
the second most weighted indexed field on no category word at all, and it reads
well, which is exactly why reading it did not catch it. The English draft
dropped `subscription`. Same class as the `über 160 Vorlagen` overclaim: a
number or a term that reaches marketing copy has to be COUNTED.

THE TWO TIERS ARE THE WHOLE POINT, and the first draft of this checker got it
wrong. It had ONE list holding both, so `kündig`, `anleitung` and
`verlängerung` satisfied the floor and it passed the very line it was written
to catch. Its own negative test found that, which is the argument for writing
the negative test first.

IT PRINTS THE SURFACE FORM IT MATCHED, deliberately. German `kostenlos`
contains `kosten` and Play would not rank it for that query, so a reader has to
be able to see WHAT matched and overrule the count. Report, not verdict, same
as `check_screens.py`.

THE TERM LISTS ARE A MARKETING JUDGEMENT rather than a measurement, unlike
every other number in this skill. They are near the top of `check_copy.py` and
are meant to be edited when the positioning changes.

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
