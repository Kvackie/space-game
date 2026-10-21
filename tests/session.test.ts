import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startTimer } from '../src/game/clock'
import { startSession } from '../src/game/session'
import { newGame } from '../src/game/state'
import { serialize } from '../src/save/saveFile'
import { deleteSave, readSave, writeSave } from '../src/save/storage'
import { exportFileName, importSave } from '../src/save/transfer'

// startSession hooks page events; give the node test environment stand-ins
vi.stubGlobal('document', { addEventListener: () => {}, visibilityState: 'visible' })
vi.stubGlobal('addEventListener', () => {})

const HOUR = 3_600_000

describe('session start-up', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout', 'Date'] })
    vi.setSystemTime(10 * HOUR)
    await deleteSave()
  })
  afterEach(() => vi.useRealTimers())

  it('starts a new game with no resources when there is no save', async () => {
    const session = await startSession()
    expect(session.store.state.resources).toEqual({ ore1: 0, ore2: 0, rareResource: 0, pullCurrency: 0 })
    expect(session.loadError).toBeNull()
  })

  it('completes timers that finished while the game was closed', async () => {
    const saved = newGame(0)
    startTimer(saved, 'mining', HOUR, 8 * HOUR, { field: 'ore1' })
    startTimer(saved, 'mining', 5 * HOUR, 8 * HOUR, { field: 'ore2' })
    await writeSave(serialize(saved))

    const session = await startSession((clock) => {
      clock.on('mining', (state, timer) => (state.resources[timer.data?.field as 'ore1' | 'ore2'] += 10))
    })

    expect(session.completedWhileAway).toHaveLength(1)
    expect(session.store.state.resources.ore1).toBe(10)
    expect(session.store.state.timers).toHaveLength(1)
  })

  it('keeps a damaged save aside instead of overwriting it', async () => {
    await writeSave('{"version": 1, "broken": true}')
    const session = await startSession()
    expect(session.loadError).toMatch(/damaged/)
    expect(session.store.state.resources.ore1).toBe(0)
  })

  it('saves the session to IndexedDB', async () => {
    const session = await startSession()
    session.store.update((s) => (s.resources.ore2 = 7))
    await vi.advanceTimersByTimeAsync(1_000)
    expect(JSON.parse((await readSave())!).resources.ore2).toBe(7)
  })
})

describe('export and import', () => {
  it('names export files by date and time', () => {
    expect(exportFileName(new Date(2026, 9, 21, 9, 5))).toBe('save-2026-10-21-0905.json')
  })

  it('imports an exported save', async () => {
    const state = newGame(0)
    state.resources.rareResource = 4
    const imported = await importSave(new Blob([serialize(state)]))
    expect(imported).toEqual(state)
  })

  it('refuses a file that is not a save', async () => {
    await expect(importSave(new Blob(['hello']))).rejects.toThrow()
  })
})
