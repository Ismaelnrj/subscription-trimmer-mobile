# Store listing: the cancellation and privacy paragraph

A paragraph to ADD to the Play full description, in both languages, plus the
onboarding slide that now matches it. Written 2026-09-22.

## Why this exists

The listing led with tracking, which is what every competitor leads with.
Measured against the market on 2026-09-21: Tilla, Subby, Bobby, ReSubs, Rocket
Money and AboTracker all track subscriptions, and Tilla, Bobby, ReSubs and
Rocket Money all send a reminder before the charge. So neither tracking nor the
advance warning is a differentiator, and a listing claiming to be alone in
either is a claim a rival's comparison page disproves in one sentence.

What survives the comparison is narrower and real: the cancellation guides, and
having nothing to connect. Rocket Money needs a bank login. ReSubs wants Gmail
access. Tilla has neither trial tracking nor cancellation help.

## Every claim below was verified before it was written

| Claim | Verified how |
|---|---|
| over 30 cancellation guides | 36 counted in `lib/cancellation-guides.ts`, by walking braces and listing the keys |
| no bank account to connect | zero matches for plaid, truelayer or open banking across app/, lib/, backend/ |
| no email login | the paste parser is text in, not an account connection |
| Trimio reads the pasted email on your phone | `lib/parse-subscription.ts` is 290 lines with ZERO network calls |

**THE COUNT WAS WRONG IN CLAUDE.md AND IT SAID 41.** That number matches the 41
occurrences of `url:` in the guides file, which includes URLs inside note text,
so it was a grep artefact rather than a count. There are 36 real guides plus one
generic fallback. Corrected in CLAUDE.md in the same commit as this file.

**SAY "OVER 30", NOT 36.** Same discipline as the template count, which went from
an overclaimed "über 160" to "über 120" against 127 actual: round down to a
threshold that stays true when a guide is removed. If the catalogue grows past
40, re-count by listing the keys, never by grepping `url:`.

**WHAT MUST NOT BE WRITTEN, and I nearly did:** "your data never leaves your
phone". It is false. `subscriptions.name` and `subscriptions.price` are columns
in Postgres on Railway, so subscription names and prices do leave the phone. The
true claim is about what you are NOT asked to CONNECT, and about where the
pasted email is parsed. Keep that distinction: it is the difference between
accurate copy and a Data Safety declaration that contradicts the listing.

No Apple service is named, even though guides exist for four of them, because
Trimio is Android only. The live German listing does name iCloud, which predates
this and is the owner's call to keep or change.

## English, for the main Play listing

Append to the full description. **438 characters**, and the live description was
about 2566 against a 4000 limit, so there is room.

```
Knowing is only half of it. Trimio carries step by step cancellation guides for over 30 services, from Netflix and Spotify to Disney+ and Amazon Prime, so when you decide to drop something you know exactly where to click instead of digging through account settings.

There is also nothing to connect. No bank account, no email login. You add a subscription by typing it, or by pasting a confirmation email that Trimio reads on your phone.
```

## German, for the de-DE listing

Append to the German full description, under Grow > Store presence > Main store
listing > Manage translations > German (Deutschland). **472 characters.**

```
Wissen ist nur die Hälfte. Trimio enthält Schritt-für-Schritt-Anleitungen zum Kündigen für über 30 Dienste, von Netflix und Spotify bis Disney+ und Amazon Prime. Wenn du ein Abo beenden willst, weißt du genau, wo du klicken musst, statt dich durch Kontoeinstellungen zu wühlen.

Und es gibt nichts zu verbinden. Kein Bankkonto, keine E-Mail-Anmeldung. Du fügst ein Abo hinzu, indem du es eintippst oder eine Bestätigungsmail einfügst, die Trimio auf deinem Handy ausliest.
```

Terminology matches `locales/de.json`: informal du, Abo, and Kündigen, which is
already the label on the in-app button. The hyphens in
"Schritt-für-Schritt-Anleitungen" and "E-Mail" are compound hyphens, which German
spelling requires and the dash rule explicitly permits. `check_copy.py` passes on
both, and it was run rather than assumed.

## The onboarding slide, already shipped in the locale files

Slide 3 was "Save money intelligently", about the category breakdown and the
budget. Replaced with the cancelling beat, because analytics is discoverable by
opening the Stats tab whereas nothing in the app told a new user the guides
existed at all.

|  | English | German |
|---|---|---|
| Title | Cancel without the hunt | Kündigen ohne langes Suchen |
| Body | Step by step guides for over 30 services. No bank account to connect, no inbox to hand over. | Schritt-für-Schritt-Anleitungen für über 30 Dienste. Kein Bankkonto verbinden, kein Postfach freigeben. |

THE TRADE-OFF, stated rather than hidden: the budget goal and the category
breakdown now go unmentioned in onboarding. That is deliberate and reversible in
one commit. Both new strings are within a few characters of the ones they
replace, so the three slide layout is unchanged and no slide was added, which
matters because `SLIDE_ICONS` is one slide per brand colour and a fourth would
break that.

## Before you publish

- Play Console counts characters including spaces. Paste and read its own
  counter rather than trusting the numbers above.
- The full description that is LIVE is not the one in `store-listing-de.md`'s
  code block: that block is 1405 characters and the merged version actually
  uploaded is about 2566. Append to what is live, in Console.
- The onboarding change is a locale edit, so it ships over the air. The listing
  change is a Console edit and needs no build and no publish.
