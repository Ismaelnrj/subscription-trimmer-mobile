# Creator outreach, seeding test

Written 2026-10-18. One small test, not a campaign: 3 to 5 German speaking micro
creators, Premium for free, their own referral code, and cash (50 to 150 EUR) for
at most ONE of them. Why it is small: the funnel still leaks (20 of 30 accounts
never added a subscription), so paid reach mostly buys uninstalls today.

## Who to approach

A web search on 2026-10-18 found NO usable list of small German budgeting
creators. What it found were large investing accounts (Finanzfluss and similar),
which are the wrong fit twice: they talk about stocks, not everyday spending,
and they cost far more than this test. Finanztip does not take advertising at
all. `@sparbuchfeinde` (about 94,000 followers by a HypeAuditor estimate) is
listed under crypto, so it is not the audience either. Instagram itself is
blocked from a sandbox, so the shortlist has to be built by hand.

**Search these hashtags in Instagram and TikTok, and look at the Reels tab:**
`#geldsparentipps` `#sparenimalltag` `#umschlagmethode` `#cashstuffingdeutschland`
`#budgetplanung` `#haushaltsbuch` `#sparenmitfamilie` `#finanzenfürfrauen`
`#geldsparenösterreich`

**Pick accounts that pass all six:**

1. **5,000 to 50,000 followers.** Big enough to move installs, small enough to
   answer a DM and accept Premium plus a small fee.
2. **Everyday money, not investing.** Budgets, Haushalt, Umschlagmethode,
   families saving. A stock picker's audience does not lose money to forgotten
   Abos, or does not care.
3. **Recent Reels getting views of at least 10% of the follower count.** A
   20,000 follower account whose Reels sit at 300 views has an audience that
   no longer sees it.
4. **Real comments**, questions and stories, not only emoji.
5. **Speaks German on camera**, ideally from DACH. Austria is a plus: same
   prices as the catalogue's DACH rows.
6. **Has done a labelled partnership before** ("Werbung", "Anzeige"). It means
   they know how, and they will label yours.

**Rank them by fit, not by size.** One account whose followers keep asking "how
do I cancel X" beats a bigger general lifestyle account.

## The message (Instagram DM, German)

Personalise the bracketed parts. The specific post is the line that gets a
reply, so never send it without one.

```
Hi [Name],

ich bin [Dein Name] und habe Trimio gebaut, eine Android App gegen vergessene Abos. Dein Reel über [konkretes Thema] hat mir richtig gut gefallen.

Trimio erinnert dich vor jeder Abbuchung und zeigt dir für über 30 Dienste Schritt für Schritt, wie du kündigst. Kein Bankkonto verbinden, keine Kartendaten.

Magst du es ausprobieren? Du bekommst Premium kostenlos, und deine Community bekommt mit deinem Code bis zu 30 Tage Premium geschenkt.

Wenn es dir gefällt, würde ich mich über ein ehrliches Reel oder eine Story freuen, natürlich als Werbung gekennzeichnet. [Optional: Für ein Reel zahle ich gerne 100 €.]

Kein Druck, und danke fürs Lesen!
[Dein Name]
```

If there is no answer after 5 days, one follow up, then stop:

```
Hi [Name], kurz nachgefragt, ob du meine Nachricht gesehen hast. Wenn es gerade nicht passt, ist das völlig in Ordnung. Viele Grüße, [Dein Name]
```

## The brief (send once they say yes)

```
Trimio, kurz erklärt

Was es ist
Eine Android App, die alle deine Abos an einem Ort sammelt und dich vor jeder Verlängerung erinnert. Für über 30 Dienste zeigt sie Schritt für Schritt, wie du kündigst.

Was du sagen darfst
Trimio verbindet kein Bankkonto und fragt nach keinen Kartendaten.
Eine Bestätigungsmail einfügen reicht, und das Formular füllt sich selbst aus.
Kostenlos für den Start. Premium ist ein Monatsabo, den Preis zeigt Google Play in deiner Währung.
Gibt es nur für Android, im Google Play Store.

Was du bitte NICHT sagst
"Deine Daten verlassen nie dein Handy." Das stimmt nicht: deine Abo-Liste wird auf unserem Server gespeichert, damit sie nach einer Neuinstallation wieder da ist.
Keine Preise für Netflix, Spotify und Co., die du nicht selbst geprüft hast.
Nichts über iPhone. Es gibt noch keine iOS Version.

Ideen, wenn du welche willst
Zeig dein eigenes Abo, das du vergessen hattest, und was es gekostet hat.
Füge eine echte Bestätigungsmail ein und zeig, wie sich das Formular selbst ausfüllt.
Öffne die Kündigungsanleitung für einen Dienst, den deine Community kennt.
Echte Screens bitte, keine nachgebauten.

Am Ende
"Trimio, kostenlos im Play Store. Link in meiner Bio." Und bitte als Werbung oder Anzeige kennzeichnen.

Dein Link und dein Code
Link: [persönlicher Link, siehe unten]
Code: [dein Empfehlungscode aus der App, unter Freunde einladen]
```

## Setting each creator up

1. **Their own tagged Play link**, so Play Console counts their installs on
   their own row. Replace `NAME` with a short lowercase handle:
   `https://play.google.com/store/apps/details?id=com.trimio.app&referrer=utm_source%3DNAME%26utm_medium%3Dcreator%26utm_campaign%3Doct26`
2. **Their referral code** comes from their own Trimio account (Refer a Friend
   screen). Each install that redeems it is credited to both of you, up to 30
   days each, inside the 12 month cap.
3. **Free Premium**: in Railway > Database > Console, `psql -U postgres`, then
   `UPDATE users SET bonus_premium_until = now() + interval '12 months' WHERE email = 'their@email';`
   Check the address first with a `SELECT id, email FROM users WHERE email = '...';`.
   That writes to the live database, so type it carefully.

## How to read it, 7 days after each post

- **Installs:** Play Console, acquisition by source, the creator's row.
- **Did they stay:** `/api/admin/funnel` with `?since=` the post date: signups,
  and how many added a subscription.
- **Continue** with that kind of creator if a post brings at least 30 installs
  and at least 40% of the new accounts add a subscription.
- **Stop** with that kind if it brings fewer than 10.
- A creator's own reach screenshot is not an install. Only Play Console and the
  funnel count.

## English version

Use it only when an English speaking creator wins on fit. Their audience is
probably more iPhone heavy than a German one, and Trimio is Android only, so
weigh that before paying anything.

**Message (Instagram DM):**

```
Hi [Name],

I'm [Your name], and I built Trimio, an Android app against forgotten subscriptions. I really liked your Reel about [specific topic].

Trimio reminds you before every renewal and shows step by step how to cancel more than 30 services. No bank login, no card details.

Would you like to try it? You get Premium for free, and your followers get up to 30 days of Premium with your code.

If you like it, I'd love an honest Reel or Story, clearly marked as an ad. [Optional: I'm happy to pay 100 € for a Reel.]

No pressure, and thanks for reading!
[Your name]
```

**Follow up after 5 days, then stop:**

```
Hi [Name], just checking whether you saw my message. If it isn't a fit right now, that's completely fine. Best, [Your name]
```

**Brief (once they say yes):**

```
Trimio, in short

What it is
An Android app that keeps all your subscriptions in one place and reminds you before every renewal. For more than 30 services it shows step by step how to cancel.

What you can say
Trimio never connects to your bank and never asks for card details.
Paste a confirmation email and the form fills itself in.
Free to start. Premium is a monthly plan, and Google Play shows the price in your currency.
Android only, on Google Play.

Please do NOT say
"Your data never leaves your phone." It isn't true: your subscription list is stored on our server so it comes back after a reinstall.
Prices for Netflix, Spotify and so on that you haven't checked yourself.
Anything about iPhone. There is no iOS version yet.

Ideas, if you want them
Show a subscription you forgot about and what it cost you.
Paste a real confirmation email and show the form filling itself in.
Open the cancellation guide for a service your audience knows.
Real screens please, no recreated ones.

At the end
"Trimio, free on Google Play. Link in my bio." And please mark it as an ad (#ad), as your platform and country require.

Your link and your code
Link: [personal link, see "Setting each creator up"]
Code: [your referral code from the app, under Refer a Friend]
```
