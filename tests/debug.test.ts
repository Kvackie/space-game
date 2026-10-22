import { describe, expect, it } from 'vitest'
import { GACHA } from '../src/data'
import { GameClock } from '../src/game/clock'
import { registerCrafting, startCraft } from '../src/game/crafting'
import {
  finishTimers,
  grantAllResources,
  grantResource,
  setPity,
  spawnCaptain,
  spawnGear,
  spawnShip,
} from '../src/game/debug'
import { pull } from '../src/game/gacha'
import { newGame } from '../src/game/state'

describe('debug menu', () => {
  it('grants one resource or all of them', () => {
    const state = newGame(0)
    grantResource(state, 'ore2', 50)
    grantAllResources(state, 10)
    expect(state.resources.ore2).toBe(60)
    expect(Object.values(state.resources).every((n) => n >= 10)).toBe(true)
  })

  it('finishes running timers on the next clock tick', () => {
    const state = newGame(0)
    grantAllResources(state, 1000)
    startCraft(state, 'refineOre1', 0)
    const clock = new GameClock()
    registerCrafting(clock)
    expect(finishTimers(state, 1)).toBe(1)
    expect(clock.tick(state, 1)).toHaveLength(1)
    expect(state.resources.material1).toBe(1010)
  })

  it('spawns ships, gear and captains the way the real systems do', () => {
    const state = newGame(0)
    spawnShip(state, 'frigate')
    spawnGear(state, 'autocannon')
    spawnCaptain(state, 'c4')
    spawnCaptain(state, 'c4')
    expect(state.ships.map((s) => s.hull)).toEqual(['barge', 'frigate'])
    expect(state.ships[1].gear).toEqual([null])
    expect(state.gear).toHaveLength(1)
    expect(state.captains).toHaveLength(1)
    expect(state.captains[0].limitBreakMaterial).toBe(GACHA.limitBreakMaterialPerDuplicate)
  })

  it('can set the pity counter so the next pull is the guaranteed Legendary', () => {
    const state = newGame(0)
    setPity(state, 999)
    expect(state.gacha.pity).toBe(GACHA.pityThreshold - 1)
    state.resources.pullCurrency = GACHA.pullPrice
    expect(pull(state, 1, () => 0)[0].rarity).toBe('legendary')
  })
})
