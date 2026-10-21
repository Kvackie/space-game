/**
 * Stack 2: Babylon.js renders everything 3D and the 2D effects (as sprites);
 * the game UI is DOM. One canvas, one WebGL context.
 *
 * The scene runs right-handed so the shared layouts (glTF / three.js style)
 * apply unchanged.
 */

import { Constants } from '@babylonjs/core/Engines/constants'
import { Engine } from '@babylonjs/core/Engines/engine'
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader'
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline'
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents'
import { Scene } from '@babylonjs/core/scene'
import { Sprite } from '@babylonjs/core/Sprites/sprite'
import { SpriteManager } from '@babylonjs/core/Sprites/spriteManager'
import { TargetCamera } from '@babylonjs/core/Cameras/targetCamera'
// side-effect registrations: thin instances, picking rays, sprites, glTF loader
import '@babylonjs/core/Meshes/thinInstanceMesh'
import '@babylonjs/core/Culling/ray'
import '@babylonjs/core/Sprites/spriteSceneComponent'
import '@babylonjs/loaders/glTF/2.0'

import { Battle, BEAM_TTL, BLAST_TTL, MAX_HP } from '../shared/battle'
import { FrameStats } from '../shared/bench'
import { createDomGameUi } from '../shared/gameUi'
import { createHud } from '../shared/hud'
import {
  BACKDROP,
  battleCamera,
  BLOOM,
  ENGINES,
  MODELS,
  modelUrl,
  shipCamera,
  shipScene,
  stationCamera,
  stationScene,
  TEAM_COLOURS,
  type CameraPose,
  type ModelId,
  type Placement,
  type SceneId,
} from '../shared/scenes'
import { DEFAULT_SHIPS, MAX_PIXEL_RATIO, type StackApp } from '../shared/stack'
import * as tex from '../shared/textures'
import '../shared/style.css'

const MAX_SHIPS_PER_TEAM = 256
const MAX_BEAMS = 1024
const MAX_BLASTS = 96

const stats = new FrameStats()
const canvas = document.getElementById('stage') as HTMLCanvasElement

const engine = new Engine(canvas, true, { powerPreference: 'high-performance' }, true)
engine.setHardwareScalingLevel(1 / Math.min(devicePixelRatio, MAX_PIXEL_RATIO))
const scene = new Scene(engine)
scene.useRightHandedSystem = true
scene.clearColor = new Color4(0.04, 0.06, 0.13, 1)
addEventListener('resize', () => engine.resize())

const camera = new TargetCamera('camera', new Vector3(0, 5, 10), scene)
camera.fov = (45 * Math.PI) / 180
camera.minZ = 0.1
camera.maxZ = 2500

const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene)
hemi.diffuse = Color3.FromHexString('#cfe4ff')
hemi.groundColor = Color3.FromHexString('#302850')
hemi.intensity = 1.1
const key = new DirectionalLight('key', new Vector3(-30, -40, -20).normalize(), scene)
key.intensity = 2.2
const rim = new DirectionalLight('rim', new Vector3(30, -10, 40).normalize(), scene)
rim.diffuse = Color3.FromHexString('#b48cff')
rim.intensity = 1.2

const pipeline = new DefaultRenderingPipeline('pipeline', true, scene, [camera])
pipeline.samples = 4
pipeline.bloomEnabled = true
pipeline.bloomThreshold = BLOOM.threshold
pipeline.bloomWeight = BLOOM.strength
pipeline.bloomKernel = 32
pipeline.bloomScale = 0.5
pipeline.imageProcessingEnabled = true
pipeline.imageProcessing.toneMappingEnabled = true
pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL

const instrumentation = new SceneInstrumentation(scene)
instrumentation.captureFrameTime = false

// ---------------------------------------------------------------- assets ---

const source = Object.fromEntries(
  await Promise.all(
    MODELS.map(async (id) => {
      const buffer = await (await fetch(modelUrl(id))).arrayBuffer()
      const container = await LoadAssetContainerAsync(new Uint8Array(buffer), scene, { pluginExtension: '.glb' })
      container.addAllToScene()
      const root = container.meshes.find((m) => m.name === '__root__')!
      root.setEnabled(false)
      const mesh = container.meshes.find((m) => m.parent === root) as Mesh
      return [id, mesh] as const
    }),
  ),
) as Record<ModelId, Mesh>

/** An independent copy of a model, detached from the disabled glTF root. */
const cloneModel = (id: ModelId, parent: TransformNode): Mesh => {
  const m = source[id].clone(`${id}-copy`, null)!
  m.parent = parent
  m.setEnabled(true)
  m.getChildMeshes().forEach((c) => c.setEnabled(true))
  m.rotationQuaternion = Quaternion.Identity()
  m.position.setAll(0)
  return m
}

const dataUrl = (c: HTMLCanvasElement) => c.toDataURL()
/** A regular texture (DynamicTexture leaves its mip levels empty, which blacks out tiled stars). */
const textureFrom = (name: string, c: HTMLCanvasElement) => {
  const t = new Texture(dataUrl(c), scene)
  t.name = name
  return t
}

// -------------------------------------------------------------- backdrop ---

const nebula = CreateSphere('nebula', { diameter: BACKDROP.nebulaRadius * 2, segments: 32, sideOrientation: Mesh.BACKSIDE }, scene)
const nebulaMat = new StandardMaterial('nebula', scene)
nebulaMat.disableLighting = true
nebulaMat.disableDepthWrite = true
nebulaMat.emissiveTexture = textureFrom('nebula', tex.nebula(3))
nebula.material = nebulaMat
nebula.isPickable = false

BACKDROP.starRadii.forEach((r, i) => {
  const layer = BACKDROP.starLayers[i]
  const stars = CreateSphere(`stars${i}`, { diameter: r * 2, segments: 32, sideOrientation: Mesh.BACKSIDE }, scene)
  const t = textureFrom(`stars${i}`, tex.starLayer(11 + i, layer.count, layer.size))
  t.uScale = layer.repeat[0]
  t.vScale = layer.repeat[1]
  t.hasAlpha = true
  const mat = new StandardMaterial(`stars${i}`, scene)
  // unlit and alpha-blended straight from the canvas alpha
  mat.disableLighting = true
  mat.disableDepthWrite = true
  mat.emissiveColor = Color3.White()
  mat.diffuseTexture = t
  mat.useAlphaFromDiffuseTexture = true
  stars.material = mat
  stars.isPickable = false
})

const planetSprites = new SpriteManager('planet', dataUrl(tex.planet()), 1, 512, scene)
const planet = new Sprite('planet', planetSprites)
planet.position = new Vector3(...BACKDROP.planet.position)
planet.size = BACKDROP.planet.size

// --------------------------------------------------- sprite-based 2D FX ---

const glowSprites = new SpriteManager('glow', dataUrl(tex.glow()), 2048, 128, scene)
glowSprites.blendMode = Constants.ALPHA_ADD
const glowPool: Sprite[] = []
let glowUsed = 0
/** Reuse glow sprites frame to frame; anything not claimed this frame is hidden. */
const glowAt = (p: Vector3, size: number, colour: Color4) => {
  let s = glowPool[glowUsed]
  if (!s) glowPool.push((s = new Sprite('g', glowSprites)))
  glowUsed++
  s.isVisible = true
  s.position.copyFrom(p)
  s.size = size
  s.color.copyFrom(colour)
  return s
}

const blastSprites = new SpriteManager('blast', dataUrl(tex.explosionStrip()), MAX_BLASTS, 128, scene)
blastSprites.blendMode = Constants.ALPHA_ADD
const blastPool = Array.from({ length: MAX_BLASTS }, () => {
  const s = new Sprite('b', blastSprites)
  s.isVisible = false
  return s
})

const white = document.createElement('canvas')
white.width = white.height = 4
white.getContext('2d')!.fillStyle = '#fff'
white.getContext('2d')!.fillRect(0, 0, 4, 4)
const barSprites = new SpriteManager('bars', dataUrl(white), MAX_SHIPS_PER_TEAM * 4, 4, scene)
barSprites.renderingGroupId = 1
const barPool = Array.from({ length: MAX_SHIPS_PER_TEAM * 4 }, () => {
  const s = new Sprite('bar', barSprites)
  s.isVisible = false
  return s
})

const cyan = new Color4(0.5, 0.95, 1, 1)
const orange = new Color4(1, 0.55, 0.2, 1)
const team4 = TEAM_COLOURS.map((c) => Color4.FromHexString(c + 'ff'))
const barBg = new Color4(0.04, 0.06, 0.14, 0.75)

// ----------------------------------------------------------- ship scene ---

const shipRoot = new TransformNode('ship-scene', scene)
const shipObjects = shipScene(0).map((p) => cloneModel(p.model, shipRoot))

// -------------------------------------------------------- station scene ---

const stationRoot = new TransformNode('station-scene', scene)
const station = cloneModel('station', stationRoot)
const ring = station.getChildMeshes().find((m) => m.name.endsWith('Ring'))!
ring.rotationQuaternion = null
const orbiters = stationScene(0).ships.map(() => cloneModel('frigate', stationRoot))

// --------------------------------------------------------- battle scene ---

const battleRoot = new TransformNode('battle-scene', scene)
const battle = new Battle(DEFAULT_SHIPS)
const fleetBuffers = [0, 1].map(() => new Float32Array(16 * MAX_SHIPS_PER_TEAM))
const fleets = (['frigate', 'enemy'] as const).map((id, t) => {
  const m = cloneModel(id, battleRoot)
  m.thinInstanceSetBuffer('matrix', fleetBuffers[t], 16, false)
  m.thinInstanceCount = 0
  m.thinInstanceEnablePicking = true
  m.alwaysSelectAsActiveMesh = true
  return m
})
let teamIndex: number[][] = [[], []]

const beamBuffers = [0, 1].map(() => new Float32Array(16 * MAX_BEAMS))
const beams = TEAM_COLOURS.map((c, t) => {
  const m = CreateBox(`beam${t}`, { size: 1 }, scene)
  m.bakeTransformIntoVertices(Matrix.Translation(0, 0, 0.5))
  m.parent = battleRoot
  const mat = new StandardMaterial(`beam${t}`, scene)
  mat.disableLighting = true
  mat.emissiveColor = Color3.FromHexString(c)
  mat.alphaMode = Constants.ALPHA_ADD
  mat.alpha = 0.99
  m.material = mat
  m.isPickable = false
  m.alwaysSelectAsActiveMesh = true
  m.thinInstanceSetBuffer('matrix', beamBuffers[t], 16, false)
  m.thinInstanceCount = 0
  return m
})

const setShipCount = (n: number) => {
  battle.setCount(n)
  teamIndex = [[], []]
  battle.ships.forEach((s, i) => teamIndex[s.team].push(i))
  selected = null
}

// ------------------------------------------------------------ per frame ---

let current: SceneId = 'ship'
let sceneTime = 0
let selected: number | null = null

const m = new Matrix()
const q = new Quaternion()
const v = new Vector3()
const v2 = new Vector3()
const one = Vector3.One()
const zero = Vector3.Zero()
const zAxis = new Vector3(0, 0, 1)
const beamScale = new Vector3()
const white4 = new Color4(1, 1, 1, 1)

const place = (mesh: Mesh, p: Placement) => {
  mesh.position.set(...p.position)
  Quaternion.RotationYawPitchRollToRef(p.yaw, 0, p.bank, mesh.rotationQuaternion!)
}

const pose = (p: CameraPose) => {
  camera.position.set(...p.position)
  camera.setTarget(new Vector3(...p.target))
}

/** Glow sprites at each exhaust of a placed ship. */
const engineGlows = (id: Exclude<ModelId, 'station'>, pos: Vector3, rot: Quaternion, size: number, colour: Color4) => {
  for (const e of ENGINES[id]) {
    v2.set(...e).rotateByQuaternionToRef(rot, v2).addInPlace(pos)
    glowAt(v2, size, colour)
  }
}

const updateBattle = (dt: number) => {
  battle.step(dt)
  for (let t = 0; t < 2; t++) {
    const list = teamIndex[t]
    for (let i = 0; i < list.length; i++) {
      const s = battle.ships[list[i]]
      Quaternion.RotationYawPitchRollToRef(s.yaw, 0, 0, q)
      v.set(s.x, s.y, s.z)
      Matrix.ComposeToRef(s.alive ? one : zero, q, v, m)
      m.copyToArray(fleetBuffers[t], i * 16)
      if (s.alive) engineGlows(t ? 'enemy' : 'frigate', v, q, 1.8, t ? orange : cyan)
    }
    fleets[t].thinInstanceCount = list.length
    fleets[t].thinInstanceBufferUpdated('matrix')
  }

  const beamCounts = [0, 0]
  for (const beam of battle.beams) {
    const a = battle.ships[beam.from]
    const c = battle.ships[beam.to]
    const n = beamCounts[a.team]
    if (n >= MAX_BEAMS) continue
    v.set(a.x, a.y, a.z)
    v2.set(c.x - a.x, c.y - a.y, c.z - a.z)
    const len = v2.length()
    v2.normalize()
    Quaternion.FromUnitVectorsToRef(zAxis, v2, q)
    const w = 0.25 * (1 - beam.age / BEAM_TTL)
    Matrix.ComposeToRef(beamScale.set(w, w, len), q, v, m)
    m.copyToArray(beamBuffers[a.team], n * 16)
    beamCounts[a.team]++
  }
  beams.forEach((b, t) => {
    b.thinInstanceCount = beamCounts[t]
    b.thinInstanceBufferUpdated('matrix')
  })

  // health bars: two sprites per ship, fill anchored left via the camera's right vector
  const right = camera.getDirection(Vector3.Right())
  let h = 0
  for (const s of battle.ships) {
    if (!s.alive) continue
    const k = Math.max(0, s.hp) / MAX_HP
    const bg = barPool[h++]
    bg.isVisible = true
    bg.position.set(s.x, s.y + 2.4, s.z)
    bg.width = 3
    bg.height = 0.4
    bg.color.copyFrom(barBg)
    const fill = barPool[h++]
    fill.isVisible = true
    fill.position.copyFrom(bg.position).addInPlace(right.scale((-3 * (1 - k)) / 2))
    fill.width = 3 * k
    fill.height = 0.26
    fill.color.copyFrom(team4[s.team])
  }
  for (let i = h; i < barPool.length && barPool[i].isVisible; i++) barPool[i].isVisible = false

  blastPool.forEach((sprite, i) => {
    const blast = battle.blasts[i]
    sprite.isVisible = !!blast
    if (!blast) return
    const k = blast.age / BLAST_TTL
    sprite.position.set(blast.x, blast.y, blast.z)
    sprite.size = 6 + k * 6
    sprite.cellIndex = Math.min(tex.EXPLOSION_FRAMES - 1, Math.floor(k * tex.EXPLOSION_FRAMES))
  })

  const sel = selected === null ? null : battle.ships[selected]
  if (sel?.alive) glowAt(v.set(sel.x, sel.y, sel.z), 7 + Math.sin(battle.time * 6) * 0.8, white4)
}

const hideBattleSprites = () => {
  for (const s of barPool) s.isVisible = false
  for (const s of blastPool) s.isVisible = false
}

const update = (dt: number) => {
  sceneTime += dt
  const t = sceneTime
  glowUsed = 0
  if (current === 'ship') {
    shipScene(t).forEach((p, i) => {
      place(shipObjects[i], p)
      engineGlows(p.model as Exclude<ModelId, 'station'>, shipObjects[i].position, shipObjects[i].rotationQuaternion!, 0.9, cyan)
    })
    pose(shipCamera(t))
  } else if (current === 'station') {
    const s = stationScene(t)
    ring.rotation.y = s.ringAngle
    s.ships.forEach((p, i) => {
      place(orbiters[i], p)
      engineGlows('frigate', orbiters[i].position, orbiters[i].rotationQuaternion!, 0.9, cyan)
    })
    pose(stationCamera(t))
  } else {
    updateBattle(dt)
    pose(battleCamera(t, battle.fieldSize()))
  }
  for (let i = glowUsed; i < glowPool.length && glowPool[i].isVisible; i++) glowPool[i].isVisible = false
}

// --------------------------------------------------------------- wiring ---

const ui = createDomGameUi(() => {
  if (selected !== null) battle.repair(selected)
})

scene.onPointerObservable.add((info) => {
  if (info.type !== PointerEventTypes.POINTERDOWN || current !== 'battle') return
  const hit = scene.pick(scene.pointerX, scene.pointerY, (mesh) => fleets.includes(mesh as Mesh))
  if (!hit?.hit || hit.thinInstanceIndex < 0) {
    selected = null
    return
  }
  selected = teamIndex[fleets.indexOf(hit.pickedMesh as Mesh)][hit.thinInstanceIndex] ?? null
})

const app: StackApp = {
  name: 'Babylon.js + DOM UI',
  async setScene(id) {
    current = id
    sceneTime = 0
    selected = null
    shipRoot.setEnabled(id === 'ship')
    stationRoot.setEnabled(id === 'station')
    battleRoot.setEnabled(id === 'battle')
    if (id !== 'battle') hideBattleSprites()
  },
  setShipCount,
  setBloom(on) {
    pipeline.bloomEnabled = on
  },
  info() {
    return { drawCalls: instrumentation.drawCallsCounter.current, triangles: Math.round(scene.getActiveIndices() / 3) }
  },
}

setShipCount(DEFAULT_SHIPS)
createHud(app, stats, (id) => ui.setVisible(id === 'battle'))

// dev-only handle for inspecting the scene from the console
if (import.meta.env.DEV) Object.assign(window, { __scene: scene })

engine.runRenderLoop(() => {
  update(Math.min(0.1, engine.getDeltaTime() / 1000))
  scene.render()
  if (current === 'battle') ui.update(battle, selected)
  stats.frame()
})
