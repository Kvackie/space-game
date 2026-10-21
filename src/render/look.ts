/**
 * Switchable 3D looks (D-111): prototypes of lighting and outline treatments
 * for the dark style, chosen in Settings so the human can compare them in game.
 */

import type { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import type { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
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
  mesh.outlineColor = Color3.FromHexString('#05070c')
  mesh.outlineWidth = 0.05
  if (current === 'edges') {
    mesh.enableEdgesRendering(0.95)
    mesh.edgesColor = new Color4(0.37, 0.66, 0.85, 0.75)
    mesh.edgesWidth = 2.5
  } else {
    mesh.disableEdgesRendering()
  }
}

function applyToScene(scene: Scene): void {
  const rig = rigs.get(scene)
  if (!rig) return
  const { fill, key, rim, pipeline } = rig
  const settings: Record<Look, { fill: number; key: number; keyColour: string; rim: number; rimColour: string }> = {
    standard: { fill: 0.6, key: 1.6, keyColour: '#c9d6ec', rim: 0, rimColour: '#5fa8d9' },
    ink: { fill: 0.75, key: 1.5, keyColour: '#dfe6f2', rim: 0, rimColour: '#5fa8d9' },
    edges: { fill: 0.45, key: 1.3, keyColour: '#c9d6ec', rim: 0.4, rimColour: '#5fa8d9' },
    noir: { fill: 0.12, key: 2.6, keyColour: '#f1e6d6', rim: 1.6, rimColour: '#e2473f' },
    holo: { fill: 0.35, key: 1.1, keyColour: '#c9d6ec', rim: 2.4, rimColour: '#7fc4f0' },
  }
  const s = settings[current]
  fill.intensity = s.fill
  key.intensity = s.key
  key.diffuse = Color3.FromHexString(s.keyColour)
  rim.intensity = s.rim
  rim.diffuse = Color3.FromHexString(s.rimColour)

  if (pipeline) {
    const noir = current === 'noir'
    pipeline.grainEnabled = noir
    pipeline.grain.intensity = 12
    pipeline.grain.animated = true
    pipeline.imageProcessing.vignetteEnabled = noir
    pipeline.imageProcessing.vignetteWeight = 2.5
    pipeline.imageProcessing.contrast = noir ? 1.35 : 1
    pipeline.imageProcessing.exposure = noir ? 0.95 : 1
  }

  for (const mesh of scene.meshes) if (mesh.metadata?.model) applyLookToMesh(mesh)
}

export function setLook(look: Look): void {
  if (look === current) return
  current = LOOKS.includes(look) ? look : 'standard'
  for (const scene of rigs.keys()) applyToScene(scene)
}
