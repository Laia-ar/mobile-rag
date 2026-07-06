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
