/**
 * The whole saved game. Each format change bumps SAVE_VERSION and adds a
 * migration in save/saveFile.ts.
 */

import { HULLS, STARTING_SHIP } from '../data'
import type { CombatantInit } from './battle'

export const RESOURCE_IDS = [
  'ore1',
  'ore2',
  'material1',
  'material2',
  'component',
  'rareResource',
  'pullCurrency',
] as const
export type ResourceId = (typeof RESOURCE_IDS)[number]

/**
 * Anything that finishes after a delay: mining runs, crafting, expeditions
 * (D-71). Timers store wall-clock times, so they keep counting while the game
 * is closed.
 */
export interface Timer {
  id: string
  /** What finishing means; handlers are registered per kind. */
  kind: string
  /** Device clock, ms since epoch. */
  startedAt: number
  durationMs: number
  /** Kind-specific details, e.g. which ships and which ore field. */
  data?: Record<string, unknown>
}

export interface Ship {
  id: string
  hull: string
  name: string
  /** One entry per gear slot: a gear item id or null. */
  gear: (string | null)[]
  captainId: string | null
}

export interface GearItem {
  id: string
  type: string
}

export interface Captain {
  id: string
  def: string
  /** Limit Break material from duplicates of this captain (D-108); spent once captain levelling exists. */
  limitBreakMaterial: number
}

/** One captain pulled, for the pull history (D-109). Newest first. */
export interface PullRecord {
  at: number
  def: string
  duplicate: boolean
}

export interface BattleRecord {
  id: string
  /** When the battle happened (the expedition's end). */
  at: number
  seed: number
  /** Both sides exactly as they entered battle, so it can be replayed. */
  fighters: CombatantInit[]
  won: boolean
  rewards: Partial<Record<ResourceId, number>>
}

export interface Settings {
  quality: 'high' | 'low'
  showFps: boolean
}

export interface GameState {
  version: number
  createdAt: number
  savedAt: number
  resources: Record<ResourceId, number>
  timers: Timer[]
  ships: Ship[]
  gear: GearItem[]
  captains: Captain[]
  gacha: { pity: number; history: PullRecord[] }
  battles: BattleRecord[]
  settings: Settings
  /** Counter for unique ids (timers, ships, gear, captains, battles). */
  nextId: number
}

export const DEFAULT_SETTINGS: Settings = { quality: 'high', showFps: false }

export function newId(state: GameState, prefix: string): string {
  return `${prefix}${state.nextId++}`
}

export function createShip(state: GameState, hull: string): Ship {
  const def = HULLS[hull]
  const count = state.ships.filter((s) => s.hull === hull).length + 1
  const ship: Ship = {
    id: newId(state, 's'),
    hull,
    name: `${def.name} ${count}`,
    gear: Array<string | null>(def.gearSlots).fill(null),
    captainId: null,
  }
  state.ships.push(ship)
  return ship
}

export function newGame(now: number): GameState {
  const state: GameState = {
    version: 3,
    createdAt: now,
    savedAt: now,
    // no starting resources (D-86)
    resources: Object.fromEntries(RESOURCE_IDS.map((id) => [id, 0])) as Record<ResourceId, number>,
    timers: [],
    ships: [],
    gear: [],
    captains: [],
    gacha: { pity: 0, history: [] },
    battles: [],
    settings: { ...DEFAULT_SETTINGS },
    nextId: 1,
  }
  // one free starting ship (D-64, D-86)
  createShip(state, STARTING_SHIP)
  return state
}

export const timerEndsAt = (timer: Timer) => timer.startedAt + timer.durationMs
