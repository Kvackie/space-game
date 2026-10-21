/**
 * The game clock. Timers hold device-clock timestamps, so whatever finished
 * while the game was closed completes on the next tick after loading (D-71).
 *
 * The device clock is the time source; what to do about players changing it
 * is still open (Q-44). Turning the clock back just makes timers wait longer.
 */

import { timerEndsAt, type GameState, type Timer } from './state'

export type TimerHandler = (state: GameState, timer: Timer) => void

export function startTimer(
  state: GameState,
  kind: string,
  durationMs: number,
  now: number,
  data?: Record<string, unknown>,
): Timer {
  const timer: Timer = { id: `t${state.nextId++}`, kind, startedAt: now, durationMs, ...(data && { data }) }
  state.timers.push(timer)
  return timer
}

export const timeLeft = (timer: Timer, now: number) => Math.max(0, timerEndsAt(timer) - now)

export class GameClock {
  private handlers = new Map<string, TimerHandler>()

  /** What happens when a timer of this kind finishes (e.g. add mined ore). */
  on(kind: string, handler: TimerHandler): void {
    this.handlers.set(kind, handler)
  }

  /**
   * Completes every timer that has ended by `now`, oldest first, and runs its
   * handler. Returns the completed timers, e.g. for a "while you were away"
   * summary.
   */
  tick(state: GameState, now: number): Timer[] {
    const due = state.timers.filter((t) => timerEndsAt(t) <= now).sort((a, b) => timerEndsAt(a) - timerEndsAt(b))
    if (!due.length) return due
    state.timers = state.timers.filter((t) => !due.includes(t))
    for (const timer of due) this.handlers.get(timer.kind)?.(state, timer)
    return due
  }
}
