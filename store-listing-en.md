# Play Store listing, English (default)

Created 2026-09-22, and the reason it did not exist before is the point: the
German listing had a file and the English one, which is the DEFAULT listing,
lived only in Play Console. Nobody could check a claim in it against the code
without opening a browser, and three of its numbers turned out to be wrong.

## App title

```
Trimio: Subscription Tracker
```

28/30, READ OFF PLAY CONSOLE on 2026-11-07 (the owner's screenshot of the
default en-US listing). Until then this file named the GERMAN title here,
`Trimio: Abo Tracker & Kosten`, so the file and the live listing disagreed and
nobody had checked. Treat the rest of this file the same way: it is the
intended text, and the live listing is the one to read before editing it.
Do NOT change the title. It is indexed, and a change resets signal already
paid for in time.

NOTE THAT THE TITLE ALREADY CARRIES Subscription AND Tracker, at the highest
weight Play applies. That is why the short description should not spend
characters re-buying those two.

---

## Short description

```
Renewal and free trial reminders, plus over 30 guides to cancel subscriptions.
```

78/80, measured with `check_copy.py --keywords en`. REWRITTEN 2026-11-10. The
line before it, `Subscription tracker. See renewals early, cancel with over 30
real guides.`, spent its first 21 characters on the two words the TITLE already
carries at higher weight, which this file's own note above says not to do.
This one keeps `subscription`, adds the category term `trial` (people search
"free trial tracker") and the supporting term `reminder`, and keeps the
positioning test's variable, cancellation guides, in the line. It loses
`tracker`, which the checker reports and which the title still holds.

---

## Full description

**Limit 4000 characters.** REWRITTEN 2026-11-10 from scratch: 2565 characters.

```
Trimio is a subscription tracker that reminds you before a renewal or a free trial charges you, and shows you exactly how to cancel what you no longer use.

No bank login. No card details. Nothing to connect.

Cancel without the hunt
Over 30 services, including Netflix, Spotify, Disney+, Amazon Prime and YouTube Premium, have a step by step cancellation guide in the app, with the buttons you will actually see and a direct link to the right page. Once you have decided, the cancel page is one tap away.

Reminders before you are charged
Trimio reminds you on your phone before each renewal and before a free trial turns into a paid plan, at the lead time you choose. Every subscription keeps its own currency, so the reminder names the amount that will really leave your account.

Add a subscription in seconds
Paste a confirmation or receipt email and Trimio fills in the name, price and billing cycle. It recognises over 50 services, from Netflix and Spotify to ChatGPT, Adobe and Microsoft 365, and it looks past PayPal or Stripe to name the service you are really paying for. The email is read on your phone. Or pick from over 120 ready made templates, or type anything in yourself.

See where your money goes
Your monthly and yearly total at a glance, spending by category, a calendar of every upcoming payment, and suggestions where you could save, such as two services doing the same job or a monthly plan that is cheaper billed yearly. Change a price and Trimio keeps the history and shows what the increase costs you a year.

Works offline
Trimio opens without a connection and shows your last saved list. Add a subscription offline and it is kept on your phone, then saved to your account when you are back online.

Made to stay out of your way
• Nine currencies, with totals converted for you
• English and German, reminders and emails included
• Light and dark mode
• Pause a subscription without losing its history
• Sign in with email or Google

Free to start
New accounts get 14 days of Premium free, no card needed. Nothing is charged when it ends: choose a plan, or carry on with the free version.

Premium adds unlimited subscriptions, the full category breakdown, every savings recommendation, a monthly budget goal, custom categories, email reminders before each renewal and a CSV export. Monthly, yearly or a one time lifetime purchase.

Your data stays yours
Trimio never asks for bank access and never sells your personal information. You can delete your account and everything in it at any time, from inside the app.

Know before you pay.
```

### Every claim, checked against the code on 2026-11-10

- **Over 30 cancellation guides**: 36, counted by walking braces in
  `lib/cancellation-guides.ts`. Rounded down.
- **Over 50 services recognised from a pasted email**: 56 distinct names in
  `KNOWN_SERVICES` (it said 45 when there were 49). Rounded down.
- **Looks past PayPal or Stripe**: `PAYMENT_INTERMEDIARIES`.
- **The email is read on your phone**: `lib/parse-subscription.ts` makes no
  network call.
- **Over 120 templates**: 127 unique names (162 rows).
- **Reminders before renewals and trial ends, lead time you choose, in the
  row's own currency**: `lib/notification-scheduler.ts`, phone reminders are
  not Premium gated; currency per row since `5c803d5c`.
- **Price history and what an increase costs a year**: recorded when the
  user CHANGES a price (`price_history`, the price rise tip). Deliberately NOT
  "detects price increases": Trimio cannot know a provider raised a price until
  somebody edits it. The previous text said "Get notified if a price goes up",
  which read as automatic.
- **Savings suggestions**: the overlap and yearly switch tips in `buildTips`.
- **Works offline**: opens offline (`lib/offline-cache.ts`) and ADDS offline
  (`lib/pending-subscriptions.ts`). Edits still need a connection, so the text
  only claims adding.
- **Nine currencies**: `lib/currencies.ts`. **Dark mode**: Settings >
  Appearance. **English and German, reminders and emails included**.
- **14 days of Premium free, no card**: the reverse trial,
  `PREMIUM_TRIAL_DAYS` default 14. `reverse-trial.test.js` fails if this file
  and the server disagree.
- **Premium list**: exactly the paywall's comparison rows in `app/upgrade.tsx`.
- **No free tier number** anywhere, on purpose: `FREE_SUBSCRIPTION_LIMIT` is a
  Railway variable and a listing that names it eventually lies.
- **No price** anywhere: Play shows the real one.

### Numbers to re-count before quoting them again

```bash
# unique template NAMES, never row count
python3 -c "import re,io;s=io.open('lib/service-templates.ts',encoding='utf-8').read();n=re.findall(r'name:\s*\"((?:[^\"\\\\]|\\\\.)*)\"',s);print(len(n),'rows',len(set(n)),'unique')"
```

Cancellation guides are counted by walking braces in
`lib/cancellation-guides.ts`, never by grepping `url:`, which returns 41 because
URLs also appear inside note text. It is 36. Marketing copy says "over 30",
rounding DOWN so it survives a guide being removed.

---

## Before you publish

- Run `python3 .claude/skills/trimio-design/scripts/check_copy.py` on the short
  description with `--keywords en`. Zero category terms fails.
- Read the store listing conversion baseline FIRST, per
  `store-listing-positioning-test.md`. Without it there is no test.
- No Apple App Store badge and no iPhone anywhere. Android only.
