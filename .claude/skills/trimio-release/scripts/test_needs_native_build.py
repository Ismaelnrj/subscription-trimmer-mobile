#!/usr/bin/env python3
"""Feeds needs_native_build.py one case per rule and fails if it answers wrong.

Each case is a throwaway git repo with a fake node_modules, so the verdict is
decided by package CONTENTS the test controls, with no network needed. The
one case that wants "could not be inspected" uses a package name that exists
nowhere, so it answers the same online and offline.

Two directions are tested on purpose: a JavaScript-only bump must say OTA (a
false alarm wastes a build and teaches people to ignore the script), and every
kind of native change must say NATIVE or CANNOT DECIDE (a wrong OTA crashes
every install).

Run from the repo root: python3 .claude/skills/trimio-release/scripts/test_needs_native_build.py
"""

import json
import os
import subprocess
import sys
import tempfile

SCRIPT = os.path.abspath(os.path.join(os.path.dirname(__file__), "needs_native_build.py"))
INTEGRITY = "sha512-" + "A" * 86 + "=="

APP = {"expo": {"runtimeVersion": "1.0.1", "android": {"versionCode": 40},
                "plugins": ["expo-updates", ["used-plugin", {}]]}}
PKG = {"name": "t", "version": "1.0.0", "dependencies": {}}


def lock(pkgs):
    """pkgs: {"name@ver": extra_lines}"""
    out = ["lockfileVersion: '9.0'", "", "importers:", "", "  .:", "    dependencies: {}", "",
           "packages:", ""]
    for key, extra in pkgs.items():
        out.append(f"  '{key}':")
        out.append(f"    resolution: {{integrity: {INTEGRITY}}}")
        out += [f"    {e}" for e in extra]
        out.append("")
    out += ["snapshots:", "", "  placeholder@1.0.0: {}", ""]
    return "\n".join(out)


def install(root, name, version, files):
    d = os.path.join(root, "node_modules", ".pnpm", name.replace("/", "+") + "@" + version,
                     "node_modules", name)
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, "package.json"), "w") as f:
        json.dump({"name": name, "version": version}, f)
    for rel, body in files.items():
        p = os.path.join(d, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "w") as f:
            f.write(body)


def case(name, base, head, installed, want_exit, want_text):
    """base/head: dict of path -> content. installed: [(name, ver, files)]."""
    with tempfile.TemporaryDirectory() as root:
        def commit(tree, msg):
            for path, body in tree.items():
                p = os.path.join(root, path)
                os.makedirs(os.path.dirname(p) or root, exist_ok=True)
                with open(p, "w") as f:
                    f.write(body if isinstance(body, str) else json.dumps(body, indent=2))
            subprocess.run(["git", "add", "-A", "--", ":!node_modules"], cwd=root, check=True,
                           capture_output=True)
            subprocess.run(["git", "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm",
                            msg, "--allow-empty"], cwd=root, check=True, capture_output=True)
        subprocess.run(["git", "init", "-q"], cwd=root, check=True)
        commit(base, "base")
        commit(head, "head")
        for n, v, files in installed:
            install(root, n, v, files)
        r = subprocess.run([sys.executable, SCRIPT, "HEAD~1"], cwd=root, capture_output=True,
                           text=True)
        ok = r.returncode == want_exit and want_text in r.stdout
        print(("PASS " if ok else "FAIL ") + name)
        if not ok:
            print(f"     wanted exit {want_exit} with {want_text!r}, got {r.returncode}:")
            print("     " + r.stdout.replace("\n", "\n     "))
        return ok


def base_tree(pkgs, pkg=None, app=None):
    return {"app.json": app or APP, "package.json": pkg or PKG, "pnpm-lock.yaml": lock(pkgs),
            "lib/a.ts": "export const a = 1;\n"}


def main():
    js = {"index.js": "module.exports = 1;"}
    droid = {"android/build.gradle": "apply plugin: 'com.android.library'"}
    results = [
        case("JS only version bump is OTA",
             base_tree({"axios@1.0.0": []}), base_tree({"axios@1.1.0": []}),
             [("axios", "1.0.0", js), ("axios", "1.1.0", js)], 0, "OTA IS ENOUGH"),
        case("package with android/ sources is NATIVE",
             base_tree({"rn-mod@1.0.0": []}), base_tree({"rn-mod@1.1.0": []}),
             [("rn-mod", "1.0.0", droid), ("rn-mod", "1.1.0", droid)], 1, "NATIVE BUILD REQUIRED"),
        case("prebuilt .aar is NATIVE",
             base_tree({}), base_tree({"expo-thing@1.0.0": []}),
             [("expo-thing", "1.0.0", {"local-maven-repo/x/x-1.0.0.aar": "x"})], 1,
             "NATIVE BUILD REQUIRED"),
        case("Expo module config targeting Android is NATIVE",
             base_tree({}), base_tree({"expo-cfg@1.0.0": []}),
             [("expo-cfg", "1.0.0", {"expo-module.config.json": '{"platforms":["android"]}'})],
             1, "NATIVE BUILD REQUIRED"),
        case("iOS only Expo module is OTA for this Android app",
             base_tree({}), base_tree({"expo-ios@1.0.0": []}),
             [("expo-ios", "1.0.0", {"expo-module.config.json": '{"platforms":["apple"]}',
                                     "ios/Thing.swift": "x"})], 0, "OTA IS ENOUGH"),
        case("removing a native package is NATIVE",
             base_tree({"rn-mod@1.0.0": []}), base_tree({}),
             [("rn-mod", "1.0.0", droid)], 1, "NATIVE BUILD REQUIRED"),
        case("config plugin app.json loads is NATIVE",
             base_tree({"used-plugin@1.0.0": []}), base_tree({"used-plugin@1.1.0": []}),
             [("used-plugin", "1.0.0", {"app.plugin.js": "x"}),
              ("used-plugin", "1.1.0", {"app.plugin.js": "x"})], 1, "NATIVE BUILD REQUIRED"),
        case("config plugin app.json does not load is OTA",
             base_tree({"idle-plugin@1.0.0": []}), base_tree({"idle-plugin@1.1.0": []}),
             [("idle-plugin", "1.0.0", {"app.plugin.js": "x"}),
              ("idle-plugin", "1.1.0", {"app.plugin.js": "x"})], 0, "OTA IS ENOUGH"),
        case("prebuild package with no Java is NATIVE",
             base_tree({"@expo/config-plugins@1.0.0": []}),
             base_tree({"@expo/config-plugins@1.1.0": []}),
             [("@expo/config-plugins", "1.0.0", js), ("@expo/config-plugins", "1.1.0", js)], 1,
             "NATIVE BUILD REQUIRED"),
        case("JS files in a folder called android are OTA",
             base_tree({}), base_tree({"cli-ish@1.0.0": []}),
             [("cli-ish", "1.0.0", {"build/platforms/android/run.js": "x"})], 0, "OTA IS ENOUGH"),
        case("Node addon C code outside android/ is OTA",
             base_tree({}), base_tree({"node-addon@1.0.0": []}),
             [("node-addon", "1.0.0", {"src/addon.c": "x", "binding.gyp": "{}"})], 0,
             "OTA IS ENOUGH"),
        case("package that cannot be inspected is CANNOT DECIDE, never OTA",
             base_tree({}), base_tree({"zz-trimio-no-such-package-q7@1.0.0": []}),
             [], 2, "CANNOT DECIDE"),
        case("uninstallable desktop binary is skipped, OTA",
             base_tree({}), base_tree({"zz-trimio-darwin-only-q7@1.0.0": ["os: [darwin]"]}),
             [], 0, "OTA IS ENOUGH"),
        case("native wins over cannot decide",
             base_tree({}), base_tree({"rn-mod@1.0.0": [], "zz-trimio-no-such-package-q7@1.0.0": []}),
             [("rn-mod", "1.0.0", droid)], 1, "NATIVE BUILD REQUIRED"),
        case("scripts only package.json change is OTA",
             base_tree({}), base_tree({}, pkg={**PKG, "scripts": {"x": "y"}}),
             [], 0, "OTA IS ENOUGH"),
        case("unknown package.json key is CANNOT DECIDE",
             base_tree({}), base_tree({}, pkg={**PKG, "resolutions": {"a": "1"}}),
             [], 2, "CANNOT DECIDE"),
        case("package.json expo key is NATIVE",
             base_tree({}), base_tree({}, pkg={**PKG, "expo": {"autolinking": {}}}),
             [], 1, "NATIVE BUILD REQUIRED"),
        case("dependency edited without a lockfile change is CANNOT DECIDE",
             base_tree({}), base_tree({}, pkg={**PKG, "dependencies": {"axios": "1.1.0"}}),
             [], 2, "CANNOT DECIDE"),
        case("app.json change is still NATIVE",
             base_tree({}), base_tree({}, app={"expo": {**APP["expo"], "scheme": "x"}}),
             [], 1, "NATIVE BUILD REQUIRED"),
        case("both bumps present makes a native verdict exit 0",
             base_tree({}), base_tree({}, app={"expo": {**APP["expo"], "runtimeVersion": "1.0.2",
                                                        "android": {"versionCode": 41}}}),
             [], 0, "runtimeVersion 1.0.1 -> 1.0.2, good"),
    ]
    print(f"\n{sum(results)} of {len(results)} passed")
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
