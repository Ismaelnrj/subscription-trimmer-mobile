# Positioning test: lead with the cancellation guides

## Why this exists

Trimio's store copy sells the CATEGORY. Every subscription tracker says some
version of "know before you are charged", so nothing in the listing tells a
reader why this one rather than Tilla, Subby, ReSubs or Rocket Money.

The one thing nothing else in that set advertises is the **36 cancellation
guides**, bilingual, with real steps and a direct link. Rocket Money charges up
to $14/month partly to provide that. On the landing page it was the EIGHTH
feature card, described as "clear cancellation guidance", a phrase claiming
nothing a reader can check.

**Positioning is reversible in an afternoon. Pricing is not.** This is the
cheaper of the two experiments and it runs first.

## What to change in Play Console

Grow > Store presence > Main store listing.

### Short description

Play's limit is 80 characters. Counts are measured, not estimated.

| | text | count |
|---|---|---|
| **EN** | `See every renewal before it hits. Over 30 guides to actually cancel.` | 68/80 |
| **DE** | `Jede Verlängerung im Blick. Über 30 Anleitungen zum Kündigen. Ohne Bankzugang.` | 78/80 |

The German is under Manage translations > German (Deutschland).

### First paragraph of the full description

Replace the opening paragraph only. Leave the rest, including the privacy
section and the named services, which are carrying the ASO.

**EN**

> Most subscription apps tell you what you are paying for. Trimio also shows you
> how to stop. Over 30 services have a step by step cancellation guide built in,
> with the exact screens to tap and a direct link, so you are not hunting through
> help pages at the moment you have finally decided.
>
> No bank login. No card details. Nothing to connect.

**DE**

> Die meisten Abo-Apps zeigen dir, wofür du zahlst. Trimio zeigt dir auch, wie du
> wieder rauskommst. Über 30 Dienste haben eine Schritt-für-Schritt-Anleitung zum
> Kündigen, mit den genauen Schritten und einem direkten Link, damit du nicht in
> Hilfeseiten suchen musst, wenn du dich endlich entschieden hast.
>
> Kein Bankzugang. Keine Kartendaten. Nichts zu verbinden.

## What NOT to change, and why

**Leave both titles alone.** `Trimio: Abo Tracker & Kosten` (28/30) is indexed
and a title change resets ASO signal you have already paid for in time. A
positioning test wants ONE variable moved far enough to read the result, not
three moved a little.

There is a tempting alternative, `Trimio: Abos kündigen & Kosten` at exactly
30/30, which puts the high intent German verb in the title. Worth trying LATER,
on its own, if the description test reads positive. Not now.

**Do not write "your data never leaves your phone."** It is false: subscription
names and prices are columns in Postgres. The defensible claims, each verified
against the code rather than assumed, are the ones used above: nothing to
connect, no bank account, no email login, and the pasted confirmation email is
parsed on the phone.

**The guide count is 36 and the copy says "over 30".** Rounded down so it stays
true if a guide is removed. Never write 41, which is a grep artefact this repo
has already corrected once.

## What was already changed, live on the site

`tools/landing-source.html` and `tools/landing-de.json`, regenerated through
`tools/build-landing.py`:

1. **Hero lead** now names the guides instead of only the category promise.
2. **The eighth feature card** went from "Cancel with less friction / clear
   cancellation guidance" to "Cancel with real steps / Over 30 services have
   their own guide: the exact steps and a direct link".
3. **`Free for 5 subscriptions` became `Free to start`**, because the free limit
   became a Railway variable today and a page naming a number the server can
   change is a page that will eventually lie.

The headline is deliberately UNCHANGED. "See what is coming before you pay" and
"Sieh, was auf dich zukommt, bevor abgebucht wird" are the two live taglines,
and they are deliberately not back translations of each other.

## How to read the result

The point of a test is a number that decides something.

- **Metric:** Play Console store listing conversion rate, visitors to installs,
  under Grow > Store performance.
- **Baseline:** read the current 28 day figure BEFORE changing anything, and
  write it here.
- **Window:** 28 days, or until 300 store visitors, whichever is later. Below
  that the noise is larger than any effect worth acting on.
- **Continue if:** conversion rate improves at all. Positioning that is not
  worse is still better, because it is also more honest about the product.
- **Revert if:** it drops more than a fifth. The old copy is in git.
- **What it does NOT settle:** pricing. Zero traffic and a bad price produce the
  same zero, and this test only moves the first one.
