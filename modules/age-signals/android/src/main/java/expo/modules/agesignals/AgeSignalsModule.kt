package expo.modules.agesignals

import android.os.Bundle
import com.google.android.play.agesignals.AgeSignalsAccessRequest
import com.google.android.play.agesignals.AgeSignalsManagerFactory
import com.google.android.play.agesignals.AgeSignalsRequest
import com.google.android.play.agesignals.AgeSignalsStatus
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AgeSignalsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AgeSignals")

    AsyncFunction("fetchBounds") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve(null)
        return@AsyncFunction
      }
      try {
        val manager = AgeSignalsManagerFactory.create(activity.applicationContext)
        val accessRequest = AgeSignalsAccessRequest.builder().setActivity(activity).build()
        manager.requestAgeSignalsAccess(accessRequest)
          .addOnSuccessListener { access ->
            // 0.0.4 only includes bounds after SHARED. NOT_SHARED and VERIFICATION_REQUIRED stay unknown.
            if (access.ageSignalsStatus() != AgeSignalsStatus.SHARED) {
              promise.resolve(null)
              return@addOnSuccessListener
            }
            manager.checkAgeSignals(AgeSignalsRequest.builder().build())
              .addOnSuccessListener { result ->
                val bundle = Bundle()
                result.ageLower()?.let { bundle.putInt("lower", it) }
                val upper = result.ageUpper()
                upper?.let { bundle.putInt("upper", it) }
                promise.resolve(bundle)
              }
              .addOnFailureListener {
                promise.resolve(null)
              }
          }
          .addOnFailureListener {
            promise.resolve(null)
          }
      } catch (_: Throwable) {
        promise.resolve(null)
      }
    }
  }
}
