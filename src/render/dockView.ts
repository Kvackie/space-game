/**
 * The Fleet view (D-114): a docking bay with the selected ship on a slowly
 * turning cradle. Selecting another ship swaps the ship in the bay.
 */

import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import type { Engine } from '@babylonjs/core/Engines/engine'
import { PointLight } from '@babylonjs/core/Lights/pointLight'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector2, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder'
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder'
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { AssetContainer } from '@babylonjs/core/assetContainer'
import { Scene } from '@babylonjs/core/scene'
import { instantiate, loadModel, setUpSpace, type ModelName } from './common'
import { createPipeline } from './quality'

export interface DockView {
  scene: Scene
  /** Puts this hull's model in the bay (no-op if it is already there). */
  show(hull: string, key: string): void
}

/** Deck plating with a grid, hazard stripes and the cradle's landing ring. */
function deckTexture(scene: Scene): Texture {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')!
  g.fillStyle = '#141a26'
  g.fillRect(0, 0, size, size)
  g.strokeStyle = '#22304a'
  g.lineWidth = 3
  for (let i = 0; i <= size; i += 64) {
    g.beginPath()
    g.moveTo(i, 0)
    g.lineTo(i, size)
    g.moveTo(0, i)
    g.lineTo(size, i)
    g.stroke()
  }
  // hazard stripes along the front edge
  for (let x = -64; x < size; x += 64) {
    g.fillStyle = '#b8892a'
    g.beginPath()
    g.moveTo(x, size - 60)
    g.lineTo(x + 32, size - 60)
    g.lineTo(x + 64, size - 10)
    g.lineTo(x + 32, size - 10)
    g.closePath()
    g.fill()
  }
  g.strokeStyle = '#5fa8d9'
  g.lineWidth = 6
  g.beginPath()
  g.arc(size / 2, size / 2, 260, 0, Math.PI * 2)
  g.stroke()
  g.strokeStyle = '#e2473f'
  g.lineWidth = 4
  g.setLineDash([24, 18])
  g.beginPath()
  g.arc(size / 2, size / 2, 300, 0, Math.PI * 2)
  g.stroke()
  return new Texture(canvas.toDataURL(), scene)
}

function material(scene: Scene, name: string, colour: string, emissive = false): StandardMaterial {
  const m = new StandardMaterial(name, scene)
  const c = Color3.FromHexString(colour)
  if (emissive) {
    m.disableLighting = true
    m.emissiveColor = c
  } else {
    m.diffuseColor = c
    m.specularColor = new Color3(0.15, 0.17, 0.2)
  }
  return m
}

function buildBay(scene: Scene): void {
  const steel = material(scene, 'bay-steel', '#2a3346')
  const dark = material(scene, 'bay-dark', '#161c28')
  const strip = material(scene, 'bay-strip', '#5fa8d9', true)
  const warn = material(scene, 'bay-warn', '#e2473f', true)

  const deck = CreateGround('deck', { width: 60, height: 60 }, scene)
  const deckMat = material(scene, 'deck', '#ffffff')
  deckMat.diffuseTexture = deckTexture(scene)
  deck.material = deckMat
  deck.position.y = -3

  const add = (mesh: Mesh, mat: StandardMaterial, x: number, y: number, z: number) => {
    mesh.material = mat
    mesh.position.set(x, y, z)
    mesh.isPickable = false
    return mesh
  }

  // back wall with ribs and light strips
  add(CreateBox('wall', { width: 60, height: 26, depth: 1 }, scene), dark, 0, 10, 22)
  for (let x = -24; x <= 24; x += 8) {
    add(CreateBox('rib', { width: 1.2, height: 26, depth: 2 }, scene), steel, x, 10, 21)
    add(CreateBox('strip', { width: 0.25, height: 18, depth: 0.2 }, scene), strip, x + 0.8, 10, 19.9)
  }
  // overhead gantry and crane
  add(CreateBox('gantry', { width: 44, height: 1.4, depth: 2 }, scene), steel, 0, 14, 4)
  add(CreateBox('crane', { width: 2.4, height: 1.2, depth: 3 }, scene), dark, 4, 12.8, 4)
  add(CreateBox('crane-light', { width: 2, height: 0.15, depth: 2.4 }, scene), strip, 4, 12.15, 4)
  // side towers with warning lights
  for (const x of [-18, 18]) {
    add(CreateBox('tower', { width: 3, height: 18, depth: 3 }, scene), steel, x, 6, 6)
    for (let y = 0; y < 3; y++)
      add(CreateBox('warn', { size: 0.5 }, scene), warn, x + Math.sign(-x) * 1.6, 2 + y * 5, 6)
    // docking clamps reaching towards the cradle
    add(CreateBox('clamp', { width: 7, height: 0.8, depth: 1.2 }, scene), dark, x * 0.62, 0.5, 0)
  }
  // the cradle the ship sits above
  add(CreateCylinder('cradle', { height: 0.6, diameter: 9, tessellation: 32 }, scene), steel, 0, -2.7, 0)
  add(CreateTorus('cradle-ring', { diameter: 9.2, thickness: 0.18, tessellation: 48 }, scene), strip, 0, -2.35, 0)

  const glow = new PointLight('bay-light', new Vector3(0, 11, -2), scene)
  glow.diffuse = Color3.FromHexString('#9fd2f5')
  glow.intensity = 0.6
  glow.range = 40
}

export async function createDockView(engine: Engine): Promise<DockView> {
  const scene = new Scene(engine)
  // the camera looks in from the -Z side
  setUpSpace(scene, new Vector3(0.3, -0.2, -1))
  const camera = new ArcRotateCamera('camera', -1.9, 1.22, 21, new Vector3(0, -0.8, 0), scene)
  camera.fov = 0.8
  camera.minZ = 0.1
  // shift the ship left, clear of the Fleet panel on the right
  camera.targetScreenOffset = new Vector2(-4, 0)
  createPipeline(scene, camera)
  buildBay(scene)

  const models = Object.fromEntries(
    await Promise.all((['barge', 'frigate'] as ModelName[]).map(async (m) => [m, await loadModel(scene, m)] as const)),
  ) as Record<string, AssetContainer>

  let shown: { key: string; node: TransformNode } | null = null
  let appear = 1
  let time = 0
  scene.onBeforeRenderObservable.add(() => {
    const dt = engine.getDeltaTime() / 1000
    time += dt
    if (!shown) return
    appear = Math.min(1, appear + dt * 3)
    shown.node.rotation.y = time * 0.25
    // hover just above the cradle
    shown.node.position.y = -1.1 + Math.sin(time * 0.8) * 0.15
    // swap-in: settle down onto the cradle and grow to full size
    shown.node.scaling.setAll(1.8 * (0.85 + 0.15 * appear))
    shown.node.position.y += (1 - appear) * 3
  })

  return {
    scene,
    show(hull, key) {
      if (shown?.key === key) return
      shown?.node.dispose()
      const node = instantiate(models[hull] ?? models.frigate, `bay-${key}`)
      node.rotationQuaternion = null
      shown = { key, node }
      appear = 0
    },
  }
}
