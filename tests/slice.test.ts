/**
 * The vertical slice end to end (docs/SLICE-SCOPE.md §3), through the real
 * clock and handlers, with a save round-trip in the middle.
 */

import { describe, expect, it } from 'vitest'
import { EXPEDITION, MINING, RECIPES } from '../src/data'
import { rng } from '../src/game/battle'
import { GameClock } from '../src/game/clock'
import { registerCrafting, startCraft } from '../src/game/crafting'
import { registerExpedition, startExpedition } from '../src/game/expedition'
import { assignCaptain, fitGear } from '../src/game/fleet'
import { pull } from '../src/game/gacha'
import { registerMining, startMining, type OreField } from '../src/game/mining'
import { newGame, type GameState } from '../src/game/state'
import { deserialize, serialize } from '../src/save/saveFile'

describe('vertical slice', () => {
  it('goes from nothing to a captain on a frigate after a won expedition', () => {
    const clock = new GameClock()
    registerCrafting(clock)
    registerMining(clock)
    registerExpedition(clock)

    let now = 0
    let state: GameState = newGame(now)
    const wait = (seconds: number) => {
      now += seconds * 1000
      clock.tick(state, now)
    }
    const barge = state.ships[0]

    // 1–2. start with nothing but the barge; mine both fields
    expect(Object.values(state.resources).every((n) => n === 0)).toBe(true)
    const mine = (field: OreField) => {
      startMining(state, barge.id, field, now)
      wait(MINING.runSeconds)
    }
    mine('ore1')
    mine('ore2')
    mine('ore2')

    // the game is closed and reopened: the save survives
    state = deserialize(serialize(state))

    // 3–5. refine, manufacture, build the frigate, craft the autocannon
    const craft = (recipe: string) => {
      startCraft(state, recipe, now)
      wait(RECIPES[recipe].seconds)
    }
    craft('refineOre1')
    craft('refineOre1')
    craft('refineOre2')
    craft('refineOre2')
    craft('refineOre2')
    craft('component')
    craft('component')
    craft('frigate')
    craft('autocannon')

    const frigate = state.ships.find((s) => s.hull === 'frigate')!
    fitGear(state, frigate.id, 0, state.gear[0].id)

    // 6–8. formation, expedition, auto-battle, rewards
    startExpedition(state, [{ shipId: frigate.id, row: 'front' }], now)
    wait(EXPEDITION.seconds)
    expect(state.battles[0].won).toBe(true)
    expect(state.resources.pullCurrency).toBe(EXPEDITION.rewards.pullCurrency)

    // 9–10. one pull, assign the captain
    const [result] = pull(state, 1, rng(5))
    assignCaptain(state, frigate.id, state.captains[0].id)
    expect(state.captains[0].def).toBe(result.def)
    expect(frigate.captainId).toBe(state.captains[0].id)
    expect(state.timers).toEqual([])
  })
})
