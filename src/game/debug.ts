/**
 * Testing shortcuts for the debug menu: grant resources, finish timers, spawn
 * ships, gear and captains, and move the pity counter. Not part of the game's
 * rules; they only edit the state the way the real systems would.
 */

import { GACHA } from '../data'
import { createShip, newId, RESOURCE_IDS, type GameState, type ResourceId } from './state'

export function grantResource(state: GameState, id: ResourceId, amount: number): void {
  state.resources[id] += amount
}

export function grantAllResources(state: GameState, amount: number): void {
  for (const id of RESOURCE_IDS) state.resources[id] += amount
}

/** Makes every running timer due now; the game clock completes them on its next tick. */
export function finishTimers(state: GameState, now: number): number {
  for (const timer of state.timers) timer.startedAt = Math.min(timer.startedAt, now - timer.durationMs)
  return state.timers.length
}

export function spawnShip(state: GameState, hull: string): void {
  createShip(state, hull)
}

export function spawnGear(state: GameState, type: string): void {
  state.gear.push({ id: newId(state, 'g'), type })
}

/** Adds a captain as a pull would: a duplicate becomes Limit Break material. */
export function spawnCaptain(state: GameState, def: string): void {
  const owned = state.captains.find((c) => c.def === def)
  if (owned) owned.limitBreakMaterial += GACHA.limitBreakMaterialPerDuplicate
  else state.captains.push({ id: newId(state, 'c'), def, limitBreakMaterial: 0 })
}

export function setPity(state: GameState, pity: number): void {
  state.gacha.pity = Math.max(0, Math.min(pity, GACHA.pityThreshold - 1))
}
