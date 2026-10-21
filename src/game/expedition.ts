/**
 * The slice's expedition (D-72): send combat-capable ships in a formation;
 * when the timer ends one auto-battle is fought against a fixed enemy group.
 * Winning pays pull currency and the rare resource (D-17); losing pays
 * nothing and the ships return unharmed, free to try again (D-88).
 */

import { ENEMIES, ENEMY_GROUP, EXPEDITION, HULLS, type Row } from '../data'
import { simulateBattle, type CombatantInit } from './battle'
import { startTimer, type GameClock } from './clock'
import { hullOf, isIdle, shipStats } from './ships'
import { newId, timerEndsAt, type GameState, type ResourceId } from './state'

export const EXPEDITION_TIMER = 'expedition'

/** Battle records kept for replays; older ones are dropped to keep saves small. */
const KEEP_BATTLES = 10

export interface FormationSlot {
  shipId: string
  row: Row
}

export const activeExpedition = (state: GameState) => state.timers.find((t) => t.kind === EXPEDITION_TIMER)

export function cannotSendExpedition(state: GameState, formation: FormationSlot[]): string | null {
  if (activeExpedition(state)) return 'An expedition is already out'
  if (!formation.length) return 'Choose at least one ship'
  if (formation.length > EXPEDITION.maxShips) return `At most ${EXPEDITION.maxShips} ships`
  for (const { shipId } of formation) {
    const ship = state.ships.find((s) => s.id === shipId)
    if (!ship) return 'Unknown ship'
    if (!hullOf(ship).canFight) return `${ship.name} cannot fight`
    if (!isIdle(state, ship)) return `${ship.name} is busy`
  }
  return null
}

/** The enemy group as combatants. */
export function enemyFighters(): CombatantInit[] {
  return ENEMY_GROUP.map(({ enemy, row }, i) => {
    const def = ENEMIES[enemy]
    return {
      id: `enemy${i + 1}`,
      name: def.name,
      side: 'enemy',
      row,
      hp: def.stats.hp ?? 0,
      defence: def.stats.defence ?? 0,
      firepower: def.stats.firepower ?? 0,
      skill: null,
    }
  })
}

export function startExpedition(state: GameState, formation: FormationSlot[], now: number): void {
  const reason = cannotSendExpedition(state, formation)
  if (reason) throw new Error(reason)
  // ships cannot be refitted while away, but snapshot them anyway so the battle
  // matches exactly what left the station
  const fighters: CombatantInit[] = formation.map(({ shipId, row }) => {
    const ship = state.ships.find((s) => s.id === shipId)!
    const stats = shipStats(state, ship)
    return {
      id: ship.id,
      name: ship.name,
      side: 'player',
      row,
      hp: stats.hp ?? 0,
      defence: stats.defence ?? 0,
      firepower: stats.firepower ?? 0,
      skill: HULLS[ship.hull].innateSkill,
    }
  })
  startTimer(state, EXPEDITION_TIMER, EXPEDITION.seconds * 1000, now, {
    shipIds: formation.map((f) => f.shipId),
    fighters,
    seed: Math.floor(now % 2147483647) ^ state.nextId,
  })
}

export function registerExpedition(clock: GameClock): void {
  clock.on(EXPEDITION_TIMER, (state, timer) => {
    const seed = Number(timer.data?.seed) || 0
    const fighters = [...((timer.data?.fighters as CombatantInit[]) ?? []), ...enemyFighters()]
    const { won } = simulateBattle(fighters, seed)
    const rewards: Partial<Record<ResourceId, number>> = won ? { ...EXPEDITION.rewards } : {}
    for (const [id, amount] of Object.entries(rewards)) state.resources[id as ResourceId] += amount
    state.battles.unshift({ id: newId(state, 'b'), at: timerEndsAt(timer), seed, fighters, won, rewards })
    state.battles.length = Math.min(state.battles.length, KEEP_BATTLES)
  })
}
