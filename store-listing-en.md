# Play Store listing, English (default)

Created 2026-09-22, and the reason it did not exist before is the point: the
German listing had a file and the English one, which is the DEFAULT listing,
lived only in Play Console. Nobody could check a claim in it against the code
without opening a browser, and three of its numbers turned out to be wrong.

## App title

```
Trimio: Abo Tracker & Kosten
```

28/30. Do NOT change it. It is indexed, and the positioning test in
`store-listing-positioning-test.md` moves ONE variable. There is a tempting
30/30 alternative recorded there; it is a separate, later test.

NOTE THAT THE TITLE ALREADY CARRIES Abo, Tracker AND Kosten, at the highest
weight Play applies. That is why the short descriptions should not spend
characters re-buying those three.

---

## Short description

```
Subscription tracker. See renewals early, cancel with over 30 real guides.
```

74/80, measured with `check_copy.py --keywords en`.

Category terms: subscription, tracker, track. Supporting: cancel, renewal,
renew, guide. The line it replaces is recorded in the positioning test file
along with why an earlier draft of it was an ASO regression.

---

## Full description

**Limit 4000 characters.** Corrected 2026-09-22 against the live text the owner
pasted. Three numbers in it were wrong and one was going to become wrong.

```
Stop paying for subscriptions you forgot you had.

Most subscription apps tell you what you are paying for. Trimio also shows you how to stop. Over 30 services have a step by step cancellation guide built in, with the exact screens to tap and a direct link, so you are not hunting through help pages at the moment you have finally decided.

No bank login. No card details. Nothing to connect.

As we say: "Know before you pay"

Trimio is a simple, privacy-first way to track every subscription you pay for: streaming, software, fitness, gaming, and more, so you always know what's coming out of your account and when.

WHY TRIMIO
• No bank or card linking required. You add your subscriptions yourself in seconds. Nothing to authorize, no financial account access, no data-sharing with a bank-linking service. Just you and your list.
• See exactly what you're spending, monthly or yearly, in one place.
• Get reminded before a renewal or a trial ends, so you're never surprised by a charge.
• Get notified if a price goes up.

ADD SUBSCRIPTIONS IN SECONDS
Got a confirmation or receipt email from Netflix, Spotify, YouTube Premium, Adobe, ChatGPT or 45 other services? Just paste the email text in, and Trimio fills in the name, price, and billing cycle for you. Even a PayPal or Stripe receipt works: Trimio looks past the payment processor and names the service you are actually paying for. No forwarding, no linking your inbox, nothing to authorize. Or pick from over 120 built-in service templates, or add anything manually. Track subscriptions in any currency, with a display currency of your choice.

KNOW WHERE YOUR MONEY GOES
Your dashboard shows your monthly and yearly spend at a glance, plus trends over time, so you can see whether your subscription costs are creeping up.

FIND WAYS TO SAVE
Trimio looks at what you've entered and surfaces practical suggestions, like overlapping services doing the same job, or subscriptions where switching to annual billing would save you money.

CANCEL WITHOUT THE HUNTING
Over 30 major services have a built-in step-by-step cancellation guide with a direct link to the right page, so when you decide to cancel something, you're not stuck digging through menus trying to find where.

STAY IN CONTROL
• Renewal and price-change notifications you can configure
• Toggle subscriptions active/inactive without losing history
• Track price changes over time per subscription
• Sign in with email or Google, your choice

FREE TO START
Track your first subscriptions for free. Upgrade to Premium for unlimited subscriptions and full access to cost-saving insights: monthly, yearly, or a one-time lifetime purchase.

Your data belongs to you. Trimio doesn't sell your personal information, and you can permanently delete your account and data at any time from within the app.
```

### The four corrections, each counted rather than judged

**`170+ built-in service templates` WAS AN OVERCLAIM AND IS NOW `over 120`.**
`lib/service-templates.ts` holds 162 rows and **127 unique names**, and
`dedupeForRegion` shows one row per name, so a user browses at most 127. This is
the third time this repo has shipped a count that was grepped rather than
counted, and the German listing had ALREADY been corrected for the identical
error (`über 160 Vorlagen` to `über 120`) while the English kept it. A fix
applied to one language is not a fix applied to the claim. Play policy also
prohibits misrepresenting features in a listing, so this one carried real risk.

**`20+ other services` WAS AN UNDERCLAIM BY 2.5x AND IS NOW `45 other`.**
`KNOWN_SERVICES` in `lib/parse-subscription.ts` holds 54 aliases resolving to
**49 distinct services**, counted by parsing the object. The old line was hiding
the best feature in the app.

**PayPal AND Stripe WERE IN THE WRONG LIST.** They sat beside Netflix and
Spotify as services the parser recognises. They are in
`PAYMENT_INTERMEDIARIES`, which exists so the parser looks PAST them and names
the real service behind the receipt. The old sentence implied Trimio would name
your subscription "PayPal". The new one describes what it actually does, which
is a better feature than the claim it replaced.

**`Track up to 5 subscriptions for free` WAS GOING TO LIE.** The cap became the
Railway variable `FREE_SUBSCRIPTION_LIMIT` on 2026-09-22. A listing naming a
number the server can change is a listing that eventually contradicts the app,
which is the same reason the landing page went from `Free for 5 subscriptions`
to `Free to start`. If a concrete number is ever wanted back, it has to be
edited in Play Console every time that variable moves, and nothing will remind
anybody.

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
