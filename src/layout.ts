/**
 * Screen scaling (D-48).
 *
 * The UI is designed on a 1280×720 (16:9) core. The game area fills the
 * viewport between 4:3 and 21:9 and letterboxes beyond that. The UI scales up
 * with the game area, anchored to its edges, but never below its design size,
 * so text stays readable on phones and takes a bigger share of small screens
 * (D-96). No UI text is designed below MIN_TEXT_PX.
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

/** The UI never renders smaller than its design size (D-96); to be confirmed on the S24. */
export const MIN_UI_SCALE = 1

/** Smallest text size any UI may use, in design px (0.75rem). */
export const MIN_TEXT_PX = 12

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
    uiScale: Math.max(scaleFor({ width, height }), MIN_UI_SCALE),
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
