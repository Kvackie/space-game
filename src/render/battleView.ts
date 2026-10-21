/**
 * Battle view (D-03, D-13): replays a recorded battle from its seed, so what
 * the player watches is exactly what was resolved (possibly while the game
 * was closed). Player ships on the left, enemies on the right, Front rows
 * nearest the middle. Health bars are in-world UI (D-57).
 */

import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import type { Engine } from '@babylonjs/core/Engines/engine'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder'
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder'
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { AssetContainer } from '@babylonjs/core/assetContainer'
import { Scene } from '@babylonjs/core/scene'
import type { Row } from '../data'
import { simulateBattle, type BattleEvent, type CombatantInit } from '../game/battle'
import type { BattleRecord } from '../game/state'
import { instantiate, loadModel, setUpSpace, type ModelName } from './common'
import { createPipeline } from './quality'

const ROW_X: Record<Row, number> = { front: 7, middle: 14, back: 21 }
const ROW_SPACING = 6
const BEAM_SECONDS = 0.18
const BLAST_SECONDS = 0.9
const FLASH_SECONDS = 0.8
/** Pause on the final frame before the result is shown. */
const END_PAUSE_SECONDS = 1.2

const COLOURS = { player: '#5fa8d9', enemy: '#e2473f', blast: '#ffb070', bar: '#0f1626', skill: '#5fa8d9' }

interface Unit {
  init: CombatantInit
  node: TransformNode
  hp: number
  bar: Mesh
  barFill: Mesh
}

interface Effect {
  mesh: Mesh
  age: number
  life: number
  update: (mesh: Mesh, k: number) => void
}

export interface BattleView {
  scene: Scene
  play(record: BattleRecord, onEnd: () => void): void
  stop(): void
}

function emissive(scene: Scene, name: string, colour: string, alpha = 1): StandardMaterial {
  const m = new StandardMaterial(name, scene)
  m.disableLighting = true
  m.emissiveColor = Color3.FromHexString(colour)
  m.alpha = alpha
  return m
}

export async function createBattleView(engine: Engine): Promise<BattleView> {
  const scene = new Scene(engine)
  setUpSpace(scene)

  const camera = new ArcRotateCamera('camera', Math.PI / 2, Math.PI / 3.2, 62, Vector3.Zero(), scene)
  camera.fov = 0.75
  camera.minZ = 0.1
  camera.maxZ = 2000
  createPipeline(scene, camera)

  const models = Object.fromEntries(
    await Promise.all(
      (['barge', 'frigate', 'pirate'] as ModelName[]).map(async (m) => [m, await loadModel(scene, m)] as const),
    ),
  ) as Record<string, AssetContainer>

  const materials = {
    player: emissive(scene, 'beam-player', COLOURS.player),
    enemy: emissive(scene, 'beam-enemy', COLOURS.enemy),
    blast: emissive(scene, 'blast', COLOURS.blast),
    barBg: emissive(scene, 'bar-bg', COLOURS.bar, 0.85),
    barPlayer: emissive(scene, 'bar-player', COLOURS.player),
    barEnemy: emissive(scene, 'bar-enemy', COLOURS.enemy),
    skill: emissive(scene, 'skill', COLOURS.skill),
  }

  let units = new Map<string, Unit>()
  let effects: Effect[] = []
  let events: BattleEvent[] = []
  let next = 0
  let time = 0
  let endAt = Infinity
  let onEnd: (() => void) | null = null

  const addEffect = (mesh: Mesh, life: number, update: Effect['update']) => {
    mesh.isPickable = false
    effects.push({ mesh, age: 0, life, update })
  }

  const place = (fighters: CombatantInit[]) => {
    for (const side of ['player', 'enemy'] as const) {
      for (const row of Object.keys(ROW_X) as Row[]) {
        const inRow = fighters.filter((f) => f.side === side && f.row === row)
        inRow.forEach((init, i) => {
          const node = instantiate(models[init.model ?? 'frigate'] ?? models.frigate, init.id)
          const x = (side === 'player' ? -1 : 1) * ROW_X[row]
          node.position.set(x, 0, (i - (inRow.length - 1) / 2) * ROW_SPACING)
          // models face +Z; turn them to face the other side
          node.rotationQuaternion = null
          node.rotation.y = side === 'player' ? Math.PI / 2 : -Math.PI / 2
          node.scaling.setAll(1.4)

          const bar = CreatePlane(`${init.id}-bar`, { width: 3.2, height: 0.4 }, scene)
          bar.material = materials.barBg
          bar.billboardMode = Mesh.BILLBOARDMODE_ALL
          bar.position.set(x, 2.6, node.position.z)
          bar.renderingGroupId = 1
          const barFill = CreatePlane(`${init.id}-fill`, { width: 3, height: 0.26 }, scene)
          barFill.material = side === 'player' ? materials.barPlayer : materials.barEnemy
          barFill.parent = bar
          barFill.position.z = -0.01
          barFill.renderingGroupId = 1

          units.set(init.id, { init, node, hp: init.hp, bar, barFill })
        })
      }
    }
  }

  const clear = () => {
    for (const unit of units.values()) {
      unit.node.dispose()
      unit.bar.dispose()
    }
    for (const effect of effects) effect.mesh.dispose()
    units = new Map()
    effects = []
  }

  const apply = (event: BattleEvent) => {
    if (event.type === 'shot') {
      const from = units.get(event.from)
      const to = units.get(event.to)
      if (!from || !to) return
      to.hp = Math.max(0, to.hp - event.damage)
      const ratio = to.hp / to.init.hp
      to.barFill.scaling.x = Math.max(0.001, ratio)
      to.barFill.position.x = (-3 * (1 - ratio)) / 2

      const a = from.node.position
      const b = to.node.position
      const beam = CreateBox('beam', { size: 1 }, scene)
      beam.material = from.init.side === 'player' ? materials.player : materials.enemy
      beam.position = Vector3.Center(a, b)
      beam.lookAt(b)
      const length = Vector3.Distance(a, b)
      addEffect(beam, BEAM_SECONDS, (m, k) => m.scaling.set(0.2 * (1 - k), 0.2 * (1 - k), length))
    } else if (event.type === 'destroyed') {
      const unit = units.get(event.id)
      if (!unit) return
      unit.node.setEnabled(false)
      unit.bar.setEnabled(false)
      const blast = CreateSphere('blast', { diameter: 1, segments: 12 }, scene)
      blast.material = materials.blast.clone('blast-m') as StandardMaterial
      blast.position.copyFrom(unit.node.position)
      addEffect(blast, BLAST_SECONDS, (m, k) => {
        m.scaling.setAll(2 + k * 7)
        ;(m.material as StandardMaterial).alpha = 1 - k
      })
    } else {
      const unit = units.get(event.id)
      if (!unit) return
      const ring = CreateTorus('skill', { diameter: 5, thickness: 0.2, tessellation: 32 }, scene)
      ring.material = materials.skill.clone('skill-m') as StandardMaterial
      ring.position.copyFrom(unit.node.position)
      addEffect(ring, FLASH_SECONDS, (m, k) => {
        m.scaling.setAll(1 + k)
        ;(m.material as StandardMaterial).alpha = 1 - k
      })
    }
  }

  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(0.1, engine.getDeltaTime() / 1000)
    time += dt
    while (next < events.length && events[next].t <= time) apply(events[next++])

    for (const unit of units.values()) {
      unit.node.position.y = Math.sin(time * 1.3 + unit.node.position.z) * 0.25
    }
    effects = effects.filter((effect) => {
      effect.age += dt
      const k = Math.min(1, effect.age / effect.life)
      effect.update(effect.mesh, k)
      if (k < 1) return true
      // per-effect material copies (fading alpha) go with their mesh
      if (effect.mesh.material?.name.endsWith('-m')) effect.mesh.material.dispose()
      effect.mesh.dispose()
      return false
    })
    camera.alpha = Math.PI / 2 + Math.sin(time * 0.15) * 0.12

    if (time >= endAt && onEnd) {
      const done = onEnd
      onEnd = null
      done()
    }
  })

  return {
    scene,
    play(record, finished) {
      clear()
      place(record.fighters)
      // frame the whole formation: small fights up close, big ones from further out
      let extent = 0
      for (const unit of units.values()) {
        extent = Math.max(extent, Math.abs(unit.node.position.x), Math.abs(unit.node.position.z))
      }
      camera.radius = Math.min(90, Math.max(28, extent * 2.4))
      events = simulateBattle(record.fighters, record.seed).events
      next = 0
      time = 0
      endAt = (events.at(-1)?.t ?? 0) + END_PAUSE_SECONDS
      onEnd = finished
    },
    stop() {
      onEnd = null
      clear()
    },
  }
}
