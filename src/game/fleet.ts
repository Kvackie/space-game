/**
 * Refitting: gear into slots (D-20, D-67) and one captain per ship (D-68).
 * Ships can only be refitted while docked.
 */

import { hullOf, isIdle } from './ships'
import type { GameState, Ship } from './state'

const findShip = (state: GameState, shipId: string): Ship => {
  const ship = state.ships.find((s) => s.id === shipId)
  if (!ship) throw new Error('Unknown ship')
  return ship
}

/** Gear items not fitted to any ship. */
export function spareGear(state: GameState) {
  const fitted = new Set(state.ships.flatMap((s) => s.gear))
  return state.gear.filter((g) => !fitted.has(g.id))
}

/** Puts a gear item in a slot (moving it off any other ship), or empties the slot with null. */
export function fitGear(state: GameState, shipId: string, slot: number, gearId: string | null): void {
  const ship = findShip(state, shipId)
  if (!isIdle(state, ship)) throw new Error('Ship is away')
  if (slot < 0 || slot >= hullOf(ship).gearSlots) throw new Error('No such slot')
  if (gearId !== null) {
    if (!state.gear.some((g) => g.id === gearId)) throw new Error('Unknown gear')
    for (const other of state.ships) other.gear = other.gear.map((id) => (id === gearId ? null : id))
  }
  ship.gear[slot] = gearId
}

/** Assigns a captain (moving them off any other ship), or removes the ship's captain with null. */
export function assignCaptain(state: GameState, shipId: string, captainId: string | null): void {
  const ship = findShip(state, shipId)
  if (!isIdle(state, ship)) throw new Error('Ship is away')
  if (captainId !== null) {
    if (!state.captains.some((c) => c.id === captainId)) throw new Error('Unknown captain')
    const other = state.ships.find((s) => s.captainId === captainId)
    if (other && !isIdle(state, other)) throw new Error('Captain is away')
    if (other) other.captainId = null
  }
  ship.captainId = captainId
}

export const captainShip = (state: GameState, captainId: string) => state.ships.find((s) => s.captainId === captainId)
