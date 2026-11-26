package expo.modules.trimioagesignals

import com.google.android.play.agesignals.AgeSignalsAccessRequest
import com.google.android.play.agesignals.AgeSignalsException
import com.google.android.play.agesignals.AgeSignalsManager
import com.google.android.play.agesignals.AgeSignalsManagerFactory
import com.google.android.play.agesignals.AgeSignalsRequest
import com.google.android.play.agesignals.ApplicableAgeFeaturesRequest
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Google Play Age Signals (com.google.android.play:age-signals), for
// California's Digital Age Assurance Act (AB 1043) and the laws like it.
// JavaScript reaches it as "TrimioAgeSignals" through lib/age-signals.ts,
// which treats a missing module as "not in this build".
//
// Three calls, and ONLY requestAccess can show anything: it is the one
// request that carries an Activity, and the library's only path to its
// consent screen (AgeSharingConsentWrapperActivity) runs through it.
// applicableFeatures asks Play, quietly, whether sharing an age range is
// mandatory for this person; check reads the range, which Play reports only
// after the person has agreed to share. Read from the 0.0.6 bytecode.
//
// Play's rule for this data: use it to meet the law, never for analytics or
// advertising. Nothing here logs it or sends it anywhere.
class TrimioAgeSignalsModule : Module() {
  private val manager: AgeSignalsManager by lazy {
    val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
    AgeSignalsManagerFactory.create(context.applicationContext)
  }

  override fun definition() = ModuleDefinition {
    Name("TrimioAgeSignals")

    // A set of com.google.android.play.agesignals.model.ApplicableAgeFeature
    // values; MANDATORY_SHARING is 1.
    AsyncFunction("applicableFeatures") { promise: Promise ->
      manager.getApplicableAgeFeatures(ApplicableAgeFeaturesRequest.builder().build())
        .addOnSuccessListener { result -> promise.resolve(result.features().toList()) }
        .addOnFailureListener { e -> rejectWithPlayCode(promise, e) }
    }

    // Shows Play's consent prompt when Play decides it should. Resolves with
    // model.AgeSignalsStatus: SHARED 1, NOT_SHARED 2, VERIFICATION_REQUIRED 3.
    AsyncFunction("requestAccess") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject("ERR_AGE_SIGNALS_NO_ACTIVITY", "No foreground activity for Play's prompt", null)
      } else {
        manager.requestAgeSignalsAccess(AgeSignalsAccessRequest.builder().setActivity(activity).build())
          .addOnSuccessListener { result -> promise.resolve(result.ageSignalsStatus() ?: 0) }
          .addOnFailureListener { e -> rejectWithPlayCode(promise, e) }
      }
    }

    // Bounds are null until the person has shared.
    AsyncFunction("check") { promise: Promise ->
      manager.checkAgeSignals(AgeSignalsRequest.builder().build())
        .addOnSuccessListener { result ->
          promise.resolve(
            mapOf(
              "ageLower" to result.ageLower(),
              "ageUpper" to result.ageUpper(),
              "ageRangeSource" to result.ageRangeSource(),
              "significantChangeStatus" to result.significantChangeStatus()
            )
          )
        }
        .addOnFailureListener { e -> rejectWithPlayCode(promise, e) }
    }
  }

  // The message carries Play's model.AgeSignalsErrorCode (for example -6,
  // PLAY_STORE_VERSION_OUTDATED), so the JavaScript side can tell "this phone
  // cannot" from "try again".
  private fun rejectWithPlayCode(promise: Promise, e: Exception) {
    val code = (e as? AgeSignalsException)?.errorCode
    promise.reject("ERR_AGE_SIGNALS", "Play age signals failed, code ${code ?: "none"}", e)
  }
}
