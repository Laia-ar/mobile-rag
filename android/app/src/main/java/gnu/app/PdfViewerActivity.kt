package gnu.app

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.Bundle
import android.os.ParcelFileDescriptor
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import java.io.File

class PdfViewerActivity : Activity() {
  private var descriptor: ParcelFileDescriptor? = null
  private var renderer: PdfRenderer? = null
  private var bitmap: Bitmap? = null
  private lateinit var image: ImageView
  private lateinit var counter: TextView
  private lateinit var previous: Button
  private lateinit var next: Button
  private var currentPage = 0

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.statusBarColor = Color.WHITE
    window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR

    val path = intent.getStringExtra(EXTRA_PATH)
    if (path.isNullOrBlank()) {
      finishWithError("No se recibió la ruta del documento.")
      return
    }

    try {
      descriptor = ParcelFileDescriptor.open(
        File(path),
        ParcelFileDescriptor.MODE_READ_ONLY,
      )
      renderer = PdfRenderer(descriptor!!)
      if (renderer!!.pageCount == 0) {
        finishWithError("El PDF no contiene páginas.")
        return
      }
      currentPage = (intent.getIntExtra(EXTRA_PAGE, 1) - 1)
        .coerceIn(0, renderer!!.pageCount - 1)
      setContentView(buildLayout(File(path).name))
      renderPage()
    } catch (error: Exception) {
      finishWithError("No se pudo leer el PDF.")
    }
  }

  private fun buildLayout(fileName: String): View {
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setBackgroundColor(Color.rgb(245, 246, 249))
    }
    val toolbar = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(8), dp(8), dp(12), dp(8))
      setBackgroundColor(Color.WHITE)
    }
    toolbar.addView(Button(this).apply {
      text = "Cerrar"
      contentDescription = "Cerrar documento"
      setOnClickListener { finish() }
    })
    toolbar.addView(TextView(this).apply {
      text = fileName
      textSize = 16f
      setTextColor(Color.rgb(38, 38, 38))
      maxLines = 1
      gravity = Gravity.CENTER
    }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
    root.addView(toolbar)

    image = ImageView(this).apply {
      adjustViewBounds = true
      scaleType = ImageView.ScaleType.FIT_CENTER
      setBackgroundColor(Color.WHITE)
      contentDescription = "Página del documento"
    }
    root.addView(ScrollView(this).apply {
      isFillViewport = true
      setPadding(dp(12), dp(12), dp(12), dp(12))
      addView(
        image,
        ViewGroup.LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          ViewGroup.LayoutParams.WRAP_CONTENT,
        ),
      )
    }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))

    val controls = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
      setPadding(dp(12), dp(8), dp(12), dp(12))
      setBackgroundColor(Color.WHITE)
    }
    previous = Button(this).apply {
      text = "Anterior"
      setOnClickListener {
        currentPage--
        renderPage()
      }
    }
    counter = TextView(this).apply {
      gravity = Gravity.CENTER
      textSize = 15f
      setTextColor(Color.rgb(64, 64, 64))
    }
    next = Button(this).apply {
      text = "Siguiente"
      setOnClickListener {
        currentPage++
        renderPage()
      }
    }
    controls.addView(previous)
    controls.addView(
      counter,
      LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f),
    )
    controls.addView(next)
    root.addView(controls)
    return root
  }

  private fun renderPage() {
    val pdfRenderer = renderer ?: return
    currentPage = currentPage.coerceIn(0, pdfRenderer.pageCount - 1)
    pdfRenderer.openPage(currentPage).use { page ->
      bitmap?.recycle()
      val targetWidth = resources.displayMetrics.widthPixels - dp(24)
      val targetHeight = (targetWidth.toFloat() * page.height / page.width)
        .toInt()
        .coerceAtLeast(1)
      bitmap = Bitmap.createBitmap(
        targetWidth.coerceAtLeast(1),
        targetHeight,
        Bitmap.Config.ARGB_8888,
      ).also { output ->
        output.eraseColor(Color.WHITE)
        page.render(output, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
      }
    }
    image.setImageBitmap(bitmap)
    counter.text = "Página ${currentPage + 1} de ${pdfRenderer.pageCount}"
    previous.isEnabled = currentPage > 0
    next.isEnabled = currentPage < pdfRenderer.pageCount - 1
  }

  private fun finishWithError(message: String) {
    Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    finish()
  }

  private fun dp(value: Int): Int =
    (value * resources.displayMetrics.density).toInt()

  override fun onDestroy() {
    if (::image.isInitialized) image.setImageDrawable(null)
    bitmap?.recycle()
    bitmap = null
    renderer?.close()
    renderer = null
    descriptor?.close()
    descriptor = null
    super.onDestroy()
  }

  companion object {
    const val EXTRA_PATH = "pdf_path"
    const val EXTRA_PAGE = "pdf_page"
  }
}
