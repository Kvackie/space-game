import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/state'
import { deserialize, SAVE_VERSION, SaveError, serialize } from '../src/save/saveFile'

const sample = () => {
  const state = newGame(1_000)
  state.resources.ore1 = 12
  state.timers.push({ id: 't1', kind: 'mining', startedAt: 2_000, durationMs: 60_000, data: { field: 'ore1' } })
  return state
}

describe('save file', () => {
  it('round-trips a game through readable JSON', () => {
    const text = serialize(sample())
    expect(text).toContain('\n  "resources"')
    expect(deserialize(text)).toEqual(sample())
  })

  it('starts at the current save version', () => {
    expect(newGame(0).version).toBe(SAVE_VERSION)
  })

  it('rejects text that is not JSON', () => {
    expect(() => deserialize('not json')).toThrow(SaveError)
  })

  it('rejects saves from a newer game version', () => {
    const text = serialize({ ...sample(), version: SAVE_VERSION + 1 })
    expect(() => deserialize(text)).toThrow(/newer version/)
  })

  it('rejects saves with missing or wrongly typed fields', () => {
    const broken = [
      { ...sample(), resources: undefined },
      { ...sample(), resources: { ...sample().resources, ore2: 'lots' } },
      { ...sample(), timers: [{ id: 't1', kind: 'mining', startedAt: 'yesterday', durationMs: 1 }] },
      { ...sample(), version: 0 },
    ]
    for (const save of broken) expect(() => deserialize(JSON.stringify(save))).toThrow(SaveError)
  })

  it('upgrades a version 1 save, keeping its resources and timers', () => {
    const v1 = {
      version: 1,
      createdAt: 1,
      savedAt: 2,
      nextId: 4,
      resources: { ore1: 12, ore2: 3, rareResource: 1, pullCurrency: 0 },
      timers: [{ id: 't3', kind: 'mining', startedAt: 5, durationMs: 60 }],
    }
    const upgraded = deserialize(JSON.stringify(v1))
    expect(upgraded.version).toBe(SAVE_VERSION)
    expect(upgraded.resources).toMatchObject({ ore1: 12, ore2: 3, material1: 0, component: 0 })
    expect(upgraded.timers).toEqual(v1.timers)
    expect(upgraded.ships).toHaveLength(1)
    expect(upgraded.ships[0].id).toBe('s4')
    expect(upgraded.nextId).toBe(5)
  })

  it('does not reject hand-edited but well-formed values', () => {
    const edited = sample()
    edited.resources.pullCurrency = 999_999
    expect(deserialize(serialize(edited)).resources.pullCurrency).toBe(999_999)
  })
})

describe('save version 3', () => {
  it('turns version 2 duplicate counts into Limit Break material and adds an empty pull history', () => {
    const v2 = { ...newGame(0), version: 2, gacha: { pity: 3 }, captains: [{ id: 'c9', def: 'c2', duplicates: 2 }] }
    const upgraded = deserialize(JSON.stringify(v2))
    expect(upgraded.captains).toEqual([{ id: 'c9', def: 'c2', limitBreakMaterial: 2 }])
    expect(upgraded.gacha).toEqual({ pity: 3, history: [] })
  })
})
