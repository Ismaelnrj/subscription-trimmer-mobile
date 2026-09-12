#!/usr/bin/env python3
"""Answer the question asked before every Trimio ship: build, or just OTA?

    needs_native_build.py                 compares against the last versionCode bump
    needs_native_build.py <commit>        compares against a commit you name

Getting this wrong is expensive in both directions. Building when an OTA would
do costs a day and burns a versionCode, which can only ever be uploaded to Play
once. Shipping an OTA when a native change is in the diff means old builds pull
JavaScript that calls native code they do not contain, and crash on launch, for
everyone rather than for one unlucky device.

The list of what counts as native is not obvious from filenames alone, which is
why this is a script and not a rule anyone is expected to recall:

  assets/play-store-icon.png   changes nothing in the app. It is the 512 square
                               listing icon, uploaded in Play Console, and it is
                               not referenced by app.json at all.
  assets/splash.png            is required from JavaScript by AnimatedSplash,
                               so it rides an OTA like any other bundled asset.
  assets/splash-icon.png       IS named in app.json as the OS splash, so it is
                               baked into the build and needs one.

The rule underneath: an asset matters to the build if app.json points at it.
"""

import json
import re
import subprocess
import sys

# Paths that are compiled into the binary, whatever their contents.
NATIVE_PATHS = (
    "android/", "ios/", "plugins/", "fix-gradle.sh", "codemagic.yaml",
    "google-services.json", "eas.json", "package.json", "pnpm-lock.yaml",
    "react-native.config.js",
)
# Changes here are a Play Console upload: no build, and no OTA either.
CONSOLE_ONLY = ("assets/play-store-icon.png",)


def git(*args):
    return subprocess.run(("git",) + args, capture_output=True, text=True).stdout.strip()


def app_json_at(ref):
    raw = git("show", f"{ref}:app.json")
    return json.loads(raw)["expo"] if raw else None


def referenced_assets(cfg):
    """Assets app.json points at, so a change to them lands in the binary."""
    return set(re.findall(r'"\./(assets/[^"]+)"', json.dumps(cfg)))


def last_version_bump():
    out = git("log", "--format=%H", "-G", '"versionCode"', "--", "app.json")
    return out.splitlines()[0] if out else ""


def main():
    ref = sys.argv[1] if len(sys.argv) > 1 else last_version_bump()
    if not ref:
        print("Could not find a versionCode bump to compare against. "
              "Pass a commit explicitly.")
        return 2
    if not git("cat-file", "-t", ref):
        print(f"Not a commit this repo knows: {ref}")
        return 2

    head_cfg = json.loads(open("app.json").read())["expo"]
    base_cfg = app_json_at(ref) or {}
    assets = referenced_assets(head_cfg) | referenced_assets(base_cfg)

    changed = [f for f in git("diff", "--name-only", f"{ref}..HEAD").splitlines() if f]
    if not changed:
        print(f"Nothing has changed since {ref[:8]}. Nothing to ship.")
        return 0

    native, console, ota = [], [], []
    for f in changed:
        if f in CONSOLE_ONLY:
            console.append((f, "Play Console upload, not in the build"))
        elif f == "app.json":
            native.append((f, "native config"))
        elif f.startswith("assets/"):
            (native if f in assets else ota).append(
                (f, "referenced by app.json" if f in assets else
                    "bundled from JS, ships over the air"))
        elif any(f.startswith(p) or f == p for p in NATIVE_PATHS):
            native.append((f, "compiled into the binary"))
        else:
            ota.append((f, ""))

    print(f"\nComparing {ref[:8]}..HEAD, {len(changed)} file(s) changed\n")

    if not native:
        print("  OTA IS ENOUGH. No native input changed.\n")
        print(f"    {len(ota)} file(s) ship over the air.")
        if console:
            print("\n    Console only, neither a build nor an OTA carries these:")
            for f, why in console:
                print(f"      {f}   {why}")
        print("\n  Publish with:")
        print('    eas update --channel production --message "..."')
        print("\n  Channel, not branch. app.json sends expo-channel-name: "
              "production\n  as a request header, and that is what the app "
              "actually asks for.\n")
        return 0

    print("  NATIVE BUILD REQUIRED. These are compiled in, not shipped over "
          "the air:\n")
    for f, why in native:
        print(f"    {f:44} {why}")

    # The two invariants that make a native build safe to release.
    print()
    rt_head = head_cfg.get("runtimeVersion")
    rt_base = base_cfg.get("runtimeVersion")
    vc_head = head_cfg.get("android", {}).get("versionCode")
    vc_base = base_cfg.get("android", {}).get("versionCode")

    problems = 0
    if rt_head == rt_base:
        print(f"    runtimeVersion is still {rt_head}.  BUMP IT.")
        print("      It is the guard that stops a JS bundle reaching a build")
        print("      without the native code that JS needs. Leave it and every")
        print("      older build keeps pulling updates it cannot run.")
        problems += 1
    else:
        print(f"    runtimeVersion {rt_base} -> {rt_head}, good.")

    if vc_head == vc_base:
        print(f"    versionCode is still {vc_head}.  BUMP IT.")
        print(f"      {vc_base} has already been uploaded, and Play accepts a")
        print("      versionCode exactly once. Reusing it fails at upload.")
        problems += 1
    else:
        print(f"    versionCode {vc_base} -> {vc_head}, good.")

    if console:
        print("\n    Console only, not part of the build:")
        for f, why in console:
            print(f"      {f}   {why}")

    print("\n  Before building, run preflight.py. Then Codemagic, not EAS "
          "Build:\n  native Android CI for this project is codemagic.yaml.\n")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
