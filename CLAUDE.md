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
- EVERYTHING GOES ON `master`. ALWAYS. This is a STANDING INSTRUCTION from the
  owner, given 2026-09-11 ("everything should be always on master") and
  restated in stronger terms on 2026-09-20 ("it needs to be everything on
  master always", "lock this in"). It is not a preference to weigh against
  tidiness, and it is not re-negotiated per session.
  THIS ENTRY USED TO END "Never push to master without asking first." THAT
  LINE IS REVOKED, by the owner, on 2026-09-20. It was causing the exact
  failure it was written to prevent: finished, verified work sitting on a
  `claude/` branch across sessions while a fresh session read master and
  believed that was the state of the project. Asking every time also trained
  the answer, which makes the question theatre.
  WHAT TO DO NOW, as a cloud session: work still lands on the
  `claude/<something>` branch you were handed, because a sandbox writing
  straight to master is how an unreviewed mistake reaches a production deploy.
  When the work is DONE AND GREEN, fast-forward master onto it and push,
  WITHOUT ASKING. Do not leave it on the branch. Do not wait to be prompted.
  `git merge --ff-only` is the verb: it keeps history linear and FAILS LOUDLY
  if the branch is not a strict descendant, which is exactly what you want,
  since a merge commit or a force push to master is never the answer here.
  THE THREE CONDITIONS, and they are not negotiable either, because they are
  what makes standing authorisation safe rather than reckless:
    1. The Checks workflow is GREEN on the exact head commit you are merging.
       Not on an earlier commit of the branch, not "it was green before the
       last push". Read the run for that SHA.
    2. `git merge --ff-only` succeeds. If it refuses, master has moved:
       rebase onto it, let CI go green again, then merge. Never `--force`,
       never `-X ours`, never a merge commit to "get around" it.
    3. You have said out loud, in your report, what the push will DEPLOY.
       Master is wired to the Railway deploy, so a backend change goes live
       the moment you push. That is the point of the rule and also its one
       real hazard.
  WHAT STILL NEEDS ASKING, and this is a short list: running `eas update`,
  anything that changes `runtimeVersion` or triggers a native build, deleting
  or force pushing anything, and any change whose failure mode is a broken
  production deploy that the owner has not already been told about. Pushing
  finished green work to master is NOT on that list any more.
  AND FIX WHAT MATTERS WITHOUT BEING ASKED. STANDING INSTRUCTION from the owner,
  2026-10-01, on being asked whether to fix a defect found mid-task: "Always fix
  what you think is important for trimio!" So a real defect found while doing
  something else is FIXED, in its own commit with its own CI run, not parked
  waiting for permission. Judge importance by the axis the review entry below
  sets: what sits on the path users and money travel, what can lose data, what
  can take the service down. Cosmetic tidy-ups are not that.
  IT DOES NOT WIDEN THE ASK-FIRST LIST ABOVE, it works inside it. `eas update`,
  runtimeVersion, native builds, deletes, force pushes and anything scheduled
  (see NEVER CREATE A SCHEDULED ANYTHING) still get asked first. And every fix
  made this way is REPORTED with what it deploys, so "fixed without asking"
  never means "fixed without telling".
  ONE STEP THAT IS EASY TO DROP, and it is what keeps the above working on the
  NEXT session rather than only this one: after the merge, push master back to
  the working branch as well, `git push origin master:claude/<branch>`. Without
  it the branch falls behind the moment anything else lands, and the session
  after you inherits a stale one. Not hypothetical: on 2026-09-20 a session was
  handed a branch 44 commits behind master with nothing of its own on it.
  INHERITING A STALE BRANCH IS CHEAP TO FIX AND EASY TO GET WRONG. `git checkout
  -B claude/<branch> origin/master` recreates it, and that is safe ONLY when the
  branch carries nothing unmerged. Measure before assuming, with `git rev-list
  --left-right --count origin/master...HEAD`, and if the right hand number is
  not zero those commits are yours alone: rebase them, never discard them. Note
  that this is an ancestry question, so the shallow clone entry below applies
  and the count LIES until you have unshallowed.
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

READING ONLY `Embedded launch: false` IS NOT ENOUGH, and on 2026-09-25 that
warning finally caught something rather than being theoretical. An OLD update
still applied satisfies that line perfectly. Compare the Update ID against the
previous one recorded in this file, every time.

TWO SEPARATE CHECKS, and this file used to have a command for only one of them.
`eas channel:view production` answers whether the bundle ever reached the
channel, on the owner's machine. The Build Info panel answers whether it reached
the phone. A publish can pass the first and fail the second, which is exactly
what happened on 2026-09-25. There is now a CHECK FOR UPDATES button in that
same panel which collapses the two launch wait to one tap. See the entry below.

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
- Native Android CI is Codemagic. It is not the EAS build service, and as of
  2026-09-21 it is the ONLY native build path: the GitHub Actions
  `build-android.yml` workflow that used to sit beside it is deleted, see below.
  `codemagic.yaml` runs `expo prebuild`, then `fix-gradle.sh`, then Gradle.
- THE OWNER'S ACTUAL RULE, stated 2026-09-20: OTA FIRST, CODEMAGIC ONLY WHEN
  OTA CANNOT DO IT. "I do codemagic as well but just if the build cannot be
  done with an Eas update." So a native build is an exception that
  `needs_native_build.py` has to justify, not a routine step, and that script
  is the thing that decides.
- `build-android.yml` IS DELETED, 2026-09-21, with the owner's explicit
  authorisation and on the condition that it could not take the app down. It
  could not, and that was verified rather than asserted: a GitHub Actions
  workflow runs on GitHub's servers when you push, so it is not in the APK, not
  in the JS bundle and not on any phone. `app.json` and `eas.json` referenced it
  ZERO times and nothing under app/, lib/ or components/ mentioned it at all.
  WHY IT WENT. It was never the path Trimio ships on (Codemagic is), and it
  failed on EVERY push: run 509 on `dc500210` died in 10 seconds at
  `Setup Android SDK` with `sdkmanager` exiting 1 under
  `android-actions/setup-android@v3`, and all eleven build steps after it
  SKIPPED, so nothing ever compiled. Because it triggered on `push` to master,
  every commit put a red X on the repo for a path nobody uses. That is the
  CI-was-decorative entry below happening a second time: a check that is always
  red trains everybody to stop reading red checks, and that habit is what let a
  two line eslint bug hide the entire test suite for months.
  IT WAS NOT A ONE LINE DELETE, which is the part worth remembering.
  `__tests__/ci-secrets.test.js` READ the file and asserted three things about
  it, so removing the workflow alone would have made that suite throw ENOENT and
  turned `Checks` red: the exact problem the deletion was meant to solve, moved
  one file over. Both halves went together, the file and the three references.
  WHAT THOSE ASSERTIONS GUARDED, and why dropping them cost nothing: that the
  workflow exited 1 on a missing `KEYSTORE_BASE64`, that it contained no
  `keytool -genkey` (the fallback that once printed a private signing key into a
  build log), and a Node version floor shared with the other CI files. All three
  guarded a file that no longer exists. `codemagic.yaml` keeps its own copies,
  measured at the time of deletion: 17 `CM_KEYSTORE` references and ZERO
  `keytool -genkey`. The real build path is unchanged.
  THE SUITE WENT 255 TO 254 PASSING, which is the one deleted test and nothing
  else: the 35 shim-limited failures were identical before and after with no
  per-file delta. `.github/workflows/checks.yml` is now the only GitHub
  workflow, and it is the one that matters.
- BUILD 41 IS PREPARED, 2026-10-31 in `d49bef03`, for the eMudhra CA
  compromise (a PostHog email, "You should update OkHttp for your Android
  build"). The private keys of eight eMudhra intermediate CAs were recoverable,
  so a network attacker holding one could impersonate the Railway host to a
  phone that still trusts them. React Native's networking runs on OkHttp.
  THE FIX IS OKHTTP 4.12.1, VERIFIED FROM OKHTTP'S OWN `changelog_4x.md`
  ("Version 4.12.1, 2026-10-22: Block 8 compromised eMudhra intermediate
  certificates"), not 5.x: same 4.x line React Native uses, same dependencies
  as 4.12.0 (okio 3.6.0, kotlin-stdlib 1.8.21, read off the pom), so the Kotlin
  2.0.21 pin is undisturbed. `fix-gradle.sh` Fix 10 forces okhttp,
  okhttp-urlconnection and logging-interceptor to 4.12.1; run twice on a
  scratch build.gradle it adds once and skips once.
  versionCode 41, version 1.0.4. RUNTIMEVERSION STAYS 1.0.1, which
  `needs_native_build.py` objects to and which is deliberate: the rule exists
  so JS cannot reach a build missing native code it calls, and nothing in the
  bundle calls OkHttp or any module build 40 lacks. Bumping it would cut every
  build 40 phone off OTA updates until it updates from Play. The owner was told
  and the call is theirs; if they want the bump, it is one line in app.json.
  Play Services phones were already covered by Google's own block, so this
  protects phones without Google Play, and is not urgent.
  CODEMAGIC BUILD 41 STARTED 2026-10-31 by the owner, from master at
  `b88bef07`, runtimeVersion left at 1.0.1 as recommended. IT FINISHED THE
  SAME DAY, so dependency resolution and `compileReleaseKotlin` both passed
  with the pin in place. 1.0.4 / VERSIONCODE 41 IS LIVE ON PLAY, 2026-11-01
  (owner's report, not a screenshot of Play Console). versionCode 41 is spent.
  STILL NOT READ: the Fix 10 line below in the Codemagic log.
  BUILD INFO ON A BUILD 41 PHONE WAS READ, 2026-11-04, off the owner's
  screenshot: `App version: 1.0.4`, `Native build: 41`, `Channel: production`,
  `Runtime version: 1.0.1`, `Embedded launch (no OTA applied): false`,
  `Update ID: 01a19b10-41eb-7241-ad6f-ac7d4d1f070a`, `Update published:
  2026-11-02T07:01:36.363Z`, `You are on the latest version.` So a 41 phone
  takes updates on runtime 1.0.1 exactly like a build 40 one. THIS ENTRY HAD
  PREDICTED `Embedded launch: true` and it was not tested by what happened: a
  newer OTA was published (the 2026-11-02 one) before the panel was read, so
  the phone ran that rather than its embedded copy. The prediction about the
  2026-10-31 bundle is still unread and no longer matters.
  Release notes drafted for 1.0.4 claim the OkHttp fix and the offline mode;
  offline OPENING is now seen working on a phone, see the offline entry.
  The proof the pin applied is the "Apply Gradle compatibility fixes"
  step printing `[10/10] ... OK — OkHttp pinned to 4.12.1`; a failure there or
  at dependency resolution names OkHttp, a failure at `compileReleaseKotlin`
  points at the Kotlin 2.0.21 pin instead. Once uploaded, versionCode 41 is
  spent whatever happens next.

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

## Which skill fires when

A skill is loaded per invocation, into the turn that needs it. There is no
setting that pins them on, and loading all of them at once is actively harmful:
they compete for the same context the actual work needs. So this table is the
durable version of "have them active", and it survives a context reset in a way
a loaded skill does not.

| Skill | Load it before |
|---|---|
| `trimio-design` | any colour, screen, store copy, locale string, caption or landing page text |
| `trimio-release` | an `eas update`, a runtimeVersion or versionCode decision, a Play Console upload |
| `trimio-verify` | claiming ANY suite passes, and before saying a guard would have caught something |
| `code-review` | a second pass on a diff that is about to merge |
| `security-review` | an audit of a branch, as its own pass |
| `dataviz` | the Stats split bar or any chart |
| `trimio-social` | any Instagram or YouTube post, reel script, caption, comment, reply or DM, any vidIQ publish call, and any generated image or video meant for a post |
| `trimio-founder` | a business question rather than code: pricing, positioning, competitors, unit economics, the trial or offer, a marketing, launch or business plan |
| `trimio-lean` | writing, fixing, refactoring or reviewing code, and a long tool heavy task: the smallest complete change and the token habits |

THE REST DO NOT APPLY HERE. xlsx, pptx, docx, pdf, morning, keybindings and the
artifact skills have nothing to do with this repo, and reaching for one is a
sign of having misread the task.

WHAT `trimio-design` DOES NOT COVER, learned 2026-09-22 the expensive way: it
had no ASO check at all, so it returned CLEAN on a short description carrying
zero category terms. Loading a skill proves you ran ITS checks, never that its
checks are the right ones. When a skill passes something that later turns out
broken, the gap is the finding: close it in the skill rather than remembering
to look harder next time. That is where `--keywords` came from.

## NEVER CREATE A SCHEDULED ANYTHING WITHOUT ASKING FIRST

STANDING INSTRUCTION from the owner, given 2026-09-28, in response to a Routine
they had not agreed to waking their phone at 07:00 on a Monday: "never create
scheduled things without asking please".

IT COVERS EVERY FORM OF IT, so nobody reads the word "Routine" narrowly and
creates the same surprise wearing another name: a Routine or scheduled trigger
(`create_trigger`), a self check-in or deferred message (`send_later`,
`ScheduleWakeup`), a `/loop`, a cron entry, a background task set to re-invoke,
or a repository workflow on a schedule. If it can run when the owner is not
looking, ask BEFORE creating it, every time. Their yes is per thing, not a
standing licence, and "it would be useful" is not consent.

TELL THEM WHAT IT WILL DO TO THEIR PHONE. A Routine defaults to push
notifications ON, and that is what made this one land as an ambush rather than a
convenience. If you are ever authorised to create one, say in the same breath
what it will do, when it fires, and whether it will notify them.

THE ONE THAT WAS SWITCHED OFF, kept on record so it is not rebuilt by accident:
`trig_01GqW4M3kJfG4wmeF36zx7m5`, "Trimio: store listing conversion check",
Mondays 07:00 UTC, fresh session per fire, created 2026-09-22 by a Claude
session via `meta_mcp` and DISABLED 2026-09-28 at the owner's instruction.
It is `enabled: false` rather than deleted, which the owner chose so it stays
recoverable. It will not fire again unless somebody turns it back on.
THIS PARAGRAPH FIRST SAID DELETED WHILE IT WAS STILL LIVE AND FIRING, which is
the mistake this file exists to prevent. It was written in the same edit that
ATTEMPTED the delete, before knowing the attempt failed: a server-side check was
erroring on every write tool for about an hour, so the delete, the disable, git
and the commit were all refused, and the record was drafted from the intention
rather than the result. Never write down an outcome in the same breath as the
action that is meant to produce it. Do the thing, read what came back, then
write what came back.

THE REASONING BEHIND IT WAS SOUND AND THE THING STILL DID NOT WORK, which is
the part worth keeping. A `/loop` lives inside one session and the positioning
test runs 28 days, so a loop would have died with the session that created it.
A Routine outlives it. All true, and it earned switching off on its own merits
before consent was even discussed:
  - IT FIRED WITH NO REPOSITORY ATTACHED. A fresh session per fire gets an
    empty working directory, so it could not read
    `store-listing-positioning-test.md`, which is step one of its own prompt.
    That was structural from the moment it was created, and its FIRST fire,
    2026-09-28, is when anyone found out.
  - THE RUN WAS LOGGED `SUCCEEDED` ANYWAY, because the turn completed. A green
    run status here means the session finished, never that it did anything.
    Same green-while-broken shape this file keeps recording.
  - IT STORED NO MCP CONNECTORS, so a fired session had no GitHub tools, could
    not read a CI run, and could not honestly complete its own merge step.
  - IT COULD NOT READ PLAY CONSOLE, which is egress-blocked like everything
    else (see "Network limits"), so its entire remaining job was asking the
    owner for two numbers once a week. That is a phone reminder wearing a
    container.
`update_trigger` TAKES NO SOURCE PARAMETER, so the repository binding cannot be
repaired in place: fixing it means delete and recreate, which is guessing at
whether the recreation binds any better. That is why the answer was to switch
it off rather than repair it.

WHAT REPLACES IT: nothing automated. The positioning test's decision date is
around 2026-10-20 and the owner is holding the ads budget until then anyway, so
a single reminder near the date beats a weekly nag that cannot do its own step
one. Ask before setting even that.

## An external review, 2026-09-29, and the six findings taken from it

Codex reviewed master at `9931511b` and produced twelve findings. SEVEN were
checked against the real code before anything was changed and ALL SEVEN were
real: zero false positives, which is a better hit rate than any review pass
recorded in this file. Fixed in `99dcd71c` and `631e7fa5`.

THE REVIEW'S PRIORITY ORDER WAS WRONG FOR THIS PRODUCT, and that is the part
worth keeping rather than the list. It put payment reliability first. With zero
paying customers those findings affect nobody today, while the paused-rows and
preferences bugs were live for every actual user. THE RIGHT AXIS IS NOT USER
COUNT, it is whether a bug sits on the path you are about to spend money driving
people down. At zero users an acquisition-path bug is MORE urgent, not less,
because at a thousand you would already know about it.

WHAT WAS FIXED, and each was measured rather than argued:
  - THE ALERTS SCREEN MAPPED TYPES THE SERVER HAS NEVER SENT. It switched on
    `"expensive"` and `"renewal"` while `alerts.list` emits `renewal_alert`,
    `trial_alert` and `expensive_alert`, so EVERY alert fell through to the
    generic `information` icon and colour was the only thing telling them
    apart. The severity badge beside it was a bare English JSX node, the FOURTH
    time that class has appeared here.
  - THE DASHBOARD SCHEDULED REMINDERS FROM INVENTED PREFERENCES, passing
    `notifPrefs ?? {}`. `lib/language-store.ts` ALREADY carried this exact fix
    and a long comment saying `?? {}` is the insufficient version; it was never
    applied to the other caller. A cold start where the preferences query lost
    the race re-enabled reminders somebody had turned off.
  - PAUSED ROWS GENERATED PLANNED ACTIVITY ON THE PHONE. The server filters
    `is_active = TRUE` in four places and `subscriptions.list` deliberately does
    not, because the management screen needs paused rows. So every client
    consumer has to filter and NONE did: the scheduler, the calendar, the weekly
    chart, the dashboard and buildTips all read the raw list. A paused row was
    paused on the server and live on the device.
    `livePlanned` in `lib/recurrence.ts` is the rule, beside `isPhantomOccurrence`
    for the same reason. `buildTips` filters INSIDE itself so a third caller
    cannot forget, and its signature is untouched: adding a parameter there is
    what shipped `TypeError: 50 is not a function`.
  - A BILLING DATE THE CALENDAR DOES NOT HAVE WAS ACCEPTED. `isNaN` is not a
    validity check, because JavaScript ROLLS OVER: `new Date("2026-02-31")` is a
    valid Date holding 3 MARCH. The ISO branch of `normaliseDateInput` accepted
    31 February, 31 April and 29 February in a non-leap year, while the SLASH
    branch directly beneath it compared the month back and correctly refused
    them. One helper right, its neighbour wrong, the same shape as `fmtIcsDate`
    beside `nextDay`. Both client and server now compare all three components,
    and `parseCalendarDateStrict` in server.js does it via `Date.UTC` so the
    answer does not depend on the server's timezone. Measured across four.
  - TOTALS ADDED RAW NUMBERS ACROSS CURRENCIES. `analytics.summary` summed a
    10 EUR row and a 10 USD row into 20, and the dashboard then passed that to
    `fmtC`, which by convention treats an unlabelled aggregate as ALREADY base
    currency and converts it a second time. The server now also reports
    `monthlyByCurrency` and introduces NO exchange rate (rates belong to the
    client, which already fetches and validates them); `sumMixedInBase`
    converts each part once, into BASE, which is what `fmtC` and `budgetGoal`
    already assume, so one value drops into the old total's place and every
    consumer becomes correct untouched. Existing fields are unchanged for
    installed builds.
    ONLY THE DASHBOARD SLICE WAS DONE. Exports, threshold comparisons, weekly
    buckets and market price selection are deferred and still add raw.

THE EMPTY STATE WAS SEEDING THAT MIXED TOTAL, and this one the review missed.
`handleLoadExamples` inserted three hardcoded USD rows, so for any non-USD user
the FIRST SCREEN AFTER ONBOARDING mixed two currencies and every total on it was
a sum of two. Its comment claimed "these three prices are the US figures".
THAT WAS FALSE: 15.99 is the DACH Netflix price, the US price is 19.99, and the
catalogue puts Spotify Premium at 12.99 rather than 9.99, so two of the three
were stale as well as mislabelled. They come from the catalogue now through
`findTemplateByExactName(name, baseCurrencyCode)`, so a German user gets three
EUR rows at verified DACH prices and a US user three USD rows.
A TEST EXISTED ASSERTING THE MISLABELLING WAS CORRECT BY DESIGN, named "tags the
sample subscriptions USD, since those are the US figures". It was REPLACED
rather than patched, the same way the CANCELLATION test was, because a test
whose NAME asserts a false premise tells the next reader the question is closed.

I FIXED AN ASSERTION CLASS IN THE SUITE I COULD RUN AND NOT IN THE ONE I COULD
NOT, and CI caught it. `calendar-next-up` and `calendar-phantom` both pinned a
LITERAL dependency array for `app/(tabs)/calendar.tsx`. Filtering paused rows
renamed that dependency, I fixed the first because it runs in a sandbox, and
`calendar-phantom` imports a `.ts` module so it does not run here and failed in
CI: one assertion of 683. That is this file's own parseApiDate lesson, committed
by me, in the same session as writing about it.
THE HABIT THAT WOULD HAVE CAUGHT IT: after changing a shared file, grep the
WHOLE `__tests__` directory for what was changed, not just the suites that run.
`grep -rn "\[subscriptions" __tests__/` found all three in one command.
BOTH NOW NAME THE IDENTIFIER the memo really iterates rather than one spelling,
so they still catch a genuinely missing dependency and stop objecting to a
rename.

`isMixedCurrency` EXISTS BECAUSE `fmtC`'s TILDE RULE IS NOT ENOUGH here. It
marks an estimate when the BASE differs from the display currency, which misses
the case this change created: a US reader with one euro row has base and display
both USD, so an exact-looking figure was printed for a number that had moved
through a rate. The dashboard total, and the over-budget and remaining amounts
derived from it, are marked whenever any PART was priced in something else.

WHAT WAS DEFERRED AND WHY, so nobody re-litigates it from the review document:
the payment findings (the client discards the server's premium verdict, and a
restore error is reported as "no purchase found") are real and cheap and should
be done BEFORE the first customer rather than after, since the failure mode is
somebody paying and not getting it. The session-race finding the review itself
marks as NOT REPRODUCED is the most expensive to do properly and the least
evidenced. The savings-suggestion finding is product judgement rather than a
bug. E02, scheduling later billing cycles, expands scheduled behaviour and is
covered by the standing rule above: ask first.

## History lives in docs/history.md

Everything dated (every publish, audit, incident, measurement and decision
record, 224 entries) is in `docs/history.md`, moved there word for word on
2026-11-23. Grep it, never read it whole. A "see the X entry" anywhere in this
file means grep that file for X.

THE RULE THAT KEEPS THIS FILE SMALL: a new dated entry goes at the end of
`docs/history.md`, a few lines. This file changes only when "Current state"
changes, or when a new rule must keep holding, as ONE line in "Do not undo"
ending in a `[grep: ...]` phrase copied from the entry. `__tests__/claude-md-size.test.js`
fails if this file passes 60 KB or a grep phrase matches nothing in the
history. It had reached 505 KB, about 126,000 tokens read into every session.

## Current state

Keep this short and current. As of 2026-11-28.

- PHONES run the update published `2026-11-28T11:21:22.142Z`, `Update ID:
  01a221e3-6bde-74ab-a3fa-b80c3b62817c`, read off the owner's build 42 phone
  screenshot 2026-11-28 (1.0.5, runtime 1.0.1). Master held `a4352b5c` from
  11:00:30Z and nothing later, so that is its baseline: the navy stage on
  every screen, what's new as a list, every fix of the 2026-11-28 audit and
  the privacy policy additions with their what's new line. Nothing is owed.
  The owner reported setting `MIN_ANDROID_VERSION_CODE=42` in Railway (not
  read from here), so builds 40 and 41 are asked to update. The next
  confirmation must show a different id and a later time.
- BUILD 42 IS LIVE ON PLAY (owner's report 2026-11-26; versionCode 42 SPENT,
  next is 43): 1.0.5, runtimeVersion KEPT at
  1.0.1, the launch screen on the light ground, the launch motion, Play Age
  Signals 0.0.6 in `modules/trimio-age-signals` with no prompt anywhere yet (see
  BUILD 42 IS LIVE ON PLAY in the history). Build Info read off a phone
  2026-11-26, the age module answering. Release notes: `store-assets/release-notes/`. The age policy (when
  Play's prompt shows, what an under 16 sees) is the owner's call, over the air
  before 2027-01-01. The build after it, ask first: Expo SDK upgrade (React
  Native 0.79 is past support) with the runtimeVersion bump, Credential
  Manager, EAS update code signing. Play has 1.0.5 / versionCode 42.
- PRICES: Premium 3.99 a month, 24.99 a year, lifetime in Play Console. Every
  new account gets 14 days of Premium free. Free tier 5 active rows.
- STORY REELS: Parts 1 to 6 are public on YouTube and on Instagram (Part 5
  on Instagram 2026-11-23, `DgFdY-NAWhh`; Part 6 on Instagram 2026-11-24,
  `DgIdGcRGTUt`, AI label on). Part 7, Part 8 (her ex's Netflix) and "The
  announcement" (standalone), all 2026-11-23, and "The friend" (first of the
  one new friend at a time ensemble) are on YouTube: Part 8 `KVCpOx62eBE`
  PUBLIC since 2026-11-24 19:25Z and on Instagram (`DgIvCkKmX11`, before Part 7
  at the owner's word); the friend `abof1xwBNXA` public 2026-11-25 10:00Z and
  on Instagram (`DgLPHB9hVoT`); the announcement `lgSW8rKscgk` public 14:00Z,
  not yet on Instagram; Part 7 `sM0eh-rPY9k` private. Review page:
  https://claude.ai/artifact/R5vegjSzPLfYxZRsy4u6QW. The German Amazon Prime reel is on
  YouTube PRIVATE (`0o1UXbSXcg4`) and on Instagram since 2026-11-23 13:33Z
  (`DgFfz_fAGKo`, AI label on). Each step needs the owner's yes naming the platform
  (`trimio-social`). THE JANUARY SERIES (three reels) is scripted in
  `tools/reels/README.md`; generation waits for Higgsfield credits (~14 Dec).
- INSTAGRAM CLEANUP is the owner's call, advised 2026-11-18: seven posts with
  invented UI and two avatar testimonials (`Deb0LEtgvBV`, `DetTd7Nj70M`) were
  still live. Do not nag.
- SCHEDULED TASKS: none live. `trig_01Mmpqc5cXXyUmtsxZm6tkmp` (the German
  Instagram post) fired once and ended, `run_once_fired`. The Part 2 and Part 3 posts
  (`trig_01GQy8Cut5TJYTWJ4LMZYscZ`, `trig_01BjGYp1RZ22eLJYRzwfHDSW`) are
  disabled, the 22 Nov reminder fired and ended.
- PRIVACY POLICY additions made 2026-11-28 in `76d4ed93` at the owner's yes
  (name, language, Google id, referrals, IPs; the win-back email with its
  basis and the right to object; Expo; Frankfurter; dated 28 November), the
  website copy live with the Railway deploy, the app copy on phones since the
  11:21Z publish. Sentry "United States" and export "regardless of tier" were left on
  purpose [grep: TWO OF THE FIVE WERE NOT ISSUES]. Done: RevenueCat erasure 2026-11-23, one refresh
  token per session 2026-11-24 (rolling the backend back signs people out once).
- OWNER'S DASHBOARD ITEMS, open: which Dockerfile Railway builds and its
  `/health` healthcheck; a backup restore test; PostHog "Discard client IP
  data"; 2FA on Codemagic, Claude, ChatGPT, RevenueCat and cron-job.org
  (Expo's is ON, owner's report 2026-11-28); disconnecting the personal YouTube channel from vidIQ; the
  keystore move to `$HOME\trimio-keys` (unconfirmed).
- READ DATES: Search Console guide impressions, at least 100 a week by the end
  of November; store listing conversion around 2026-12-08; by 2026-12-13 one
  reel at 500+ views or one share or save, and 5+ link taps in 30 days; one
  Play install tagged `youtube` / `channel` by 2026-12-15; reverse trial, at
  least 1 in 15 started trials paid, read 30 days after signups
  (`/api/admin/funnel`).
- DATES THAT TURN THINGS RED: from 2027-03-05 the checked catalogue prices
  start going quiet; on 2027-04-12 the five published guides fail
  `cancel-guide-pages.test.js` ON PURPOSE (re-check or unpublish, never freeze
  the clock).

## Do not undo

Rules from the history that still hold, each a past mistake or a decision.
One line each; the grep phrase finds the full reasoning in `docs/history.md`.

### Release and over the air

- A publish is confirmed by a screenshot of the Build Info panel, never a
  paraphrase of it: new Update ID, later time. [grep: A REPORTED VALUE IS NOT A READ VALUE]
- The channel and the phone are two checks: `eas channel:view production`,
  then the panel. [grep: A PUBLISH CAN BE LIVE ON THE SERVER AND NOT ON THE PHONE]
- `eas update` uploads the working tree: the owner pulls and compares
  `git rev-parse` first; the publish time pins the baseline. [grep: PULLING FIRST IS PART OF THE PROCEDURE]
- Master ahead of the baseline is usually docs: check what the gap holds before
  asking for a publish. [grep: check WHAT the gap contains]
- `needs_native_build.py <last published commit>` before a publish, bare before
  a build. [grep: PASS IT THE RIGHT BASELINE]
- After an OTA, a build 40 phone still says Native build 40 and 1.0.3; that is
  correct. [grep: THE BUILD INFO PANEL READ THE WRONG BUILD NUMBER]
- No `Updates.reloadAsync` anywhere until expo-asset 12: it crashed a phone
  with SIGBUS. [grep: A SIGBUS IN FREETYPE]
- The Build Info field labels stay English. [grep: THE BUILD INFO FIELD LABELS STAY ENGLISH ON PURPOSE]
- `fallbackToCacheTimeout` stays 0. [grep: WAS CONSIDERED AND REJECTED. It would make an]
- Raise `FREE_SUBSCRIPTION_LIMIT` only after a publish lands; lower it any time.
  It stays 5 until the owner says. [grep: IT STAYS AT 5 FOR NOW]
- Reminders are scheduled from useQuery `onSuccess`, which react-query v5
  removes: move it before upgrading. [grep: was REMOVED from useQuery in v5]
- Fix 9 in `fix-gradle.sh` (native Sentry) stays. [grep: only ever visible because of Fix 9]
- The ask-first list is also a hook; change both together. [grep: THE ASK-FIRST LIST IS A HOOK NOW]
- Every publish people can see adds a What's new entry at the top of
  `ANNOUNCEMENTS`. [grep: EVERY UPDATE IS ANNOUNCED, the owner]

### The money path

- `PRODUCT_IDS` keep Play's base plan suffix and the tier match stays
  `.includes()`. [grep: DO NOT "TIDY" EITHER OF THOSE TO THE BARE ID]
- `fetchPremiumEntitlementFromRevenueCat` throws on a non-ok answer, so an
  outage never cancels a customer. [grep: THROWS on a non-ok response]
- verify-premium never trusts the posted `isPremium`; it answers 503 without
  the key. [grep: THE FAIL-OPEN ON ENTITLEMENT IS CLOSED]
- TRANSFER, CANCELLATION and a late EXPIRATION are settled by asking
  RevenueCat, never by array order or `cancel_reason`. [grep: THE FIX DOES NOT BRANCH ON]
- SUBSCRIPTION_PAUSED falls through on purpose. [grep: IS SETTLED AND THE FALL-THROUGH IS CORRECT]
- A failed restore lookup never posts false to the server. [grep: THE ERROR PATH IS THE ONLY ONE THAT DOES NOT SYNC]
- Only the purchase screen names a price, and only Play's own string
  (loading, real, unavailable). [grep: THE PURCHASE SCREEN SHOWED HARDCODED USD]
- The price and the reverse trial are decided; reopen them only with funnel
  numbers, never a reel or a simulated panel. [grep: THE OWNER RAISED IT, 2026-11-07]
- The number 14 lives in five places; change them together. [grep: THE NUMBER 14 NOW LIVES IN FIVE PLACES]
- A refund in RevenueCat must revoke access, or nothing reaches the handler. [grep: a process rule for whoever issues refunds]

### Backend and data

- `settings.update` and `notifications.updatePreferences` are partial: send
  only the fields being edited, never resend a neighbour. [grep: IS A PARTIAL UPDATE, and every caller must send ONLY]
- Which day: `parseApiDate` and `daysUntil`, never `new Date()` on an API date.
  The remaining 86400000 uses are durations. [grep: DO NOT GO HUNTING FOR]
- An update resubmitting the stored date keeps `billing_anchor_day`. [grep: THE FIX COMPARES THE CALENDAR DAY]
- `isPhantomOccurrence` and the anchor clamp stay as they are. [grep: TO CHASE THAT CASE]
- A row shows its own currency; totals convert in the app; the server holds no
  rates. A missing rate is not 1. [grep: A ROW SHOWS ITS OWN CURRENCY AND IS NEVER CONVERTED]
- A schema is built by running the real initDB, and a CREATE comes before
  anything touching its table. [grep: COULD NOT BUILD AN EMPTY DATABASE]
- Count and insert run in one transaction under the per user lock, every
  statement through the checked out client. [grep: withSubscriptionLimitLock]
- A create refusal other than the free limit is 409, never 403. [grep: THE ACCOUNT CEILING WEDGED THE OFFLINE QUEUE]
- `'Email already registered'` and machine codes stay English. [grep: STAYS ENGLISH ON PURPOSE]
- The login error stays generic; Google sign in stays app only. [grep: Do not "fix" this in server.js]
- `JWT_SECRET` is required with no fallback. [grep: IT IS NOW REQUIRED UNCONDITIONALLY]
- `tokenLimiter` is loose on purpose (CGNAT); login does not validate the
  password rules. [grep: THE ONE THAT COULD HAVE BROKEN THE APP]
- `secretMatches` refuses when the secret is unset. [grep: single most dangerous line in the change]
- Guess limits claim a number in the database before comparing. [grep: GUESS LIMITS DID NOT HOLD FOR A BURST]
- The unsubscribe GET only shows a button. [grep: OPENING THE UNSUBSCRIBE LINK UNSUBSCRIBED YOU]
- Rate limits key IPv6 on the /64. [grep: EVERY RATE LIMIT COUNTED EACH IPv6 ADDRESS ALONE]
- Sentry gets no body, query, user, IP or breadcrumbs; never pass an email or
  user id. [grep: decides what leaves]
- `DATABASE_CA_CERT` stays unset, and the private database address is not
  retried without checking the projects first. [grep: DO NOT TRY THE PRIVATE ADDRESS AGAIN]
- Never rotate `CRON_SECRET` to get past a 401. [grep: Do NOT rotate CRON_SECRET]
- Audit npm with the lockfile; a root Dependabot PR is never merged from the
  button; overrides stay inside the major. [grep: NEVER MERGED FROM GITHUB'S BUTTON]

### The app's code

- An exported signature change: grep the whole repo, tests included.
  `buildTips` takes no new parameter. [grep: WITHOUT REPEATING ITS OWN CRASH]
- Screens gate on `isLoadingError`, not `isError`. [grep: SCREENS GATE ON]
- Every list fetch goes through `lib/subscription-list.ts`. [grep: EVERY LIST FETCH GOES THROUGH]
- AsyncStorage loads lazily inside a try. [grep: is LOADED LAZILY inside a try]
- Hermes: no Unicode property escapes, no `TextEncoder`. [grep: a Unicode property escape Hermes cannot parse]
- Brand marks come from the generator, never hand edited or drawn; the app
  mark is never redrawn. [grep: DO NOT HAND EDIT THE DATA FILE]
- A template price is prefilled only in the currency it is saved in. [grep: A TEMPLATE PRICE IS ONLY PREFILLED]
- A price gets a `verified` date only from two sources checked that day. [grep: PRICE VERIFICATION IS POSSIBLE FROM A SANDBOX]
- A number in marketing copy is counted by listing, never by grepping a field:
  36 guides, "over 30". [grep: THE GUIDE COUNT WAS 41 IN THIS FILE AND IT IS 36]
- "Your data never leaves your phone" is false. [grep: IS FALSE AND MUST NEVER BE WRITTEN]
- The parser takes no bare Monat or Jahr. [grep: ARE DELIBERATELY NOT IN THE FIX]
- A fixture you wrote is reported as your test input, never as the user's data. [grep: a fixture you wrote is not evidence about the user's data]
- A shared `textTransform` breaks on a sentence. [grep: a text transform is a layout decision applied to language]
- A test whose answer depends on today freezes the clock at file scope. [grep: A TEST WRITTEN AGAINST "TODAY" EXPIRES]
- Locale parity compares the `{{...}}` tokens, not only the keys. [grep: LOCALE PARITY NEEDS TWO CHECKS, NOT ONE]
- The category palette's declaration order is load bearing. [grep: THE DECLARATION ORDER IS PART OF]
- Nothing puts text on or in `primary`; a RefreshControl sets
  `progressBackgroundColor`. [grep: No screen now puts text on or]
- Montserrat through `type`; a bare fontWeight is Roboto. [grep: a fontWeight with no family]
- The launch ground follows the build: grey from build 42, cream on 40 and 41,
  chosen by `nativeBuild()`. [grep: THE GROUND FOLLOWS THE BUILD]
- While runtimeVersion is shared with older builds, a native module is loaded
  with `requireOptionalNativeModule`. [grep: A MODULE OLDER BUILDS LACK IS LOADED OPTIONALLY]
- `.gitignore`'s android/ and ios/ stay anchored to the root, or a local module's
  native code is silently left out. [grep: THE IGNORES ARE ANCHORED TO THE ROOT]
- A completeness claim ("every screen", "nothing else") is checked by a scan. [grep: a completeness claim is the single most dangerous kind of entry]
- From an owner's mock, keep every part no measured rule forbids; taste is
  theirs. [grep: TASTE IS THE OWNER'S]

### Accounts, dashboards and the repository

- Never delete the "Trimio Web" OAuth client; never press "Actualizar clave". [grep: NEVER DELETE "Trimio Web"]
- The upload key is Expo's keystore, so Expo's 2FA matters most. [grep: THE UPLOAD KEY IS EXPO'S KEYSTORE]
- Play Integrity off and billing unlinked, on purpose. [grep: PLAY INTEGRITY API IS OFF ON PURPOSE]
- Never a second `v=spf1` record. [grep: Never create a second]
- Brevo only delivers mail: no templates there, no third party access. [grep: DO NOT HAND BREVO ACCESS TO A THIRD PARTY]
- Count accounts in the database, installs in Play Console and PostHog; never
  trust Brevo's zero or an ad platform's own figure. [grep: A NUMBER AN AD PLATFORM REPORTS ABOUT ITSELF IS NOT AN INSTALL]
- A missing PostHog event is probably unflushed. [grep: A MISSING POSTHOG EVENT IS PROBABLY JUST UNFLUSHED]
- Rotating the database password: psql first, then the variables. [grep: THE RAILWAY PASSWORD STEP HAS ONE TRAP]
- The repository is public on purpose; do not raise it. [grep: THE REPOSITORY IS PUBLIC ON PURPOSE]
- The name stays Trimio; the trademark waits for the first customer. [grep: THE NAME STAYS TRIMIO]
- Never Google Fonts on the site. [grep: NEVER GOOGLE FONTS]
- `tools/build-landing.py` is the only editor of the landing pages. [grep: is the only thing]
- The English legal `SECTIONS` arrays keep their shape; German comes from
  `backend/legal-de.json`. [grep: MUST KEEP ITS SHAPE]

### Posts and marketing

- Content is about the customer's problem, mostly; the app is the last beat,
  never the subject. [grep: THE CUSTOMER'S PROBLEM IS THE SUBJECT]
- Every post goes to YouTube first; Instagram only once that video is public.
  [grep: A PRIVATE UPLOAD DOES NOT COUNT AS FIRST]
- No TikTok: do not recommend or plan for it unless the owner raises it.
  [grep: NO TIKTOK, the owner]
- Generated video never shows the app, a screen or a wordmark; real
  screenshots in, the model never invents the screen. [grep: GENERATED VIDEO MUST NEVER TOUCH THE UI]
- No avatar posing as a customer. [grep: UCPD]
- Never post to the owner's personal YouTube channel. [grep: NEVER POST TRIMIO THERE]
- The vidIQ sign in link dies in minutes: make it when the owner is ready,
  send it as a code block. [grep: EXPIRES WITHIN MINUTES]
- Videos go to the owner on a page, never as a bare MP4. [grep: THE OWNER CANNOT PLAY AN MP4 SENT AS A FILE]
- The English and German taglines differ on purpose. [grep: THEY DO NOT BACK TRANSLATE INTO]
- Store titles stay; one variable at a time. [grep: BOTH TITLES ARE DELIBERATELY UNCHANGED]
- Linktree stays in the bio. [grep: LINKTREE STAYS]
- The "17 users" line is not re-added unasked. [grep: THE 17 USERS HONESTY BLOCK IS GONE]
- iOS waits for Android traction. [grep: Deliberately deferred, revisit later]

### Verifying from a sandbox

- A sandbox can install, typecheck, run jest, render the app in Chromium and
  boot the real backend on PostgreSQL. [grep: A SANDBOX CAN NOW INSTALL, TYPECHECK, RUN JEST AND SEE THE APP]
- The clone is shallow: unshallow before trusting any ancestry answer. [grep: THE SANDBOX CLONE IS SHALLOW]
- The web preview's traps (Switch, Alert, RefreshControl, prices). [grep: WEB PREVIEW TRAP]
