/**
 * The whole saved game. Later build steps add ships, captains and so on; each
 * addition bumps SAVE_VERSION and adds a migration in save/saveFile.ts.
 */

export const RESOURCE_IDS = ['ore1', 'ore2', 'rareResource', 'pullCurrency'] as const
export type ResourceId = (typeof RESOURCE_IDS)[number]

/**
 * Anything that finishes after a delay: mining runs, refining, building,
 * expeditions (D-71). Timers keep counting while the game is closed because
 * they store wall-clock times, not elapsed play time.
 */
export interface Timer {
  id: string
  /** What finishing means; handlers are registered per kind. */
  kind: string
  /** Device clock, ms since epoch. */
  startedAt: number
  durationMs: number
  /** Kind-specific details, e.g. which ship and which ore field. */
  data?: Record<string, unknown>
}

export interface GameState {
  version: number
  createdAt: number
  savedAt: number
  resources: Record<ResourceId, number>
  timers: Timer[]
  /** Counter for unique ids (timers, later ships and captains). */
  nextId: number
}

export function newGame(now: number): GameState {
  return {
    version: 1,
    createdAt: now,
    savedAt: now,
    // no starting resources (D-86)
    resources: { ore1: 0, ore2: 0, rareResource: 0, pullCurrency: 0 },
    timers: [],
    nextId: 1,
  }
}

export const timerEndsAt = (timer: Timer) => timer.startedAt + timer.durationMs
