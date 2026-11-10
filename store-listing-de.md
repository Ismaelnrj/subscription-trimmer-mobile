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

**Limit 4000 characters.** REWRITTEN 2026-11-10 from scratch, 2989
characters, written alongside the English rather than translated from it.

```
Trimio ist dein Abo-Tracker. Die App erinnert dich, bevor ein Abo verlängert wird oder eine kostenlose Testphase kostenpflichtig wird, und zeigt dir genau, wie du kündigst, was du nicht mehr nutzt.

Kein Bankzugang. Keine Kartendaten. Nichts zu verbinden.

Kündigen ohne Sucherei
Für über 30 Dienste, darunter Netflix, Spotify, Disney+, Amazon Prime und YouTube Premium, gibt es in der App eine Schritt-für-Schritt-Anleitung zum Kündigen, mit den Schaltflächen, die du wirklich siehst, und einem direkten Link zur richtigen Seite. Wenn du dich entschieden hast, ist die Kündigungsseite nur einen Tipp entfernt.

Erinnerung vor der Abbuchung
Trimio erinnert dich auf dem Handy vor jeder Verlängerung und bevor eine Testphase in ein bezahltes Abo übergeht, mit der Vorlaufzeit, die du wählst. Jedes Abo behält seine eigene Währung, damit die Erinnerung den Betrag nennt, der wirklich abgebucht wird.

Abos in Sekunden hinzufügen
Füge eine Bestätigungs- oder Rechnungsmail ein, und Trimio trägt Name, Preis und Abrechnungszeitraum ein. Über 50 Dienste werden erkannt, von Netflix und Spotify bis ChatGPT, Adobe und Microsoft 365, und hinter PayPal oder Stripe findet Trimio den Dienst, für den du wirklich zahlst. Die E-Mail wird auf deinem Handy ausgelesen. Oder wähle aus über 120 fertigen Vorlagen, oder trag ein Abonnement selbst ein.

Deine Kosten im Blick
Monatliche und jährliche Kosten auf einen Blick, Ausgaben nach Kategorie, ein Kalender mit allen kommenden Zahlungen und Sparempfehlungen, etwa für zwei Dienste, die dasselbe tun, oder ein Monatsabo, das jährlich günstiger wäre. Änderst du einen Preis, speichert Trimio den Verlauf und zeigt dir, was die Preiserhöhung im Jahr kostet.

Funktioniert auch offline
Trimio öffnet ohne Verbindung und zeigt deine zuletzt gespeicherte Liste. Ein Abo, das du offline hinzufügst, bleibt auf dem Handy und wird in deinem Konto gespeichert, sobald du wieder online bist.

Für Testphasen und laufende Abos
Ob Streaming, Software, Fitnessstudio, Versicherung oder ein Probeabo, das du längst vergessen hast: Trimio sammelt alles an einem Ort.

Durchdacht bis ins Detail
• Komplett auf Deutsch, auch Erinnerungen und E-Mails
• Neun Währungen, Summen werden für dich umgerechnet
• Heller und dunkler Modus
• Abos pausieren, ohne den Verlauf zu verlieren
• Anmeldung per E-Mail oder mit Google

Kostenlos starten
Neue Konten bekommen 14 Tage Premium kostenlos, ohne Kartendaten. Danach wird nichts abgebucht: Du wählst einen Plan oder nutzt die kostenlose Version weiter.

Premium bietet unbegrenzt viele Abos, die volle Aufschlüsselung nach Kategorie, alle Sparempfehlungen, ein monatliches Budget, eigene Kategorien, E-Mail-Erinnerungen vor jeder Verlängerung und den Export als CSV. Monatlich, jährlich oder einmalig mit lebenslangem Zugang.

Deine Daten gehören dir
Trimio fragt nie nach Bankzugang und verkauft keine persönlichen Daten. Du kannst dein Konto und alle Daten jederzeit direkt in der App löschen.

Wissen, bevor abgebucht wird.
```

### What changed on 2026-11-10 and why

The old text (about 3150 characters) said most things twice: the cancellation
guides three times, the privacy line three times, a ten bullet list repeating
the paragraphs above it. The new one says each thing once, in the order a
reader decides in: what it does, why it is safe, then each feature with the
evidence for it.

KEPT, because they carry search: Abo and Abos (12), Abonnement, Kosten,
Testphase (3), Probeabo once (a recorded decision, see the top of this file),
kündigen in four forms, Verlängerung, Preiserhöhung, Abo-Tracker in the first
sentence, and the named services.

REMOVED AS OVERCLAIMS: "Preiserhöhungen bei laufenden Abos erkennen" read as
automatic detection. Trimio records a rise when the user changes the price, and
the new sentence says exactly that. "Über 45 Dienste" is now "über 50" (56
distinct names in `KNOWN_SERVICES`, counted 2026-11-10).

ADDED, all shipped and checked against the code: adding offline, the reminder
naming each row's own currency, "Komplett auf Deutsch, auch Erinnerungen und
E-Mails", dark mode, the lifetime plan, and the Premium list taken from the
paywall's own comparison rows.

The short description and the title are UNCHANGED: both already lead with
Abo, Tracker, Kosten and Testphasen, and the short line carries the
positioning test's variable.

---

## Screenshot overlay captions

The growth plan specifies four screenshots in swipe order with English
overlays. German equivalents, kept short enough to read at thumbnail size:

| # | Screen | Overlay |
|---|---|---|
| 1 | Dashboard | Wisse, was du wirklich zahlst. |
| 2 | Add by pasting an email | Ein Abo, ein Einfügen. |
| 3 | Price rise in insights | Zeigt, was eine Preiserhöhung im Jahr kostet. |
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
