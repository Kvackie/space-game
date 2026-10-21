/**
 * Pieces every 3D scene shares: the dark backdrop, lighting, and loading the
 * Blender-made placeholder models (blender/scripts/build_placeholder_models.py).
 */

import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { AssetContainer } from '@babylonjs/core/assetContainer'
import type { Scene } from '@babylonjs/core/scene'
import '@babylonjs/loaders/glTF/2.0'

export const BG = '#070b14'

/** Seeded star field drawn on a canvas, so the backdrop needs no image file. */
function starTexture(scene: Scene): Texture {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')!
  g.fillStyle = BG
  g.fillRect(0, 0, size, size)
  let seed = 7
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  for (let i = 0; i < 420; i++) {
    const r = random() < 0.92 ? 0.6 : 1.3
    g.fillStyle = `rgba(${200 + random() * 55}, ${210 + random() * 45}, 255, ${0.25 + random() * 0.6})`
    g.beginPath()
    g.arc(random() * size, random() * size, r, 0, Math.PI * 2)
    g.fill()
  }
  const texture = new Texture(canvas.toDataURL(), scene)
  texture.uScale = 4
  texture.vScale = 2
  return texture
}

/** Dark space with stars, and cold key + dim fill lighting (D-78, D-84). */
export function setUpSpace(scene: Scene): void {
  // glTF models are right-handed; matching avoids mirrored ships
  scene.useRightHandedSystem = true
  scene.clearColor = Color4.FromHexString(`${BG}ff`)

  const fill = new HemisphericLight('fill', new Vector3(0, 1, 0), scene)
  fill.diffuse = Color3.FromHexString('#5a6f96')
  fill.groundColor = Color3.FromHexString('#0b0f1c')
  fill.intensity = 0.6
  const key = new DirectionalLight('key', new Vector3(-0.6, -0.4, -0.7), scene)
  key.diffuse = Color3.FromHexString('#c9d6ec')
  key.intensity = 1.6

  const sky = CreateSphere('sky', { diameter: 1600, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene)
  const material = new StandardMaterial('sky', scene)
  material.disableLighting = true
  material.disableDepthWrite = true
  material.backFaceCulling = false
  // black until the star texture has loaded, rather than lit grey-blue
  material.diffuseColor = Color3.Black()
  material.specularColor = Color3.Black()
  material.emissiveTexture = starTexture(scene)
  sky.material = material
  sky.isPickable = false
  sky.infiniteDistance = true
}

export type ModelName = 'barge' | 'frigate' | 'pirate' | 'station'

const modelUrl = (name: ModelName) => `${import.meta.env.BASE_URL}assets/models/${name}.glb`

export function loadModel(scene: Scene, name: ModelName): Promise<AssetContainer> {
  return LoadAssetContainerAsync(modelUrl(name), scene)
}

/** A fresh copy of a loaded model in its scene. */
export function instantiate(container: AssetContainer, name: string): TransformNode {
  const { rootNodes } = container.instantiateModelsToScene((source) => `${name}-${source}`, false, {
    doNotInstantiate: true,
  })
  return rootNodes[0] as TransformNode
}
