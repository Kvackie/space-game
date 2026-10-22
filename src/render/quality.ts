/**
 * The shared post-processing pipeline and the graphics quality setting (D-94).
 * High: subtle glow on lights, anti-aliasing, sharp on high-DPI screens.
 * Low: no glow or anti-aliasing, one render pixel per CSS pixel.
 */

import type { Camera } from '@babylonjs/core/Cameras/camera'
import type { Engine } from '@babylonjs/core/Engines/engine'
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration'
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline'
import type { Scene } from '@babylonjs/core/scene'
import type { Settings } from '../game/state'

/** Device pixel ratio cap on High: sharper than this costs a lot on phones for little gain. */
const MAX_PIXEL_RATIO = 2

const pipelines = new Set<DefaultRenderingPipeline>()
let quality: Settings['quality'] = 'high'
let applied: Settings['quality'] | null = null

function configure(pipeline: DefaultRenderingPipeline): void {
  pipeline.samples = quality === 'high' ? 4 : 1
  pipeline.bloomEnabled = quality === 'high'
}

export function createPipeline(scene: Scene, camera: Camera): DefaultRenderingPipeline {
  const pipeline = new DefaultRenderingPipeline(`${scene.uid}-pipeline`, true, scene, [camera])
  // an extremely subtle glow, on the brightest lights only (D-119)
  pipeline.bloomThreshold = 0.9
  pipeline.bloomWeight = 0.1
  pipeline.bloomKernel = 32
  pipeline.bloomScale = 0.5
  pipeline.imageProcessingEnabled = true
  pipeline.imageProcessing.toneMappingEnabled = true
  pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL
  configure(pipeline)
  pipelines.add(pipeline)
  scene.onDisposeObservable.add(() => pipelines.delete(pipeline))
  return pipeline
}

export function applyQuality(engine: Engine, value: Settings['quality']): void {
  if (value === applied) return
  applied = quality = value
  const ratio = value === 'high' ? Math.min(devicePixelRatio, MAX_PIXEL_RATIO) : 1
  engine.setHardwareScalingLevel(1 / ratio)
  for (const pipeline of pipelines) configure(pipeline)
}
