/**
 * Engine-agnostic scene layouts. Every stack reads the same numbers, so the
 * comparison is about the renderer, not about what is on screen.
 *
 * Coordinates are glTF/three.js style: right-handed, +Y up, models face +Z.
 */

export type SceneId = 'ship' | 'station' | 'battle'
export type ModelId = 'hero' | 'frigate' | 'enemy' | 'station'
export type Vec3 = [number, number, number]

export const SCENES: SceneId[] = ['ship', 'station', 'battle']

/** Bloom settings every stack uses: strength, radius (0-1), luminance threshold. */
export const BLOOM = { strength: 0.25, radius: 0.2, threshold: 0.92 }
export const MODELS: ModelId[] = ['hero', 'frigate', 'enemy', 'station']

/** Pages live one folder down (three/, babylon/, ...); models sit in the public root. */
export const modelUrl = (id: ModelId) => `../models/${id}.glb`

/** Engine exhaust points in model space, for the 2D glow sprites. */
export const ENGINES: Record<Exclude<ModelId, 'station'>, Vec3[]> = {
  hero: [[0.62, -0.05, -2.15], [-0.62, -0.05, -2.15], [0, 0, -2.1]],
  frigate: [[0.75, 0, -1.65], [-0.75, 0, -1.65]],
  enemy: [[0, 0, -1.75]],
}

export const TEAM_COLOURS = ['#4fb8ff', '#ff5a6e'] as const

export interface Placement {
  model: ModelId
  position: Vec3
  yaw: number
  bank: number
}

export interface CameraPose {
  position: Vec3
  target: Vec3
}

/** Background art. The nebula and stars wrap the scene; the planet is a flat sprite. */
export const BACKDROP = {
  nebulaRadius: 900,
  starRadii: [700, 520],
  /** stars per 1024 px tile, largest star radius in px, tile repeats around the sphere */
  starLayers: [
    { count: 260, size: 0.9, repeat: [8, 4] as [number, number] },
    { count: 90, size: 1.6, repeat: [6, 3] as [number, number] },
  ],
  planet: { position: [-380, 60, -560] as Vec3, size: 200 },
}

// ------------------------------------------------------------------ ship ---

export function shipScene(t: number): Placement[] {
  return [
    { model: 'hero', position: [0, Math.sin(t * 0.8) * 0.15, 0], yaw: 0, bank: Math.sin(t * 0.6) * 0.18 },
    { model: 'frigate', position: [-5, -1 + Math.sin(t + 1) * 0.2, 4], yaw: 0, bank: Math.sin(t * 0.7 + 1) * 0.12 },
    { model: 'frigate', position: [4, -1.2 + Math.sin(t + 2) * 0.2, 6], yaw: 0, bank: Math.sin(t * 0.7 + 2) * 0.12 },
  ]
}

export function shipCamera(t: number): CameraPose {
  // swing around the rear quarter so the engines and escorts stay in view
  const a = 2.3 + Math.sin(t * 0.15) * 0.6
  return { position: [Math.sin(a) * 13, 3 + Math.sin(t * 0.2), Math.cos(a) * 13], target: [0, 0, -1] }
}

// --------------------------------------------------------------- station ---

export const STATION_ORBITERS = 8

export function stationScene(t: number): { ringAngle: number; ships: Placement[] } {
  const ships: Placement[] = []
  for (let i = 0; i < STATION_ORBITERS; i++) {
    const r = 17 + i * 1.6
    const speed = 0.12 + (i % 3) * 0.04
    const a = t * speed + (i * Math.PI * 2) / STATION_ORBITERS
    // tangent of a counter-clockwise orbit, as a yaw about +Y
    ships.push({
      model: 'frigate',
      position: [Math.cos(a) * r, ((i % 3) - 1) * 4, -Math.sin(a) * r],
      yaw: Math.PI + a,
      bank: -0.25,
    })
  }
  return { ringAngle: t * 0.15, ships }
}

export function stationCamera(t: number): CameraPose {
  const a = 0.4 + t * 0.05
  return { position: [Math.sin(a) * 50, 16, Math.cos(a) * 50], target: [0, 0, 0] }
}

// ---------------------------------------------------------------- battle ---

export function battleCamera(t: number, fieldSize: number): CameraPose {
  const d = 40 + fieldSize * 1.1
  return {
    position: [Math.sin(t * 0.05) * d * 0.4 + d * 0.5, d * 0.55, d * 0.6],
    target: [0, 0, 0],
  }
}
