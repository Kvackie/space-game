/**
 * The test harness overlay: scene switcher, ship-count ramp, bloom toggle,
 * live stats and the benchmark runner. It is the same DOM on every stack and
 * is not part of what is being compared.
 */

import { BENCH_SHIP_COUNTS, FrameStats, heapMB, runBench, type BenchResult } from './bench'
import { SCENES, type SceneId } from './scenes'
import { DEFAULT_SHIPS, type StackApp } from './stack'

declare global {
  interface Window {
    __bench?: BenchResult[]
    __benchDone?: boolean
  }
}

const LABELS: Record<SceneId, string> = { ship: 'Ship', station: 'Station', battle: 'Battle' }

export function createHud(app: StackApp, stats: FrameStats, onSceneChange?: (id: SceneId) => void): void {
  const root = document.createElement('div')
  root.className = 'hud'
  root.innerHTML = `
    <div class="hud-head">
      <a href="../" class="hud-back">←</a>
      <strong>${app.name}</strong>
      <button class="hud-toggle" title="Collapse">–</button>
    </div>
    <div class="hud-body">
      <div class="hud-scenes">${SCENES.map((s) => `<button data-scene="${s}">${LABELS[s]}</button>`).join('')}</div>
      <label class="hud-ships">Ships <input type="range" min="2" max="${Math.max(...BENCH_SHIP_COUNTS)}" step="2" value="${DEFAULT_SHIPS}"><span>${DEFAULT_SHIPS}</span></label>
      <label><input type="checkbox" class="hud-bloom" checked> Bloom</label>
      <pre class="hud-stats"></pre>
      <button class="hud-bench">Run benchmark (~55 s)</button>
      <div class="hud-results"></div>
    </div>`
  document.body.appendChild(root)

  const $ = <T extends Element>(sel: string) => root.querySelector<T>(sel)!
  const sceneButtons = root.querySelectorAll<HTMLButtonElement>('[data-scene]')
  const shipsLabel = $<HTMLLabelElement>('.hud-ships')
  const slider = $<HTMLInputElement>('.hud-ships input')
  const sliderValue = $<HTMLSpanElement>('.hud-ships span')
  const statsEl = $<HTMLPreElement>('.hud-stats')
  const benchButton = $<HTMLButtonElement>('.hud-bench')
  const resultsEl = $<HTMLDivElement>('.hud-results')

  const markScene = (id: SceneId) => {
    sceneButtons.forEach((b) => b.classList.toggle('active', b.dataset.scene === id))
    shipsLabel.style.display = id === 'battle' ? '' : 'none'
    onSceneChange?.(id)
  }
  const showScene = async (id: SceneId) => {
    markScene(id)
    await app.setScene(id)
  }

  sceneButtons.forEach((b) => b.addEventListener('click', () => showScene(b.dataset.scene as SceneId)))
  slider.addEventListener('input', () => {
    sliderValue.textContent = slider.value
    app.setShipCount(Number(slider.value))
  })
  $<HTMLInputElement>('.hud-bloom').addEventListener('change', (e) => app.setBloom((e.target as HTMLInputElement).checked))
  $<HTMLButtonElement>('.hud-toggle').addEventListener('click', () => root.classList.toggle('collapsed'))

  const bench = async () => {
    benchButton.disabled = true
    const results = await runBench(app, stats, (step) => {
      benchButton.textContent = `Measuring ${step}…`
      const [scene, n] = step.split(' × ')
      markScene(scene as SceneId)
      if (n) {
        slider.value = n
        sliderValue.textContent = n
      }
    })
    window.__bench = results
    window.__benchDone = true
    resultsEl.innerHTML = renderResults(results)
    benchButton.textContent = 'Run benchmark (~55 s)'
    benchButton.disabled = false
  }
  benchButton.addEventListener('click', bench)

  setInterval(() => {
    const s = stats.summary()
    const info = app.info()
    const heap = heapMB()
    statsEl.textContent = [
      `fps      ${s.fps.toFixed(0)}  (1% low ${s.low1.toFixed(0)})`,
      `frame    ${s.ms.toFixed(2)} ms`,
      `cpu      ${s.cpuMs.toFixed(2)} ms  (p99 ${s.cpuP99.toFixed(2)})`,
      `draws    ${info.drawCalls}   tris ${info.triangles.toLocaleString()}`,
      `heap     ${heap === null ? 'n/a' : heap.toFixed(0) + ' MB'}`,
      `1st frame ${stats.firstFrameMs === null ? '…' : stats.firstFrameMs.toFixed(0) + ' ms'}`,
    ].join('\n')
  }, 250)

  showScene('ship').then(() => {
    if (new URLSearchParams(location.search).has('bench')) bench()
  })
}

function renderResults(results: BenchResult[]): string {
  const rows = results
    .map(
      (r) =>
        `<tr><td>${r.scene}${r.ships ? ' ×' + r.ships : ''}</td><td>${r.fps.toFixed(0)}</td><td>${r.low1.toFixed(0)}</td><td>${r.cpuMs.toFixed(2)}</td><td>${r.drawCalls}</td><td>${r.heapMB?.toFixed(0) ?? '–'}</td></tr>`,
    )
    .join('')
  return `<table><tr><th>scene</th><th>fps</th><th>1% low</th><th>cpu ms</th><th>draws</th><th>MB</th></tr>${rows}</table>`
}
