# Maestro E2E flows

Smoke tests for the flows that broke silently this session: the review
prompt getting permanently locked out, and the rate button doing nothing.
These are authored but **not yet run against a real device** (this
environment has no Android emulator) — expect to tweak selectors the first
time you actually run them.

## Setup (one-time, on your machine)

1. Install the Maestro CLI: `curl -Ls "https://get.maestro.mobile.dev" | bash`
   (see https://maestro.mobile.dev for other install options).
2. Create a dedicated test account in the app (email + password login, not
   Google — Maestro can't drive Google's native sign-in sheet reliably) with
   fewer than 3 subscriptions, so flow 03 can rely on adding exactly 3 to
   cross the review-prompt threshold.
3. Export credentials as env vars before running:
   ```
   export MAESTRO_TEST_EMAIL="your-test-account@example.com"
   export MAESTRO_TEST_PASSWORD="..."
   ```

## Running

Against a running emulator/device with the app already installed:

```
maestro test maestro/flows/01_launch_and_login.yaml
maestro test maestro/flows/02_add_and_delete_subscription.yaml
maestro test maestro/flows/03_review_prompt.yaml
```

Or all of them in order: `maestro test maestro/flows/`

## What each flow covers

- **01** — app boots past the splash screen, login succeeds, lands on the
  tabs.
- **02** — add a subscription, confirm it's listed, delete it via the swipe
  action, confirm the savings toast appears.
- **03** — add subscriptions until the review prompt's 3-subscription
  threshold is crossed, confirm the prompt appears, tap a star, confirm the
  prompt closes. Maestro can't reliably assert that the Play Store page
  actually opened (no stable, locale-independent anchor to check for), so
  confirm that part by eye when running manually.

## Notes

- Flow 02/03 assume flow 01 already ran in the same session (Maestro keeps
  app state between flows unless `clearState` is used), so run them in
  order.
- Text selectors are in English — if the test account's device locale is
  German, these will need matching `locales/de.json` strings instead.
