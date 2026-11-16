import { useEffect, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type PDFDocumentLoadingTask, type RenderTask } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { obtenerPdf } from '../api'
import type { Source } from '../types'

GlobalWorkerOptions.workerSrc = workerUrl

export default function PdfPreview({ registrationId, source }: {
  registrationId: string
  source: Source
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [page, setPage] = useState(1)
  const [pageText, setPageText] = useState('')
  const [rendering, setRendering] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl: string | null = null
    let task: PDFDocumentLoadingTask | undefined
    setPdf(null)
    setUrl(null)
    setError(null)
    if (!source.document_id || source.pdf_available === false) return
    const load = async () => {
      const blob = await obtenerPdf(registrationId, source.document_id!, controller.signal)
      const data = new Uint8Array(await blob.arrayBuffer())
      if (controller.signal.aborted) return
      task = getDocument({ data })
      const document = await task.promise
      if (controller.signal.aborted) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
      setPage(Math.min(document.numPages, Math.max(1, source.page ?? 1)))
      setPdf(document)
    }
    load().catch(() => {
      if (!controller.signal.aborted) setError('No se pudo abrir el PDF. Intentá nuevamente.')
    })
    return () => {
      controller.abort()
      void task?.destroy()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [registrationId, source.document_id, source.pdf_available, source.page, attempt])

  useEffect(() => {
    if (!pdf || !canvasRef.current) return
    let cancelled = false
    let renderTask: RenderTask | undefined
    const canvas = canvasRef.current
    setRendering(true)
    setPageText('')
    const render = async () => {
      const documentPage = await pdf.getPage(page)
      if (cancelled) return
      const viewport = documentPage.getViewport({ scale: 1.5 })
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      renderTask = documentPage.render({ canvas, viewport })
      await renderTask.promise
      const text = await documentPage.getTextContent()
      if (!cancelled) setPageText(text.items.map(item => 'str' in item ? item.str : '').join(' '))
    }
    render().catch(() => {
      if (!cancelled) setError('No se pudo mostrar esta página del PDF. Intentá nuevamente.')
    }).finally(() => {
      if (!cancelled) setRendering(false)
    })
    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [pdf, page])

  if (!source.document_id || source.pdf_available === false) {
    return <p>El PDF de este documento no está disponible. Podés consultar el fragmento citado.</p>
  }
  if (error) return <div role="alert">
    <p>{error}</p>
    <button className="fh-button" onClick={() => setAttempt(value => value + 1)}>Reintentar PDF</button>
  </div>
  if (!pdf) return <p role="status">Abriendo PDF…</p>
  return <section className="fh-pdf" aria-label={`PDF: ${source.title}`}>
    <div className="fh-pdf-controls">
      <button className="fh-button" onClick={() => setPage(value => value - 1)} disabled={page <= 1 || rendering}>Página anterior</button>
      <span aria-live="polite">Página {page} de {pdf.numPages}</span>
      <button className="fh-button" onClick={() => setPage(value => value + 1)} disabled={page >= pdf.numPages || rendering}>Página siguiente</button>
    </div>
    {rendering && <p role="status">Mostrando página…</p>}
    <canvas ref={canvasRef} role="img" aria-label={`Página ${page} de ${source.title}`} />
    {pageText && <details className="fh-pdf-text"><summary>Texto de la página</summary><p>{pageText}</p></details>}
    {url && <a className="fh-text-button" href={`${url}#page=${page}`} target="_blank" rel="noopener noreferrer">Abrir PDF en otra pestaña</a>}
  </section>
}
