/** Manual export and import of the save file (D-16, D-75). */

import type { GameState } from '../game/state'
import { deserialize, serialize } from './saveFile'

const pad = (n: number) => String(n).padStart(2, '0')

export function exportFileName(date: Date): string {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return `save-${day}-${pad(date.getHours())}${pad(date.getMinutes())}.json`
}

/** Downloads the current game as a readable JSON file. */
export function exportSave(state: GameState, now = new Date()): void {
  const url = URL.createObjectURL(new Blob([serialize(state)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = exportFileName(now)
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Reads and checks a save file; throws SaveError if it is not usable. */
export async function importSave(file: Blob): Promise<GameState> {
  return deserialize(await file.text())
}
