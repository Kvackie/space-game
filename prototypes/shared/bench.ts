/**
 * Frame timing, load timing and the automated benchmark run.
 * Identical for every stack; each stack calls `stats.frame()` once per rendered frame.
 */

import type { SceneId } from './scenes'
import type { StackApp } from './stack'

const WINDOW = 600

export class FrameStats {
  private times = new Float64Array(WINDOW)
  private count = 0
  private last = 0
  firstFrameMs: number | null = null

  frame(now = performance.now()): void {
    if (this.firstFrameMs === null) this.firstFrameMs = now
    if (this.last) {
      this.times[this.count % WINDOW] = now - this.last
      this.count++
    }
    this.last = now
  }

  reset(): void {
    this.count = 0
    this.last = 0
  }

  /** Average fps, "1% low" fps (99th percentile frame time) and average frame time. */
  summary(): { fps: number; low1: number; ms: number; samples: number } {
    const n = Math.min(this.count, WINDOW)
    if (!n) return { fps: 0, low1: 0, ms: 0, samples: 0 }
    const sorted = Array.from(this.times.subarray(0, n)).sort((a, b) => a - b)
    const avg = sorted.reduce((a, b) => a + b, 0) / n
    const p99 = sorted[Math.min(n - 1, Math.floor(n * 0.99))]
    return { fps: 1000 / avg, low1: 1000 / p99, ms: avg, samples: n }
  }
}

/** Chromium-only JS heap size; other browsers report null. */
export function heapMB(): number | null {
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
  return mem ? mem.usedJSHeapSize / 1048576 : null
}

export interface BenchResult {
  stack: string
  scene: SceneId
  ships: number | null
  fps: number
  low1: number
  ms: number
  drawCalls: number
  triangles: number
  heapMB: number | null
}

export const BENCH_SHIP_COUNTS = [20, 50, 100, 200, 400]
const WARMUP = 1500
const MEASURE = 5000

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function runBench(
  app: StackApp,
  stats: FrameStats,
  onStep: (label: string) => void,
): Promise<BenchResult[]> {
  const results: BenchResult[] = []
  const measure = async (scene: SceneId, ships: number | null) => {
    onStep(ships === null ? scene : `${scene} × ${ships}`)
    await wait(WARMUP)
    stats.reset()
    await wait(MEASURE)
    const s = stats.summary()
    results.push({ stack: app.name, scene, ships, fps: s.fps, low1: s.low1, ms: s.ms, ...app.info(), heapMB: heapMB() })
  }

  for (const scene of ['ship', 'station'] as const) {
    await app.setScene(scene)
    await measure(scene, null)
  }
  await app.setScene('battle')
  for (const n of BENCH_SHIP_COUNTS) {
    app.setShipCount(n)
    await measure('battle', n)
  }
  return results
}
