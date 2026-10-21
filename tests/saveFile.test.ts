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

  it('does not reject hand-edited but well-formed values', () => {
    const edited = sample()
    edited.resources.pullCurrency = 999_999
    expect(deserialize(serialize(edited)).resources.pullCurrency).toBe(999_999)
  })
})
