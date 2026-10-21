/**
 * Procedural 2D art shared by every stack, so all three draw identical pixels.
 * Each function returns a canvas that the engine turns into its own texture.
 */

import { rng } from './random'

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!]
}

/** Transparent star layer. Denser, dimmer layers read as further away. */
export function starLayer(seed: number, count: number, maxSize: number): HTMLCanvasElement {
  const [c, g] = canvas(1024, 1024)
  const r = rng(seed)
  for (let i = 0; i < count; i++) {
    const x = r() * 1024
    const y = r() * 1024
    const s = 0.4 + r() * maxSize
    const hue = [210, 190, 280, 40][Math.floor(r() * 4)]
    const grad = g.createRadialGradient(x, y, 0, x, y, s * 3)
    grad.addColorStop(0, `hsla(${hue}, 100%, 95%, 1)`)
    grad.addColorStop(0.3, `hsla(${hue}, 100%, 80%, 0.6)`)
    grad.addColorStop(1, `hsla(${hue}, 100%, 70%, 0)`)
    g.fillStyle = grad
    g.fillRect(x - s * 3, y - s * 3, s * 6, s * 6)
  }
  return c
}

/** Opaque nebula backdrop in the bright anime palette. */
export function nebula(seed: number): HTMLCanvasElement {
  const [c, g] = canvas(2048, 1024)
  const r = rng(seed)
  const base = g.createLinearGradient(0, 0, 0, 1024)
  base.addColorStop(0, '#0d1236')
  base.addColorStop(0.55, '#1b1450')
  base.addColorStop(1, '#0a2347')
  g.fillStyle = base
  g.fillRect(0, 0, 2048, 1024)
  g.globalCompositeOperation = 'lighter'
  const hues = [200, 280, 320, 190, 250]
  for (let i = 0; i < 14; i++) {
    const x = r() * 2048
    const y = 200 + r() * 620
    const rad = 120 + r() * 380
    const hue = hues[Math.floor(r() * hues.length)]
    const grad = g.createRadialGradient(x, y, 0, x, y, rad)
    grad.addColorStop(0, `hsla(${hue}, 90%, 55%, 0.12)`)
    grad.addColorStop(1, `hsla(${hue}, 90%, 50%, 0)`)
    g.fillStyle = grad
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
  }
  return c
}

/** Planet disc with bands and a rim light, drawn as a flat 2D sprite. */
export function planet(): HTMLCanvasElement {
  const [c, g] = canvas(512, 512)
  g.save()
  g.beginPath()
  g.arc(256, 256, 240, 0, Math.PI * 2)
  g.clip()
  const body = g.createLinearGradient(0, 0, 512, 512)
  body.addColorStop(0, '#7fd8ff')
  body.addColorStop(0.5, '#4b6fe0')
  body.addColorStop(1, '#2a1f6b')
  g.fillStyle = body
  g.fillRect(0, 0, 512, 512)
  g.globalAlpha = 0.25
  for (let i = 0; i < 9; i++) {
    g.fillStyle = i % 2 ? '#ffffff' : '#a46cff'
    g.fillRect(0, 60 + i * 46, 512, 14 + (i % 3) * 8)
  }
  g.globalAlpha = 1
  const shade = g.createRadialGradient(150, 150, 60, 256, 256, 300)
  shade.addColorStop(0, 'rgba(0,0,0,0)')
  shade.addColorStop(1, 'rgba(5,5,30,0.85)')
  g.fillStyle = shade
  g.fillRect(0, 0, 512, 512)
  g.restore()
  g.strokeStyle = 'rgba(160,230,255,0.9)'
  g.lineWidth = 6
  g.beginPath()
  g.arc(256, 256, 238, Math.PI * 0.9, Math.PI * 1.6)
  g.stroke()
  return c
}

/** Soft round glow for engines, hits and explosions. */
export function glow(): HTMLCanvasElement {
  const [c, g] = canvas(128, 128)
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.25, 'rgba(255,255,255,0.7)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return c
}

export const EXPLOSION_FRAMES = 8

/** Horizontal flipbook strip of an explosion, EXPLOSION_FRAMES frames of 128 px. */
export function explosionStrip(): HTMLCanvasElement {
  const [c, g] = canvas(128 * EXPLOSION_FRAMES, 128)
  const r = rng(7)
  for (let f = 0; f < EXPLOSION_FRAMES; f++) {
    const t = f / (EXPLOSION_FRAMES - 1)
    const cx = f * 128 + 64
    const rad = 18 + t * 44
    g.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 9; i++) {
      const a = r() * Math.PI * 2
      const d = r() * rad * 0.5
      const x = cx + Math.cos(a) * d
      const y = 64 + Math.sin(a) * d
      const pr = rad * (0.4 + r() * 0.5)
      const grad = g.createRadialGradient(x, y, 0, x, y, pr)
      const alpha = (1 - t) * 0.8
      grad.addColorStop(0, `rgba(255,250,220,${alpha})`)
      grad.addColorStop(0.4, `rgba(255,150,60,${alpha * 0.8})`)
      grad.addColorStop(1, 'rgba(255,60,120,0)')
      g.fillStyle = grad
      g.fillRect(x - pr, y - pr, pr * 2, pr * 2)
    }
  }
  return c
}
