import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { newGame } from '../src/game/state'
import { Autosave } from '../src/save/autosave'
import { deserialize } from '../src/save/saveFile'
import { deleteSave, readSave, writeSave } from '../src/save/storage'

describe('IndexedDB storage', () => {
  beforeEach(() => deleteSave())

  it('is empty before the first save', async () => {
    expect(await readSave()).toBeNull()
  })

  it('stores and reads back the save text', async () => {
    await writeSave('{"a":1}')
    expect(await readSave()).toBe('{"a":1}')
    await writeSave('{"a":2}')
    expect(await readSave()).toBe('{"a":2}')
  })
})

describe('autosave', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('turns a burst of actions into one write', async () => {
    const state = newGame(0)
    const write = vi.fn(async () => {})
    const autosave = new Autosave(
      () => state,
      write,
      () => 5_000,
    )

    autosave.markDirty()
    state.resources.ore1 = 3
    autosave.markDirty()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(write).toHaveBeenCalledTimes(1)
    const saved = deserialize(write.mock.calls[0][0])
    expect(saved.resources.ore1).toBe(3)
    expect(saved.savedAt).toBe(5_000)
  })

  it('flushes immediately and skips writing when nothing changed', async () => {
    const write = vi.fn(async () => {})
    const autosave = new Autosave(() => newGame(0), write)

    await autosave.flush()
    expect(write).not.toHaveBeenCalled()

    autosave.markDirty()
    await autosave.flush()
    expect(write).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(write).toHaveBeenCalledTimes(1)
  })
})
