import { describe, expect, it } from 'vitest'
import { RECIPES } from '../src/data'
import { GameClock } from '../src/game/clock'
import { cannotCraft, craftingJobs, registerCrafting, startCraft } from '../src/game/crafting'
import { newGame, type GameState, type ResourceId } from '../src/game/state'

const clock = new GameClock()
registerCrafting(clock)

/** Gives the state exactly a recipe's inputs. */
function stock(state: GameState, recipeId: string) {
  for (const [id, n] of Object.entries(RECIPES[recipeId].inputs)) state.resources[id as ResourceId] += n
}

/** Starts a recipe and lets it finish. */
function craft(state: GameState, recipeId: string) {
  startCraft(state, recipeId, 0)
  clock.tick(state, RECIPES[recipeId].seconds * 1000)
}

describe('crafting', () => {
  it('refuses to start without the inputs', () => {
    expect(cannotCraft(newGame(0), 'refineOre1')).toBe('Not enough materials')
    expect(() => startCraft(newGame(0), 'refineOre1', 0)).toThrow()
  })

  it('takes inputs at the start and delivers output when the timer ends', () => {
    const state = newGame(0)
    stock(state, 'refineOre1')
    startCraft(state, 'refineOre1', 0)
    expect(state.resources.ore1).toBe(0)
    expect(state.resources.material1).toBe(0)

    clock.tick(state, RECIPES.refineOre1.seconds * 1000 - 1)
    expect(state.resources.material1).toBe(0)
    clock.tick(state, RECIPES.refineOre1.seconds * 1000)
    expect(state.resources.material1).toBe(10)
    expect(craftingJobs(state)).toHaveLength(0)
  })

  it('runs one job at a time', () => {
    const state = newGame(0)
    stock(state, 'refineOre1')
    stock(state, 'refineOre2')
    startCraft(state, 'refineOre1', 0)
    expect(cannotCraft(state, 'refineOre2')).toBe('Crafting is busy')
  })

  it('goes from ore to a frigate and an autocannon (D-69)', () => {
    const state = newGame(0)
    state.resources.ore1 = 40
    state.resources.ore2 = 60

    craft(state, 'refineOre1')
    craft(state, 'refineOre1')
    craft(state, 'refineOre2')
    craft(state, 'refineOre2')
    craft(state, 'refineOre2')
    craft(state, 'component')
    craft(state, 'component')
    craft(state, 'frigate')
    craft(state, 'autocannon')

    expect(state.ships.map((s) => s.hull)).toEqual(['barge', 'frigate'])
    expect(state.ships[1].gear).toEqual([null])
    expect(state.gear.map((g) => g.type)).toEqual(['autocannon'])
    expect(state.resources).toMatchObject({ ore1: 0, ore2: 0, material1: 0, material2: 0, component: 0 })
  })
})
