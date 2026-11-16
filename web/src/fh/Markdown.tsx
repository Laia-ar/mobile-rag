import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Renderiza el markdown de las respuestas del asistente. react-markdown no
// interpreta HTML crudo por defecto, así que el output del LLM no puede
// inyectar markup en la página.
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="fh-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className="fh-table-scroll" role="region" aria-label="Tabla de la respuesta" tabIndex={0}>
              <table>{children}</table>
            </div>
          ),
        }}
      >{children}</ReactMarkdown>
    </div>
  )
}
