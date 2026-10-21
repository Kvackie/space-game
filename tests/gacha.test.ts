import { describe, expect, it } from 'vitest'
import { GACHA, RARITY_ORDER, type Rarity } from '../src/data'
import { rng } from '../src/game/battle'
import { cannotExchange, cannotPull, exchange, pull, pullCost, rollRarity } from '../src/game/gacha'
import { newGame } from '../src/game/state'

const rich = (pulls: number) => {
  const state = newGame(0)
  state.resources.pullCurrency = pullCost(pulls)
  return state
}

describe('gacha', () => {
  it('costs the same per pull for single and 10-pulls (D-60)', () => {
    expect(pullCost(GACHA.multiPull)).toBe(pullCost(1) * GACHA.multiPull)
    const state = rich(1)
    expect(cannotPull(state, GACHA.multiPull)).not.toBeNull()
    pull(state, 1, rng(1))
    expect(state.resources.pullCurrency).toBe(0)
    expect(state.captains).toHaveLength(1)
  })

  it('matches the decided drop rates over many pulls (D-58)', () => {
    const random = rng(42)
    const counts = Object.fromEntries(RARITY_ORDER.map((r) => [r, 0])) as Record<Rarity, number>
    const N = 200_000
    // pity 0 throughout, so only the base rates apply
    for (let i = 0; i < N; i++) counts[rollRarity(random, 0)]++
    for (const rarity of RARITY_ORDER) expect(counts[rarity] / N).toBeCloseTo(GACHA.rates[rarity], 2)
  })

  it('guarantees a Legendary on the 50th pull without one (D-59)', () => {
    // a random source that always rolls Common
    const commonOnly = () => 0
    const state = rich(GACHA.pityThreshold)
    const results = pull(state, GACHA.pityThreshold, commonOnly)
    expect(results.slice(0, -1).every((r) => r.rarity === 'common')).toBe(true)
    expect(results.at(-1)!.rarity).toBe('legendary')
    expect(state.gacha.pity).toBe(0)
  })

  it('resets the pity counter on a Mythical as well', () => {
    const state = rich(3)
    state.gacha.pity = 20
    // 0.999 rolls past every rate into the last tier, Mythical
    pull(state, 1, () => 0.999)
    expect(state.gacha.pity).toBe(0)
    pull(state, 1, () => 0)
    expect(state.gacha.pity).toBe(1)
  })

  it("turns duplicates into that captain's Limit Break material (D-108)", () => {
    const state = rich(2)
    const [first, second] = pull(state, 2, () => 0)
    expect(first.duplicate).toBe(false)
    expect(second.duplicate).toBe(true)
    expect(state.captains).toHaveLength(1)
    expect(state.captains[0].limitBreakMaterial).toBe(GACHA.limitBreakMaterialPerDuplicate)
    expect(state.gacha.history.map((p) => p.duplicate)).toEqual([true, false])
  })

  it('exchanges the rare resource for pull currency at the fixed rate (D-61)', () => {
    const state = newGame(0)
    expect(cannotExchange(state)).not.toBeNull()
    state.resources.rareResource = GACHA.exchange.rareResource
    exchange(state)
    expect(state.resources.rareResource).toBe(0)
    expect(state.resources.pullCurrency).toBe(GACHA.exchange.pullCurrency)
  })
})
