# Play Store listing, German (de-DE)

Paste into Play Console under Grow > Store presence > Main store listing, with
German (Deutschland) added as a translation. The English listing stays as the
default; this does not replace it.

Translated from the live English listing rather than written fresh, so the
keyword intent carries over. Terminology follows what the app itself already
says in `locales/de.json`, so the listing and the product do not use different
words for the same thing:

- **Testphase**, not Probeabo, for a free trial. The app says Testphase in 15
  places and Probeabo in none. Probeabo appears once in the long description
  anyway, because people do search for it.
- **Verlängerung** for a renewal, as in the app's reminder strings.
- **Preis gestiegen** is the app's phrasing for a price increase, so the
  listing says Preiserhöhung, which is the searched noun form of it.
- **du**, not Sie. The app is informal throughout (24 uses of du, 27 of dein).
- **abgebucht**, not "du zahlst", for the tagline. A renewal is not something
  you do: the money leaves on its own, which is the entire reason the product
  exists. `zahlen` describes an act you perform and quietly misdescribes the
  mechanic; `abbuchen` is the automatic debit and the word a German bank
  statement uses. The closing line said "bevor du zahlst" until 2026-09-14,
  against "Wissen, bevor abgebucht wird" everywhere else.

No dash, en dash or em dash is used as clause separating punctuation anywhere
below, per the copy rule.

---

## App title

**Limit 30 characters.**

```
Trimio: Abo Tracker & Kosten
```

28 characters. Carries the three tokens worth having: Abo, Tracker, Kosten.

Alternative if you would rather lead with the trial angle, which is the
differentiator the growth plan says to lead with. 25 characters, so there is
room to adjust it:

```
Trimio: Abos & Testphasen
```

---

## Short description

**Limit 80 characters.** This is the line under the title in search results and
does more conversion work than anything except the first screenshot.

```
Abos & Testphasen im Blick. Über 30 Anleitungen zum Kündigen. Ohne Bankzugang.
```

78 characters, measured with
`check_copy.py --keywords de`, not counted by eye.

THIS REPLACED `Abos und Testphasen im Blick. Ohne Bankzugang. Wissen, bevor
abgebucht wird.` (76 characters) on 2026-09-22, and the reasoning is worth
keeping because the obvious version was worse.

THE TITLE ALREADY CARRIES Abo, Tracker AND Kosten, all at the highest weight
Play applies. A first draft of this line opened `Abos, Kosten, Testphasen.` and
was spending characters re-buying a term the title already owns. These 80
characters should go on terms the title does NOT have.

SO THE TRADE IS THE TAGLINE FOR THE DIFFERENTIATOR. Every term the old line
carried survives (Abos, Testphasen, Bankzugang) and two are added, `kündigen`
and `Anleitungen`, which appear nowhere in the title and appeared exactly ONCE
in the whole listing before the full description was fixed the same day.
`Wissen, bevor abgebucht wird` is what goes, and this is the one field where it
earns least: `abgebucht` is not a query anybody types, and the tagline is still
live on the website, in the video captions and as the closing line below.

THE `&` IS LOAD BEARING, not a stylistic choice: it saves three characters over
`und`, which is what buys the margin. At `und` the line is exactly 80/80, which
fits and leaves nothing, and shipping a field at its exact limit is how a later
one word edit becomes impossible.

AN EARLIER DRAFT OF THIS TEST WAS AN ASO REGRESSION and is recorded in
`store-listing-positioning-test.md`: it proposed `Jede Verlängerung im Blick.
Über 30 Anleitungen zum Kündigen. Ohne Bankzugang.`, which carries ZERO category
terms. It read well, which is why reading it caught nothing. Count, do not
read: `check_copy.py --keywords de "<line>"` fails on zero category terms.

---

## Full description

**Limit 4000 characters.** This block now matches WHAT IS LIVE, corrected
2026-09-22. It previously held a 1405 character draft that was never what went
up: CLAUDE.md records that the uploaded version was a merged one, and this file
had no copy of it, so anybody reading here was reading a version no user has
ever seen. The owner pasted the live text and it is reproduced below with three
measured corrections.

```
Die meisten Abo-Apps zeigen dir, wofür du zahlst. Trimio zeigt dir auch, wie du wieder rauskommst. Über 30 Dienste haben eine Schritt-für-Schritt-Anleitung zum Kündigen, mit den genauen Schritten und einem direkten Link, damit du nicht in Hilfeseiten suchen musst, wenn du dich endlich entschieden hast.

Kein Bankzugang. Keine Kartendaten. Nichts zu verbinden.

Trimio hilft dir, deine Abos, Testphasen und wiederkehrenden Zahlungen im Blick zu behalten, bevor die nächste Abbuchung kommt.

Füge ein Abonnement in Sekunden hinzu: Bestätigungsmail einfügen und Trimio trägt Name, Preis und Abrechnungszeitraum automatisch ein. Über 45 Dienste werden erkannt. Auch eine PayPal oder Stripe Quittung funktioniert, weil Trimio am Zahlungsdienst vorbei schaut und das Abo benennt, für das du wirklich zahlst. Oder wähle aus über 120 fertigen Vorlagen für Dienste wie Netflix, Spotify, Disney+, iCloud und viele mehr. Trimio zeigt dir dann, was als Nächstes fällig ist, wie viel du monatlich und jährlich ausgibst und wo du sparen kannst.

Mit Trimio kannst du:

• Abos und Testphasen übersichtlich verwalten
• Anstehende Zahlungen frühzeitig sehen
• Erinnerungen vor Verlängerungen erhalten
• Monatliche und jährliche Kosten im Blick behalten
• Deine Ausgaben nach Kategorien verstehen
• Sparmöglichkeiten und Empfehlungen entdecken
• Preiserhöhungen bei laufenden Abos erkennen
• Abos kündigen, mit Anleitung für über 30 Dienste
• Mehrere Währungen verwalten
• Deine Abos im Kalender verfolgen

Kündigen ohne Sucherei

Wenn du ein Abo kündigen willst, zeigt dir Trimio bei über 30 Diensten die genauen Schritte und verlinkt direkt auf die richtige Seite. Kein Durchklicken durch Einstellungsmenüs und kein Suchen in Hilfeseiten, nur um herauszufinden, wo das Kündigen überhaupt versteckt ist.

Privatsphäre zuerst

Trimio benötigt keinen Zugriff auf dein Bankkonto und keine Verbindung zu deiner Kreditkarte. Du entscheidest selbst, welche Abos du hinzufügst.

Deine Finanzdaten werden nicht automatisch aus deinem Konto ausgelesen.

So behältst du die Kontrolle, ohne unnötig sensible Bankdaten zu teilen.

Wissen, bevor abgebucht wird

Statt erst nach einer Abbuchung zu merken, dass ein Abo verlängert wurde, hilft Trimio dir dabei, vorher zu wissen, was kommt.

Sieh deine nächsten Zahlungen auf dem Dashboard, plane Verlängerungen im Kalender und erkenne, wie sich deine Abos auf deine monatlichen Kosten auswirken.

Mehr Überblick über deine Ausgaben

Mit Statistiken und Kategorien siehst du auf einen Blick, wohin dein Geld fließt.

Trimio zeigt dir unter anderem:

• Monatliche Gesamtkosten
• Jährliche Hochrechnung
• Ausgaben nach Kategorie
• Kommende Verlängerungen
• Potenzielle Sparmöglichkeiten

Für kostenlose Testphasen und laufende Abos

Auch Testphasen lassen sich verfolgen, damit du rechtzeitig weißt, wann eine kostenlose Phase endet und eine kostenpflichtige Verlängerung beginnt.

Ob Streaming, Software, Fitnessstudio, Versicherung oder ein Probeabo, das du längst vergessen hast: Trimio sammelt alles an einem Ort.

Trimio Premium

Mit Trimio Premium verwaltest du unbegrenzt viele Abonnements und bekommst zusätzlich Ausgabenanalysen nach Kategorie, E-Mail-Erinnerungen vor jeder Verlängerung, eigene Kategorien und den Export deiner Daten als CSV.

Trimio wurde entwickelt, um dir mehr Klarheit über wiederkehrende Zahlungen zu geben, ohne unnötige Komplexität und ohne Bankzugang.

Trimio. Wissen, bevor abgebucht wird.
```

Roughly 3150 characters against a 4000 limit. The live version measured 2515,
so this spends part of the 1485 characters of indexed field that were sitting
unused.

### The three corrections, each measured rather than judged

**`kündig` APPEARED ONCE IN 2515 CHARACTERS.** The differentiator had one vague
bullet, `Kündigungsseiten schneller finden`, at position 8 of 10, and nothing
else. "Abo kündigen" is a high intent German query and the listing barely said
the word. It now appears six times, including a section heading and a bullet
that names the number.

**THE PASTE PARSER NAMED NO NUMBER.** `lib/parse-subscription.ts` recognises 49
distinct services through `KNOWN_SERVICES`, counted by parsing the object rather
than grepping. The listing now says "über 45", rounding DOWN so it stays true if
one is removed. It also now describes the payment intermediary behaviour, which
is a better feature than the old text claimed: PayPal, Stripe and nine others
are in `PAYMENT_INTERMEDIARIES`, which exists so the parser looks PAST them and
names the real service.

**THE CANCELLATION BULLET OVERCLAIMED.** It read "Verlinkt direkt auf die echte
Kündigungsseite jedes Anbieters", which says EVERY provider. It is 36, counted
by walking braces in `lib/cancellation-guides.ts`. The German mirror of the
English `170+` error, and the same class as `über 160 Vorlagen`.

**`über 120 Vorlagen` WAS ALREADY CORRECT** and is untouched. 127 unique names,
so the count error was English only: the German had already been fixed once and
the English never was.

### What was deliberately NOT changed

**`Probeabo` stays.** It contradicts the Testphase rule and that is already a
recorded decision, stated at the top of this file: people search for it. The app
itself still says Testphase everywhere.

**No free tier number appears anywhere in the German**, which is why nothing
here goes stale when `FREE_SUBSCRIPTION_LIMIT` moves. The English listing said
"up to 5 subscriptions" and needed fixing for exactly that reason.

**The tagline closes it**, unchanged, and that is where it belongs now that the
short description spends its 80 characters elsewhere.

---

## Screenshot overlay captions

The growth plan specifies four screenshots in swipe order with English
overlays. German equivalents, kept short enough to read at thumbnail size:

| # | Screen | Overlay |
|---|---|---|
| 1 | Dashboard | Wisse, was du wirklich zahlst. |
| 2 | Add by pasting an email | Ein Abo, ein Einfügen. |
| 3 | Price hike alert | Erkennt Preiserhöhungen automatisch. |
| 4 | Cancellation guide | Kündigen in zwei Taps, nicht zwanzig. |

If you shoot the screenshots with the app set to German, these go on those
shots. If you shoot in English and only translate the listing text, Play
Console will serve the English screenshots to German users, which is allowed
and still better than not translating the listing at all.

---

## Before you publish

- Play Console counts characters including spaces. Paste and read the counter
  rather than trusting the numbers above, since Console has occasionally
  counted certain characters differently.
- The app itself is already fully German, so a German speaker who installs
  from this listing does not hit an English app.
- Check whether German is even missing first. If a translation already exists
  in Console this is a rewrite rather than a new listing, and the existing
  install numbers are the thing to compare against afterwards.
