/**
 * Screen scaling (D-48).
 *
 * The UI is designed on a 1280×720 (16:9) core. The game area fills the
 * viewport between 4:3 and 21:9 and letterboxes beyond that. The UI scales
 * with the game area, anchored to its edges, and stops shrinking below the
 * minimum supported screen (D-47).
 */

export interface Size {
  width: number
  height: number
}

export interface Layout {
  /** The game area inside the viewport, in CSS px. */
  x: number
  y: number
  width: number
  height: number
  /** UI scale relative to the 1280×720 design core. */
  uiScale: number
}

export const DESIGN: Size = { width: 1280, height: 720 }
export const MIN_ASPECT = 4 / 3
export const MAX_ASPECT = 21 / 9

/**
 * Smallest supported viewport in CSS px, landscape. Approximates a Samsung S24
 * in a browser; to be confirmed by measuring on the device.
 */
export const MIN_VIEWPORT: Size = { width: 780, height: 360 }

const scaleFor = (size: Size) => Math.min(size.width / DESIGN.width, size.height / DESIGN.height)

export function computeLayout(viewport: Size): Layout {
  const { width: w, height: h } = viewport
  const aspect = w / h

  let width = w
  let height = h
  if (aspect > MAX_ASPECT) width = h * MAX_ASPECT
  else if (aspect < MIN_ASPECT) height = w / MIN_ASPECT

  return {
    x: (w - width) / 2,
    y: (h - height) / 2,
    width,
    height,
    uiScale: Math.max(scaleFor({ width, height }), scaleFor(MIN_VIEWPORT)),
  }
}

/**
 * Positions the game area element and sets the root font size, so UI sized
 * in rem scales with the screen (1rem = 16 design px).
 */
export function applyLayout(gameArea: HTMLElement, layout: Layout): void {
  Object.assign(gameArea.style, {
    left: `${layout.x}px`,
    top: `${layout.y}px`,
    width: `${layout.width}px`,
    height: `${layout.height}px`,
  })
  document.documentElement.style.fontSize = `${16 * layout.uiScale}px`
}
