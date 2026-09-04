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

## Network limits in cloud/sandbox sessions

Outbound access to `api.expo.dev` is blocked by this environment's network
policy (confirmed via repeated 403 "policy denial" entries in the agent
proxy status). This is independent of whether an Expo token is valid, so if
`eas` commands fail here with auth-looking errors, the fix is not a new
token, it's running the command on the owner's own machine instead.

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

The app is fully localized into German already (`locales/de.json`), the
Play Store *listing* itself may not be, that's a separate, free win, check
Play Console.

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
- MARK CORRECTED (2026-09): the rejected chevron is gone. The approved
  artwork is now the source: `tools/trace-mark.py` lifts both silhouettes
  out of the reference PNG, walks the outlines and writes
  `tools/mark.json`, which every generator draws from. Do NOT re-derive
  the outline from measurements, that is exactly what produced the
  inverted Pac-Man. The chevron keeps its 45 traced points; the triangle
  is reduced to its three corners because tracing a small shape out of
  soft artwork left the edges lumpy.
- master is at 1.0.3 / versionCode 39 and is now good to build. 1.0.2 /
  38 is live in the Play Store carrying the old RECEIPT icon, so the next
  native build is what puts the chevron on phones.
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
- THE ONE THING STILL VIOLET: the Play Store screenshots and feature
  graphic. They are a Play Console upload and do NOT need a new build or
  a new release, so they can be replaced at any time. Shoot them from the
  owner's own phone once the 1.0.2 build installs, so they show the real
  navy UI. Those same shots are also what the promo video re-cut needs,
  so do both in one sitting.
- MARK MISMATCH, currently live and expected: the Play Store app shows
  the receipt icon (1.0.2) while subtrimio.com shows the corrected
  chevron, because the site auto-deploys from master and the icon needs a
  native build. It resolves itself when 1.0.3 ships.
- In progress: Phase 2 (posting cadence). The owner has an existing promo
  video (`trimio_promo_clean_vertical.mp4`, 15s vertical) that needs a
  re-cut before reuse: it shows the pre-redesign Dashboard/Stats/Add
  Expense screens (now outdated), wrongly shows an Apple App Store badge
  (there is no iOS build), and has a caption/UI overlap issue. Fresh
  screenshots for it should come from the owner's own phone, not a
  generated mock, the real device is authentic and already has the
  current build via OTA.
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
- GOOGLE SIGN IN is deliberately absent from the site. `POST
  /api/auth/google` exists for the mobile token exchange, not a browser
  redirect flow. Enabling the web button needs a Google OAuth client id
  and secret plus a registered redirect URI, then a `GET
  /api/auth/google?intent=` route. Until then the button stays removed
  rather than dead.
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
- Landing page design, as of the 2026-09 rewrite: alternating full-bleed
  fields, warm white for hero, problem, how it works, privacy and the 17
  block, ink navy for the demo, the account section and the footer. The
  navy fields are what make the 25% real and are the only place pure Soft
  Mint can be type. Ink navy Fraunces display with Manrope for UI, hard
  offset shadows with no blur (mint on the ledger, privacy and account
  plates, coral on the bank charge slip, which is deliberately the one
  dark object on the bright half), rotated plates, numbered sections.
  Cards sitting on a navy field must set `color` explicitly or they
  inherit warm white and go invisible on their own paper. It went violet, then
  vermilion, then landed here. The page is deliberately a single light
  visual world, there is no dark theme and no theme override. Its CSS
  tokens are role named (`--ground`, `--card`, `--type`, `--signal`,
  `--signal-text`), so a future repaint means changing values, not names.
- STILL VIOLET, deliberately: the app icon, adaptive icon, splash and the
  `#7746DD` values in `app.json`. Those are baked into a native build, not
  shipped over the air, so they change together with a redrawn icon and a
  new Play Console upload. Until then the icon is the one violet thing
  left.
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
- The landing page shows a real, hardcoded user count ("17") in its honesty
  block, a deliberate radical-honesty move the owner chose. It does not
  update itself: when the user count meaningfully grows, update the number
  in BOTH copies (backend/landing.html and the artifact) or the honesty
  becomes a lie.
