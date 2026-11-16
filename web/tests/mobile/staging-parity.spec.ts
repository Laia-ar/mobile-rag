import fs from 'node:fs'
import {expect, test, type Page, type TestInfo} from '@playwright/test'

const staging = process.env.PALMERA_STAGING_URL
const reg = {registration_id: 'parity-synthetic', nombre: 'Persona de prueba', mail: 'prueba@example.com', pais: 'AR', provincia: 'Buenos Aires', efector: 'Centro de prueba', disciplina: 'Pruebas'}
const documents = [{document_id: 'guide', title: 'Guía sintética', description: 'Documento de prueba', document_type: 'pdf', file_size: 1, pdf_available: true}]
const answer = {answer: '**Respuesta de prueba**\n\n- Primer punto\n\n| Columna | Valor |\n|---|---|\n| Uno | Dos |', sources: [{document_id: 'guide', title: 'Guía sintética', page: 3, content_preview: 'Fragmento de prueba'}], has_context: true, log_id: 'mobile-parity', model_used: 'fixture', model_name: 'Modelo de prueba', corpus_name: 'Corpus de prueba', prompt_name: null, latency_ms: 1}

async function prepare(page: Page, native: boolean, registered: boolean) {
  // All mutations are intercepted. No participant or question reaches staging.
  await page.route('**/*', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path.startsWith('/api/')) {
      let data: unknown
      if (path.endsWith('/registro') || path.includes('/registro/')) data = reg
      else if (path.includes('/documents/')) data = documents
      else if (path.endsWith('/consulta/')) data = answer
      else return route.abort('blockedbyclient')
      return route.fulfill({json: data})
    }
    if (!['GET', 'HEAD'].includes(request.method())) return route.abort('blockedbyclient')
    await route.continue()
  })
  await page.addInitScript(({registration, installed, nativeMode, catalog, response}) => {
    if (installed) {
      localStorage.setItem('palmera-web-registration', JSON.stringify(registration))
      localStorage.setItem(`palmera-web-registration:consent:${registration.registration_id}`, '1')
      localStorage.setItem(`palmera-web-welcome:${registration.registration_id}`, 'true')
    }
    if (!nativeMode) return
    Object.assign(window, {ReactNativeWebView: {postMessage(raw: string) {
      const request = JSON.parse(raw)
      const result = request.action === 'session.get' ? installed ? registration : null
        : request.action === 'registration.create' || request.action === 'profile.update' ? registration
        : request.action === 'documents.list' ? catalog
        : request.action === 'consultation.send' ? response : null
      setTimeout(() => (window as unknown as {__palmeraReceive(value: unknown): void}).__palmeraReceive({version: 1, id: request.id, ok: true, result}), 0)
    }}})
  }, {registration: reg, installed: registered, nativeMode: native, catalog: documents, response: answer})
  await page.goto(native ? '/' : staging!)
}

async function compare(native: Page, reference: Page, name: string, info: TestInfo) {
  for (const page of [native, reference]) {
    await page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all(Array.from(document.images).map(img => img.complete ? Promise.resolve() : new Promise<void>(resolve => { img.onload = () => resolve(); img.onerror = () => resolve() })))
    })
  }
  let actual = Buffer.alloc(0)
  let expected = Buffer.alloc(0)
  try {
    await expect.poll(async () => {
      actual = await native.screenshot({animations: 'disabled', caret: 'hide'})
      expected = await reference.screenshot({animations: 'disabled', caret: 'hide'})
      return actual.equals(expected)
    }, {timeout: 5000, message: `The ${name} view must match the published staging pixels`}).toBe(true)
  } catch (error) {
    fs.writeFileSync(info.outputPath(name + '-apk.png'), actual)
    fs.writeFileSync(info.outputPath(name + '-staging.png'), expected)
    await info.attach(`${name}-apk`, {body: actual, contentType: 'image/png'})
    await info.attach(`${name}-staging`, {body: expected, contentType: 'image/png'})
    throw error
  }
  fs.writeFileSync(info.outputPath(name + '-verified.png'), actual)
}

test('registration and consent match the published staging pixels', async ({page, context}, info) => {
  test.skip(!staging, 'PALMERA_STAGING_URL is required for the read-only comparison')
  const reference = await context.newPage()
  await Promise.all([prepare(page, true, false), prepare(reference, false, false)])
  for (const current of [page, reference]) await expect(current.getByRole('heading', {name: 'Ingresá tus datos para empezar'})).toBeVisible()
  await compare(page, reference, 'registration', info)
  for (const current of [page, reference]) {
    await current.getByLabel('Nombre *').fill(reg.nombre)
    await current.getByLabel('Mail *').fill(reg.mail)
    await current.getByLabel('País *').selectOption('AR')
    await current.getByLabel('Provincia *').selectOption('Buenos Aires')
    await current.getByLabel('Efector de salud *').fill(reg.efector)
    await current.getByLabel('Disciplina/especialidad *').fill(reg.disciplina)
    await current.getByRole('button', {name: 'Ingresar', exact: true}).click()
    await expect(current.getByRole('heading', {name: 'Cómo usar esta plataforma'})).toBeVisible()
  }
  await compare(page, reference, 'consent', info)
})

test('consultation, recommendations, guides, profile, chat and sources match staging pixels', async ({page, context}, info) => {
  test.skip(!staging, 'PALMERA_STAGING_URL is required for the read-only comparison')
  const reference = await context.newPage()
  await Promise.all([prepare(page, true, true), prepare(reference, false, true)])
  for (const current of [page, reference]) await expect(current.getByRole('heading', {name: 'Consulta', exact: true})).toBeVisible()
  await compare(page, reference, 'consultation', info)
  for (const current of [page, reference]) await current.getByRole('button', {name: 'Recomendaciones Buenas prácticas para una consulta integral'}).click()
  await compare(page, reference, 'recommendations', info)
  for (const current of [page, reference]) {
    await current.getByRole('button', {name: 'Guías', exact: true}).click()
    await expect(current.getByRole('button', {name: /Guía sintética/})).toBeVisible()
  }
  await compare(page, reference, 'guides', info)
  for (const current of [page, reference]) await current.getByRole('button', {name: 'Perfil', exact: true}).click()
  await compare(page, reference, 'profile', info)
  for (const current of [page, reference]) {
    await current.getByRole('button', {name: 'Consulta', exact: true}).click()
    await current.getByRole('button', {name: 'Chatbot Consulta directa'}).click()
  }
  await compare(page, reference, 'chat-empty', info)
  for (const current of [page, reference]) {
    await current.getByRole('textbox', {name: 'Escribí tu consulta'}).fill('Pregunta sintética')
    await current.getByRole('button', {name: 'Enviar consulta'}).click()
    await expect(current.locator('.fh-answer table')).toBeVisible()
  }
  await compare(page, reference, 'chat-answer', info)
  for (const current of [page, reference]) await current.getByRole('button', {name: 'Ver todas las fuentes'}).click()
  await compare(page, reference, 'sources', info)
})
