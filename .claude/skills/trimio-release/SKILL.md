---
name: trimio-release
description: How Trimio ships, and the four things that are expensive to get wrong: whether a change needs a native build or an over-the-air update, the frozen runtimeVersion, versionCode discipline, and the typecheck that passes silently while broken. Use this whenever release is in play: publishing an eas update, deciding if a native build is needed, bumping versionCode or runtimeVersion, preparing a Play Console upload, running pre-ship checks, diagnosing why an update did not reach devices, or answering "can I just OTA this". Also use it before saying a change ships over the air, because assets and app.json are not all one category and the wrong call crashes every install rather than one device.
---

# Shipping Trimio

Two mistakes here are much more expensive than the rest, and both have already
happened.

**Shipping JS that needs native code that is not there.** `runtimeVersion` is
the guard against that, and it is frozen, so the guard is currently off.

**Burning a versionCode.** Play accepts each one exactly once, forever. 39 was
consumed by a build carrying a crash, so 40 had to be a fresh number for the
same code with one line fixed.

Neither is recoverable after the fact. Both are mechanically checkable, which
is why the two scripts exist rather than a list to remember at 11pm.

## Start here, always

```bash
python3 scripts/needs_native_build.py      # build, or is an OTA enough?
python3 scripts/preflight.py               # the four checks that must pass
```

`needs_native_build.py` diffs against the last versionCode bump (or a commit
you name), classifies every changed file, and exits non-zero if a native build
is required while `runtimeVersion` or `versionCode` has not moved with it.

## Native or over the air

The categories are not guessable from filenames, which is the whole reason for
the script:

| Changed | Ships how |
|---|---|
| `android/`, `plugins/`, `fix-gradle.sh`, `codemagic.yaml`, `google-services.json` | Native build |
| `package.json`, `pnpm-lock.yaml`, `eas.json`, `react-native.config.js` | Native build |
| `app.json` | Native build |
| An asset **named in app.json** (`icon`, `adaptive-icon`, `splash-icon`, `notification-icon`, `favicon`) | Native build |
| An asset **required from JS** (`assets/splash.png`, used by `AnimatedSplash`) | Over the air |
| `assets/play-store-icon.png` | **Neither.** It is the 512 listing icon, a Play Console upload, not referenced by app.json and not in the binary |
| Anything in `app/`, `components/`, `lib/`, `locales/` | Over the air |
| `backend/` | Neither: Railway auto-deploys on push |

The rule underneath the asset rows: an asset reaches the binary only if
`app.json` points at it. Everything else rides the bundle.

## runtimeVersion, the one that crashes everyone

`app.json` pins `"runtimeVersion": "1.0.1"` as a literal, and `version` reads
`1.0.3`. That gap is deliberate and must not be tidied.

EAS matches an update to a build by **runtimeVersion**, never by `version`.
Build 40 carries 1.0.1, so it asks for updates tagged 1.0.1, and a publish
carries the same. Set it to 1.0.3 and every existing build keeps asking for
1.0.1, finds nothing, and silently stops receiving updates forever. Seeing
`Runtime version: 1.0.1` in the app is the mechanism working.

Frozen, it lets every build take every update, which is safe exactly as long
as nothing native changes. **So when a native change does happen, bump
runtimeVersion in the same commit.** Skip it and an old install pulls JS that
calls native code it does not contain, and dies on launch. The blast radius is
everyone, not one device.

## versionCode

A versionCode uploads to Play once and can never be reused, even if the build
was never released. Bump it with any native build. If a build is rejected or
found broken after upload, the fix takes the next number, it does not reclaim
the old one.

## Publishing an OTA

```bash
eas update --channel production --message "what changed"
```

**Channel, not branch.** `app.json` sends `expo-channel-name: production` as a
request header, and that header is what the app actually asks against.
`--branch production` happens to work because EAS auto-links a same-named
branch on first publish, but it is coincidence rather than the mechanism.
`BUILD_GUIDE.md` shows a command with no channel flag at all; do not copy it.

Run it from a machine that can reach `api.expo.dev`. Cloud and sandbox sessions
are refused by network policy, which surfaces as an auth-looking error and is
not one, so a new token never fixes it.

**Pull before publishing.** `eas update` uploads the working tree, not the
remote. Publishing from a stale clone succeeds, reports success, and ships the
old bundle.

## Confirming an update actually landed

A successful publish and a delivered update are different claims. Help &
Support has a Build Info panel:

- `Embedded launch (no OTA applied)` should read **false**
- `Update ID` should be a UUID, not `none`
- `Update published` should match the publish timestamp

If it says embedded with no update ID, the app is running the bundle baked into
the build. Updates download in the background and apply on the **next** launch,
so force close and reopen before concluding anything is wrong.

## Before any native build

```bash
python3 scripts/preflight.py
```

Four checks, each of which has caught something real. `preflight.py` reports a
check that could not run as SKIPPED and says plainly that skipped is not
passed, because the one time that distinction was blurred it shipped a crash.

**Never trust a bare `npx tsc --noEmit`.** This project pins TypeScript 5.3.3.
Without `node_modules`, npx falls through to whatever global compiler is on
PATH, which rejects this tsconfig outright (TS5107, TS5101) and exits before
typechecking a single file. That reads as a clean run. On 2026-09-04 it was
believed, and `buildTips` shipped with a `t` argument in the wrong position,
so every user hit `TypeError: 50 is not a function` on the dashboard. Piping
through `tail` hides the exit code as well, so the failure is invisible twice.

The deeper habit that would have caught it: **when an exported signature
changes, grep the whole repo**, tests included, not just the file you are
editing.

```bash
grep -rn "<name>" --include=*.ts --include=*.tsx .
```

## Native builds run on Codemagic

Not EAS Build. `codemagic.yaml` runs `expo prebuild`, then `fix-gradle.sh`,
then Gradle, and since 2026-09-21 it is the only native path: the GitHub
Actions `build-android.yml` workflow was deleted, having never produced a
usable artifact and having failed on every push.

Codemagic is also the exception rather than the routine. The owner's rule is
OTA first, Codemagic only when an OTA cannot do the job, so
`needs_native_build.py` is what decides whether a build is owed.

If a build dies at `compileReleaseKotlin` with "Module was compiled with an
incompatible version of Kotlin", look there first: `fix-gradle.sh` pins Kotlin
to 2.0.21 deliberately, and a dependency whose prebuilt AAR wants a newer
compiler collides with that pin.

Do not remove Fix 9. It adds native Sentry auto-init through the
AndroidManifest, which is the only reason crashes that happen before the JS
bundle loads are ever seen. The one SoLoader crash on record was invisible
without it.

## Google Play policy, currently satisfied

Verified by build 40 being accepted after the 31 Aug 2026 enforcement date:
Play Billing Library 8.x, arriving via `react-native-purchases`, and target API
36, set by `fix-gradle.sh` rather than by an `expo-build-properties` plugin,
because there is no such plugin here. The shell script is the only thing
setting it, so changes to it are policy-relevant.

## Order of operations for a native release

1. `needs_native_build.py` to confirm a build is genuinely required
2. Bump `versionCode`, and `runtimeVersion` if anything native moved
3. `preflight.py`, on a machine where the typecheck can actually run
4. Codemagic build
5. Upload to Play, note the versionCode is now spent
6. `eas update --channel production` afterwards only if JS changed since
7. Confirm on a real device through the Build Info panel
