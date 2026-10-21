import { describe, expect, it } from 'vitest'
import { BATTLE, SKILLS } from '../src/data'
import { damage, simulateBattle, type CombatantInit } from '../src/game/battle'

const ship = (over: Partial<CombatantInit> & Pick<CombatantInit, 'id' | 'side'>): CombatantInit => ({
  name: over.id,
  row: 'front',
  hp: 100,
  defence: 0,
  firepower: 10,
  skill: null,
  ...over,
})

describe('auto-battle', () => {
  it('is fully determined by its inputs and seed', () => {
    const fighters = [
      ship({ id: 'p1', side: 'player', hp: 300, firepower: 30 }),
      ship({ id: 'e1', side: 'enemy' }),
      ship({ id: 'e2', side: 'enemy', row: 'middle' }),
    ]
    expect(simulateBattle(fighters, 7)).toEqual(simulateBattle(fighters, 7))
  })

  it('reduces damage by defence', () => {
    expect(damage(20, 0)).toBe(20)
    expect(damage(20, BATTLE.damageDefenceScale)).toBe(10)
  })

  it('targets the front row before the middle and back (D-88)', () => {
    const result = simulateBattle(
      [
        ship({ id: 'p1', side: 'player', hp: 1000, firepower: 50 }),
        ship({ id: 'front', side: 'enemy', firepower: 0 }),
        ship({ id: 'middle', side: 'enemy', row: 'middle', firepower: 0 }),
        ship({ id: 'back', side: 'enemy', row: 'back', firepower: 0 }),
      ],
      1,
    )
    const order = result.events.filter((e) => e.type === 'destroyed').map((e) => (e as { id: string }).id)
    expect(order).toEqual(['front', 'middle', 'back'])
    expect(result.won).toBe(true)
  })

  it('lets ships fire from any row', () => {
    const result = simulateBattle(
      [ship({ id: 'p1', side: 'player', row: 'back', firepower: 50 }), ship({ id: 'e1', side: 'enemy', firepower: 0 })],
      2,
    )
    expect(result.events.some((e) => e.type === 'shot' && e.from === 'p1')).toBe(true)
  })

  it('on time-out, gives the win to the side that lost the smaller share of its HP (D-107)', () => {
    // both sides survive 60 s: the player loses 10% of its HP, the enemy 30%
    const result = simulateBattle(
      [
        ship({ id: 'p1', side: 'player', hp: 10_000, defence: 0, firepower: 0.5 }),
        ship({ id: 'e1', side: 'enemy', hp: 100, defence: 0, firepower: 1000 / 60 }),
      ],
      3,
    )
    expect(result.duration).toBe(BATTLE.timeLimitSeconds)
    expect(result.won).toBe(true)
  })

  it('compares shares, not raw damage, so a bigger fleet is not penalised', () => {
    // the player takes more raw damage but a smaller share of its larger HP pool
    const result = simulateBattle(
      [
        ship({ id: 'p1', side: 'player', hp: 5000, firepower: 0.6 }),
        ship({ id: 'p2', side: 'player', hp: 5000, firepower: 0 }),
        ship({ id: 'e1', side: 'enemy', hp: 100, firepower: 4 }),
      ],
      5,
    )
    expect(result.duration).toBe(BATTLE.timeLimitSeconds)
    expect(result.won).toBe(true)
  })

  it('gives a time-out tie to the enemy', () => {
    const result = simulateBattle(
      [ship({ id: 'p1', side: 'player', firepower: 0 }), ship({ id: 'e1', side: 'enemy', firepower: 0 })],
      3,
    )
    expect(result.won).toBe(false)
  })

  it('triggers Last Stand once, below its HP threshold', () => {
    const result = simulateBattle(
      [
        ship({ id: 'p1', side: 'player', hp: 100, defence: 10, firepower: 0, skill: 'lastStand' }),
        ship({ id: 'e1', side: 'enemy', firepower: 15 }),
      ],
      4,
    )
    const skills = result.events.filter((e) => e.type === 'skill')
    expect(skills).toHaveLength(1)
    const before = result.events.filter((e) => e.type === 'shot' && e.t <= skills[0].t)
    const hpLeft = 100 - before.reduce((sum, e) => sum + (e.type === 'shot' ? e.damage : 0), 0)
    expect(hpLeft / 100).toBeLessThan(SKILLS.lastStand.hpBelow)
  })
})
