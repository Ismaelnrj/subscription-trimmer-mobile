#!/usr/bin/env python3
"""Answer the question asked before every Trimio ship: build, or just OTA?

    needs_native_build.py                 compares against the last versionCode bump
    needs_native_build.py <commit>        compares against a commit you name
    needs_native_build.py <base> <head>   compares two commits (used by the tests)

Exit codes: 0 OTA is enough (or a native build with both bumps in place),
1 native build required and a bump is missing, 2 CANNOT DECIDE. Exit 2 is
never a verdict: it means something could not be inspected, and it names what.

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

DEPENDENCIES ARE JUDGED BY WHAT THE PACKAGE CONTAINS, not by the file name.
It used to flag any edit to package.json or pnpm-lock.yaml as native, which
called the 2026-10-18 axios bump a native build when axios ships no native
code at all. A false alarm costs a day and a versionCode; it also trains
everybody to stop believing the script, which is how a real one gets ignored.
Now every package version that appears or disappears in the lockfile is
opened and looked at: from node_modules when that exact version is installed,
otherwise from its registry tarball, checked against the lockfile's own
integrity hash. It counts as native when it carries Android sources (Java,
Kotlin, Gradle, AAR, JAR, .so, AndroidManifest.xml, or C/C++ under an android
or jni folder), an Expo module config that targets Android, a config plugin
that app.json actually loads, or when it is one of the packages that write the
Android project during prebuild. Anything that cannot be opened makes the
answer CANNOT DECIDE, never OTA: a wrong OTA crashes every install.
"""

import base64
import hashlib
import io
import json
import os
import re
import subprocess
import sys
import tarfile
import tempfile
import urllib.request

# Paths that are compiled into the binary, whatever their contents.
NATIVE_PATHS = (
    "android/", "ios/", "plugins/", "fix-gradle.sh", "codemagic.yaml",
    "google-services.json", "eas.json", "react-native.config.js",
)
# Judged by content, see the module docstring.
DEPENDENCY_FILES = ("package.json", "pnpm-lock.yaml")
# These generate the android/ project during `expo prebuild`, so a new version
# can change the binary while shipping no Java of its own.
PREBUILD_PACKAGES = {
    "expo", "@expo/prebuild-config", "@expo/config-plugins", "@expo/config",
    "@expo/config-types", "expo-template-bare-minimum", "expo-modules-autolinking",
    "@react-native/gradle-plugin", "@react-native-community/cli-platform-android",
    "@react-native-community/cli-config-android",
}
# package.json keys that cannot reach the binary. Dependency keys are judged
# through the lockfile instead; any key not listed here is CANNOT DECIDE.
INERT_PACKAGE_KEYS = {
    "name", "version", "private", "description", "license", "author",
    "repository", "keywords", "homepage", "bugs", "scripts", "engines",
    "packageManager", "jest", "eslintConfig", "prettier", "main",
    "dependencies", "devDependencies", "pnpm",
}
NATIVE_EXT = (".java", ".kt", ".kts", ".gradle", ".aar", ".jar", ".so")
NATIVE_C_EXT = (".c", ".cc", ".cpp", ".h", ".hpp", ".cmake")
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


def show(ref, path):
    r = subprocess.run(("git", "show", f"{ref}:{path}"), capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else None


def parse_lock(text):
    """name@version -> {name, version, integrity, tarball, platform} from the
    lockfile's packages section. Returns None when the format is unreadable,
    which the caller turns into CANNOT DECIDE rather than guessing."""
    if text is None:
        return {}
    out, key, inside = {}, None, False
    for line in text.splitlines():
        if not line.strip():
            continue
        if not line.startswith(" "):
            inside = line.rstrip() == "packages:"
            key = None
            continue
        if not inside:
            continue
        m = re.match(r"^  (?! )'?(.+?)'?:\s*$", line)
        if m:
            raw = re.sub(r"\(.*\)$", "", m.group(1).lstrip("/"))
            at = raw.rfind("@")
            if at <= 0:
                return None
            key = raw
            out[key] = {"name": raw[:at], "version": raw[at + 1:],
                        "integrity": None, "tarball": None, "platform": False}
            continue
        if key is None:
            continue
        if re.match(r"^    (os|cpu|libc):", line):
            out[key]["platform"] = True
        m = re.search(r"integrity: (sha\d+-[A-Za-z0-9+/=]+)", line)
        if m:
            out[key]["integrity"] = m.group(1)
        m = re.search(r"tarball: (\S+?)[,}]", line)
        if m:
            out[key]["tarball"] = m.group(1)
    return out


def files_from_node_modules(name, version):
    root = os.path.join("node_modules", ".pnpm")
    dirname = name.replace("/", "+") + "@" + version
    cands = []
    if os.path.isdir(root):
        cands += [os.path.join(root, d, "node_modules", name) for d in os.listdir(root)
                  if d == dirname or d.startswith(dirname + "_") or d.startswith(dirname + "(")]
    cands.append(os.path.join("node_modules", name))
    for c in cands:
        try:
            with open(os.path.join(c, "package.json"), encoding="utf-8") as f:
                if json.load(f).get("version") != version:
                    continue
        except (OSError, ValueError):
            continue
        files = []
        for dp, dns, fns in os.walk(c):
            dns[:] = [d for d in dns if d != "node_modules"]
            files += [os.path.relpath(os.path.join(dp, fn), c).replace(os.sep, "/") for fn in fns]
        return (files, c), None
    return None, "not installed"


def files_from_registry(entry):
    """The published tarball, verified against the lockfile's integrity hash, so
    what is inspected is byte for byte what pnpm installs."""
    name, version, integrity = entry["name"], entry["version"], entry["integrity"]
    if not integrity:
        return None, "no integrity hash in the lockfile"
    url = entry["tarball"] or (
        f"https://registry.npmjs.org/{name}/-/{name.split('/')[-1]}-{version}.tgz")
    cache = os.path.join(tempfile.gettempdir(), "trimio-native-check")
    os.makedirs(cache, exist_ok=True)
    path = os.path.join(cache, hashlib.sha1(integrity.encode()).hexdigest() + ".tgz")
    try:
        data = open(path, "rb").read()
    except OSError:
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                data = r.read()
        except Exception as e:  # network, 404, TLS: all mean "could not look"
            return None, f"download failed ({e.__class__.__name__})"
    algo, want = integrity.split("-", 1)
    if base64.b64encode(hashlib.new(algo, data).digest()).decode() != want:
        return None, "tarball does not match the lockfile's integrity hash"
    try:
        with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as t:
            names = [m.name.split("/", 1)[1] for m in t.getmembers()
                     if m.isfile() and "/" in m.name]
            cfg = next((m for m in t.getmembers()
                        if m.name.split("/", 1)[-1] == "expo-module.config.json"), None)
            expo_cfg = t.extractfile(cfg).read().decode("utf-8", "replace") if cfg else None
    except (tarfile.TarError, OSError, EOFError):
        return None, "tarball could not be read"
    with open(path, "wb") as f:
        f.write(data)
    return (names, expo_cfg), None


def native_reason(name, files, expo_cfg, plugins):
    """Why this package changes the Android binary, or None if it cannot."""
    if name in PREBUILD_PACKAGES:
        return "generates the Android project at prebuild"
    for f in files:
        parts = f.lower().split("/")
        base = parts[-1]
        if base.endswith(NATIVE_EXT) or base == "androidmanifest.xml":
            return f"ships Android code ({f})"
        if (base.endswith(NATIVE_C_EXT) or base == "cmakelists.txt") and (
                "android" in parts[:-1] or "jni" in parts[:-1]):
            return f"ships Android code ({f})"
    if expo_cfg is not None:
        try:
            cfg = json.loads(expo_cfg)
        except ValueError:
            return "Expo module config it ships cannot be read"
        if "android" in cfg or "android" in (cfg.get("platforms") or []):
            return "Expo module with Android code"
    if name in plugins and "app.plugin.js" in files:
        return "config plugin that app.json loads"
    return None


def inspect(entry, plugins):
    """('native', reason) | ('js', reason) | ('unknown', reason)."""
    name, version = entry["name"], entry["version"]
    got, why = files_from_node_modules(name, version)
    files, expo_cfg = None, None
    if got is not None:
        files, pkg_dir = got
        p = os.path.join(pkg_dir, "expo-module.config.json")
        if "expo-module.config.json" in files:
            try:
                expo_cfg = open(p, encoding="utf-8").read()
            except OSError:
                expo_cfg = "{\"android\": {}}"  # present but unreadable: assume native
    else:
        got, why2 = files_from_registry(entry)
        if got is None:
            if entry["platform"]:
                return "js", "prebuilt for one desktop platform, never in an Android build"
            return "unknown", f"{why}, and {why2}"
        files, expo_cfg = got
    reason = native_reason(name, files, expo_cfg, plugins)
    return ("native", reason) if reason else ("js", "no Android code")


def plugin_names(*cfgs):
    names = set()
    for cfg in cfgs:
        for p in (cfg or {}).get("plugins", []):
            n = p[0] if isinstance(p, list) else p
            if isinstance(n, str) and not n.startswith("."):
                names.add(n)
    return names


def judge_dependencies(base, head, plugins):
    """Returns (native, unknown, js) lists of (label, reason)."""
    native, unknown, js = [], [], []
    pj_old, pj_new = show(base, "package.json"), show(head, "package.json")
    try:
        old, new = json.loads(pj_old or "{}"), json.loads(pj_new or "{}")
    except ValueError:
        return [], [("package.json", "cannot be parsed")], []
    for k in sorted(set(old) | set(new)):
        if old.get(k) != new.get(k) and k not in INERT_PACKAGE_KEYS:
            (native if k in ("expo", "react-native") else unknown).append(
                (f"package.json \"{k}\"", "changed, and this script cannot judge that key"))
    lk_old, lk_new = show(base, "pnpm-lock.yaml"), show(head, "pnpm-lock.yaml")
    deps_moved = any(old.get(k) != new.get(k) for k in ("dependencies", "devDependencies", "pnpm"))
    if deps_moved and lk_old == lk_new:
        unknown.append(("pnpm-lock.yaml", "dependencies changed but the lockfile did not"))
        return native, unknown, js
    a, b = parse_lock(lk_old), parse_lock(lk_new)
    if a is None or b is None:
        unknown.append(("pnpm-lock.yaml", "format this script cannot read"))
        return native, unknown, js
    for key in sorted(set(a) ^ set(b)):
        entry, verb = (b[key], "added") if key in b else (a[key], "removed")
        kind, why = inspect(entry, plugins)
        label = f"{key} ({verb})"
        {"native": native, "unknown": unknown, "js": js}[kind].append((label, why))
    return native, unknown, js


def last_version_bump():
    out = git("log", "--format=%H", "-G", '"versionCode"', "--", "app.json")
    return out.splitlines()[0] if out else ""


def main():
    ref = sys.argv[1] if len(sys.argv) > 1 else last_version_bump()
    head = sys.argv[2] if len(sys.argv) > 2 else "HEAD"
    if not ref:
        print("Could not find a versionCode bump to compare against. "
              "Pass a commit explicitly.")
        return 2
    if not git("cat-file", "-t", ref):
        print(f"Not a commit this repo knows: {ref}")
        return 2

    if not git("cat-file", "-t", head):
        print(f"Not a commit this repo knows: {head}")
        return 2
    head_cfg = app_json_at(head) or {}
    base_cfg = app_json_at(ref) or {}
    assets = referenced_assets(head_cfg) | referenced_assets(base_cfg)

    changed = [f for f in git("diff", "--name-only", f"{ref}..{head}").splitlines() if f]
    if not changed:
        print(f"Nothing has changed since {ref[:8]}. Nothing to ship.")
        return 0

    native, console, ota, unknown = [], [], [], []
    for f in changed:
        if f in DEPENDENCY_FILES:
            continue
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

    print(f"\nComparing {ref[:8]}..{head[:8]}, {len(changed)} file(s) changed\n")

    if any(f in DEPENDENCY_FILES for f in changed):
        print("  Dependencies moved. Opening every package version that changed...")
        dn, du, dj = judge_dependencies(ref, head, plugin_names(head_cfg, base_cfg))
        native += dn
        unknown += du
        for label, why in dj:
            print(f"    {label:52} {why}")
        print()

    if unknown and not native:
        print("  CANNOT DECIDE. Nothing is known to be native, but these could not")
        print("  be inspected, and guessing OTA is the expensive mistake:\n")
        for f, why in unknown:
            print(f"    {f:52} {why}")
        print("\n  Fix: run `pnpm install --frozen-lockfile` (so node_modules holds")
        print("  these versions) or rerun where the npm registry is reachable.\n")
        return 2

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
        print(f"    {f:52} {why}")
    if unknown:
        print("\n    Also not inspected (does not change the verdict above):")
        for f, why in unknown:
            print(f"      {f}   {why}")

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
