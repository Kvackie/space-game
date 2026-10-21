/**
 * Autosave (D-75): every meaningful action marks the game dirty and a save
 * follows shortly after; hiding or closing the tab saves at once.
 */

import type { GameState } from '../game/state'
import { serialize } from './saveFile'

/** Several actions in quick succession become one write. */
const DEBOUNCE_MS = 300

export class Autosave {
  private timer: ReturnType<typeof setTimeout> | null = null
  private dirty = false
  private writing: Promise<void> = Promise.resolve()

  constructor(
    private readonly getState: () => GameState,
    private readonly write: (text: string) => Promise<void>,
    private readonly now: () => number = Date.now,
  ) {}

  markDirty(): void {
    this.dirty = true
    if (this.timer === null) this.timer = setTimeout(() => void this.flush(), DEBOUNCE_MS)
  }

  /** Writes now if anything changed; writes never overlap. */
  flush(): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (!this.dirty) return this.writing
    this.dirty = false
    const state = this.getState()
    state.savedAt = this.now()
    const text = serialize(state)
    this.writing = this.writing.then(() => this.write(text))
    return this.writing
  }

  /** Saves when the tab is hidden (phones often never fire unload) or closed. */
  attachPageHooks(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void this.flush()
    })
    addEventListener('pagehide', () => void this.flush())
  }
}
