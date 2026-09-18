# Trimio mobile app

Durable facts worth having on record across sessions. Conversation memory
resets between sessions and can lose detail even within one long session
(context compaction is lossy), this file is the place that doesn't.

## Owner's local setup

- Local clone lives at `C:\Users\ismae\subtrimio-clone` on Windows, worked in
  from PowerShell. Use Windows-style paths and PowerShell syntax when giving
  commands meant to run there.
- Any cloud/sandbox Claude Code session (like this one) has its own separate
  checkout and cannot see or reach the owner's machine. Commands that need to
  run locally (`eas update`, `eas build`, anything hitting `api.expo.dev`)
  must be handed to the owner to run themselves, not executed from here, see
  "Network limits" below for why.

## Branching, and who else works on this

- THE DEFAULT BRANCH IS `master`, not `main`. `git fetch origin main` fails
  quietly and, worse, a comparison against the non-existent `origin/main`
  resolves to an empty ref and lists the ENTIRE history as "not merged",
  which reads like catastrophic divergence and is an artefact. Compare
  against `origin/master`.
- THE OWNER WANTS EVERYTHING ON `master` (stated 2026-09-11: "everything
  should be always on master"). Cloud sessions are handed a
  `claude/<something>` working branch as a guardrail so a sandbox cannot
  write to master unreviewed, so work lands there first. When it is done,
  ASK, then fast-forward master onto it and push. `git merge --ff-only` is
  the right verb while the branch is a strict descendant, it keeps history
  linear and fails loudly if it is not actually a fast-forward. Never push
  to master without asking first.
- CHATGPT ALSO WORKS ON TRIMIO. The owner has given it access to read and
  review this codebase, so it is a second assistant on the same repo, not a
  bystander. Practical consequences: changes may arrive that this session
  did not make, so re-read a file before editing it rather than trusting a
  stale copy in context; `git log` and `git status` are the source of truth
  about what is actually in the repo; and if something looks unfamiliar or
  contradicts a note here, the likely explanation is work from the other
  assistant or the owner, not a mistake, so check the history before
  "correcting" it. Keep this file accurate for whoever reads it next.

## Stack

- Expo SDK ~53, React Native 0.79.6, React 19, Expo Router.
- Package manager is **pnpm** (`packageManager: "pnpm@9.15.0"` in
  package.json), even though a stray `package-lock.json` also exists in the
  repo, it is not authoritative, ignore it.
- Backend: `backend/server.js`, Express + PostgreSQL, deployed on Railway at
  `subscription-trimmer-mobile-production.up.railway.app`. Transactional
  email via Brevo/Sendinblue.
- Analytics: PostHog, EU region (`https://eu.i.posthog.com`), wired in
  `lib/analytics.ts`. Session replay and autocapture are deliberately off,
  the app's positioning is "we never see your data."

## EAS Update (OTA)

This project uses **channel-based** updates, not branch-based. `app.json`
sends `expo-channel-name: production` as a request header, so the correct
publish command is:

```bash
eas update --channel production --message "..."
```

`--branch production` happens to work too since EAS auto-links a same-named
branch to a channel on first publish, but `--channel` is the one that
actually matches how this app checks for updates, use it, not `--branch`.

`BUILD_GUIDE.md`'s example (`eas update --platform android`, no channel
flag) is imprecise, don't copy it as-is.

### runtimeVersion is FROZEN at 1.0.1, and that is load bearing

`app.json` carries `"runtimeVersion": "1.0.1"` as a hardcoded string, not a
policy. It is deliberately NOT the same as `version` (1.0.3), and it must not
be "tidied up" to match.

EAS Update matches an update to a build by **runtimeVersion**, never by
`version`. Build 40 has 1.0.1 baked into it, so it asks the server for
updates tagged 1.0.1, and a publish carries the same 1.0.1. They match, so
the update lands. Set runtimeVersion to 1.0.3 and every existing build would
still ask for 1.0.1, find nothing, and silently stop receiving OTA updates
forever. Seeing "Runtime version: 1.0.1" in the app is the mechanism working.

THE RULE THIS IMPLIES: runtimeVersion exists to stop a JS bundle reaching a
native build that lacks the native code that JS needs. Frozen, that guard is
off and every build gets every update. That is safe only while nothing native
changes. **When a native change does happen (a new native dependency, an
app.json native config change, a new permission), bump runtimeVersion in the
same commit as that change.** Skip it and an old build pulls JS that calls
native code it does not have, and crashes on launch, for everyone.

### Verifying an OTA actually landed

Help & Support has a Build Info panel (`app/help-support.tsx`) that answers
this without guessing. `Embedded launch (no OTA applied)` should read
`false`, `Update ID` should be a UUID rather than `none`, and
`Update published` should match the publish timestamp. If it says embedded
with no update ID, the app is running the bundle baked into the build: the
update downloads in the background and applies on the NEXT launch, so force
close and reopen before concluding anything is broken.

## Network limits in cloud/sandbox sessions

Outbound access to `api.expo.dev` is blocked by this environment's network
policy (confirmed via repeated 403 "policy denial" entries in the agent
proxy status). This is independent of whether an Expo token is valid, so if
`eas` commands fail here with auth-looking errors, the fix is not a new
token, it's running the command on the owner's own machine instead.

It is NOT only `api.expo.dev`. The Railway backend
(`subscription-trimmer-mobile-production.up.railway.app`), `www.subtrimio.com`
and the bare `subtrimio.com` are all refused the same way, confirmed
2026-09-10 by `curl` returning HTTP 000 on every path and the proxy log
showing `403 to CONNECT (policy denial)` for all three hosts. So a sandbox
session CANNOT check whether the backend or the site is up. Getting nothing
back here says nothing about their health: do not report them as down. Read
the proxy's own verdict with
`curl -sS "$HTTPS_PROXY/__agentproxy/status"` before drawing any conclusion,
and hand live checks to the owner (Railway dashboard, or just load the site).

## Native build notes

- `fix-gradle.sh` deliberately pins Kotlin to `2.0.21` in
  `android/build.gradle` (needed for the Compose plugin, kept low
  intentionally). Any dependency whose prebuilt AAR needs a newer Kotlin
  compiler will crash `compileReleaseKotlin` with "Module was compiled with
  an incompatible version of Kotlin", check this first if a Codemagic/native
  build fails there.
- Native Android CI is Codemagic, separate from the GitHub Actions
  `build-android.yml` workflow (plain Gradle + keystore secret, not the EAS
  build service).

## Backend API convention

Every `/api/trpc/*` endpoint wraps its response with the `trpc()` helper in
`backend/server.js` (`res.json(trpc(data))` → `{ result: { data } }`), and
the frontend reads `res.data.result.data` everywhere to match. A handwritten
endpoint that skips `trpc()` will crash any screen that reads it (this
already happened once with `referrals.me`, fixed).

## Copy and content rules

No dash, em dash or hyphen used as clause-separating punctuation, in any
Trimio-facing marketing or UI text: Play Store copy, in-app strings, video
captions, ASO copy. Use a colon, comma, or period instead. This does not
apply to code comments or internal docs like this file.

## Localization

Everything user facing is German as well as English, as of 2026-09-12:

- The app (`locales/en.json` and `locales/de.json`, 562 keys each).
- The Play Store listing (uploaded 2026-09-10).
- The website. `/` is English, `/de` is German, generated together by
  `tools/build-landing.py` from `tools/landing-de.json` and paired with
  hreflang. Two URLs rather than a client side toggle, because a toggle
  leaves Google one page and the German copy effectively unindexed.
- The legal documents. `/privacy-policy` and `/terms` in English,
  `/de/datenschutz` and `/de/nutzungsbedingungen` in German, the German copy
  in `backend/legal-de.json`.

Terminology is shared across all four so the product says one thing: Abo and
Abonnement, Testphase not Probeabo, Verlaengerung for a renewal, informal du
throughout, including in the legal copy. Register does not affect
enforceability, and switching to Sie only there would read as a different
product.

## Where things stand (marketing push)

Update this section as things move, so a fresh session picks up where the
last one left off without needing a recap typed out.

- A 90 day growth plan exists as a published artifact (solo operator,
  zero to modest budget, sequenced ASO, referral, content, then a small
  paid track). Ask the owner for the link if it's needed again, or check
  `Artifact` with `action: "list"`.
- Done: store listing rewrite, German locale note, referral nudges
  (savings toast + dashboard banner), Codemagic build fix, backend
  connection pool fix, privacy policy PostHog disclosure. All shipped, in
  production, confirmed via an `eas update` the owner ran plus Railway
  auto-deploys.
- REBRAND LIVE (2026-09): version 1.0.2, versionCode 38, approved by
  Google and published. It carries the ink navy palette across the app,
  the splash and notification tint, the error states for calendar,
  subscription details and notification settings, and the RECEIPT icon,
  which is the mark live on phones right now. No `eas update` was run for
  it and none is needed.
- MARK, and how it is reproduced: `tools/trace-mark.py` lifts the two
  shapes out of the approved artwork as soft alpha masks
  (`tools/mark-chevron.png`, `tools/mark-triangle.png`) and records their
  proportions in `tools/mark.json`. Every generator scales and tints
  those masks. NOTHING redraws the outline: two earlier attempts did,
  from measurements and then from a simplified polygon, and both drifted
  into an inverted Pac-Man. The generated icon now matches the artwork to
  3.9/255 mean per channel across its interior.
- Three details of the artwork that are easy to miss and were each worth
  a visible error: the mark is NOT centred in the tile, it sits +2.20%
  right and -1.29% high (fixing that alone took the difference from 24.1
  to 3.9); the field is a diagonal far deeper than the UI's Ink Navy,
  running #051E2F top left to #00101E bottom left; and the triangle
  carries a vertical ramp, #4FEEC3 down to #24D2A4. The chevron is flat
  warm white.
- Shapes are separated during extraction by GREENNESS, not colour
  distance. A half covered white edge over navy is a mid grey which sits
  nearer mint than paper, so distance leaks the whole chevron outline
  into the triangle mask.
- 1.0.3 / versionCode 40 IS LIVE in the Play Store, with an `eas update`
  on top of it (2026-09-05). 39 carried the chevron and the buildTips
  crash; 40 is the same build with the crash fixed. A versionCode can
  only ever be uploaded to Play once, which is why 39 was not reused.
- PUBLISHED THROUGH ef7a2853 (2026-09-12). Earlier runs went out through
  0163d23 and then cc285cd. Backend changes ride the Railway auto-deploys.
- EVERYTHING IS PUBLISHED AGAIN, through 8c002028 (2026-09-17), and the Railway
  deploy for the same range is green. The owner ran `tools/typecheck.py` on their
  machine first and it came back clean, which matters because three screens
  changed and no sandbox can run it.
  That publish finally shipped `df2db7a5`, the fourteen localised screen headers,
  which had been sitting unpublished since BEFORE the 2026-09-17 session started.
  It was only caught by checking whether it was an ancestor of the stated
  baseline rather than trusting the note that said everything was published.
  THE LESSON: `git merge-base --is-ancestor <commit> <publish baseline>` is how
  you find out, and "everything is published" in this file is a claim to verify,
  not a fact to rely on.
- PUBLISHED THROUGH bd6d683f AND CONFIRMED ON A REAL DEVICE (2026-09-18). The
  owner ran `tools/typecheck.py` on their machine first and it came back clean,
  which matters because seven JS files changed and no sandbox can run it.
  The evidence is read off the Build Info panel, not inferred from a publish that
  exited zero: `Embedded launch (no OTA applied): false`, `Update ID:
  01a0b41b-04ce-7439-8dd9-4a6a36d15b07`, `Update published:
  2026-09-18T10:41:04.718Z`, against `Native build: 40`, `Channel: production`
  and `Runtime version: 1.0.1`. That pairing is the frozen runtimeVersion proving
  itself once more: a build carrying 1.0.1 asked for updates tagged 1.0.1 and got
  one.
  MASTER IS AT 889b5c22, ONE COMMIT AHEAD OF THAT BASELINE, and it does not
  matter: 889b5c22 touches CLAUDE.md alone, and documentation never enters a JS
  bundle. bd6d683f is the last commit carrying anything a phone runs. Do not
  "fix" the gap with another publish.
  Verified OTA-safe before pushing any of it: zero files touched under android/,
  assets/, app.json, package.json or eas.json, so runtimeVersion correctly stayed
  1.0.1. The frontend files that went out were `lib/api.ts`, `lib/auth-store.ts`,
  `lib/query-client.ts`, `lib/parse-subscription.ts`, `app/_layout.tsx`,
  `app/(tabs)/subscriptions.tsx` and both locale files.
- PUBLISHED THROUGH 81b709ba (2026-09-18, second publish of the day). The owner
  ran `tools/typecheck.py` clean and the full jest suite green first: 20 suites,
  231 tests. Verified OTA-safe across the widest range, `bd6d683f..HEAD`: zero
  files touched under android/, assets/, app.json, package.json or eas.json, so
  runtimeVersion correctly stayed 1.0.1 and no native build was needed.
  NOT YET CONFIRMED ON A DEVICE. The publish exited zero and that is ALL that is
  known so far. This file's own rule applies: read `Embedded launch (no OTA
  applied): false` and a real `Update ID` off the Build Info panel before calling
  it landed. Fill that in when it is read, or delete this sentence and say it was
  never checked. Do not quietly upgrade "published" into "confirmed".
  THE LAST COMMIT CARRYING ANYTHING A PHONE RUNS IS 43e0df2f. `dba47863` and
  `81b709ba` are a test file and CLAUDE.md, which never enter a JS bundle, so a
  future session finding master ahead of the publish baseline should check WHAT
  the gap contains before publishing again. This is the same shape as the
  889b5c22 note above and it keeps recurring because the fix for a documentation
  commit looks identical to the fix for a missed screen.
- PUBLISHED THROUGH 39a58081 (2026-09-18, third publish of the day), which
  supersedes the baseline above. It carried exactly ONE client file,
  `lib/language-store.ts`, the skip-when-preferences-unloaded fix. Everything
  else in `81b709ba..39a58081` is backend, tests and this document. Native
  check across that range: zero files under android/, assets/, app.json,
  package.json or eas.json, so runtimeVersion stayed 1.0.1 and no build was
  needed. The backend half rides the same Railway deploy.
  ALSO NOT CONFIRMED ON A DEVICE. Same rule as the entry above, same reason:
  three publishes went out on 2026-09-18 and not one of them has been read off
  the Build Info panel yet. Whoever picks this up should either read it and fill
  in the Update ID, or say plainly that it was never checked. Three unverified
  publishes stacked on each other is how a silently broken bundle survives a
  whole day.
- THE FAIL-OPEN ON ENTITLEMENT IS CLOSED, and it is the reason 9abf5c2c mattered
  more than the other four findings. `/api/auth/verify-premium` used to fall back
  to `req.body.isPremium` whenever REVENUECAT_SECRET_API_KEY was unset, so any
  authenticated user could POST `{"isPremium": true}` and take the paid tier with
  a single request. It now refuses with 503 and writes nothing. A startup warning
  is not an access control.
  THE COROLLARY NOBODY EXPECTS: that endpoint is now HARD DEPENDENT on the key
  being present in Railway. Unset, no purchase can confirm through it at all, and
  new purchasers wait on the RevenueCat webhook plus `retryPendingPremiumSync`
  instead. Refusing is the right default for a claim about money, but check the
  variable exists before assuming purchases confirm.
- `fetchPremiumEntitlementFromRevenueCat` THROWS on a non-ok response and must
  keep throwing. Returning false would read a RevenueCat outage as "not a
  subscriber", and the caller would write `is_paid = false` and cancel a paying
  customer because a third party was briefly unreachable. Throwing reaches the
  handler's catch, which answers 500 before the UPDATE, so a transient failure
  leaves an existing entitlement untouched. 4ad99cf8 records that in the source,
  and also deleted a comment that still described the removed fail-open as the
  intended design, which is how a hole gets re-added by the next reader.
- THE 2026-09-17 BACKEND CHANGE CARRIES A MIGRATION, which is unusual for this
  repo and worth watching the first boot for. `users.referred_by` was created
  with no ON DELETE action, so Postgres refused to delete any account that had
  successfully referred somebody: the referred row still pointed at it. Account
  deletion returned 500 for exactly the users the referral programme rewards,
  breaking Play's deletion requirement and GDPR erasure together. The migration
  finds the constraint by lookup (not by guessing its name, since DROP
  CONSTRAINT IF EXISTS against a wrong name silently succeeds and then a second
  constraint gets added with the old behaviour) and rebuilds it ON DELETE SET
  NULL. The handler also nulls the pointers first, so deletion works even if the
  migration has not run.
  THE DEPLOY IS GREEN, so the migration did not throw: initDB runs at boot and a
  failing DO block would have taken the service down with it. That proves it RAN,
  not that it did the right thing, which are different claims. The cheap way to
  settle the second one, in the Railway database console:
  `SELECT conname, confdeltype FROM pg_constraint WHERE conrelid = 'users'::regclass
   AND contype = 'f' AND conname LIKE '%referred_by%';`
  `confdeltype` should read `n`, which is SET NULL. Anything else and the
  constraint was not rebuilt, though the handler's own null-out still keeps
  account deletion working.
  SETTLED 2026-09-18, AND IT DID THE RIGHT THING. Read off the live database:
  `"users_referred_by_fkey" FOREIGN KEY (referred_by) REFERENCES users(id) ON
  DELETE SET NULL`. The lookup-by-constraint approach worked and there is exactly
  ONE such constraint, which was the real hazard: a DROP CONSTRAINT IF EXISTS
  against a guessed name succeeds silently and leaves a second constraint behind
  carrying the old behaviour. The same output confirmed all five cascades off
  `users` (notification_preferences, notifications, price_history, subscriptions,
  user_settings), every one ON DELETE CASCADE, so deletion orphans nothing.
  HOW TO READ IT AGAIN WITHOUT THE ONE-LETTER CODE: Railway's Database > Data tab
  is not a free query input, and its Console tab is a SHELL, not psql. Run
  `psql -U postgres` there first (the prompt becomes `railway=#`), then `\d users`,
  which spells the rule out as ON DELETE SET NULL and lists every inbound cascade
  at the same time. `q` leaves the pager, `\q` leaves psql. Paste is mangled in
  that console (bracketed paste arrives literally as `^[[200~`), so short typed
  commands beat long pasted ones.
- EMAIL NOW CARRIES AN UNSUBSCRIBE, added 2026-09-17. `users.email_opt_out`,
  honoured by both bulk queries, a signed link in both footers, and GET plus
  POST `/unsubscribe` (POST is RFC 8058 one-click, which must act with no
  confirmation step or it does not count). Neither route is authenticated on
  purpose: the HMAC in the URL is the authorisation, and an unsubscribe that
  asks you to log in is an unsubscribe that does not work. Gmail and Yahoo have
  required this from bulk senders since Feb 2024, so its absence was costing
  inbox placement on the transactional mail too.
- ACCOUNT DELETION REACHES POSTHOG TOO, added 2026-09-17. Six tables cascade off
  `DELETE FROM users`: subscriptions, price_history (twice, from both its
  subscription_id and its user_id), notifications, notification_preferences and
  user_settings. Nothing is soft deleted. But `identifyUser(user.id)` in
  `lib/auth-store.ts` means PostHog holds a person profile keyed to the numeric
  id, and dropping the Postgres row does not touch it: `reset()` on logout stops
  future attribution and deletes nothing. `deletePostHogPerson` now erases the
  profile and its events with `delete_events=true`.
  IT IS NOT AWAITED INTO THE RESPONSE AND EVERY FAILURE PATH IS SWALLOWED, on
  purpose: the right to erasure cannot depend on a third party being reachable,
  and the account row is already gone by the time it runs. Needs
  POSTHOG_PERSONAL_API_KEY (a personal key, NOT the project key the app embeds,
  which can only write) and POSTHOG_PROJECT_ID in Railway. Unset, it is a no-op.
  For the record on what was at stake: the events are funnel milestones only and
  `subscription_added` deliberately sends billing_cycle, category and
  is_first_subscription and never the name or the price, so the residue was
  pseudonymous rather than personal. Defensible, but not worth arguing on behalf
  of an app positioned as "we never see your data".
  HOW THE KEY IS MADE, since the docs do not spell it out: PostHog's Create
  personal API key dialog exposes Person as ONE three-state selector, No access /
  Read / Write, not two tickable scopes, so you cannot grant read and write
  separately. Pick Write. Verified 2026-09-18 by calling
  `GET /api/projects/<id>/persons/?limit=1` with a Write-only key and getting
  results back, so `person:write` covers reads and the lookup needs nothing extra.
  PostHog's own scope docs do not state that, which is why it was worth measuring.
  Scope the key to the Trimio PROJECT, not the organisation: the Organizations
  tab grants every project inside it, and this key only ever erases one person.
  Read the project id off the browser URL (`eu.posthog.com/project/<id>/...`),
  NOT from `GET /api/projects/`, which needs `project:read` and answers 403 for a
  correctly scoped key, which reads as a broken key and is not one.
  IT IS LIVE AND CONFIRMED WORKING, 2026-09-18. Both variables are set in Railway
  and a real deletion produced `PostHog person erased for user 31` in the logs,
  so this is verified end to end rather than merely configured. A green deploy
  only ever proved the variables were present: the call fires on account deletion
  alone and swallows every error, so nothing short of deleting an account can
  tell you it works.
  HOW TO RE-TEST IT, because one step is easy to skip and turns the test into a
  false pass: register a throwaway account and ADD ONE SUBSCRIPTION before
  deleting it. With no event captured there is no PostHog person, so
  `deletePostHogPerson` finds nothing, returns early and logs NOTHING, which
  looks like silence and proves neither success nor failure. Registration only
  does `.trim().toLowerCase()` on the address and never strips a plus tag, so
  `you+test1@gmail.com` is a distinct account that still reaches your inbox. No
  working inbox is needed either: `is_verified` gates only the two bulk email
  queries and the referral reward, never registration, login or adding a
  subscription.
  WHAT THE LOG LINE DOES NOT MEAN: `delete_events=true` queues an ASYNC deletion
  and covers only events captured before the request, so the line means PostHog
  ACCEPTED the erasure, not that the events are already gone. Confirm that by
  searching the distinct id in the People view later, not by reading the log.
- `/delete-account` EXISTS because Play requires a deletion route reachable
  without installing the app, separate from the in-app one. STILL TO DO: declare
  it in Play Console's Data Safety form, which is a Console action nobody can do
  from a repo. The page itself is confirmed rendering correctly in a browser on
  a phone (2026-09-18), so the URL is ready to paste into the form.
- DELETING AN ACCOUNT NOW SENDS A CONFIRMATION EMAIL, added 2026-09-18. Neither
  Play nor GDPR requires one: it exists because without it the only way to learn
  your account was deleted is to open the app and find yourself signed out.
  It follows the same rule as the PostHog erasure and for the same reason. The
  address is read off the row BEFORE the DELETE, since afterwards there is
  nowhere to look it up, and the send is NOT awaited into the response. `sendEmail`
  retries three times with a backoff, so awaiting it could hold the response for
  seconds and then fail a deletion that has already happened irreversibly.
  IT CARRIES NO UNSUBSCRIBE FOOTER, unlike every bulk email here, which is
  deliberate twice over: it is transactional so RFC 8058 does not apply, and
  `unsubscribeUrlFor` HMACs the user id, which by then names a row that no longer
  exists, so the link would resolve to nothing.
- THE BACKEND HAD NO LANGUAGE SIGNAL AT ALL until that email needed one. There is
  no language column on `users`, and `lib/api.ts` sent no `Accept-Language`, so
  anything the server wrote would have been English for every user including the
  German half. The request interceptor now sends a bare `de` or `en` from i18n,
  in its OWN try/catch: an English email is a far smaller problem than a request
  that never leaves. Bare rather than regional because the server tests the FIRST
  tag with `^\s*de\b`, so `de-AT` must still read as German.
  That header is the reusable half. Anything server-rendered or server-sent can
  now be localised, which was not previously possible.
- THE 2026-09-12 PUBLISH carried a review round from Codex, the other
  assistant, which produced six findings across two passes with no false
  positives. Worth knowing what it found, because the pattern repeats:
  `subscriptions.tsx` destructured `isLoading` but never `isError`, so a
  failed request fell through to the empty state and told someone on a dropped
  connection they had no subscriptions; both calendar renewal rows pushed to
  the subscriptions list instead of the subscription; nothing imported a
  date-fns locale anywhere, so every month and weekday name rendered English
  regardless of app language; and `MonthCalendarGrid` had zero accessibility
  props at all.
- THE CALENDAR MARKED RENEWALS A DAY EARLY WEST OF UTC, until 2026-09-18, and
  the reminder for the same row arrived on the right day. Two different answers,
  same app, same data.
  WHY: `next_billing_date` and `trial_end_date` are TIMESTAMPTZ, and
  subscriptions.create stores `new Date("2026-10-16").toISOString()`, which is
  MIDNIGHT UTC. So the API sends an instant rather than a day, and `new Date()`
  on it resolves to the PREVIOUS local day at any negative offset.
  `lib/notification-scheduler.ts` already did `String(x).slice(0, 10)` before
  parsing, so reminders were never wrong. `lib/recurrence.ts` did not, and every
  occurrence it projects inherits its anchor, so the calendar grid, the timeline
  and the analytics month were all shifted together.
  MEASURED, not reasoned about: a 16 October renewal read day 15 in New York and
  Los Angeles, day 16 in Vienna, Tokyo and Auckland. After the fix all five read
  16, so the DACH audience saw no change at all. That is also why it survived:
  it is invisible from Vienna. The currency picker offers USD, CAD, BRL and MXN,
  so the affected users are real rather than hypothetical.
  `parseApiDate` IN `lib/utils.ts` IS THE FIX AND THE THING TO REUSE. It reads
  the leading YYYY-MM-DD digits, which is what makes it offset-proof: those
  digits are the day and no reader's timezone can change what they say. Never go
  back to `new Date(sub.nextBillingDate)` for anything that asks WHICH DAY.
  STILL UNFIXED ON PURPOSE, eight sites in `insights.tsx`, `(tabs)/index.tsx` and
  `notification-preferences.tsx` that do `Math.ceil((new Date(x) - now) / 86400000)`.
  Same root cause, much milder: a few hours out only changes a rounding. Moving
  them would shift what the "3 days left" badges say, which is a product decision
  about whether that counts CALENDAR days or 24 hour periods, so it wants an
  answer before an edit.
- TWO HELPERS CAME OUT OF THAT and should be used rather than reinvented.
  `lib/date-locale.ts` exposes `useDateFormat` and `weekdayInitials`, picking
  the date-fns locale from i18n. Never localise the `"yyyy-MM-dd"` calls: those
  build the day-map keys and are identifiers, not display text. `weekdayInitials`
  derives the letters from the locale because the German row is S M D M D F S,
  which is not a swap a translator can perform on a single string.
  `lib/cycle-label.ts` maps the API's raw `monthly`/`yearly`/`weekly` to noun
  forms, since German needs "pro Monat" and reusing `dashboard.monthly`
  ("Monatlich", an adjective) is grammatical nonsense. It falls back to the raw
  API value for an unrecognised cycle rather than blanking the price line.
- AN ACCESSIBILITY BUG WORTH REMEMBERING THE SHAPE OF. The first fix used
  `markedDates.get(day).length` as the spoken renewal count. `markedDates`
  deduplicates by colour because that is what the dots draw, so three streaming
  subscriptions on one day collapsed to one colour and the label said "1
  renewal". It was invisible to anyone who could see the three dots were really
  one dot, and wrong only for the person relying on the label, which is the
  entire audience the label exists for. `renewalCounts` now comes from
  `occurrencesByDay`, one entry per occurrence. Accessibility defects fail
  precisely where nobody is looking, so they need simulating rather than
  eyeballing.
- THAT ENTRY IS FIXED AND THIS NOTE REPLACES IT. It used to say `app/_layout.tsx`
  hardcoded all fourteen `Stack.Screen` titles in English and did not import
  `useTranslation` at all. Checked 2026-09-18: it imports `useTranslation`, calls
  `t("screenTitles.<x>")` fourteen times, and both locale files carry the
  `screenTitles` block. `df2db7a5` did this and shipped in the 2026-09-17
  publish. The note outlived the work by a day, which is its own lesson: a STILL
  OUTSTANDING line is a claim with an expiry date, so check it before repeating it.
- `settings.update` IS A PARTIAL UPDATE, and every caller must send ONLY the
  fields it is editing. This was not true until 2026-09-18 and the asymmetry was
  invisible: three columns used COALESCE and `budget_goal` was a bare assignment
  in the same statement, which reads as deliberate rather than as a bug.
  What it cost: any caller saving a different setting had to resend budgetGoal or
  lose it, so both callers passed `settings?.budgetGoal ?? null`, which is null
  until the settings query resolves. Changing your currency in Account Settings,
  or saving a custom category on the Subscriptions screen, BEFORE that first load
  landed wiped the budget goal. The category path also resent
  `settings?.currency ?? "USD"` and reset a euro subscriber to dollars, which is
  worse than it sounds: the currency decides what every stored price MEANS, so
  the numbers stay and their interpretation changes. Nothing errored in any of
  it. The write succeeded, it just wrote defaults.
  THE RULE NOW: presence of the KEY decides. An absent field is preserved, an
  explicit `null` clears it, and those cannot be the same thing because clearing
  a budget goal is a real action the UI offers. Do not "protect" a neighbouring
  field by resending it, which is exactly how this started.
  BOTH HALVES WERE NEEDED, and neither works alone: an old client still sends the
  key so the backend still honours it, and a new client against an old backend
  still gets nulled by `budgetGoal ?? null`. Backend rides Railway, client needs
  the publish, and between the two the behaviour is unchanged rather than worse.
  `__tests__/settings-update.test.js` pins both sides.
  FOUND BY GREPPING THE WHOLE REPO for the endpoint rather than the one screen
  under repair. `app/(tabs)/subscriptions.tsx` was the second caller and would
  have been missed, which is the buildTips crash repeating in a new place.
- THAT 2026-09-11 UPDATE IS CONFIRMED APPLIED ON A REAL DEVICE, read off the
  Build Info panel rather than assumed from a successful publish: `Embedded
  launch (no OTA applied): false`, `Update ID:
  01a08f4f-21db-7bac-b8a0-9693b34abcc5`, `Update published:
  2026-09-11T07:12:03.035Z`, against `Native build: 40` and `Runtime
  version: 1.0.1`. That is also the runtimeVersion mechanism proven end to
  end: a build carrying 1.0.1 asked for updates tagged 1.0.1, and got one.
- GOOGLE POLICY, both satisfied, verified by 40 being accepted after the
  31 Aug 2026 enforcement date: Play Billing Library >= 8.0.0 (comes from
  `react-native-purchases ^10.4.4`, which pulls 8.3.0, see RevenueCat's
  VERSIONS.md) and target API 36 (set by `fix-gradle.sh`, which
  codemagic.yaml runs; there is no expo-build-properties plugin, so the
  shell script is the only thing doing it). Since 40 targets 36, the
  `"edgeToEdgeEnabled": false` in app.json is inert, Android 16 ignores
  the opt out. Worth checking screens for clipping under the system bars.
- NOTHING NATIVE has changed since 39 was built: no app.json, no assets,
  no android/, no dependency. Everything after it is JS or backend, so it
  ships over the air. Check this before assuming a build is required:
  `git diff --name-only <build commit>..HEAD` filtered to android/,
  assets/, app.json, package.json, eas.json.
- REFERRALS, fixed 2026-09-05, previously half broken. Only the referrer
  was ever credited, while the screen title, the description, the share
  message and the redeem confirmation all promised both sides a month.
  `rewardReferral(referrerId, referredId)` now credits both in one
  statement, claiming `referral_rewarded` first so a retry cannot pay
  twice. Codes were also only assigned at registration with no backfill,
  so every account predating the feature saw a dash and a disabled share
  button; `referrals.me` now assigns on first read. Confirmed working
  against production. There is a rolling cap on the standing balance,
  12 months, `REFERRAL_MAX_BONUS_MONTHS` in Railway overrides it.
- Decided against a discount for the referred user instead of a free
  month (2026-09-05): Play Billing will not let the backend set a per
  user price, so it would need promo codes or a second SKU, and at
  $2.99/month a discount is worth less than the month it replaces. The
  free month also costs nothing real and doubles as the trial. Revisit
  with evidence once referrals actually have usage.
- LANDING PAGE ANALYTICS: PostHog, same EU project as the app, added as
  transform 16 in tools/build-landing.py. Autocapture and session replay
  off, `persistence: 'memory'` so there is no cookie and no consent
  banner, Do Not Track honoured, nothing typed is ever sent. Events are
  `$pageview`, `landing_signup_completed`, `landing_play_store_click`.
  Privacy policy section 15 covers the site as well as the app.
- `store-listing-de.md` is the German Play Store listing, and it IS NOW
  UPLOADED (2026-09-10), under Grow > Store presence > Main store listing >
  Manage translations > German (Deutschland). Title "Trimio: Abo Tracker &
  Kosten" (28/30) and the short description (76/80) went in verbatim;
  Play Console's own counter confirmed both. Terminology matches
  locales/de.json (Testphase, not Probeabo) and every character count was
  measured.
- The full description that went up is NOT the one in the file's own code
  block, it is the merged version: the file's structure and privacy section
  plus the ASO the first draft had dropped, namely named services (Netflix,
  Spotify, Disney+, iCloud), the paste-a-confirmation-email feature leading
  the second paragraph instead of "manuell hinzufügen", "Abonnement" as well
  as "Abo" since German search uses both, and a Premium paragraph naming the
  actual features rather than saying "zusätzliche Funktionen". 2566
  characters against a 4000 limit.
- TEMPLATE COUNT IN MARKETING COPY: the listing used to claim "über 160
  Vorlagen". That number predates `dedupeForRegion` and was an overclaim,
  since the catalogue holds 127 unique service names and a user browses at
  most one row per name. It now says "über 120". If the catalogue changes,
  re-count with a unique-name count, not a row count.
- `chipText` IN `app/(tabs)/subscriptions.tsx` CARRIES `textTransform: "capitalize"`,
  and that is deliberate: category names arrive lowercase and want title casing.
  It is also why the free trial checkbox renders as "This Is A Free Trial" while
  `locales/en.json` says "This is a free trial". The string is NOT wrong and the
  screen recordings showing it are NOT mockups, which is worth knowing because
  the mismatch looks exactly like fabricated UI at first glance.
  IT WAS STILL A BUG IN GERMAN, fixed 2026-09-18. German capitalises nouns but
  not verbs, articles or adjectives, so "Dies ist eine kostenlose Testphase" was
  rendering as "Dies Ist Eine Kostenlose Testphase", which reads as machine
  translation on a product whose claim is that it is properly localised. Every
  OTHER chip is a single capitalised noun in both languages, so the transform is
  a no-op for them: the trial toggle was the only chip carrying a sentence. It
  now opts out via `styles.trialToggleText` (`textTransform: "none"`) rather than
  changing `chipText`, so the category chips keep the casing they need.
  THE GENERAL SHAPE: a text transform is a layout decision applied to language,
  and it stops being correct the moment one string in the shared style is a
  sentence instead of a label. The other two `capitalize` call sites
  (`categoryBadgeText`, `legendName`) were checked and are category names only.
- EXCHANGE RATES ARE VALIDATED AT BOTH ENDS as of 2026-09-18, and the reason is
  that `?? 1` looks like a guard and is not one: it catches null and undefined
  ONLY. A rate of `0` divided through to Infinity and a `NaN` rate propagated, so
  a single bad value from `api.frankfurter.app` rendered EVERY price in the app
  as "€Infinity" or "€NaN", with nothing having thrown. `fetchRates` used to
  spread the response straight into the store unchecked.
  Now the fetch keeps only finite positive numbers and refuses to replace good
  rates with an empty set, and `convert` returns the amount untouched unless both
  rates are finite and positive. Showing an unconverted number is a small quiet
  error; showing NaN where a monthly cost belongs looks like the app has fallen
  over.
  ONE DELIBERATE BEHAVIOUR CHANGE: a MISSING rate no longer defaults to 1. It
  used to, which meant an absent base was silently treated as USD and prices that
  were never entered in dollars got converted anyway, the same class of error as
  the 2026-09-05 baseCurrencyCode bug. The picker only offers the nine currencies
  FALLBACK_RATES covers, so this path does not fire in practice, but honest is
  better than confidently wrong. `__tests__/currency-convert.test.ts` pins it.
- CATEGORY COLOURS (`lib/categories.ts`) drive four surfaces at once: the
  quick add icons, the subscription card icons, the Stats donut with its
  legend, and the calendar day dots. The rebrand missed them entirely
  until 2026-09-05, so violet and Netflix red were still shipping. The
  ten real categories are now a validated categorical palette, checked
  with the dataviz skill's `validate_palette.js` against the warm white
  ground on the ADJACENT pairlist, which is the one a donut needs since
  slices touch only their neighbours. THE DECLARATION ORDER IS PART OF
  THAT RESULT: red with olive-green, and orange with green, both fail
  when adjacent, so reordering the map without re-running the validator
  silently reintroduces them. `other` is the one deliberate neutral.
- The Stats donut caps at 6 named slices plus a labelled Other row
  (`DONUT_SLICES` in `app/(tabs)/analytics.tsx`). Not 3: that was tried
  first, was tighter than the colours require, and hid real categories.
  Eleven is not an option, the colours stop being tellable apart.
- SERVICE TEMPLATES: the region lives in the row, never in the name. 33
  services used to be listed twice, "Amazon Prime" beside "Amazon Prime
  DE", and 59 names carried a DE/AT/CH token. Names are clean now and
  therefore collide on purpose: `dedupeForRegion` picks the row matching
  the user's region, so the list shows one row per service at the right
  local price (162 rows down to 127). The language is the only region
  proxy this app has, there is no geo detection. `findTemplateByExactName`
  takes a currency so the market price insight compares against the right
  regional row, otherwise a euro subscriber gets told they overpay.
- TEMPLATE PRICES go stale, and the app is not allowed to pretend
  otherwise. `verified` on a ServiceTemplate is the date somebody actually
  checked that row against the provider; absent means never checked since
  the catalogue was written in July 2026, which is true of most of the 127
  rows. `isPriceFresh` gates the market price insight on that date being
  within 6 months, so the "you may be overpaying" alert only speaks from a
  figure somebody stands behind. Verified 2026-09-05: Netflix Standard DACH
  15.99 and Amazon Prime DACH 8.99 (both already right), Disney+ DACH
  8.99 -> 10.99, Spotify Premium DACH 10.99 -> 12.99, Netflix Basis m.
  Werbung 4.99 -> 6.99, Xbox Game Pass Ultimate US 19.99 -> 22.99. US rows
  and the DACH sport services (DAZN, WOW, RTL+) were NOT verified: the
  sources were mostly promotional pricing and could not be pinned down.
- A SECOND PASS ON 2026-09-17 took it from 6 verified rows to 14, all of the
  Quick Add set. Four were wrong: Netflix Standard USD 15.49 -> 19.99, Netflix
  Premium USD 22.99 -> 26.99, Spotify Premium USD 10.99 -> 12.99, and Xbox Game
  Pass Ultimate DACH 14.99 -> 20.99. That last one is the big miss and its
  source is Xbox's own newsroom: Microsoft raised it to 26.99 in Oct 2025 and cut
  it to 20.99 on 21 Apr 2026, so the catalogue sat six euros under the truth.
  Amazon Prime, Adobe CC, Microsoft 365 Personal and iCloud+ 50GB were checked
  and already correct, so they carry a date rather than a change.
  NOTE THE SIDE EFFECT: eight rows that were silent now speak, because
  isPriceFresh only lets the insight talk about fresh rows.
  148 rows remain unverified. The ones that RESIST verification are listed in a
  comment at the top of `lib/service-templates.ts` so nobody repeats the dead
  ends: DAZN, WOW Sport and RTL+ still quote a different product in every source
  (44.99 monthly vs 24.99 annual vs 9.99 promo for DAZN Unlimited alone), Disney+
  US returned three different answers, and Netflix Basic US names a plan that no
  longer exists, which needs a decision rather than an edit since renaming
  orphans anything matching the old name.
- PRICE VERIFICATION IS POSSIBLE FROM A SANDBOX, via WebSearch. Direct fetches to
  netflix.com and friends are egress-blocked like everything else, but the search
  tool routes differently and works. Use two independent sources before changing
  a number, and never stamp `verified` on something you did not actually check.
- The market price tests lean on real catalogue rows, so renaming a
  template can orphan a fixture silently. That already happened once:
  stripping region tokens renamed "Drei AT S" to "Drei S" and the test kept
  asserting against a name that no longer existed. Fixtures now use rows
  that carry a verified date, and there is a test asserting an unverified
  row stays quiet.
- CURRENCY: picking a currency sets both what prices are entered in and
  what they are shown in. `setBaseCurrency` existed but was called from
  nowhere, so `baseCurrencyCode` was stuck at USD for everyone, the add
  form said "Price in USD" wherever you lived, and useFmt then converted
  what you typed out of dollars. Anything added from a template before
  2026-09-05 was stored at its US price and now reads as that number in
  the local currency, so old rows may look high.
- The floating add button overlaps the scroll area, so screens that
  render it must reserve `FAB_SCROLL_CLEARANCE`, exported from
  `components/GlobalFab.tsx`. Subscriptions is exempt, GlobalFab returns
  null there.
- `assets/play-store-icon.png` is the 512 square listing icon, a
  SEPARATE asset from the launcher icon. Play Console requires exactly
  512 and rejects an alpha channel.
- MARK: a chevron pointing right, inner edge a V, outer edge a circular
  arc, with a mint triangle nesting into the V. Regenerate everything
  from the repo root with `python3 tools/trace-mark.py && python3
  tools/make-icons.py && python3 tools/make-splash.py && python3
  tools/make-og.py && python3 tools/make-svg.py`.
- The mint triangle sits on the page ground, not on the chevron, so on
  light grounds it takes `#1F7A62` and on navy it takes `#55C6A3`. At
  21px a 1.9:1 triangle is a ghost, which is why the site header uses the
  deepened mint and the navy footer the bright one.
- SPLASH: Android 12+ only allows an icon on a solid colour for the OS
  splash, so the illustrated launch screen is NOT the OS splash. It is
  `assets/splash.png`, drawn by `components/AnimatedSplash.tsx` once the
  app mounts, with `resizeMode="cover"` so the wave reaches the bottom
  edge. The OS splash is `assets/splash-icon.png` (the navy mark) on warm
  white, matching the screen that follows it so there is no colour flash.
  Do not try to move the rings, wordmark or wave into the OS splash.
- PLAY STORE ASSETS: the owner confirmed (2026-09-09) that the new
  screenshots and the corrected listing icon are uploaded to Play Console.
  They are a Console upload and never needed a build or a release. The
  feature graphic was not separately confirmed, so check its state in
  Console rather than assuming either way. The promo video re-cut still
  wants those same shots.
- The mark mismatch is RESOLVED: 1.0.3 is live, so the Play Store app and
  subtrimio.com both show the chevron.
- In progress: Phase 2 (posting cadence). The old promo
  (`trimio_promo_clean_vertical.mp4`) is superseded and not worth re-cutting.
- VIDEO IS NOW A PIPELINE, not hand editing. `tools/make-cut.py` builds a cut
  from a JSON spec in `cuts/` and REFUSES anything breaking the rules before it
  renders a frame: dash as clause punctuation, Apple named, a decimal point in
  German copy, a line too short to read twice, type outside the 25 to 75 percent
  caption band, missing footage. `tools/test-make-cut.py` feeds each rule
  something that breaks it and fails if the renderer accepts it, plus four cases
  it must NOT reject including a compound hyphen, which is German spelling and
  was over-corrected once already. Run it after touching the renderer.
  Three scene types: `card` (brand frame, no footage), `reframe` (crop a region
  of a clip and inlay it, scaling to fill a content box that clears both UI
  zones, so a tight crop comes out LARGER than in the source), and `clip`
  (passthrough for footage that already has its own composition; `reframe` would
  stack a second header on it). ffmpeg comes from `imageio_ffmpeg`, since there
  is no system ffmpeg in a sandbox.
- WHAT THE PLATFORM COVERS, measured not guessed: the bottom 20% and the right
  15% of a vertical frame. Every video sent for review before 2026-09-16 put its
  own footer, the app's tab bar or the floating button inside that strip.
- THE SHORTS THAT EXIST, all English because the recordings are English:
  auto-fill paste, savings toast into the referral nudge, duplicate catch, and
  the cancellation guide. German Shorts need a German RECORDING, not German
  subtitles over an English screen, which would tell a German viewer the app is
  not localised when it has 589 keys and a toggle in Settings.
- `video-rerecord-brief.md` IS THE HANDOFF for the next recording, written so
  Codex or the owner can execute it without re-deriving anything: findings with
  timestamps, capture setup, an eight beat shot list, and a checklist. Its two
  highest value lines are record at 1080 rather than 720, and hold the payoff
  frame about four times longer than feels right. The best still in the whole
  capture, pasted email plus Detected line plus filled fields all at once, lasted
  2.5 seconds.
- GENERATED VIDEO MUST NEVER TOUCH THE UI. Every model smears text and the screen
  IS text. Earlier drafts produced "Trlmio", an iPhone running an Android-only
  app, and a green mock dashboard that is not Trimio's. Generative tools are fine
  for the human half of a frame and never the screen half. Higgsfield is the
  connected generator; there is no Runway connector and none is needed.
- VIDEO CAPTION CONSTRAINTS, the reasons the old cut needs redoing and the
  traps in redoing it: no Apple App Store badge (Android only, the Play link
  is `play.google.com/store/apps/details?id=com.trimio.app`); TikTok and
  Reels both cover roughly the bottom 20% and right 15% of a vertical frame
  with their own UI, which is what caused the caption overlap, so keep
  captions in the middle band; and Soft Mint must never sit behind white
  caption text (2.1:1), use Ink Navy behind white, or `#1F7A62` for text
  that has to read as mint. The two live taglines are "Know before you pay"
  and "Wissen, bevor abgebucht wird", and THEY DO NOT BACK TRANSLATE INTO
  EACH OTHER. That is deliberate, decided 2026-09-14, and it is the one
  place in this product where the two languages say different things on
  purpose. German renders it as "before it is debited", because a renewal is
  not an act you perform: the money is taken while you do nothing, and
  `abbuchen` is the verb a German bank statement uses, which is also how
  every in-app English string already puts it (`chargedOnExpiry`, "You will
  be charged {{amount}} automatically"). English keeps the shorter, punchier
  "you pay" because a tagline is transcreated rather than translated, and
  four words beat five on a share card. DO NOT "fix" either side toward the
  other, in `tools/landing-de.json`, the store listings, or the video
  captions. This entry used to record the English as "Know before you're
  charged", which appears on no shipped surface at all.
- A SoLoader NATIVE CRASH IS ON RECORD AND WAS DELIBERATELY NOT FIXED
  (2026-09-08, Sentry). `SoLoaderDSONotFoundError: couldn't find DSO to
  load: libc++_shared.so` at `MainApplication.onCreate`, one user, fatal,
  every launch. The diagnosis: SoSource 0 reported the app's native library
  directory as `/lib/x86_64` while SoSource 1 searched `/lib/arm64-v8a`
  inside the split APKs. The device was `HRY-LX1T`, an Honor 10 Lite, which
  is Kirin 710 and therefore ARM64 with no x86_64 anywhere in it, installed
  from Play (`installerStore = com.android.vending`, `isSideLoaded = false`)
  on versionCode 39. So the APK search path was right and the INSTALL was
  corrupted: Android linked the app to an architecture the phone does not
  have. Nothing in this repo causes it, confirmed by grepping the whole
  build chain (plugins, app.json, codemagic.yaml, fix-gradle.sh) for
  `abiFilters`, `extractNativeLibs`, `useLegacyPackaging`, `enableSplit` and
  `reactNativeArchitectures` and finding no overrides at all. It cannot be
  fixed over the air either, since SoLoader runs before any JS.
  WHAT WOULD CHANGE THE DECISION: the same crash on versionCode 40, more
  than a handful of users, or a SECOND manufacturer appearing. Any of those
  and the mitigation is `useLegacyPackaging true` in the next native build,
  which makes the installer extract the .so files to the lib directory
  instead of reading them from inside the APK. Not worth a build for one
  corrupted install on a superseded versionCode.
- That crash was only ever visible because of Fix 9 in `fix-gradle.sh`,
  which adds native Sentry auto-init through AndroidManifest meta-data so
  crashes BEFORE the JS bundle loads still report. Do not remove it.
- LOCALE PARITY NEEDS TWO CHECKS, NOT ONE. Matching key counts are not
  enough. On 2026-09-10 both files were at 562 keys with nothing missing in
  either direction, and `accountSettings.thresholdHint` was still broken:
  the call site passes `{ symbol: currency.symbol }`, English spent it on a
  closing "Default: {{symbol}}50/mo.", and the German had dropped that
  sentence, so German readers were told which subscriptions get flagged but
  never what the threshold defaults to. i18next ignores an unused
  interpolation value silently, so nothing crashed. ALWAYS compare the
  `{{...}}` tokens of each key across the pair as well as the key names.
  A scan of every `t("...")` in app/, components/ and lib/ found 520
  distinct keys with zero missing and zero template-literal keys, so that
  scan is complete rather than partial.
- RENEWAL REMINDERS WERE ENGLISH ONLY UNTIL 2026-09-18, and that was the largest
  localisation gap in the product as well as the least visible. `lib/notification-
  scheduler.ts` hardcoded every string it sent: "in 7 days", "{{name}} renews
  {{when}}", "will be charged on", "trial ends tomorrow", "Cancel now if you
  don't want to be charged". A notification is the one surface you cannot find by
  opening the app and looking, which is why 589 translated keys, a German store
  listing, German legal documents and a German landing page all coexisted with it.
  It matters more than its size suggests: the reminder IS the product. "Wissen,
  bevor abgebucht wird" is a promise kept by this file and almost nowhere else.
  FORMATTING IS LANGUAGE AWARE TOO, not just the words. German writes a decimal
  COMMA and puts the symbol after the amount, so it renders "10,00 €" rather than
  "€10.00". This project already refuses a decimal point in German copy elsewhere
  (`tools/make-cut.py` rejects a render containing one), so the notification had
  been breaking a rule the video pipeline enforces on captions. The date also
  follows the APP language now: a bare `toLocaleDateString()` uses the DEVICE
  locale, so a German user on an English phone got an English date inside German
  text.
  SWITCHING LANGUAGE NOW RESCHEDULES, which is not optional here. The OS bakes
  the text in when the notification is scheduled, so pending reminders keep the
  old language until something reschedules them, and the only thing that did was
  the dashboard's subscriptions query happening to refetch. `setLanguage` now
  calls a fire-and-forget reschedule that reads the cached list out of
  `lib/query-client.ts`, swallowing everything: changing language must succeed
  even with notifications denied or the cache empty.
  ALSO ON RECORD, since it will matter at the next SDK bump: reminders are
  scheduled from `onSuccess` on a `useQuery` in `app/(tabs)/index.tsx`. That
  option EXISTS in `@tanstack/react-query` 4.32.0, which this project pins, and
  was REMOVED from useQuery in v5. Upgrading to v5 without moving that call would
  silently stop every reminder in the app, with nothing erroring anywhere.
- A CHECK BEFORE AN `await` DOES NOT GOVERN WHAT HAPPENS AFTER IT, and that is
  the shape of the notification cancellation bug fixed 2026-09-18 (Codex's
  recheck of 31a93689). `scheduleRenewalReminders` checked the session
  generation at the top of each subscription, which reads like the race is
  covered and is not: the dangerous moment is INSIDE the enqueue. Sign out while
  `scheduleNotificationAsync` is in flight and it completes afterwards, the OS
  keeps the notification, and the same iteration then queues the TRIAL reminder
  with no check in front of it at all. So `await cancelAllReminders()` could
  return with the queue empty and two of account A's notifications appear in it
  a moment later, names and amounts included, on a device that may not be theirs.
  THE RULE: a pre-call check decides whether to START; only a post-call check
  decides what EXISTS. Every enqueue now goes through `enqueue()`, which checks
  on both sides and cancels the identifier it was just handed if the session
  moved, and a false answer aborts the whole run rather than just that enqueue.
  Both a cancel and a schedule now take the NEXT generation, so a newer run
  invalidates an older one exactly the way a sign-out does. Two overlapping runs
  used to share a number and neither could stop the other, while the newer one's
  opening `cancelAll` wiped what the older one had queued and the older one kept
  adding to the queue the newer one owned. That is how switching reminders OFF
  could be undone by an enabled run that was already in flight.
  THE SWEEP IN `cancelAllReminders` IS GENERATION GUARDED AND THAT IS NOT
  OPTIONAL: it fires after the in-flight run settles, which can be long after
  somebody has signed in again, so unguarded it would clear the NEW account's
  reminders. It is also deliberately not awaited into the caller, because a run
  parked inside an OS call that never returns must not be able to hang a
  sign-out.
  MEASURED, not reasoned about. `__tests__/notification-race.test.js` drives the
  real scheduler against a mocked OS queue whose enqueue can be made to hang on
  demand, which is the only way to express "while pending". Against the previous
  code the cancel case leaves 2 notifications behind and the disable case leaves
  2; against the fix both are 0, and the working paths still queue 2.
- SWITCHING LANGUAGE USED TO SILENTLY TURN REMINDERS BACK ON, fixed the same
  day. `lib/language-store.ts` reschedules on a language change, because the OS
  bakes the text in at scheduling time and pending reminders would otherwise
  stay in the old language. It called the scheduler with no preferences, and the
  scheduler's `{}` default means push on, renewal alerts on, three day lead. So
  changing language re-enabled reminders somebody had switched off and replaced
  a seven day choice with three. Nothing errored, and the scheduler was right
  the whole time: only the caller was wrong, which is why a scheduler unit test
  could never have found it.
  THE GENERAL RULE THIS PROJECT KEEPS RELEARNING: a default that means "not
  loaded yet" is not consent. Absent still means ON in the scheduler, on
  purpose, because dropping reminders because a query was slow is the one
  failure this product cannot afford. Every CALLER must pass what it knows.
  `prefs ?? {}` ONLY FIXED THE CACHED CASE, which Codex pointed out reviewing
  81b709ba. With the preferences query not yet resolved it still fell through
  to the scheduler's enabled default, so a language switch before the dashboard
  had loaded re-enabled reminders somebody had turned off: the same bug in a
  narrower window. `rescheduleReminders` now RETURNS rather than defaulting.
  Skipping costs pending reminders staying in the previous language until the
  next refetch reschedules them properly. Not skipping costs somebody
  notifications they explicitly opted out of. Those are not close.
  JEST CANNOT EXECUTE `rescheduleReminders` AT ALL, and this entry used to claim
  `__tests__/language-reminders.test.js` drove the real store, which was wrong.
  It reaches its three dependencies through dynamic `import()`, babel leaves
  those untransformed, and jest's VM rejects them with
  `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG` ("A dynamic import callback was
  invoked without --experimental-vm-modules"). The store's own try/catch
  swallows that, so a behavioural test there goes green having run NOTHING,
  which is the exact failure mode this file keeps recording. Metro handles
  dynamic import, so only the test is affected, never the app. Making it
  executable needs a babel plugin devDependency (pnpm will not resolve one that
  is not explicitly installed) or a transform change, which is not worth it for
  a three line caller. The test is therefore a SOURCE-READING one that says so
  in its own header, and the behaviour was verified by running the real store
  outside jest against both the old and the new code.
  THE SHAPE TO REMEMBER: a fire-and-forget call inside its own catch is the
  right design here and it is also the thing that hides a test harness failing
  to run. When a swallowed path is under test, prove the code RAN before
  believing what it asserts.
  AND THE REGEX LESSON, since it cost two wrong answers about correct code: an
  argument list has nesting in it. `scheduleRenewalReminders\([^)]*prefs` stops
  dead at the `)` inside `useCurrencyStore.getState()`. Count brackets, do not
  match them.
- THE BILLING DAY IS NOW STORED, because `next_billing_date` cannot carry it.
  `subscriptions.billing_anchor_day SMALLINT`, added 2026-09-18. A month is not
  a fixed length, so a subscription due on the 31st has to be WRITTEN as 28
  February, and `advanceBillingDate` derived its anchor from the date it was
  advancing. That survived within one call and was lost the moment the clamped
  value was persisted, and a real advance is one call per request with a
  database write in between: 31 January became 28 February and then 28 March,
  permanently. The earlier tests missed it because they pass an explicit anchor
  of 31 or advance several months inside a single call, and production does
  neither. Measured across the persistence boundary: `2026-02-28 2026-03-28
  2026-04-28` before, `2026-02-28 2026-03-31 2026-04-30` after.
  THE BACKFILL DELIBERATELY RECOVERS NOTHING. It reads the day
  `next_billing_date` already says and writes ONLY the new column, never a date.
  A stored 28 February cannot prove whether 28, 29, 30 or 31 was meant, so
  guessing would move real billing dates on real subscriptions to settle a
  question the data cannot answer. A row that has already drifted stays drifted,
  which is the behaviour we already had, and everything created or edited from
  now on carries the true day. The anchor only moves when the DATE is
  deliberately set (a date the user picked, or a regenerated one after a cycle
  change) and is never re-derived from the stored value.
  THE CLIENT NEEDS IT TOO, or the calendar and the charge disagree: `formatSub`
  sends `billingAnchorDay` and `lib/recurrence.ts` clamps from it. Weekly
  ignores it, since there is no day of month to preserve. A yearly 29 February
  correctly returns to the 29th in the next leap year.
  AND THEN AN ORDINARY EDIT THREW IT STRAIGHT BACK AWAY, caught by Codex's
  review of 81b709ba within hours of the above shipping. `subscriptions.update`
  read a SUPPLIED `nextBillingDate` as a CHANGED one. The edit form seeds its
  date field from the stored row and posts every field back, so renaming
  Netflix resubmitted the clamped 28 February, which was taken as a deliberate
  choice of the 28th and overwrote the anchor of 31. One rename and a month-end
  subscription was drifting again. Measured, not argued: anchor 31 went to 28
  and the next advance gave 2027-03-28 instead of 2027-03-31.
  THE FIX COMPARES THE CALENDAR DAY against the stored one and only treats a
  DIFFERENT day as a change. Deliberately server side rather than client side:
  clients already installed cannot be changed and will go on resubmitting
  unchanged dates for as long as somebody skips an update, so a client-only fix
  would leave the bug live on every phone that has not updated. Codex asked for
  both halves; the client half was skipped ON PURPOSE, because the server is
  authoritative and correct on its own and the alternative was an untestable
  change to the busiest form in the app for no behaviour that is not already
  guaranteed. If a future reader wants it anyway, it is defence in depth, not a
  fix.
  ONE CASE REMAINS UNRESOLVABLE and is not worth pretending otherwise: somebody
  sitting on a clamped 28 February who OPENS the picker and deliberately
  chooses 28 February meaning "bill me on the 28th from now on" keeps the
  anchor of 31. Nothing in the payload distinguishes that from not touching the
  field, and no client-side dirty flag fixes it either, since both produce the
  same date. Preserving is the safer default of the two. Changing the cycle, or
  picking any other day, sets the anchor as expected.
  MY OWN COMMENT IN THAT BLOCK ALREADY SAID "editing a name or a price must not
  touch it" while the code did the opposite. That is the third time in this file
  a comment has documented an intention rather than the behaviour, after
  `lib/pricing.ts` and the removed entitlement fail-open. A comment describing
  what the code SHOULD do is worth a test that checks it does.
- THE JEST SUITES CANNOT RUN IN A SANDBOX, but the LOGIC in them can, and the
  difference is worth the twenty minutes. Node 22 strips TypeScript types
  natively (`node --experimental-strip-types`), so a scratchpad copy of a module
  with its imports rewritten to local stubs runs for real. That is how the
  notification race, the language store and the billing anchor above were each
  checked against BOTH the old and the new code before being committed, rather
  than reasoned about. The pure source-reading suites need even less: a thirty
  line `expect` shim runs all 121 of those assertions here.
- THE UPGRADE SCREEN SHOWED A PRICE GOOGLE PLAY WAS NOT GOING TO CHARGE, until
  2026-09-18. It fetched the RevenueCat offerings and used them ONLY to make the
  purchase: every price it DISPLAYED came from `PREMIUM_PRICES` in
  `lib/pricing.ts`, which is hardcoded USD. So a subscriber in Austria read
  "$2.99" on the screen where they decide to pay and was then charged in euros at
  Play's own local price.
  `app/tip-jar.tsx` had this right the whole time (`priceFor` falls back only
  when the offerings are absent), so the fix was copying a pattern that already
  existed in the codebase rather than inventing one.
  `lib/pricing.ts` DESCRIBED ITSELF as a fallback "shown before RevenueCat's
  localized priceString loads", which was true of the tip jar and had never been
  true of the upgrade screen. Another comment that documented an intention rather
  than the behaviour.
  STILL SHOWING THE USD FALLBACK ON PURPOSE: `components/PremiumGate.tsx` and
  `app/(tabs)/profile.tsx`. They are banners rather than purchase screens, and
  fetching offerings from each would be four extra round trips for a line of
  marketing copy. If that ever bothers somebody, the fix is a shared offerings
  store, not four more fetches.
- DATES NOW FOLLOW THE APP LANGUAGE EVERYWHERE, fixed 2026-09-18. Four call sites
  ignored it: a bare `toLocaleDateString()` in `subscriptions.tsx`,
  `refer-a-friend.tsx` and `notifications.tsx`, which uses the DEVICE locale, so
  a German user on an English phone read English dates inside German UI; and
  `notification-preferences.tsx` pinned `"en-GB"`, so German users ALWAYS got
  English. All four now use `useDateFormat` from `lib/date-locale.ts`, which
  already existed for exactly this and is the helper to reach for.
- THE COPY RULE WAS BEING BROKEN IN JSX, WHERE THE LOCALE CHECK CANNOT SEE IT.
  Both locale files were clean of dashes and always had been, and two em dashes
  were sitting in JSX text nodes instead: `{s.name} — {date}` in
  notification-preferences, and `Unlock Premium — from $2.99/mo` in PremiumGate.
  Checking `locales/*.json` alone will never find that class, so
  `__tests__/display-localization.test.js` checks JSX text nodes too.
  THAT PremiumGate STRING WAS WRONG THREE WAYS AT ONCE: an em dash, no `t()` at
  all so six surfaces across four screens showed English to German users, and the
  price written inline instead of taken from `lib/pricing.ts`. `profile.unlockPremium`
  already said exactly that sentence in both languages, with a comma. No new key
  was needed, which is usually the sign that a string was written in the wrong
  place rather than that it needed translating.
- Deliberately deferred, revisit later, not now: iOS (real inbound demand
  exists from the owner's own circle, but wait for Android traction/signal
  first). The primary-colour rebrand was deferred for a while and then
  done, see BRAND PALETTE below.
- Paid track (Google UAC via a €200/month budget) is sequenced deliberately:
  boost an already-proven organic clip first, only start an always-on UAC
  test after that, never split the budget across both from day one.
- LANDING PAGE (2026-09, replaced the editorial one): built from a
  design handoff by `tools/build-landing.py`, which is the only thing
  that should edit `backend/landing.html`. Re-run it, do not hand edit
  the output. It applies four things the handoff could not know: signup
  goes to `/api/auth/register` not `/api/auth/signup`, this backend
  returns `{ error }` where the handoff assumed `{ message }`, there is
  no web app behind `/account` so login lands on the success panel
  instead, and the handoff's logo was a 1.5MB PNG inlined five times
  (7.6MB) now served once as `/mark.svg` at 786 bytes.
- GOOGLE SIGN IN is app only, by the owner's decision (2026-09), not a
  gap waiting to be filled. `POST /api/auth/google` serves the mobile
  token exchange; there is no browser redirect flow and none is wanted.
  Do not add a Continue with Google button to the site.
- Because of that, an account created with Google in the app has no
  password, so signing in on the site returns "Invalid email or
  password". That wording must stay generic on the backend or it would
  reveal which addresses exist, so the site adds a hint under the error
  pointing the person to the app. Do not "fix" this in server.js.
- The 3D backdrop, the ledger demo and the editorial layout are gone with
  the old page. `backend/three.min.js` and `backend/trimio3d.js` were
  deleted with their routes, 601KB of WebGL the new page does not use.
  They are recoverable from git history if ever wanted.
- The design copy is a published artifact ("Trimio"), rebuilt by the
  scratchpad `mkartifact.py`. It inlines the mark as a data URI and makes
  the form a preview that points at the live site, since the artifact
  cannot reach the API. Keep it in sync when the page changes.
- BRAND PALETTE (2026-09, replaced the violet everywhere): Ink Navy
  `#142B3A`, Warm White `#F7F6F1`, Soft Mint `#55C6A3`, with Slate
  `#52616B`, Warm Amber `#E6A34A` and Muted Coral `#D96B62` supporting.
  Intended weighting is roughly 60% warm white, 25% navy, 10% mint, 5%
  the rest. The restraint is the point, mint marks things, it never
  carries them.
- The one rule that keeps that palette legible, measured not guessed:
  Soft Mint carries white text at only 2.1:1 and reads as text on warm
  white at 1.9:1, under even the 3:1 large-text floor. So mint is NEVER a
  fill behind white text and NEVER running text. It is for fills, rules,
  offset shadows, dots, trim tabs, and pills where navy sits on mint
  (7.0:1). Type that must read as mint uses the deepened `#1F7A62`
  (4.8:1 on warm white). Same idea for the other two: amber and coral
  need `#96631B` and `#C4544A` when they carry text on a light ground.
- In `lib/theme.ts`, `primary` is used both as a fill behind white text
  and as text on a surface, so it has to work in both directions. Light
  theme primary is Ink Navy. Dark theme primary is `#2F8E71`, the mint
  that balances both ways (4.0:1 under white, 3.9:1 on the card) the way
  the old violet did. The bright mint lives in the separate `accent`
  token. Do not set dark `primary` to `#55C6A3`: 36 call sites put white
  on a primary fill, and they would all drop to 2.1:1.
- Landing page layout: warm white throughout with two navy fields (the
  demo and the account section) and a navy final call to action. Hero,
  statement, how it works, features, privacy, founder quote, account,
  footer. The phone mockup in the hero is deliberately NOT a .reveal: it
  sits past the fold on a phone, so animating it in left 570px of blank
  space at first paint.
- NOTHING IS VIOLET ANY MORE. This entry used to say the app icon, adaptive
  icon, splash and `#7746DD` in `app.json` were still violet and waiting on a
  native build. That is stale: 1.0.3 / build 40 shipped the redrawn icon, and
  a grep of `app.json` on 2026-09-11 finds no `#7746DD` at all. Its colours
  are `primaryColor #142B3A`, backgrounds `#F7F6F1` and `#142B3A`, and the
  notification tint `#2F8E71`, all palette values. Do not go hunting for
  violet that is not there, and do not schedule a build to remove it.
- The 3D backdrop is `backend/trimio3d.js`, served at `/trimio3d.js`, with
  three.js self-hosted at `backend/three.min.js` (`/three.min.js`) because
  no CDN is in the page's dependency chain. Cards start "forgotten" (grey,
  unmarked) and turn "tracked" (vermilion trim tab, sage renewal date) once
  the reader passes `#how-it-works`. Card placement is a fraction of the
  frame's half width at each depth, so it stays off the type on any screen,
  and everything below the first viewport dims to 30%. Both files are
  progressive enhancement: no WebGL or no three.js and the page is
  unchanged. In the artifact copy three.js comes from cdnjs and the scene
  is inlined, since the artifact CSP blocks the Railway host.
- LIVE DOMAIN: `subtrimio.com`, registered at Squarespace (migrated from
  Google Domains). `www.subtrimio.com` is a CNAME to the Railway service
  (`2d14ukaj.up.railway.app`) and serves the landing page; the bare
  `subtrimio.com` 301-forwards to www via Squarespace forwarding. Use
  `https://www.subtrimio.com` as the canonical URL in ads and bios.
  DNS also carries Google Workspace email (MX to smtp.google.com) and
  Brevo sending auth (two `brevo*._domainkey` CNAMEs, DMARC, and a single
  SPF record `v=spf1 include:_spf.google.com include:spf.brevo.com ~all`).
  Never create a second `v=spf1` record, edit the existing one, two SPF
  records invalidate SPF entirely and would break transactional email.
- PRE BUILD CHECKS: run `python3 tools/typecheck.py`, `python3
  tools/check-legal-sync.py`, and the locale parity check before any
  native build. check-legal-sync.py fails if either legal document drifts
  between its app copy and its served copy, and enforces the no dash rule
  on both.
- NEVER trust a bare `npx tsc --noEmit`, and never report it as clean.
  This project pins TypeScript 5.3.3, but a cloud/sandbox session has no
  `node_modules` (installs are blocked), so npx falls through to the
  global compiler on PATH, currently TS 6.0.2. That version rejects this
  tsconfig outright (TS5107 on `moduleResolution=node10`, TS5101 on
  `baseUrl`) and exits before typechecking a single file, and piping it
  through `tail` hides the exit code too. It reads as a clean run and is
  not one. `tools/typecheck.py` is the guarded version: it insists on the
  pinned compiler in node_modules and treats a TS5xxx config error as a
  failed run, not an empty one. In a sandbox it exits 2 and says so, which
  is the correct answer there. Real typechecking only happens on the
  owner's machine.
- THAT GUARD WAS ITSELF BROKEN FOR ITS WHOLE LIFE, fixed 2026-09-12 in
  bec97dc5. It executed `node_modules/typescript/bin/tsc` directly, which is a
  Node script relying on a shebang. Unix honours that, Windows does not, so on
  the owner's machine it raised "[WinError 193] %1 is not a valid Win32
  application" before tsc ever started. It now invokes the compiler through
  `node`, which is portable. The script was written to stop a silent pass from
  shipping a crash, verified in a sandbox where it correctly refuses to run,
  and never once exercised on the only machine where it can work. Nobody found
  out until `preflight.py` ran it there. The lesson generalises: when a tool
  exists to catch a failure, check that the tool itself runs where it has to.
- THE PROJECT TYPECHECKS CLEAN, verified 2026-09-12 on the owner's machine
  against the pinned compiler: "Typecheck clean (typescript 5.3.3, pinned
  5.3.3)". That is the first genuine typecheck this codebase has ever had.
  Every earlier "clean" was either the global TS 6.0.2 dying on the config
  before reading a file, or the guard refusing to run. The buildTips class of
  error is therefore now known absent rather than merely unexamined.
- That silent pass shipped a crash on 2026-09-04. `buildTips` in
  `app/insights.tsx` gained a `t` parameter in third position, the second
  call site in `app/(tabs)/index.tsx` kept passing the threshold number
  into that slot, and every user hit `TypeError: 50 is not a function` on
  the dashboard. The cause underneath was scoping a grep to one file
  (`grep -n "buildTips(" app/insights.tsx`) when changing an exported
  signature. When any exported symbol changes shape, grep the WHOLE repo
  for it, tests included: `grep -rn "<name>" --include=*.ts --include=*.tsx .`
- The app's light theme uses the SAME values as the landing page for
  ground, card, rule, ink, slate and mint (`#F7F6F1`, `#FCFBF8`,
  `#DCDEDB`, `#142B3A`, `#52616B`, `#55C6A3`). Cards are warm paper, not
  pure white: pure white reads cold against the warm ground. Keep them in
  step if either side changes.
- LEGAL PAGES: `/privacy-policy` and `/terms`, both server rendered from
  section arrays in `backend/server.js` through one shared `legalPage()`
  helper, which takes a `lang` argument. The privacy policy is also mirrored
  in the app at `app/privacy-policy.tsx`; keep the two in sync. The terms were
  written 2026-09 and have NOT been reviewed by a lawyer, which the owner
  knows. Section 10 is the load bearing one for this product: reminders are
  best effort, and a missed reminder is not a liability.
- The GERMAN copies are `backend/legal-de.json`, served at `/de/datenschutz`
  and `/de/nutzungsbedingungen` (2026-09-12). They are JSON rather than more
  JS arrays because generating 15,000 characters of legal prose as escaped JS
  string literals is a quoting accident waiting to happen. The same
  lawyer-review caveat applies, doubled: a translation of unreviewed terms is
  unreviewed terms in two languages. It is still the more defensible position
  than English only, since GDPR Art. 12 wants plain language for the audience
  and German consumer law can treat foreign language terms as not validly
  incorporated.
- `tools/check-legal-sync.py` now also checks the German: equal section
  counts, matching section numbering so section 9 means the same thing in
  both, no empty bodies, and the no dash rule on all four documents. Prose
  cannot be diffed across languages but structure can, and the failure it
  catches is someone adding an English section and forgetting the German one,
  so the German document quietly says less about the same service.
- THE GERMAN LEGAL DOCUMENTS ARE NOW IN THE APP, not only on the website
  (2026-09-18). Both in-app screens were English only, 20 terms sections and 18
  privacy sections hardcoded, while `backend/legal-de.json` already held complete
  German versions served at `/de/nutzungsbedingungen` and `/de/datenschutz`. So
  the same person reading the terms on the site got German and in the app got
  English, which works against the reason the German was written at all: German
  consumer law can treat foreign language terms as not validly incorporated, and
  the in-app screen is where people actually meet them.
  NOTHING WAS TRANSLATED TO DO THIS. Both screens `import legalDe from
  "../backend/legal-de.json"`, the same file the server requires, so the app and
  the website render the same bytes. A copy was deliberately refused: a second
  version of a legal document is the one kind of drift not worth any convenience.
  THE HEADING, DATE LINE AND INTRO MOVED INTO THAT JSON TOO, as `meta`. They were
  inline literals in `server.js`, which is why the app could not render a
  complete German document without copying three strings. The served output is
  byte-identical, verified against the pre-change `server.js` rather than assumed.
  THE ENGLISH `const SECTIONS = [...]` IN BOTH SCREENS MUST KEEP ITS SHAPE.
  `check-legal-sync.py` parses that array BY NAME and compares it against
  `TERMS_SECTIONS` in `server.js`. Restructuring it silently breaks the parser,
  which is the thing that stops the two English copies drifting.
  THE CHECKER GREW FIVE MORE CHECKS and they were NEGATIVE TESTED, because a
  guard nobody has seen fail is a guard nobody has tested, which this file
  already records as a lesson about typecheck.py. Removing the app's German
  import, blanking a meta string, and restoring an inline German heading in
  server.js each produce a FAIL and exit 1. That matters here more than usual:
  deleting the import breaks no build and fails no test, it just quietly serves
  English terms to German users again.
  `tools/build-legal-de.py` DOES NOT EXIST and is not needed. The `_note` in
  legal-de.json used to name it as the generator; `server.js` requires the JSON
  directly, so the JSON is the source and there is nothing to regenerate. The
  note now says so.
- THE 17 USERS HONESTY BLOCK IS GONE. The owner had deliberately chosen
  that radical-honesty line, and the 2026-09 design handoff dropped it.
  Nothing on the page states a user count now. Restoring it is the
  owner's call: do not re-add it unasked, and do not assume it is there.
