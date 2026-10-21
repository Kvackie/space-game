import { describe, expect, it } from 'vitest'
import { HULLS, MINING } from '../src/data'
import { GameClock } from '../src/game/clock'
import { cannotMine, miningRuns, miningYield, registerMining, startMining } from '../src/game/mining'
import { busyShipIds, shipStats } from '../src/game/ships'
import { createShip, newGame } from '../src/game/state'

const clock = new GameClock()
registerMining(clock)
const RUN = MINING.runSeconds * 1000

describe('mining', () => {
  it('sends the starting barge to a field and brings ore back', () => {
    const state = newGame(0)
    const barge = state.ships[0]
    const expected = miningYield(state, barge)
    expect(expected).toBeGreaterThan(0)

    startMining(state, barge.id, 'ore2', 0)
    expect(miningRuns(state)).toHaveLength(1)
    expect(busyShipIds(state).has(barge.id)).toBe(true)

    clock.tick(state, RUN)
    expect(state.resources.ore2).toBe(expected)
    expect(state.resources.ore1).toBe(0)
    expect(busyShipIds(state).size).toBe(0)
  })

  it('caps a run at the ship cargo', () => {
    const state = newGame(0)
    const barge = state.ships[0]
    const { cargo, miningYield: perMinute } = HULLS.barge.stats
    expect(miningYield(state, barge)).toBe(Math.min(cargo!, Math.floor(perMinute! * (MINING.runSeconds / 60))))
  })

  it('does not send a busy ship twice', () => {
    const state = newGame(0)
    startMining(state, state.ships[0].id, 'ore1', 0)
    expect(cannotMine(state, state.ships[0].id)).toBe('Ship is busy')
  })

  it('lets frigates mine, weaker than the barge (D-65)', () => {
    const state = newGame(0)
    const frigate = createShip(state, 'frigate')
    expect(cannotMine(state, frigate.id)).toBeNull()
    expect(miningYield(state, frigate)).toBeLessThan(miningYield(state, state.ships[0]))
  })

  it('adds gear bonuses only to stats the hull has', () => {
    const state = newGame(0)
    const frigate = createShip(state, 'frigate')
    state.gear.push({ id: 'g1', type: 'autocannon' })
    frigate.gear[0] = 'g1'
    expect(shipStats(state, frigate).firepower).toBe(HULLS.frigate.stats.firepower! + 10)
    expect(shipStats(state, state.ships[0]).firepower).toBeUndefined()
  })
})
