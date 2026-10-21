/**
 * The save format: readable JSON, versioned from the start (D-75, D-93).
 *
 * Import checks the structure only (D-75): right shape and types, a version
 * this build understands. It does not try to detect hand-edited values.
 */

import { HULLS, STARTING_SHIP } from '../data'
import { DEFAULT_SETTINGS, RESOURCE_IDS, type GameState } from '../game/state'

export const SAVE_VERSION = 3

type RawSave = Record<string, unknown>

/** Upgrades a save one version at a time: MIGRATIONS[n] turns version n into n + 1. */
const MIGRATIONS: Record<number, (save: RawSave) => RawSave> = {
  // v2: materials and components, ships (with the free starting ship), gear,
  // captains, gacha pity, battle records and settings
  1: (save) => {
    let nextId = save.nextId as number
    const hull = HULLS[STARTING_SHIP]
    return {
      ...save,
      resources: { material1: 0, material2: 0, component: 0, ...(save.resources as object) },
      ships: [
        {
          id: `s${nextId++}`,
          hull: STARTING_SHIP,
          name: `${hull.name} 1`,
          gear: Array(hull.gearSlots).fill(null),
          captainId: null,
        },
      ],
      gear: [],
      captains: [],
      gacha: { pity: 0 },
      battles: [],
      settings: { ...DEFAULT_SETTINGS },
      nextId,
    }
  },
  // v3: duplicates become Limit Break material (D-108); pull history (D-109)
  2: (save) => ({
    ...save,
    captains: (save.captains as RawSave[]).map(({ duplicates, ...captain }) => ({
      ...captain,
      limitBreakMaterial: Number(duplicates) || 0,
    })),
    gacha: { ...(save.gacha as RawSave), history: [] },
  }),
}

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

function isRecord(value: unknown): value is RawSave {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isString = (value: unknown): value is string => typeof value === 'string'
const isStringOrNull = (value: unknown) => value === null || isString(value)

function migrate(raw: unknown): RawSave {
  if (!isRecord(raw)) throw new SaveError('The save is not a JSON object.')
  if (!Number.isInteger(raw.version) || (raw.version as number) < 1) {
    throw new SaveError('The save has no valid version.')
  }
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

function validate(save: RawSave): GameState {
  const fail = (what: string): never => {
    throw new SaveError(`The save is damaged: ${what}.`)
  }
  /** Checks an array field whose items must each pass `ok`. */
  const list = (field: string, ok: (item: RawSave) => boolean) => {
    const value = save[field]
    if (!Array.isArray(value)) fail(field)
    ;(value as unknown[]).forEach((item, i) => {
      if (!isRecord(item) || !ok(item)) fail(`${field}[${i}]`)
    })
  }

  if (!isNumber(save.createdAt)) fail('createdAt')
  if (!isNumber(save.savedAt)) fail('savedAt')
  if (!Number.isInteger(save.nextId)) fail('nextId')

  if (!isRecord(save.resources)) fail('resources')
  const resources = save.resources as RawSave
  for (const id of RESOURCE_IDS) if (!isNumber(resources[id])) fail(`resources.${id}`)

  list(
    'timers',
    (t) =>
      isString(t.id) &&
      isString(t.kind) &&
      isNumber(t.startedAt) &&
      isNumber(t.durationMs) &&
      (t.data === undefined || isRecord(t.data)),
  )
  list(
    'ships',
    (s) =>
      isString(s.id) &&
      isString(s.hull) &&
      isString(s.name) &&
      Array.isArray(s.gear) &&
      s.gear.every(isStringOrNull) &&
      isStringOrNull(s.captainId),
  )
  list('gear', (g) => isString(g.id) && isString(g.type))
  list('captains', (c) => isString(c.id) && isString(c.def) && isNumber(c.limitBreakMaterial))
  list(
    'battles',
    (b) =>
      isString(b.id) &&
      isNumber(b.at) &&
      isNumber(b.seed) &&
      Array.isArray(b.fighters) &&
      typeof b.won === 'boolean' &&
      isRecord(b.rewards),
  )

  if (!isRecord(save.gacha) || !isNumber(save.gacha.pity)) fail('gacha')
  const history = (save.gacha as RawSave).history
  if (
    !Array.isArray(history) ||
    !history.every((p) => isRecord(p) && isNumber(p.at) && isString(p.def) && typeof p.duplicate === 'boolean')
  ) {
    fail('gacha.history')
  }
  if (!isRecord(save.settings) || !['high', 'low'].includes(save.settings.quality as string)) fail('settings')
  if (typeof (save.settings as RawSave).showFps !== 'boolean') fail('settings.showFps')

  return save as unknown as GameState
}
