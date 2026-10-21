import { describe, expect, it } from 'vitest'
import { GameClock, startTimer, timeLeft } from '../src/game/clock'
import { newGame } from '../src/game/state'
import { deserialize, serialize } from '../src/save/saveFile'

const MINUTE = 60_000

describe('game clock', () => {
  it('gives each timer a unique id', () => {
    const state = newGame(0)
    const a = startTimer(state, 'mining', MINUTE, 0)
    const b = startTimer(state, 'mining', MINUTE, 0)
    expect(a.id).not.toBe(b.id)
  })

  it('leaves running timers alone and reports time left', () => {
    const state = newGame(0)
    const timer = startTimer(state, 'mining', MINUTE, 0)
    expect(new GameClock().tick(state, 30_000)).toEqual([])
    expect(state.timers).toHaveLength(1)
    expect(timeLeft(timer, 30_000)).toBe(30_000)
  })

  it('completes due timers oldest first and runs their handlers', () => {
    const state = newGame(0)
    startTimer(state, 'refining', 2 * MINUTE, 0)
    startTimer(state, 'mining', MINUTE, 0, { field: 'ore1' })
    startTimer(state, 'mining', 10 * MINUTE, 0)

    const clock = new GameClock()
    const order: string[] = []
    clock.on('mining', (s, t) => {
      order.push(t.kind)
      s.resources[t.data?.field as 'ore1'] += 5
    })
    clock.on('refining', (_, t) => order.push(t.kind))

    const done = clock.tick(state, 3 * MINUTE)
    expect(done.map((t) => t.kind)).toEqual(['mining', 'refining'])
    expect(order).toEqual(['mining', 'refining'])
    expect(state.resources.ore1).toBe(5)
    expect(state.timers).toHaveLength(1)
  })

  it('finishes timers that ended while the game was closed', () => {
    const state = newGame(0)
    startTimer(state, 'mining', MINUTE, 0, { field: 'ore2' })
    const saved = serialize(state)

    // reopened an hour later
    const loaded = deserialize(saved)
    const clock = new GameClock()
    clock.on('mining', (s) => (s.resources.ore2 += 3))
    expect(clock.tick(loaded, 60 * MINUTE)).toHaveLength(1)
    expect(loaded.resources.ore2).toBe(3)
    expect(loaded.timers).toEqual([])
  })

  it('makes timers wait longer if the device clock goes back', () => {
    const state = newGame(0)
    const timer = startTimer(state, 'mining', MINUTE, 10 * MINUTE)
    expect(new GameClock().tick(state, 5 * MINUTE)).toEqual([])
    expect(timeLeft(timer, 5 * MINUTE)).toBe(6 * MINUTE)
  })
})
