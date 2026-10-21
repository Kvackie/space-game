/**
 * Refining, manufacturing, shipbuilding and gear crafting (D-09, D-69).
 * Inputs are taken when a job starts; the output arrives when its timer ends,
 * also while the game is closed (D-71).
 */

import { CRAFTING, RECIPES, type RecipeDef } from '../data'
import { startTimer, type GameClock } from './clock'
import { createShip, newId, type GameState, type ResourceId } from './state'

export const CRAFT_TIMER = 'craft'

export const craftingJobs = (state: GameState) => state.timers.filter((t) => t.kind === CRAFT_TIMER)

/** Why a recipe cannot start right now, or null if it can. */
export function cannotCraft(state: GameState, recipeId: string): string | null {
  const recipe = RECIPES[recipeId]
  if (!recipe) return 'Unknown recipe'
  if (craftingJobs(state).length >= CRAFTING.maxConcurrentJobs) return 'Crafting is busy'
  for (const [id, amount] of Object.entries(recipe.inputs)) {
    if (state.resources[id as ResourceId] < amount) return 'Not enough materials'
  }
  return null
}

export function startCraft(state: GameState, recipeId: string, now: number): void {
  const reason = cannotCraft(state, recipeId)
  if (reason) throw new Error(reason)
  const recipe = RECIPES[recipeId]
  for (const [id, amount] of Object.entries(recipe.inputs)) state.resources[id as ResourceId] -= amount
  startTimer(state, CRAFT_TIMER, recipe.seconds * 1000, now, { recipe: recipeId })
}

function deliver(state: GameState, output: RecipeDef['output']): void {
  if ('resource' in output) state.resources[output.resource as ResourceId] += output.amount
  else if ('ship' in output) createShip(state, output.ship)
  else state.gear.push({ id: newId(state, 'g'), type: output.gear })
}

export function registerCrafting(clock: GameClock): void {
  clock.on(CRAFT_TIMER, (state, timer) => {
    const recipe = RECIPES[timer.data?.recipe as string]
    if (recipe) deliver(state, recipe.output)
  })
}
