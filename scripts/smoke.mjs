// Prueba de humo de la Fase 1 en un navegador real (Chromium vía playwright-core).
// Requiere un servidor ya levantado: `npm run build && npx vite preview --port 4173 --strictPort`.
// Uso: `npm run smoke` (o SMOKE_URL=http://host:puerto/ npm run smoke).
// Imprime PASS/FAIL por paso, guarda capturas en .smoke/ y sale con código 1 si algo falla.
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const URL_APP = process.env.SMOKE_URL || 'http://localhost:4173/'
const DIR = fileURLToPath(new URL('../.smoke/', import.meta.url))
const ESPERA = 15_000

const resultados = []

/** Ejecuta un paso, registra PASS/FAIL y devuelve si pasó. */
async function paso(grupo, nombre, fn) {
  const t0 = Date.now()
  try {
    const nota = await fn()
    resultados.push({ grupo, nombre, ok: true })
    console.log(`  PASS  ${nombre}${nota ? ` (${nota})` : ''} · ${Date.now() - t0} ms`)
    return true
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).split('\n')[0]
    resultados.push({ grupo, nombre, ok: false, msg })
    console.log(`  FAIL  ${nombre}: ${msg}`)
    return false
  }
}

function afirmar(cond, msg) {
  if (!cond) throw new Error(msg)
}

/** Registra errores de consola y excepciones de la página. */
function vigilarErrores(page) {
  page.setDefaultTimeout(10_000)
  const errores = []
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(`console.error: ${m.text()}`)
  })
  page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`))
  return errores
}

async function sinScrollHorizontal(page) {
  const { sw, iw } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth,
  }))
  afirmar(sw <= iw + 1, `scrollWidth ${sw} > innerWidth ${iw}`)
  return `scrollWidth ${sw}, innerWidth ${iw}`
}

async function cargar(page) {
  await page.goto(URL_APP, { waitUntil: 'domcontentloaded', timeout: ESPERA })
  await page.locator('[data-testid="plan-view"] svg').first().waitFor({ state: 'visible', timeout: ESPERA })
}

const panel = (page) => page.locator('[data-testid="side-panel"]')

async function escritorio(browser) {
  const G = 'escritorio'
  console.log('\nEscritorio 1440x900')
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' })
  const page = await ctx.newPage()
  const errores = vigilarErrores(page)

  const listo = await paso(G, 'Carga la app: plano 2D y al menos 35 nodos en el diagrama', async () => {
    await cargar(page)
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="process-view"] .react-flow__node').length >= 35,
      null,
      { timeout: ESPERA },
    )
    const nodos = await page.locator('[data-testid="process-view"] .react-flow__node').count()
    const zonas = await page.locator('[data-testid="plan-view"] [data-zona-id]').count()
    return `${nodos} nodos, ${zonas} zonas`
  })
  if (!listo) {
    await ctx.close()
    return
  }

  await paso(G, 'Testids de cabecera, barra y leyenda presentes', async () => {
    const ids = ['header', 'badge-fuente', 'alarmas-boton', 'tema-boton', 'toolbar', 'kpi-bar', 'legend']
    for (const id of ids) {
      afirmar((await page.locator(`[data-testid="${id}"]`).count()) > 0, `falta data-testid="${id}"`)
    }
    const fuente = (await page.locator('[data-testid="badge-fuente"]').innerText()).trim()
    return `fuente: ${fuente}`
  })

  await paso(G, 'Clic en la zona z-decorado abre el panel con "Decorado"', async () => {
    await page.locator('[data-testid="plan-view"] [data-zona-id="z-decorado"]').first().click()
    await panel(page).waitFor({ state: 'visible', timeout: 5000 })
    const texto = await panel(page).innerText()
    afirmar(texto.includes('Decorado'), 'el panel no contiene "Decorado"')
    // Sincronía con el diagrama: las etapas de la zona quedan marcadas.
    const marcadas = await page.locator('[data-testid="process-view"] [role="button"][aria-pressed="true"]').count()
    afirmar(marcadas > 0, 'el diagrama no resalta ninguna etapa de la zona')
    return `${marcadas} etapa(s) resaltadas en el diagrama`
  })

  await paso(G, 'Clic en el nodo 2.5 muestra "Impresión digital" en el panel', async () => {
    await page.locator('[data-testid="process-view"] .react-flow__node[data-id="2.5"]').click()
    await page.waitForFunction(
      () => document.querySelector('[data-testid="side-panel"]')?.textContent?.includes('Impresión digital'),
      null,
      { timeout: 5000 },
    )
    // Sincronía con el plano: la zona de la etapa queda resaltada.
    const resaltes = await page.locator('[data-testid="plan-view"] [data-resalte-zona]').count()
    afirmar(resaltes > 0, 'el plano no resalta la zona de la etapa 2.5')
    return `${resaltes} zona(s) resaltadas en el plano`
  })

  await paso(G, 'Ruta R7: overlay en el plano y aristas atenuadas en el diagrama', async () => {
    await page.locator('[data-ruta="R7"]').click()
    await page.locator('[data-testid="ruta-overlay"]').first().waitFor({ state: 'attached', timeout: 5000 })
    const pulsado = await page.locator('[data-ruta="R7"]').getAttribute('aria-pressed')
    afirmar(pulsado === 'true', 'el chip R7 no quedó pulsado')
    const atenuadas = await page.locator('[data-testid="process-view"] .react-flow__edge.opacity-20').count()
    afirmar(atenuadas > 0, 'el diagrama no atenúa las aristas fuera de la ruta')
    return `${atenuadas} aristas atenuadas`
  })

  await paso(G, 'Esc cierra el panel', async () => {
    await page.keyboard.press('Escape')
    await panel(page).waitFor({ state: 'detached', timeout: 5000 })
  })

  await paso(G, 'Captura escritorio-claro.png', async () => {
    await page.screenshot({ path: `${DIR}escritorio-claro.png`, fullPage: true })
  })

  await paso(G, 'El botón de tema llega a oscuro (html.dark)', async () => {
    for (let i = 0; i < 3; i++) {
      if (await page.evaluate(() => document.documentElement.classList.contains('dark'))) break
      await page.locator('[data-testid="tema-boton"]').click()
    }
    const oscuro = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    afirmar(oscuro, '<html> no tiene la clase dark tras 3 clics')
  })

  await paso(G, 'El KPI prod_turno muestra un número tras unos ticks', async () => {
    await page.waitForTimeout(3000)
    const valor = (await page.locator('[data-kpi="prod_turno"] p').first().innerText()).trim()
    afirmar(/^\d[\d.,\s]*(\S+)?$/.test(valor), `valor no numérico: "${valor}"`)
    return `prod_turno = ${valor}`
  })

  await paso(G, 'Captura escritorio-oscuro.png', async () => {
    await page.screenshot({ path: `${DIR}escritorio-oscuro.png`, fullPage: true })
  })

  await paso(G, 'Sin errores de consola ni de página', async () => {
    afirmar(errores.length === 0, `${errores.length} error(es): ${errores.slice(0, 3).join(' | ')}`)
  })
  await ctx.close()
}

async function movil(browser) {
  const G = 'movil'
  console.log('\nMóvil 390x844 (deviceScaleFactor 2)')
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'light',
  })
  const page = await ctx.newPage()
  const errores = vigilarErrores(page)

  const listo = await paso(G, 'Carga la app en la pestaña Planta', async () => {
    await cargar(page)
    await page.locator('[data-testid="kpi-bar"] [data-kpi]').first().waitFor({ state: 'visible', timeout: ESPERA })
  })
  if (!listo) {
    await ctx.close()
    return
  }

  await paso(G, 'Sin scroll horizontal (Planta)', () => sinScrollHorizontal(page))

  await paso(G, 'Captura movil-planta.png', async () => {
    await page.screenshot({ path: `${DIR}movil-planta.png`, fullPage: true })
  })

  await paso(G, 'La pestaña Proceso muestra el diagrama', async () => {
    await page.locator('[data-vista="proceso"]').click()
    await page.locator('[data-testid="process-view"]').waitFor({ state: 'visible', timeout: 5000 })
    await page.locator('[data-testid="process-view"] .react-flow__node').first().waitFor({ state: 'visible', timeout: 5000 })
    afirmar(!(await page.locator('[data-testid="plan-view"]').isVisible()), 'el plano sigue visible')
    // El diagrama se reencuadra al mostrarse: algún nodo de etapa queda dentro del lienzo.
    await page.waitForTimeout(500)
    const visibles = await page.evaluate(() => {
      const lienzo = document.querySelector('[data-testid="process-view"] .react-flow')?.getBoundingClientRect()
      if (!lienzo || lienzo.width === 0) return 0
      return [...document.querySelectorAll('[data-testid="process-view"] .react-flow__node-etapa')].filter((n) => {
        const r = n.getBoundingClientRect()
        return r.right > lienzo.left && r.left < lienzo.right && r.bottom > lienzo.top && r.top < lienzo.bottom
      }).length
    })
    afirmar(visibles > 0, 'ningún nodo de etapa dentro del lienzo')
    return `${visibles} nodos de etapa a la vista`
  })

  await paso(G, 'Sin scroll horizontal (Proceso)', () => sinScrollHorizontal(page))

  await paso(G, 'Captura movil-proceso.png', async () => {
    await page.screenshot({ path: `${DIR}movil-proceso.png`, fullPage: true })
  })

  await paso(G, 'Tocar una zona abre el panel (hoja inferior)', async () => {
    await page.locator('[data-vista="planta"]').click()
    const zona = page.locator('[data-testid="plan-view"] [data-zona-id="z-decorado"]').first()
    await zona.scrollIntoViewIfNeeded()
    await zona.tap()
    await panel(page).waitFor({ state: 'visible', timeout: 5000 })
    const texto = await panel(page).innerText()
    afirmar(texto.includes('Decorado'), 'el panel no contiene "Decorado"')
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${DIR}movil-panel.png` })
  })

  await paso(G, 'Sin scroll horizontal (panel abierto)', () => sinScrollHorizontal(page))

  await paso(G, 'Sin errores de consola ni de página', async () => {
    afirmar(errores.length === 0, `${errores.length} error(es): ${errores.slice(0, 3).join(' | ')}`)
  })
  await ctx.close()
}

async function main() {
  await mkdir(DIR, { recursive: true })
  console.log(`Prueba de humo contra ${URL_APP}`)
  let browser
  try {
    browser = await chromium.launch()
  } catch (e) {
    console.error(`FAIL  No se pudo lanzar Chromium: ${e instanceof Error ? e.message : e}`)
    process.exit(1)
  }
  try {
    await escritorio(browser)
    await movil(browser)
  } finally {
    await browser.close()
  }

  const fallos = resultados.filter((r) => !r.ok)
  console.log('\nResumen')
  for (const g of ['escritorio', 'movil']) {
    const del = resultados.filter((r) => r.grupo === g)
    console.log(`  ${g}: ${del.filter((r) => r.ok).length}/${del.length} PASS`)
  }
  if (fallos.length) {
    console.log(`\nFAIL: ${fallos.length} paso(s) fallaron`)
    for (const f of fallos) console.log(`  - [${f.grupo}] ${f.nombre}: ${f.msg}`)
    process.exit(1)
  }
  console.log(`\nPASS: ${resultados.length} pasos. Capturas en .smoke/`)
}

main().catch((e) => {
  console.error('FAIL  Error inesperado:', e)
  process.exit(1)
})
