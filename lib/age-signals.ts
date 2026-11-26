import { requireOptionalNativeModule } from "expo";

/* PLAY AGE SIGNALS, through modules/trimio-age-signals (build 42 and later).

   OPTIONAL ON PURPOSE. Build 42 kept runtimeVersion 1.0.1, so every update
   published from here also reaches builds 40 and 41, which do not contain the
   module. requireOptionalNativeModule answers null there (and on the web), and
   every function below then answers without touching native code. A plain
   requireNativeModule would throw on those phones at import time; the test in
   __tests__/age-signals.test.js fails if this file ever uses one.

   Play's rule for this data: use it to meet the law, never for analytics or
   advertising. Nothing here sends it anywhere. */

type AgeSignalsNative = {
  // model.ApplicableAgeFeature values; MANDATORY_SHARING is 1. Shows nothing.
  applicableFeatures(): Promise<number[]>;
  // Play's consent prompt. model.AgeSignalsStatus: SHARED 1, NOT_SHARED 2,
  // VERIFICATION_REQUIRED 3. The only call that can show anything.
  requestAccess(): Promise<number>;
  // Bounds are null until the person has shared.
  check(): Promise<{
    ageLower: number | null;
    ageUpper: number | null;
    ageRangeSource: number | null;
    significantChangeStatus: number | null;
  }>;
};

const native = requireOptionalNativeModule<AgeSignalsNative>("TrimioAgeSignals");

export const MANDATORY_SHARING = 1;

export type AgeSharing = "not in this build" | "not required here" | "required here" | "unavailable";

/* The quiet question: does Play say this person must share an age range with
   apps? Asks the person nothing. "unavailable" covers an old Play Store
   (getApplicableAgeFeatures needs a newer one than the other two calls) and
   phones without Play. */
export async function ageSharingRequirement(): Promise<AgeSharing> {
  if (!native) return "not in this build";
  try {
    const features = await native.applicableFeatures();
    return features.includes(MANDATORY_SHARING) ? "required here" : "not required here";
  } catch {
    return "unavailable";
  }
}
