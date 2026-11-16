package gnu.app

import android.content.Intent
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.security.MessageDigest

class OfflineKnowledgeModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "OfflineKnowledge"

  @ReactMethod
  fun sha256Text(value: String, promise: Promise) {
    try {
      val digest = MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray(Charsets.UTF_8))
        .joinToString("") { byte -> "%02x".format(byte) }
      promise.resolve(digest)
    } catch (error: Exception) {
      promise.reject("HASH_ERROR", "No se pudo calcular el hash.", error)
    }
  }

  @ReactMethod
  fun openPdf(path: String, page: Int, promise: Promise) {
    val file = File(path)
    if (!file.isFile) {
      promise.reject("PDF_NOT_FOUND", "No se encontró el PDF solicitado: $path")
      return
    }

    try {
      val activity = reactApplicationContext.currentActivity
      val context = activity ?: reactApplicationContext
      val intent = Intent(context, PdfViewerActivity::class.java).apply {
        putExtra(PdfViewerActivity.EXTRA_PATH, file.absolutePath)
        putExtra(PdfViewerActivity.EXTRA_PAGE, page.coerceAtLeast(1))
        if (activity == null) addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("PDF_OPEN_ERROR", "No se pudo abrir el PDF.", error)
    }
  }
}
