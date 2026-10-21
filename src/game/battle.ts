/**
 * Auto-battle (D-13, D-73, D-88). A continuous simulation in small fixed steps,
 * fully determined by its inputs and seed, so a battle that was resolved while
 * the game was closed can be replayed exactly later.
 *
 * - Each ship fires on a fixed interval at an enemy in the front-most row that
 *   still has ships (Front, then Middle, then Back), picked at random within it.
 * - Damage = firepower × scale / (scale + target defence).
 * - Skills trigger automatically on their condition.
 * - The battle ends when one side is destroyed; running out of time is a loss.
 */

import { BATTLE, ROWS, SKILLS, type Row } from '../data'

export type Side = 'player' | 'enemy'

/** A ship as it enters battle; stored with battle records for replays. */
export interface CombatantInit {
  id: string
  name: string
  side: Side
  row: Row
  hp: number
  defence: number
  firepower: number
  skill: string | null
}

export type BattleEvent =
  | { t: number; type: 'shot'; from: string; to: string; damage: number }
  | { t: number; type: 'skill'; id: string; skill: string }
  | { t: number; type: 'destroyed'; id: string }

export interface BattleResult {
  won: boolean
  /** Seconds the battle lasted. */
  duration: number
  events: BattleEvent[]
}

interface Combatant extends CombatantInit {
  maxHp: number
  nextShot: number
  skillUsed: boolean
}

/** Seeded mulberry32: the same seed always gives the same battle. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const damage = (firepower: number, defence: number) =>
  (firepower * BATTLE.damageDefenceScale) / (BATTLE.damageDefenceScale + defence)

const round = (n: number) => Math.round(n * 1000) / 1000

export function simulateBattle(fighters: CombatantInit[], seed: number): BattleResult {
  const random = rng(seed)
  const units: Combatant[] = fighters.map((f) => ({
    ...f,
    maxHp: f.hp,
    // stagger first shots so both sides do not fire in lockstep
    nextShot: random() * BATTLE.shotIntervalSeconds,
    skillUsed: false,
  }))
  const events: BattleEvent[] = []
  const alive = (side: Side) => units.filter((u) => u.side === side && u.hp > 0)

  const pickTarget = (side: Side): Combatant | undefined => {
    for (const row of ROWS) {
      const inRow = alive(side).filter((u) => u.row === row)
      if (inRow.length) return inRow[Math.floor(random() * inRow.length)]
    }
    return undefined
  }

  const triggerSkills = (unit: Combatant, t: number) => {
    if (unit.skill !== 'lastStand' || unit.skillUsed || unit.hp <= 0) return
    const skill = SKILLS.lastStand
    if (unit.hp / unit.maxHp < skill.hpBelow) {
      unit.skillUsed = true
      unit.defence *= skill.defenceMultiplier
      events.push({ t, type: 'skill', id: unit.id, skill: unit.skill })
    }
  }

  const steps = Math.round(BATTLE.timeLimitSeconds / BATTLE.stepSeconds)
  for (let step = 1; step <= steps; step++) {
    const t = round(step * BATTLE.stepSeconds)
    for (const unit of units) {
      if (unit.hp <= 0 || unit.firepower <= 0 || t < unit.nextShot) continue
      unit.nextShot += BATTLE.shotIntervalSeconds
      const target = pickTarget(unit.side === 'player' ? 'enemy' : 'player')
      if (!target) continue
      const dealt = round(Math.min(target.hp, damage(unit.firepower, target.defence)))
      target.hp = round(target.hp - dealt)
      events.push({ t, type: 'shot', from: unit.id, to: target.id, damage: dealt })
      if (target.hp <= 0) events.push({ t, type: 'destroyed', id: target.id })
      else triggerSkills(target, t)
    }
    const playerLeft = alive('player').length
    const enemyLeft = alive('enemy').length
    if (!playerLeft || !enemyLeft) return { won: playerLeft > 0, duration: t, events }
  }
  return { won: false, duration: BATTLE.timeLimitSeconds, events }
}
