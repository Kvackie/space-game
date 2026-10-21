/**
 * Ship rules shared by mining, expeditions and the screens. A ship is a
 * container: its hull's baseline stats plus its gear and its captain (D-45).
 */

import { CAPTAINS, GEAR, HULLS, type HullDef, type StatId, type Stats } from '../data'
import type { GameState, Ship } from './state'

export const hullOf = (ship: Ship): HullDef => HULLS[ship.hull]

/** Baseline + fitted gear + assigned captain. Stats a hull lacks stay absent (D-66). */
export function shipStats(state: GameState, ship: Ship): Stats {
  const stats: Stats = { ...hullOf(ship).stats }
  const add = (bonus: Stats) => {
    for (const [id, value] of Object.entries(bonus) as [StatId, number][]) {
      if (stats[id] !== undefined) stats[id] = stats[id]! + value
    }
  }
  for (const gearId of ship.gear) {
    const item = gearId && state.gear.find((g) => g.id === gearId)
    if (item) add(GEAR[item.type].bonus)
  }
  const captain = ship.captainId && state.captains.find((c) => c.id === ship.captainId)
  if (captain) add(CAPTAINS[captain.def].bonus)
  return stats
}

/** Ships away on a mining run or an expedition. */
export function busyShipIds(state: GameState): Set<string> {
  const busy = new Set<string>()
  for (const timer of state.timers) {
    for (const id of (timer.data?.shipIds as string[] | undefined) ?? []) busy.add(id)
  }
  return busy
}

export const isIdle = (state: GameState, ship: Ship) => !busyShipIds(state).has(ship.id)
