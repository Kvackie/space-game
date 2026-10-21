/**
 * The save format: readable JSON, versioned from the start (D-75, D-93).
 *
 * Import checks the structure only (D-75): right shape and types, a version
 * this build understands. It does not try to detect hand-edited values.
 */

import { RESOURCE_IDS, type GameState } from '../game/state'

export const SAVE_VERSION = 1

/**
 * Upgrades a save one version at a time: MIGRATIONS[n] turns version n into
 * version n + 1. Empty until the format first changes.
 */
const MIGRATIONS: Record<number, (save: Record<string, unknown>) => Record<string, unknown>> = {}

export class SaveError extends Error {}

export function serialize(state: GameState): string {
  return JSON.stringify(state, null, 2)
}

export function deserialize(text: string): GameState {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new SaveError('The file is not valid JSON.')
  }
  return validate(migrate(raw))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function migrate(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) throw new SaveError('The save is not a JSON object.')
  if (!Number.isInteger(raw.version) || (raw.version as number) < 1)
    throw new SaveError('The save has no valid version.')
  if ((raw.version as number) > SAVE_VERSION) {
    throw new SaveError(`The save is from a newer version of the game (save v${raw.version}, game v${SAVE_VERSION}).`)
  }
  let save = raw
  for (let v = save.version as number; v < SAVE_VERSION; v++) {
    const step = MIGRATIONS[v]
    if (!step) throw new SaveError(`No upgrade path from save version ${v}.`)
    save = { ...step(save), version: v + 1 }
  }
  return save
}

function validate(save: Record<string, unknown>): GameState {
  const fail = (what: string): never => {
    throw new SaveError(`The save is damaged: ${what}.`)
  }

  if (!isNumber(save.createdAt)) fail('createdAt')
  if (!isNumber(save.savedAt)) fail('savedAt')
  if (!Number.isInteger(save.nextId)) fail('nextId')

  if (!isRecord(save.resources)) fail('resources')
  const resources = save.resources as Record<string, unknown>
  for (const id of RESOURCE_IDS) if (!isNumber(resources[id])) fail(`resources.${id}`)

  if (!Array.isArray(save.timers)) fail('timers')
  for (const [i, timer] of (save.timers as unknown[]).entries()) {
    if (
      !isRecord(timer) ||
      typeof timer.id !== 'string' ||
      typeof timer.kind !== 'string' ||
      !isNumber(timer.startedAt) ||
      !isNumber(timer.durationMs) ||
      (timer.data !== undefined && !isRecord(timer.data))
    ) {
      fail(`timers[${i}]`)
    }
  }

  return save as unknown as GameState
}
