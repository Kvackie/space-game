import { describe, expect, it } from 'vitest'
import { CAPTAINS, HULLS } from '../src/data'
import { assignCaptain, captainShip, fitGear, spareGear } from '../src/game/fleet'
import { startMining } from '../src/game/mining'
import { shipStats } from '../src/game/ships'
import { createShip, newGame } from '../src/game/state'

function setup() {
  const state = newGame(0)
  const a = createShip(state, 'frigate')
  const b = createShip(state, 'frigate')
  state.gear.push({ id: 'g1', type: 'autocannon' })
  state.captains.push({ id: 'c1', def: 'c3', limitBreakMaterial: 0 })
  return { state, a, b }
}

describe('refitting', () => {
  it('fits gear into a slot and moves it between ships', () => {
    const { state, a, b } = setup()
    expect(spareGear(state)).toHaveLength(1)
    fitGear(state, a.id, 0, 'g1')
    expect(spareGear(state)).toHaveLength(0)
    fitGear(state, b.id, 0, 'g1')
    expect(a.gear).toEqual([null])
    expect(b.gear).toEqual(['g1'])
    fitGear(state, b.id, 0, null)
    expect(spareGear(state)).toHaveLength(1)
  })

  it('has no gear slots on the barge', () => {
    const { state } = setup()
    expect(() => fitGear(state, state.ships[0].id, 0, 'g1')).toThrow('No such slot')
  })

  it('does not refit a ship that is away', () => {
    const { state, a } = setup()
    startMining(state, a.id, 'ore1', 0)
    expect(() => fitGear(state, a.id, 0, 'g1')).toThrow('Ship is away')
  })

  it('gives each ship one captain whose bonus applies to it (D-68)', () => {
    const { state, a, b } = setup()
    assignCaptain(state, a.id, 'c1')
    expect(shipStats(state, a).firepower).toBe(HULLS.frigate.stats.firepower! + CAPTAINS.c3.bonus.firepower!)
    assignCaptain(state, b.id, 'c1')
    expect(a.captainId).toBeNull()
    expect(captainShip(state, 'c1')).toBe(b)
  })
})
