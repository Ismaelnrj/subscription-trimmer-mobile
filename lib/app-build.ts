import Constants from "expo-constants";

/* WHICH BUILD IS THIS PHONE ACTUALLY RUNNING.

   Constants.expoConfig is the app.json of the RUNNING UPDATE, not of the
   installed APK. Every `eas update` carries the app.json it was published
   from, so once app.json says versionCode 41, a build 40 phone that takes the
   next update reports 41 too. Two things read that number and both would lie:
   the Build Info panel, whose "Native build" line is how a publish is
   confirmed, and the minimum version gate in UpdateAvailableModal, which would
   stop asking exactly the phones it exists to ask.

   expo-application reads the version from the installed package itself. It is
   in build 40 (PostHog depends on it), but it is loaded inside a try so a
   build without its native module falls back to the old reading rather than
   crashing at launch. */

type NativeBuild = { versionCode: number | null; version: string | null };

let cached: NativeBuild | null = null;

export function nativeBuild(): NativeBuild {
  if (cached) return cached;
  let versionCode: number | null = null;
  let version: string | null = null;
  try {
    const Application = require("expo-application");
    const code = Number(Application.nativeBuildVersion);
    if (Number.isInteger(code) && code > 0) versionCode = code;
    if (typeof Application.nativeApplicationVersion === "string") version = Application.nativeApplicationVersion;
  } catch {
    // No native module: fall through to the update's app.json below.
  }
  cached = {
    versionCode: versionCode ?? Constants.expoConfig?.android?.versionCode ?? null,
    version: version ?? Constants.expoConfig?.version ?? null,
  };
  return cached;
}
