/**
 * The three.js 3D world, shared by the "three.js + DOM UI" and "Phaser + three.js" stacks.
 *
 * With `overlays: true` it also draws the battle's 2D-style effects (beams,
 * explosions, health bars, selection marker) inside three.js. The Phaser stack
 * passes `overlays: false` and draws those on its own canvas instead.
 */

import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { Battle, BEAM_TTL, BLAST_TTL, MAX_HP } from './battle'
import {
  BACKDROP,
  battleCamera,
  BLOOM,
  ENGINES,
  shipCamera,
  shipScene,
  stationCamera,
  stationScene,
  TEAM_COLOURS,
  type CameraPose,
  type ModelId,
  type Placement,
  type SceneId,
} from './scenes'
import { DEFAULT_SHIPS, MAX_PIXEL_RATIO } from './stack'
import * as tex from './textures'

const MAX_SHIPS_PER_TEAM = 1024
const MAX_BEAMS = 1024
const MAX_BLASTS = 96

export interface ThreeWorld {
  readonly renderer: THREE.WebGLRenderer
  readonly camera: THREE.PerspectiveCamera
  readonly battle: Battle
  scene: SceneId
  selected: number | null
  setScene(id: SceneId): void
  setShipCount(n: number): void
  setBloom(on: boolean): void
  update(dt: number): void
  render(): void
  pick(x: number, y: number): number | null
  project(x: number, y: number, z: number): { x: number; y: number; visible: boolean }
  info(): { drawCalls: number; triangles: number }
}

function canvasTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export async function createThreeWorld(opts: {
  canvas: HTMLCanvasElement
  overlays: boolean
  models: Record<ModelId, ArrayBuffer>
}): Promise<ThreeWorld> {
  const { canvas, overlays } = opts

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(devicePixelRatio, MAX_PIXEL_RATIO))
  renderer.setSize(innerWidth, innerHeight, false)
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.info.autoReset = false

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 2500)

  scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x302850, 1.1))
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(30, 40, 20)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0xb48cff, 1.2)
  rim.position.set(-30, 10, -40)
  scene.add(rim)

  // ------------------------------------------------------------ assets ---

  const loader = new GLTFLoader()
  const gltf = Object.fromEntries(
    await Promise.all(
      (Object.keys(opts.models) as ModelId[]).map(async (id) => [id, await loader.parseAsync(opts.models[id], '')] as const),
    ),
  ) as Record<ModelId, Awaited<ReturnType<GLTFLoader['parseAsync']>>>

  const meshOf = (id: ModelId) => {
    let found: THREE.Mesh | undefined
    gltf[id].scene.traverse((o) => {
      if (!found && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh
    })
    return found!
  }

  const glowTex = canvasTexture(tex.glow())
  const glowMaterial = (colour: string) =>
    new THREE.SpriteMaterial({ map: glowTex, color: colour, blending: THREE.AdditiveBlending, depthWrite: false })

  /** A ship model with additive engine-glow sprites attached at its exhausts. */
  const makeShip = (id: Exclude<ModelId, 'station'>, glowColour = '#7fe8ff') => {
    const ship = meshOf(id).clone()
    for (const p of ENGINES[id]) {
      const g = new THREE.Sprite(glowMaterial(glowColour))
      g.position.set(...p)
      g.scale.setScalar(0.9)
      ship.add(g)
    }
    return ship
  }

  const place = (o: THREE.Object3D, p: Placement) => {
    o.position.set(...p.position)
    o.rotation.set(0, p.yaw, p.bank, 'YXZ')
  }

  // ---------------------------------------------------------- backdrop ---

  const backdrop = new THREE.Group()
  scene.add(backdrop)
  const nebulaSphere = new THREE.Mesh(
    new THREE.SphereGeometry(BACKDROP.nebulaRadius, 48, 24),
    new THREE.MeshBasicMaterial({ map: canvasTexture(tex.nebula(3)), side: THREE.BackSide, depthWrite: false }),
  )
  backdrop.add(nebulaSphere)
  BACKDROP.starRadii.forEach((r, i) => {
    const layer = BACKDROP.starLayers[i]
    const map = canvasTexture(tex.starLayer(11 + i, layer.count, layer.size))
    map.wrapS = map.wrapT = THREE.RepeatWrapping
    map.repeat.set(...layer.repeat)
    backdrop.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(r, 48, 24),
        new THREE.MeshBasicMaterial({
          map,
          side: THREE.BackSide,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    )
  })
  const planet = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTexture(tex.planet()), depthWrite: false }))
  planet.position.set(...BACKDROP.planet.position)
  planet.scale.setScalar(BACKDROP.planet.size)
  backdrop.add(planet)

  // --------------------------------------------------------- ship scene ---

  const shipGroup = new THREE.Group()
  const shipObjects = shipScene(0).map((p) => makeShip(p.model as Exclude<ModelId, 'station'>))
  shipObjects.forEach((o) => shipGroup.add(o))
  scene.add(shipGroup)

  // ------------------------------------------------------ station scene ---

  const stationGroup = new THREE.Group()
  const station = gltf.station.scene.clone()
  const ring = station.getObjectByName('Ring')!
  stationGroup.add(station)
  const orbiters = stationScene(0).ships.map(() => makeShip('frigate'))
  orbiters.forEach((o) => stationGroup.add(o))
  scene.add(stationGroup)

  // ------------------------------------------------------- battle scene ---

  const battle = new Battle(DEFAULT_SHIPS)
  const battleGroup = new THREE.Group()
  scene.add(battleGroup)

  const fleets = (['frigate', 'enemy'] as const).map((id) => {
    const src = meshOf(id)
    const m = new THREE.InstancedMesh(src.geometry, src.material, MAX_SHIPS_PER_TEAM)
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    m.frustumCulled = false
    battleGroup.add(m)
    return m
  })
  /** fleets[team] instance i -> battle.ships index */
  let teamIndex: number[][] = [[], []]

  const engineCount = MAX_SHIPS_PER_TEAM * 2 * 2
  const enginePositions = new Float32Array(engineCount * 3)
  const engineColours = new Float32Array(engineCount * 3)
  const engineGeometry = new THREE.BufferGeometry()
  engineGeometry.setAttribute('position', new THREE.BufferAttribute(enginePositions, 3).setUsage(THREE.DynamicDrawUsage))
  engineGeometry.setAttribute('color', new THREE.BufferAttribute(engineColours, 3).setUsage(THREE.DynamicDrawUsage))
  const engines = new THREE.Points(
    engineGeometry,
    new THREE.PointsMaterial({
      map: glowTex,
      size: 1.8,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  engines.frustumCulled = false
  battleGroup.add(engines)

  // overlay effects (three.js stack only)
  const beamGeometry = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5)
  const beams = new THREE.InstancedMesh(
    beamGeometry,
    new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    MAX_BEAMS,
  )
  beams.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_BEAMS * 3), 3)
  beams.frustumCulled = false

  const bars = [0x0a0f24, 0xffffff].map((c, i) => {
    const m = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: c, depthTest: false, transparent: true, opacity: i ? 1 : 0.7 }),
      MAX_SHIPS_PER_TEAM * 2,
    )
    m.renderOrder = 10 + i
    m.frustumCulled = false
    if (i) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_SHIPS_PER_TEAM * 2 * 3), 3)
    return m
  })

  const blasts = Array.from({ length: MAX_BLASTS }, () => {
    const s = new THREE.Sprite(glowMaterial('#ffb070'))
    s.visible = false
    return s
  })

  const selection = new THREE.Sprite(glowMaterial('#ffffff'))
  selection.visible = false

  if (overlays) {
    battleGroup.add(beams, ...bars, ...blasts, selection)
  }

  const teamColour = TEAM_COLOURS.map((c) => new THREE.Color(c))
  const setCount = (n: number) => {
    battle.setCount(n)
    teamIndex = [[], []]
    battle.ships.forEach((s, i) => teamIndex[s.team].push(i))
    fleets.forEach((m, t) => (m.count = teamIndex[t].length))
    world.selected = null
  }

  // ----------------------------------------------------- post-process ---

  const composer = new EffectComposer(renderer)
  composer.setPixelRatio(renderer.getPixelRatio())
  composer.setSize(innerWidth, innerHeight)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(innerWidth, innerHeight),
    BLOOM.strength,
    BLOOM.radius,
    BLOOM.threshold,
  )
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(innerWidth, innerHeight, false)
    composer.setSize(innerWidth, innerHeight)
  })

  // -------------------------------------------------------- per frame ---

  let sceneTime = 0
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const v = new THREE.Vector3()
  const v2 = new THREE.Vector3()
  const one = new THREE.Vector3(1, 1, 1)
  const zAxis = new THREE.Vector3(0, 0, 1)
  const right = new THREE.Vector3()

  const pose = (p: CameraPose) => {
    camera.position.set(...p.position)
    camera.lookAt(...p.target)
  }

  const updateBattle = (dt: number) => {
    battle.step(dt)
    const counts = [0, 0]
    let engine = 0
    for (let t = 0; t < 2; t++) {
      const list = teamIndex[t]
      for (let i = 0; i < list.length; i++) {
        const s = battle.ships[list[i]]
        e.set(0, s.yaw, 0, 'YXZ')
        q.setFromEuler(e)
        v.set(s.x, s.y, s.z)
        m4.compose(v, q, s.alive ? one : v2.set(0, 0, 0))
        fleets[t].setMatrixAt(i, m4)
        if (!s.alive) continue
        for (const p of ENGINES[t ? 'enemy' : 'frigate']) {
          v2.set(...p).applyQuaternion(q).add(v)
          enginePositions.set([v2.x, v2.y, v2.z], engine * 3)
          engineColours.set(t ? [1, 0.55, 0.2] : [0.5, 0.95, 1], engine * 3)
          engine++
        }
        counts[t]++
      }
      fleets[t].instanceMatrix.needsUpdate = true
    }
    engineGeometry.setDrawRange(0, engine)
    engineGeometry.attributes.position.needsUpdate = true
    engineGeometry.attributes.color.needsUpdate = true

    if (!overlays) return

    // beams: unit boxes stretched from shooter to target, thinning as they fade
    let b = 0
    for (const beam of battle.beams) {
      if (b >= MAX_BEAMS) break
      const a = battle.ships[beam.from]
      const c = battle.ships[beam.to]
      v.set(a.x, a.y, a.z)
      v2.set(c.x - a.x, c.y - a.y, c.z - a.z)
      const len = v2.length()
      q.setFromUnitVectors(zAxis, v2.normalize())
      const w = 0.25 * (1 - beam.age / BEAM_TTL)
      m4.compose(v, q, v2.set(w, w, len))
      beams.setMatrixAt(b, m4)
      beams.setColorAt(b, teamColour[a.team])
      b++
    }
    beams.count = b
    beams.instanceMatrix.needsUpdate = true
    if (beams.instanceColor) beams.instanceColor.needsUpdate = true

    // health bars: camera-facing quads above each ship, fill anchored left
    right.set(1, 0, 0).applyQuaternion(camera.quaternion)
    let h = 0
    for (const s of battle.ships) {
      if (!s.alive) continue
      const k = Math.max(0, s.hp) / MAX_HP
      v.set(s.x, s.y + 2.4, s.z)
      bars[0].setMatrixAt(h, m4.compose(v, camera.quaternion, v2.set(3, 0.4, 1)))
      v.addScaledVector(right, (-3 * (1 - k)) / 2)
      bars[1].setMatrixAt(h, m4.compose(v, camera.quaternion, v2.set(3 * k, 0.26, 1)))
      bars[1].setColorAt(h, teamColour[s.team])
      h++
    }
    for (const m of bars) {
      m.count = h
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }

    blasts.forEach((sprite, i) => {
      const blast = battle.blasts[i]
      sprite.visible = !!blast
      if (!blast) return
      const k = blast.age / BLAST_TTL
      sprite.position.set(blast.x, blast.y, blast.z)
      sprite.scale.setScalar(3 + k * 9)
      sprite.material.opacity = 1 - k
    })

    const sel = world.selected === null ? null : battle.ships[world.selected]
    selection.visible = !!sel?.alive
    if (sel) {
      selection.position.set(sel.x, sel.y, sel.z)
      selection.scale.setScalar(7 + Math.sin(battle.time * 6) * 0.8)
    }
  }

  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()

  const world: ThreeWorld = {
    renderer,
    camera,
    battle,
    scene: 'ship',
    selected: null,

    setScene(id) {
      world.scene = id
      sceneTime = 0
      shipGroup.visible = id === 'ship'
      stationGroup.visible = id === 'station'
      battleGroup.visible = id === 'battle'
      world.selected = null
    },

    setShipCount: setCount,

    setBloom(on) {
      bloom.enabled = on
    },

    update(dt) {
      sceneTime += dt
      const t = sceneTime
      if (world.scene === 'ship') {
        shipScene(t).forEach((p, i) => place(shipObjects[i], p))
        pose(shipCamera(t))
      } else if (world.scene === 'station') {
        const s = stationScene(t)
        ring.rotation.y = s.ringAngle
        s.ships.forEach((p, i) => place(orbiters[i], p))
        pose(stationCamera(t))
      } else {
        updateBattle(dt)
        pose(battleCamera(t, battle.fieldSize()))
      }
    },

    render() {
      renderer.info.reset()
      composer.render()
    },

    pick(x, y) {
      if (world.scene !== 'battle') return null
      ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      // instanced bounds are cached from the first raycast; ships have moved since
      fleets.forEach((m) => m.computeBoundingSphere())
      const hit = raycaster.intersectObjects(fleets, false)[0]
      if (!hit || hit.instanceId === undefined) return null
      return teamIndex[fleets.indexOf(hit.object as THREE.InstancedMesh)][hit.instanceId]
    },

    project(x, y, z) {
      v.set(x, y, z).project(camera)
      return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight, visible: v.z < 1 }
    },

    info() {
      return { drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles }
    },
  }

  setCount(DEFAULT_SHIPS)
  world.setScene('ship')
  return world
}

/** Fetch every model as an ArrayBuffer (the Phaser stack uses its own loader instead). */
export async function fetchModels(ids: ModelId[], url: (id: ModelId) => string): Promise<Record<ModelId, ArrayBuffer>> {
  const entries = await Promise.all(ids.map(async (id) => [id, await (await fetch(url(id))).arrayBuffer()] as const))
  return Object.fromEntries(entries) as Record<ModelId, ArrayBuffer>
}
