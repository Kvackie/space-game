/**
 * Start-up for the game state: load the save (or start fresh), finish timers
 * that ended while the game was closed, then keep ticking and autosaving.
 */

import { Autosave } from '../save/autosave'
import { deserialize } from '../save/saveFile'
import { keepDamagedSave, readSave, requestPersistentStorage, writeSave } from '../save/storage'
import { GameClock } from './clock'
import { newGame, type GameState, type Timer } from './state'
import { GameStore } from './store'

const TICK_MS = 1000

export interface Session {
  store: GameStore
  clock: GameClock
  /** Timers that finished while the game was closed. */
  completedWhileAway: Timer[]
  /** Set when an existing save could not be loaded (it was kept aside). */
  loadError: string | null
}

/**
 * @param registerHandlers sets what each timer kind does when it finishes;
 *   it runs before the offline catch-up so those timers complete properly.
 */
export async function startSession(registerHandlers: (clock: GameClock) => void = () => {}): Promise<Session> {
  const now = Date.now()
  const clock = new GameClock()
  registerHandlers(clock)

  let state: GameState
  let loadError: string | null = null
  const text = await readSave()
  if (text === null) {
    state = newGame(now)
  } else {
    try {
      state = deserialize(text)
    } catch (error) {
      loadError = error instanceof Error ? error.message : String(error)
      await keepDamagedSave(text, now)
      state = newGame(now)
    }
  }

  const completedWhileAway = clock.tick(state, now)

  const autosave = new Autosave(() => store.state, writeSave)
  const store = new GameStore(state, () => autosave.markDirty())
  autosave.attachPageHooks()
  // save at once so a new game, a catch-up or a recovered save is on disk
  autosave.markDirty()
  void autosave.flush()

  setInterval(() => {
    if (clock.tick(store.state, Date.now()).length) store.changed()
  }, TICK_MS)

  void requestPersistentStorage()

  return { store, clock, completedWhileAway, loadError }
}
