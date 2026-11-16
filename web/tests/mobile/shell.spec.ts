import {expect, test, type Page} from '@playwright/test'

const registration = {registration_id: 'synthetic-registration', nombre: 'Persona de prueba', mail: 'prueba@example.com', pais: 'AR', provincia: 'Buenos Aires', efector: 'Centro de prueba', disciplina: 'Pruebas'}
async function bootstrap(page: Page, registered = true, deferConsultation = false) {
  await page.addInitScript(({reg, hasSession, defer}) => {
    const requests: {action: string; payload: Record<string, unknown>}[] = []
    Object.assign(window, {testRequests: requests})
    if (hasSession) {
      localStorage.setItem(`palmera-web-registration:consent:${reg.registration_id}`, '1')
      localStorage.setItem(`palmera-web-welcome:${reg.registration_id}`, 'true')
    }
    Object.assign(window, {ReactNativeWebView: {postMessage(raw: string) {
      const message = JSON.parse(raw)
      requests.push(message)
      if (message.action === 'consultation.send' && defer) {
        Object.assign(window, {pendingConsultation: message}); return
      }
      if (message.action === 'feedback.save') {
        setTimeout(() => (window as unknown as {__palmeraReceive(value: unknown): void}).__palmeraReceive({version: 1, id: message.id, ok: false, error: {status: 501, message: 'Feedback pendiente de integración'}}), 0)
        return
      }
      let result: unknown = null
      if (message.action === 'session.get') result = hasSession ? reg : null
      if (message.action === 'registration.create' || message.action === 'profile.update') result = reg
      if (message.action === 'documents.list') result = [{document_id: 'guide', title: 'Guía sintética', description: 'Documento de prueba', document_type: 'pdf', file_size: 1, pdf_available: true}]
      if (message.action === 'consultation.send') result = {answer: '**Respuesta de prueba**\n\n- Primer punto\n\n| Columna | Valor |\n|---|---|\n| Uno | Dos |', sources: [{document_id: 'guide', title: 'Guía sintética', page: 3, content_preview: 'Fragmento de prueba'}], has_context: true, log_id: 'mobile-synthetic'}
      if (message.action === 'feedback.save') result = {log_id: message.payload.log_id, rating: message.payload.rating, comment: message.payload.comment ?? null, feedback_at: new Date().toISOString()}
      setTimeout(() => (window as unknown as {__palmeraReceive(value: unknown): void}).__palmeraReceive({version: 1, id: message.id, ok: true, result}), 0)
    }}})
  }, {reg: registration, hasSession: registered, defer: deferConsultation})
  await page.goto('/')
}

test('registration and consent keep the staging screens and call the registration adapter', async ({page}) => {
  await bootstrap(page, false)
  await expect(page.getByRole('heading', {name: 'Ingresá tus datos para empezar'})).toBeVisible()
  await expect(page.getByRole('textbox', {name: 'ID de acceso'})).toHaveCount(0)
  await page.getByLabel('Nombre *').fill(registration.nombre)
  await page.getByLabel('Mail *').fill(registration.mail)
  await page.getByLabel('País *').selectOption('AR')
  await page.getByLabel('Provincia *').selectOption('Buenos Aires')
  await page.getByLabel('Efector de salud *').fill(registration.efector)
  await page.getByLabel('Disciplina/especialidad *').fill(registration.disciplina)
  await page.getByRole('button', {name: 'Ingresar', exact: true}).click()
  await expect(page.getByRole('heading', {name: 'Cómo usar esta plataforma'})).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as unknown as {testRequests: {action: string; payload: object}[]}).testRequests.find(r => r.action === 'registration.create')?.payload)).toMatchObject({consent_aceptado: true, pais: 'AR'})
})

test('chat uses local transport, renders Markdown and retains the conversation between tabs', async ({page}) => {
  await bootstrap(page)
  await page.getByRole('button', {name: 'Chatbot Consulta directa'}).click()
  await page.getByRole('textbox', {name: 'Escribí tu consulta'}).fill('Pregunta sintética')
  await page.getByRole('button', {name: 'Enviar consulta'}).click()
  await expect(page.locator('.fh-answer strong')).toHaveText('Respuesta de prueba')
  await expect(page.locator('.fh-answer table')).toBeVisible()
  await page.getByRole('button', {name: '1. Guía sintética · pág. 3'}).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as {testRequests: {action: string}[]}).testRequests.some(r => r.action === 'document.open'))).toBe(true)
  await page.getByRole('button', {name: 'Guías', exact: true}).click()
  await expect(page.getByRole('heading', {name: 'Guías y documentos'})).toBeVisible()
  await expect(page.getByRole('button', {name: /Guardar (guía|fragmento)/i})).toHaveCount(0)
  await page.getByRole('button', {name: 'Consulta', exact: true}).click()
  await page.getByRole('button', {name: 'Chatbot Consulta directa'}).click()
  await expect(page.locator('.fh-answer strong')).toHaveText('Respuesta de prueba')
  await page.getByRole('button', {name: 'Respuesta útil', exact: true}).click()
  await expect(page.getByText('¡Gracias por tu feedback!')).not.toBeVisible()
  const brokenImages = await page.locator('img').evaluateAll(images => images.filter(img => !img.complete || img.naturalWidth === 0).length)
  expect(brokenImages).toBe(0)
  await expect(page.evaluate(() => document.fonts.check('14px "FH Poppins"'))).resolves.toBe(true)
})


test('partial answers appear before completion and a late final answer is not discarded', async ({page}) => {
  await page.clock.install()
  await bootstrap(page, true, true)
  await page.getByRole('button', {name: 'Chatbot Consulta directa'}).click()
  await page.getByRole('textbox', {name: 'Escribí tu consulta'}).fill('Pregunta sintética')
  await page.getByRole('button', {name: 'Enviar consulta'}).click()
  await page.evaluate(() => {
    const w = window as unknown as {pendingConsultation: {id: string}; __palmeraProgress(value: unknown): void}
    w.__palmeraProgress({version: 1, id: w.pendingConsultation.id, answer: 'Texto parcial sintético', sources: []})
  })
  await expect(page.locator('.fh-answer')).toContainText('Texto parcial sintético')
  await page.clock.fastForward(660000)
  await expect(page.getByRole('button', {name: 'Reintentar', exact: true})).toHaveCount(0)
  await page.evaluate(() => {
    const w = window as unknown as {pendingConsultation: {id: string}; __palmeraReceive(value: unknown): void}
    w.__palmeraReceive({version: 1, id: w.pendingConsultation.id, ok: true, result: {answer: 'Respuesta completa sintética', sources: [], has_context: false, log_id: 'synthetic'}})
  })
  await expect(page.locator('.fh-answer')).toHaveCount(1)
  await expect(page.locator('.fh-answer')).toContainText('Respuesta completa sintética')
})
