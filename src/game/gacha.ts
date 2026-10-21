/**
 * Captain recruitment (D-08, D-24, D-54, D-58–D-63, D-91).
 *
 * - Rates per rarity are fixed (D-58).
 * - Hard pity: the 50th pull without a Legendary or Mythical is a Legendary;
 *   the counter resets whenever either drops (D-59).
 * - Single and 10-pulls cost the same per pull (D-60).
 * - The rare resource converts to pull currency at a fixed rate (D-61).
 * - A duplicate becomes Limit Break material for that captain (D-108).
 * - Every pull is kept in the pull history (D-109).
 */

import { CAPTAINS, GACHA, RARITY_ORDER, type Rarity } from '../data'
import { newId, type GameState } from './state'

export interface PullResult {
  def: string
  rarity: Rarity
  duplicate: boolean
}

export const pullCost = (count: number) => GACHA.pullPrice * count

export function cannotPull(state: GameState, count: number): string | null {
  return state.resources.pullCurrency < pullCost(count) ? 'Not enough pull currency' : null
}

export function rollRarity(random: () => number, pity: number): Rarity {
  if (pity >= GACHA.pityThreshold - 1) return GACHA.pityRarity as Rarity
  let roll = random()
  for (const rarity of RARITY_ORDER) {
    roll -= GACHA.rates[rarity]
    if (roll < 0) return rarity
  }
  return RARITY_ORDER[0]
}

export function pull(
  state: GameState,
  count: number,
  random: () => number = Math.random,
  now: number = Date.now(),
): PullResult[] {
  const reason = cannotPull(state, count)
  if (reason) throw new Error(reason)
  state.resources.pullCurrency -= pullCost(count)

  const results: PullResult[] = []
  for (let i = 0; i < count; i++) {
    const rarity = rollRarity(random, state.gacha.pity)
    state.gacha.pity = GACHA.pityResetRarities.includes(rarity) ? 0 : state.gacha.pity + 1

    const pool = Object.keys(CAPTAINS).filter((id) => CAPTAINS[id].rarity === rarity)
    const def = pool[Math.floor(random() * pool.length)]
    const owned = state.captains.find((c) => c.def === def)
    if (owned) owned.limitBreakMaterial += GACHA.limitBreakMaterialPerDuplicate
    else state.captains.push({ id: newId(state, 'c'), def, limitBreakMaterial: 0 })
    results.push({ def, rarity, duplicate: !!owned })
    state.gacha.history.unshift({ at: now, def, duplicate: !!owned })
  }
  state.gacha.history.length = Math.min(state.gacha.history.length, GACHA.historyKeep)
  return results
}

export function cannotExchange(state: GameState): string | null {
  return state.resources.rareResource < GACHA.exchange.rareResource ? 'Not enough rare resource' : null
}

export function exchange(state: GameState): void {
  const reason = cannotExchange(state)
  if (reason) throw new Error(reason)
  state.resources.rareResource -= GACHA.exchange.rareResource
  state.resources.pullCurrency += GACHA.exchange.pullCurrency
}
