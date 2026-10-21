/**
 * Holds the live game state. Every change goes through update() so screens
 * refresh and autosave follows (D-75).
 */

import type { GameState } from './state'

type Listener = (state: GameState) => void

export class GameStore {
  private listeners = new Set<Listener>()

  constructor(
    public state: GameState,
    private readonly onChange: () => void = () => {},
  ) {}

  update(action: (state: GameState) => void): void {
    action(this.state)
    this.changed()
  }

  /** Swap in a whole new game (import, reset). */
  replace(state: GameState): void {
    this.state = state
    this.changed()
  }

  /** Calls the listener now and after every change; returns an unsubscribe. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  changed(): void {
    this.onChange()
    for (const listener of this.listeners) listener(this.state)
  }
}
