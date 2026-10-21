/**
 * The station hub's 3D scene. The station itself is a placeholder built from
 * primitives until the Blender models exist; the lighting, backdrop and glow
 * follow the dark style (D-78, D-84).
 */

import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import type { Engine } from '@babylonjs/core/Engines/engine'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder'
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder'
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline'
import { Scene } from '@babylonjs/core/scene'

const COLOURS = {
  bg: '#070b14',
  hull: '#56627a',
  hullDark: '#1c2333',
  panel: '#1a2a4a',
  signal: '#e2473f',
  holo: '#5fa8d9',
}

/** Seeded star field drawn on a canvas, so the backdrop needs no image file. */
function starTexture(scene: Scene): Texture {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')!
  g.fillStyle = COLOURS.bg
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

function buildStation(scene: Scene): TransformNode {
  const root = new TransformNode('station', scene)
  const hull = material(scene, 'hull', COLOURS.hull)
  const hullDark = material(scene, 'hull-dark', COLOURS.hullDark)
  const panel = material(scene, 'panel', COLOURS.panel)
  const signal = material(scene, 'signal', COLOURS.signal, true)
  const holo = material(scene, 'holo', COLOURS.holo, true)

  const add = (mesh: Mesh, mat: StandardMaterial, parent: TransformNode = root) => {
    mesh.material = mat
    mesh.parent = parent
    return mesh
  }

  add(CreateCylinder('hub', { height: 6, diameter: 4, tessellation: 16 }, scene), hull)
  add(
    CreateCylinder('hub-top', { height: 1.5, diameterTop: 1.6, diameterBottom: 4, tessellation: 16 }, scene),
    hullDark,
  ).position.y = 3.75
  add(
    CreateCylinder('hub-bottom', { height: 1.5, diameterTop: 4, diameterBottom: 1.6, tessellation: 16 }, scene),
    hullDark,
  ).position.y = -3.75
  for (const y of [1.5, -1.5]) {
    add(CreateCylinder('band', { height: 0.3, diameter: 4.1, tessellation: 16 }, scene), holo).position.y = y
  }
  add(CreateBox('spine', { width: 0.8, depth: 0.8, height: 10 }, scene), hullDark)

  for (const y of [5, -5]) {
    for (const side of [1, -1]) {
      const p = add(CreateBox('solar', { width: 6, height: 1.6, depth: 0.06 }, scene), panel)
      p.position.set(side * 3.6, y, 0)
      p.rotation.x = Math.PI / 2
    }
  }

  // the ring spins slowly; its warning lights carry the signal red accent
  const ring = new TransformNode('ring', scene)
  ring.parent = root
  add(CreateTorus('ring-body', { diameter: 20, thickness: 1.6, tessellation: 48 }, scene), hull, ring)
  for (let i = 0; i < 4; i++) {
    const spoke = add(CreateBox('spoke', { width: 8, height: 0.4, depth: 0.4 }, scene), hullDark, ring)
    const a = (i * Math.PI) / 2
    spoke.position.set(Math.cos(a) * 6, 0, Math.sin(a) * 6)
    spoke.rotation.y = -a
  }
  for (let i = 0; i < 12; i++) {
    const light = add(CreateBox('ring-light', { size: 0.3 }, scene), i % 3 === 0 ? signal : holo, ring)
    const a = (i * Math.PI) / 6
    light.position.set(Math.cos(a) * 10, 0.85, Math.sin(a) * 10)
  }
  scene.onBeforeRenderObservable.add(() => {
    ring.rotation.y += scene.getEngine().getDeltaTime() * 0.00008
  })

  return root
}

export function createStationScene(engine: Engine): Scene {
  const scene = new Scene(engine)
  scene.clearColor = Color4.FromHexString(`${COLOURS.bg}ff`)

  const camera = new ArcRotateCamera('camera', -Math.PI / 3, Math.PI / 2.6, 52, Vector3.Zero(), scene)
  camera.fov = 0.8
  camera.minZ = 0.1
  camera.maxZ = 2000
  scene.onBeforeRenderObservable.add(() => {
    camera.alpha += scene.getEngine().getDeltaTime() * 0.00002
  })

  const fill = new HemisphericLight('fill', new Vector3(0, 1, 0), scene)
  fill.diffuse = Color3.FromHexString('#5a6f96')
  fill.groundColor = Color3.FromHexString('#0b0f1c')
  fill.intensity = 0.55
  const key = new DirectionalLight('key', new Vector3(-0.6, -0.4, -0.7), scene)
  key.diffuse = Color3.FromHexString('#c9d6ec')
  key.intensity = 1.4

  const sky = CreateSphere('sky', { diameter: 1600, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene)
  const skyMat = new StandardMaterial('sky', scene)
  skyMat.disableLighting = true
  skyMat.emissiveTexture = starTexture(scene)
  skyMat.disableDepthWrite = true
  sky.material = skyMat
  sky.isPickable = false
  sky.infiniteDistance = true

  buildStation(scene)

  // subtle glow on emissive lights only (bloom kept low, see the prototype review)
  const pipeline = new DefaultRenderingPipeline('pipeline', true, scene, [camera])
  pipeline.samples = 4
  pipeline.bloomEnabled = true
  pipeline.bloomThreshold = 0.9
  pipeline.bloomWeight = 0.25
  pipeline.bloomKernel = 32
  pipeline.bloomScale = 0.5
  pipeline.imageProcessingEnabled = true
  pipeline.imageProcessing.toneMappingEnabled = true
  pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL

  return scene
}
