import type { SceneId } from './scenes'

/** What the shared harness needs from each rendering stack. */
export interface StackApp {
  readonly name: string
  setScene(id: SceneId): Promise<void>
  setShipCount(count: number): void
  setBloom(on: boolean): void
  info(): { drawCalls: number; triangles: number }
}

export const DEFAULT_SHIPS = 20
export const MAX_PIXEL_RATIO = 2
