# Trimio — Project Status

**Last updated:** June 19, 2026
**Maintained for:** continuity across Claude Code sessions. Read this file first in any new session before doing anything else.

---

## TL;DR

All 19 fixes from the "Trimio — Complete Fix Guide" (3 priority groups) are
**complete, committed, and pushed to `master`**. Backend auto-deploys on
push. The Netlify legal page is live and confirmed matching. The only
remaining step is for the user to **trigger the Codemagic build** — see
"Next step" below.

---

## Standing instructions (do not re-ask about these)

- **Always push directly to `master`.** The user explicitly overrode the
  original feature-branch workflow: *"everything always to master should be
  pushed and you know this!"* There is a leftover branch
  `claude/setup-git-proxy-credentials-a7Hp7` from before that instruction —
  it's stale, ignore it.
- **Package manager is pnpm**, not npm (`packageManager: "pnpm@9.15.0"` in
  `package.json`). Don't suggest `npm install` or npm-specific flags like
  `legacy-peer-deps`.
- **Backend auto-deploys** on push to master (confirmed by user, Railway-hosted
  per `app.json` apiUrl: `subscription-trimmer-mobile-production.up.railway.app`).
- **Mobile app does NOT auto-deploy** — building/shipping the app requires
  manually triggering Codemagic (see `codemagic.yaml`) or EAS.
- **Netlify legal site does NOT auto-deploy from this repo.** There is no
  Netlify config/webhook in this repo. Live site:
  `https://trimio-privacyp.netlify.app/`. Updates to `legal/*.html` require
  manually dragging files (or a zip of them) onto Netlify's manual-deploy
  drop zone. Confirmed working as of this session.
- Terms of Service is served **two ways**: in-app via `app/terms-of-service.tsx`,
  and now also as a static page (`legal/terms.html`) on Netlify, linked from
  the new `legal/index.html` landing page. Until this session, only
  `legal/privacy.html` was deployed on Netlify — `terms.html` going live was
  new.

---

## Completed: all 19 fixes (3 priority groups)

### 🔴 Priority 1 — Security & Money (pushed, backend auto-deployed, confirmed)
1. **Purchase false-negative fix** — `lib/iap.ts` `purchasePackage()` now
   retries the entitlement check with backoff instead of throwing after a
   real charge; `app/upgrade.tsx` shows "Purchase received, may take a
   minute" instead of a false "Purchase failed". Restore button confirmed
   already visible.
2. **Premium state divergence** — `syncPremiumWithBackend` and
   `purchasePackage`/`restorePremium` now return `{ active, synced }`;
   local `isPaid` is only set once backend sync is confirmed.
3. **Rate limiting** — added `codeLimiter` (10 req / 15 min) on
   `/api/auth/verify-email` and `/api/auth/reset-password` in
   `backend/server.js`.
4. **Account deletion password re-confirmation** — `DELETE /api/auth/account`
   now requires password verification; `app/account-settings.tsx` has a
   password-confirmation modal; rate-limited via `authLimiter`.
5. **Sort comparator null-guards** — `app/(tabs)/subscriptions.tsx` `name`
   and `price_desc` sort comparators now null-coalesce missing fields.

### 🟡 Priority 2 — Polish & Consistency (pushed, confirmed)
6. **Consistent error handling** — added `isError` + retry UI (matching the
   `app/notifications.tsx` reference pattern) to `app/alerts.tsx`,
   `app/insights.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/analytics.tsx`.
7. **Loading states + pull-to-refresh** — added to `app/alerts.tsx` and
   `app/(tabs)/profile.tsx`.
8. **Analytics free-tier sort bug** — free-tier category preview in
   `app/(tabs)/analytics.tsx` now sorts by amount descending before
   `.slice(0, 1)`, matching the premium branch.
9. **`lib/pricing.ts`** created as single source of truth for displayed
   prices; wired into `app/upgrade.tsx`, `app/tip-jar.tsx`, and
   `app/(tabs)/profile.tsx` (which also had a hardcoded "$2.99/mo" not
   mentioned in the original guide).
10. **verify-email null guard** — confirmed already safe (`user?.email`
    optional chaining) and the auth-redirect logic in `app/_layout.tsx`
    already handles the screen correctly for both auth states. No change
    needed.
11. **iOS "Rate Trimio" fallback** — `app/(tabs)/profile.tsx` `handleRateApp`
    now branches on `Platform.OS === "ios"` to use an `itms-apps://` /
    App Store web link. **Note:** the App Store ID is a placeholder
    (`id0000000000`) — must be replaced with the real ID once the iOS app
    has an App Store listing.

### 🟢 Priority 3 — Cleanup (pushed, confirmed)
12. **Version sync** — `package.json` bumped `1.0.0` → `1.0.1` to match
    `app.json`.
13. **Branding cleanup** — "SubTrimmer" → "Trimio" across root markdown docs
    (case-sensitive replace; left `com.subtrimmer.app` bundle ID and the
    Expo project slug `subtrimmer` untouched, as instructed).
14. **eas.json** — removed duplicate `preview2`/`preview3` build profiles
    (confirmed unreferenced anywhere else).
15. **Netlify legal landing page** — `legal/index.html` was a byte-identical
    duplicate of `privacy.html`; replaced with a real landing page linking
    to `privacy.html` and `terms.html`. **Deployed and confirmed live** via
    screenshot in this session (drag-and-drop a zip of all three files onto
    Netlify's manual deploy area — that's the only way this site updates).
16. **Stale comment removed** — "Norton" affiliate comment in
    `app/deals.tsx` (Norton was never actually in the `DEALS` array).
17. **Key documentation** — added comments above the RevenueCat SDK key
    (`lib/iap.ts`) and Sentry DSN (`app/_layout.tsx`) explaining why they're
    safe to ship client-side (public/write-only keys, not secrets).
18. **`.npmrc`** — confirmed not applicable. File already exists, and project
    uses pnpm, where `legacy-peer-deps` (an npm-only flag) has no effect.
19. **git init / `EAS_NO_VCS`** — confirmed not applicable. Repo is already
    a real git repo; no `EAS_NO_VCS` reference exists anywhere in the
    codebase.

---

## Commits (all on `master`)

- `4e115ddd` — Priority 1 fixes (merged from feature branch)
- `b4bd085e` — Priority 2 fixes
- `ff62477c` — Priority 3 fixes

---

## Next step (as of this writing — pending user action)

The user is about to **trigger the Codemagic build** (`codemagic.yaml`,
workflow `android-build` for `.aab` or `android-apk` for a signed `.apk`) to
ship all of the above to a real Android build.

**Heads up to carry into the build conversation:** `app.json` has
`"versionCode": 15`. If versionCode 15 was already uploaded to Google Play
Console (even as a draft/internal test) before this session's fixes, Play
Console will reject this new upload as a duplicate — it needs to be bumped
to 16 first. This was flagged to the user but not yet confirmed/resolved as
of this note.

If a new session picks this up: ask whether the Codemagic build was
triggered, whether it succeeded, and whether versionCode needed bumping.
