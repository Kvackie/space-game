import { describe, expect, it } from 'vitest'
import { EXPEDITION } from '../src/data'
import { simulateBattle } from '../src/game/battle'
import { GameClock } from '../src/game/clock'
import { activeExpedition, cannotSendExpedition, registerExpedition, startExpedition } from '../src/game/expedition'
import { busyShipIds } from '../src/game/ships'
import { createShip, newGame, type GameState } from '../src/game/state'

const clock = new GameClock()
registerExpedition(clock)
const DURATION = EXPEDITION.seconds * 1000

function withFrigates(n: number): GameState {
  const state = newGame(0)
  for (let i = 0; i < n; i++) createShip(state, 'frigate')
  return state
}

describe('expedition', () => {
  it('refuses ships that cannot fight (D-88)', () => {
    const state = newGame(0)
    expect(cannotSendExpedition(state, [{ shipId: state.ships[0].id, row: 'front' }])).toMatch(/cannot fight/)
  })

  it('refuses an empty fleet and a second expedition', () => {
    const state = withFrigates(2)
    expect(cannotSendExpedition(state, [])).toBe('Choose at least one ship')
    startExpedition(state, [{ shipId: state.ships[1].id, row: 'front' }], 0)
    expect(cannotSendExpedition(state, [{ shipId: state.ships[2].id, row: 'front' }])).toBe(
      'An expedition is already out',
    )
  })

  it('fights when the timer ends and records the battle for replay', () => {
    const state = withFrigates(3)
    const formation = state.ships
      .slice(1)
      .map((s, i) => ({ shipId: s.id, row: (['front', 'middle', 'back'] as const)[i] }))
    startExpedition(state, formation, 1000)
    expect(busyShipIds(state).size).toBe(3)

    clock.tick(state, 1000 + DURATION)
    expect(activeExpedition(state)).toBeUndefined()
    expect(busyShipIds(state).size).toBe(0)

    const record = state.battles[0]
    expect(record.fighters.filter((f) => f.side === 'player').map((f) => f.row)).toEqual(['front', 'middle', 'back'])
    // replaying the record gives the same outcome
    expect(simulateBattle(record.fighters, record.seed).won).toBe(record.won)
  })

  it('pays pull currency and rare resource on a win, nothing on a loss', () => {
    const strong = withFrigates(3)
    startExpedition(
      strong,
      strong.ships.slice(1).map((s) => ({ shipId: s.id, row: 'front' as const })),
      0,
    )
    clock.tick(strong, DURATION)
    expect(strong.battles[0].won).toBe(true)
    expect(strong.resources.pullCurrency).toBe(EXPEDITION.rewards.pullCurrency)
    expect(strong.resources.rareResource).toBe(EXPEDITION.rewards.rareResource)

    const weak = withFrigates(1)
    weak.ships[1].hull = 'frigate'
    startExpedition(weak, [{ shipId: weak.ships[1].id, row: 'front' }], 0)
    // cripple the snapshot so the fight is lost
    const fighters = activeExpedition(weak)!.data!.fighters as { firepower: number }[]
    fighters[0].firepower = 0
    clock.tick(weak, DURATION)
    expect(weak.battles[0].won).toBe(false)
    expect(weak.resources.pullCurrency).toBe(0)
    // ships come back unharmed and can go again
    expect(cannotSendExpedition(weak, [{ shipId: weak.ships[1].id, row: 'front' }])).toBeNull()
  })
})

describe('slice balance with placeholder numbers', () => {
  it('lets one frigate with an autocannon win the expedition, whatever the seed', () => {
    for (let seed = 0; seed < 50; seed++) {
      const state = withFrigates(1)
      state.gear.push({ id: 'g1', type: 'autocannon' })
      state.ships[1].gear[0] = 'g1'
      startExpedition(state, [{ shipId: state.ships[1].id, row: 'front' }], seed)
      clock.tick(state, seed + DURATION)
      expect(state.battles[0].won).toBe(true)
    }
  })
})
