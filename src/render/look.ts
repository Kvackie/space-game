/**
 * Switchable 3D looks (D-111): prototypes of lighting and outline treatments
 * for the dark style, chosen in Settings so the human can compare them in game.
 */

import type { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import type { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { ColorCurves } from '@babylonjs/core/Materials/colorCurves'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import type { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline'
import type { Scene } from '@babylonjs/core/scene'
import '@babylonjs/core/Rendering/outlineRenderer'
import '@babylonjs/core/Rendering/edgesRenderer'

export const LOOKS = ['standard', 'ink', 'edges', 'noir', 'holo'] as const
export type Look = (typeof LOOKS)[number]

export const LOOK_INFO: Record<Look, { name: string; description: string }> = {
  standard: { name: 'Standard', description: 'Cold key light with a soft blue fill.' },
  ink: { name: 'Ink', description: 'Dark cel-style outlines around ships and the station.' },
  edges: { name: 'Edges', description: 'Thin holo lines on hard edges, a technical read-out feel.' },
  noir: { name: 'Noir', description: 'Hard light, deep shadows, a red rim, film grain and vignette.' },
  holo: { name: 'Holo rim', description: 'Strong cold back light that outlines silhouettes in blue.' },
}

/** The lights and pipeline a look adjusts; registered by each scene. */
export interface LookRig {
  fill: HemisphericLight
  key: DirectionalLight
  rim: DirectionalLight
  pipeline?: DefaultRenderingPipeline
}

const rigs = new Map<Scene, LookRig>()
let current: Look = 'standard'

export function registerRig(scene: Scene, rig: LookRig): void {
  rigs.set(scene, rig)
  scene.onDisposeObservable.add(() => rigs.delete(scene))
  applyToScene(scene)
}

export function registerPipeline(scene: Scene, pipeline: DefaultRenderingPipeline): void {
  const rig = rigs.get(scene)
  if (rig) {
    rig.pipeline = pipeline
    applyToScene(scene)
  }
}

/** Outlines and edge lines for one model mesh, per the current look. */
export function applyLookToMesh(mesh: AbstractMesh): void {
  mesh.renderOutline = current === 'ink'
  mesh.outlineColor = Color3.Black()
  mesh.outlineWidth = 0.14
  if (current === 'edges') {
    mesh.enableEdgesRendering(0.95)
    mesh.edgesColor = new Color4(0.45, 0.85, 1, 1)
    mesh.edgesWidth = 6
  } else {
    mesh.disableEdgesRendering()
  }
}

interface LookSettings {
  fill: number
  key: number
  keyColour: string
  rim: number
  rimColour: string
  /** colour grading: saturation (-100..100), hue tint in degrees and its strength */
  saturation: number
  tintHue: number
  tint: number
  contrast: number
  grain: number
  vignette: number
  bloomWeight: number
  bloomThreshold: number
}

const SETTINGS: Record<Look, LookSettings> = {
  standard: {
    fill: 0.6,
    key: 1.6,
    keyColour: '#c9d6ec',
    rim: 0,
    rimColour: '#5fa8d9',
    saturation: 0,
    tintHue: 0,
    tint: 0,
    contrast: 1,
    grain: 0,
    vignette: 0,
    bloomWeight: 0.25,
    bloomThreshold: 0.9,
  },
  // flat, bright toon shading with thick black outlines
  ink: {
    fill: 1.3,
    key: 0.9,
    keyColour: '#ffffff',
    rim: 0,
    rimColour: '#5fa8d9',
    saturation: 25,
    tintHue: 0,
    tint: 0,
    contrast: 1.15,
    grain: 0,
    vignette: 0,
    bloomWeight: 0.15,
    bloomThreshold: 0.95,
  },
  // dark hulls so the bright edge lines read like a tactical display
  edges: {
    fill: 0.2,
    key: 0.7,
    keyColour: '#9fb6d6',
    rim: 0.6,
    rimColour: '#5fa8d9',
    saturation: -40,
    tintHue: 205,
    tint: 35,
    contrast: 1.1,
    grain: 0,
    vignette: 1.5,
    bloomWeight: 0.45,
    bloomThreshold: 0.7,
  },
  // near monochrome, hard key, deep shadows, red rim, grain and vignette
  noir: {
    fill: 0.04,
    key: 3.2,
    keyColour: '#fff4e6',
    rim: 3.5,
    rimColour: '#ff3b30',
    saturation: -80,
    tintHue: 0,
    tint: 0,
    contrast: 1.7,
    grain: 30,
    vignette: 5,
    bloomWeight: 0.3,
    bloomThreshold: 0.85,
  },
  // silhouettes outlined by a strong cyan back light, extra glow, cool grade
  holo: {
    fill: 0.12,
    key: 0.5,
    keyColour: '#9fb6d6',
    rim: 5,
    rimColour: '#6fd8ff',
    saturation: 10,
    tintHue: 195,
    tint: 45,
    contrast: 1.2,
    grain: 0,
    vignette: 2,
    bloomWeight: 0.9,
    bloomThreshold: 0.45,
  },
}

function applyToScene(scene: Scene): void {
  const rig = rigs.get(scene)
  if (!rig) return
  const { fill, key, rim, pipeline } = rig
  const s = SETTINGS[current]
  fill.intensity = s.fill
  key.intensity = s.key
  key.diffuse = Color3.FromHexString(s.keyColour)
  rim.intensity = s.rim
  rim.diffuse = Color3.FromHexString(s.rimColour)

  if (pipeline) {
    pipeline.grainEnabled = s.grain > 0
    pipeline.grain.intensity = s.grain
    pipeline.grain.animated = true
    const image = pipeline.imageProcessing
    image.vignetteEnabled = s.vignette > 0
    image.vignetteWeight = s.vignette
    image.contrast = s.contrast
    image.colorCurvesEnabled = s.saturation !== 0 || s.tint > 0
    const curves = image.colorCurves ?? new ColorCurves()
    curves.globalSaturation = s.saturation
    curves.globalHue = s.tintHue
    curves.globalDensity = s.tint
    image.colorCurves = curves
    pipeline.bloomWeight = s.bloomWeight
    pipeline.bloomThreshold = s.bloomThreshold
  }

  for (const mesh of scene.meshes) if (mesh.metadata?.model) applyLookToMesh(mesh)
}

export function setLook(look: Look): void {
  if (look === current) return
  current = LOOKS.includes(look) ? look : 'standard'
  for (const scene of rigs.keys()) applyToScene(scene)
}
