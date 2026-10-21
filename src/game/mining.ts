/**
 * Mining runs (D-70, D-87): send one idle, mining-capable ship to one of two
 * ore fields; it returns with ore when the timer ends, also while the game is
 * closed (D-71).
 */

import { MINING } from '../data'
import { startTimer, type GameClock } from './clock'
import { hullOf, isIdle, shipStats } from './ships'
import type { GameState, Ship } from './state'

export const MINING_TIMER = 'mining'
export const ORE_FIELDS = ['ore1', 'ore2'] as const
export type OreField = (typeof ORE_FIELDS)[number]

export const miningRuns = (state: GameState) => state.timers.filter((t) => t.kind === MINING_TIMER)

/** Ore one run brings back: mining yield per minute × run length, capped by cargo. */
export function miningYield(state: GameState, ship: Ship): number {
  const stats = shipStats(state, ship)
  const perRun = Math.floor((stats.miningYield ?? 0) * (MINING.runSeconds / 60))
  return Math.min(stats.cargo ?? 0, perRun)
}

export function cannotMine(state: GameState, shipId: string): string | null {
  const ship = state.ships.find((s) => s.id === shipId)
  if (!ship) return 'Unknown ship'
  if (!hullOf(ship).canMine) return 'This ship cannot mine'
  if (!isIdle(state, ship)) return 'Ship is busy'
  return null
}

export function startMining(state: GameState, shipId: string, field: OreField, now: number): void {
  const reason = cannotMine(state, shipId)
  if (reason) throw new Error(reason)
  const ship = state.ships.find((s) => s.id === shipId)!
  // the haul is fixed at departure, so refitting mid-run changes nothing
  startTimer(state, MINING_TIMER, MINING.runSeconds * 1000, now, {
    shipIds: [shipId],
    field,
    amount: miningYield(state, ship),
  })
}

export function registerMining(clock: GameClock): void {
  clock.on(MINING_TIMER, (state, timer) => {
    const field = timer.data?.field as OreField
    if (ORE_FIELDS.includes(field)) state.resources[field] += Number(timer.data?.amount) || 0
  })
}
