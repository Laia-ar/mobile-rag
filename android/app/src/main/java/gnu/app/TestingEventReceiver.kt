// package gnu.app

// import android.os.Bundle
// import com.facebook.react.ReactActivity
// import com.facebook.react.bridge.Arguments
// import com.facebook.react.bridge.WritableMap
// import com.facebook.react.bridge.ReactContext
// import com.facebook.react.modules.core.DeviceEventManagerModule
// import com.facebook.react.ReactInstanceEventListener

// class InputTextActivity : ReactActivity() {

//     override fun onCreate(savedInstanceState: Bundle?) {
//         super.onCreate(savedInstanceState)

//         val mainApplication = application as MainApplication
//         val reactHost = mainApplication.reactHost
//         val currentContext = reactHost?.currentReactContext

//         val message = intent.getStringExtra("message") ?: "hello!, tell me some joke."
//         val params: WritableMap = Arguments.createMap()
//         params.putString("message", message)

//         if (currentContext != null) {
//             triggerReactNativeFunction(currentContext, params)
//         } else {
//             reactHost?.addReactInstanceEventListener(object : ReactInstanceEventListener {
//                 override fun onReactContextInitialized(context: ReactContext) {
//                     triggerReactNativeFunction(context, params)
//                     reactHost.removeReactInstanceEventListener(this)
//                 }
//             })
//         }
//     }

// }

package gnu.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class TestingEventReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val message = intent.getStringExtra("message") ?: "hello!, tell me some joke."
        val params: WritableMap = Arguments.createMap()
        params.putString("message", message)

        val mainApplication = context.applicationContext as MainApplication
        val reactHost = mainApplication.reactHost
        val currentContext = reactHost.currentReactContext

        if (currentContext != null && currentContext.hasActiveReactInstance()) {
            triggerReactNativeFunction(currentContext, params)
        }
    }

    private fun triggerReactNativeFunction(reactContext: ReactContext, params: WritableMap) {
        reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("triggerInputText", params)
    }
}
