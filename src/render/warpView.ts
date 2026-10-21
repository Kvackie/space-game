/**
 * The recruitment animation (D-109): a ship warping in. The portal starts as a
 * black hole, bursts open in a star-gate style explosion, and settles into a
 * warp gate in the rarity's colour; the ship comes through it.
 */

import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import { Constants } from '@babylonjs/core/Engines/constants'
import type { Engine } from '@babylonjs/core/Engines/engine'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder'
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder'
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { Scene } from '@babylonjs/core/scene'
import type { Rarity } from '../data'
import { instantiate, loadModel, setUpSpace } from './common'
import { createPipeline } from './quality'

/** Rarity colours, matching the UI (D-83). Mythical cycles through hues. */
const RARITY_COLOURS: Record<Rarity, string> = {
  common: '#9aa3ad',
  rare: '#5b8fd1',
  epic: '#a98bd4',
  legendary: '#d1ad5b',
  mythical: '#e07fb8',
}

/** Phase start times in seconds. */
const T = { hole: 0, burst: 1.0, gate: 1.35, ship: 2.1, done: 3.6 }

const smooth = (from: number, to: number, t: number) => {
  const k = Math.min(1, Math.max(0, (t - from) / (to - from)))
  return k * k * (3 - 2 * k)
}

export interface WarpView {
  scene: Scene
  play(rarity: Rarity, onEnd: () => void): void
  skip(): void
}

function glow(scene: Scene, name: string, colour: Color3, alpha = 1): StandardMaterial {
  const m = new StandardMaterial(name, scene)
  m.disableLighting = true
  m.emissiveColor = colour
  m.alpha = alpha
  return m
}

export async function createWarpView(engine: Engine): Promise<WarpView> {
  const scene = new Scene(engine)
  setUpSpace(scene)
  const camera = new ArcRotateCamera('camera', Math.PI / 2, Math.PI / 2.1, 34, Vector3.Zero(), scene)
  camera.fov = 0.8
  createPipeline(scene, camera)

  const tint = new Color3(1, 1, 1)

  // black hole: a dark core inside a bright, spinning accretion ring
  const hole = new TransformNode('hole', scene)
  const core = CreateSphere('core', { diameter: 2, segments: 24 }, scene)
  core.material = glow(scene, 'core', Color3.Black())
  core.parent = hole
  const accretion = CreateTorus('accretion', { diameter: 3, thickness: 0.35, tessellation: 48 }, scene)
  accretion.material = glow(scene, 'accretion', new Color3(1, 0.85, 0.7))
  accretion.parent = hole

  // the burst: a flash and an expanding shockwave
  const flash = CreateSphere('flash', { diameter: 1, segments: 24 }, scene)
  const flashMaterial = glow(scene, 'flash', new Color3(1, 1, 1))
  // additive, so the flash brightens what is behind it instead of greying it
  flashMaterial.alphaMode = Constants.ALPHA_ADD
  flash.material = flashMaterial
  const shock = CreateTorus('shock', { diameter: 1, thickness: 0.06, tessellation: 64 }, scene)
  const shockMaterial = glow(scene, 'shock', tint)
  shock.material = shockMaterial

  // the warp gate: a ring with chevrons and a shimmering event horizon
  const gate = new TransformNode('gate', scene)
  // the gate faces the camera; its contents spin about the gate's own axis
  const gateSpin = new TransformNode('gate-spin', scene)
  gateSpin.parent = gate
  const gateMaterial = glow(scene, 'gate', tint)
  const ring = CreateTorus('gate-ring', { diameter: 14, thickness: 0.9, tessellation: 64 }, scene)
  ring.material = gateMaterial
  ring.parent = gateSpin
  const chevrons: Mesh[] = []
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2
    const chevron = CreateBox('chevron', { width: 0.9, height: 1.4, depth: 0.5 }, scene)
    chevron.position.set(Math.cos(a) * 7, 0, Math.sin(a) * 7)
    chevron.rotation.y = -a
    chevron.material = gateMaterial
    chevron.parent = gateSpin
    chevrons.push(chevron)
  }
  const horizonMaterial = glow(scene, 'horizon', tint, 0.45)
  horizonMaterial.backFaceCulling = false
  const horizon = CreateDisc('horizon', { radius: 6.4, tessellation: 64 }, scene)
  horizon.rotation.x = Math.PI / 2
  horizon.material = horizonMaterial
  horizon.parent = gateSpin
  // the gate faces the camera
  for (const node of [hole, gate, shock]) node.rotation.x = Math.PI / 2

  const ship = instantiate(await loadModel(scene, 'frigate'), 'warp-ship')
  ship.rotationQuaternion = null

  let time = 0
  let rarity: Rarity = 'common'
  let onEnd: (() => void) | null = null

  const finish = () => {
    const done = onEnd
    onEnd = null
    done?.()
  }

  scene.onBeforeRenderObservable.add(() => {
    if (!onEnd) return
    time += Math.min(0.1, engine.getDeltaTime() / 1000)
    const t = time

    const colour =
      rarity === 'mythical' ? Color3.FromHSV((t * 140) % 360, 0.55, 1) : Color3.FromHexString(RARITY_COLOURS[rarity])
    tint.copyFrom(colour)

    // 1. the black hole grows and spins
    const holeIn = smooth(T.hole, T.burst, t)
    hole.setEnabled(t < T.gate)
    hole.scaling.setAll(0.2 + holeIn * 2.2 * (1 - smooth(T.burst, T.gate, t)))
    accretion.rotation.y = t * 6

    // 2. it bursts: a white flash and a shockwave in the rarity colour
    const burst = smooth(T.burst, T.gate + 0.4, t)
    flash.setEnabled(t >= T.burst && burst < 1)
    flash.scaling.setAll(2 + burst * 26)
    flashMaterial.alpha = 1 - burst
    shock.setEnabled(t >= T.burst && burst < 1)
    shock.scaling.setAll(1 + burst * 40)
    shockMaterial.emissiveColor = colour
    shockMaterial.alpha = 1 - burst

    // 3. the gate snaps open and shimmers
    const open = smooth(T.burst + 0.15, T.gate + 0.25, t)
    gate.setEnabled(t >= T.burst)
    gate.scaling.setAll(0.3 + open * 0.7)
    gateSpin.rotation.y = t * 0.4
    gateMaterial.emissiveColor = colour
    horizonMaterial.emissiveColor = colour
    horizonMaterial.alpha = 0.25 + Math.sin(t * 9) * 0.08 + open * 0.15
    chevrons.forEach((c, i) => (c.scaling.y = 1 + Math.max(0, Math.sin(t * 6 - i)) * 0.4))

    // 4. the ship comes through towards the camera
    const fly = smooth(T.ship, T.done, t)
    ship.setEnabled(t >= T.ship)
    ship.position.set(0, -1 + fly * 1, -18 + fly * 30)
    ship.rotation.set(0, 0, Math.sin(t * 2) * 0.1)
    ship.scaling.setAll(1.2 + fly * 1.2)

    camera.radius = 34 - smooth(T.burst, T.done, t) * 6
    if (t >= T.done + 0.4) finish()
  })

  return {
    scene,
    play(r, ended) {
      rarity = r
      time = 0
      onEnd = ended
    },
    skip: finish,
  }
}
