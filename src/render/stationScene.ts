/**
 * The station hub's 3D scene (D-76, D-115): the station seen from a fixed
 * angle, with a planet and moon behind it, a drifting asteroid field, ships
 * docked at its arms, traffic passing by and blinking beacons. The camera does
 * not move, so the menu labels around the station stay put (D-113).
 */

import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import type { Engine } from '@babylonjs/core/Engines/engine'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Matrix, Quaternion, Vector2, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateIcoSphere } from '@babylonjs/core/Meshes/Builders/icoSphereBuilder'
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder'
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer'
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { Scene } from '@babylonjs/core/scene'
import '@babylonjs/core/Meshes/thinInstanceMesh'
import { instantiate, loadModel, setUpSpace } from './common'
import { createPipeline } from './quality'

/** Seeded random, so the asteroid field is the same every visit. */
function seeded(seed: number): () => number {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

function planetTexture(scene: Scene): Texture {
  const w = 1024
  const h = 512
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const g = canvas.getContext('2d')!
  const random = seeded(31)
  const base = g.createLinearGradient(0, 0, 0, h)
  base.addColorStop(0, '#3b2a2a')
  base.addColorStop(0.5, '#6b4434')
  base.addColorStop(1, '#2a2230')
  g.fillStyle = base
  g.fillRect(0, 0, w, h)
  for (let i = 0; i < 40; i++) {
    const y = random() * h
    g.fillStyle = `rgba(${150 + random() * 60}, ${90 + random() * 40}, ${70 + random() * 30}, ${0.08 + random() * 0.12})`
    g.fillRect(0, y, w, 4 + random() * 18)
  }
  return new Texture(canvas.toDataURL(), scene)
}

function addBackdropBodies(scene: Scene): void {
  const planet = CreateSphere('planet', { diameter: 240, segments: 48 }, scene)
  planet.position.set(-200, -120, 330)
  const planetMat = new StandardMaterial('planet', scene)
  planetMat.diffuseTexture = planetTexture(scene)
  planetMat.specularColor = Color3.Black()
  planet.material = planetMat
  planet.isPickable = false

  const moon = CreateSphere('moon', { diameter: 40, segments: 24 }, scene)
  moon.position.set(-20, 60, 380)
  const moonMat = new StandardMaterial('moon', scene)
  moonMat.diffuseColor = Color3.FromHexString('#7d8494')
  moonMat.specularColor = Color3.Black()
  moon.material = moonMat
  moon.isPickable = false
}

/** Lumpy rocks drifting and tumbling slowly in a loose band around the station. */
function addAsteroids(scene: Scene): void {
  const random = seeded(77)
  const rock = CreateIcoSphere('asteroid', { radius: 1, subdivisions: 2, flat: true, updatable: true }, scene)
  const positions = rock.getVerticesData(VertexBuffer.PositionKind)!
  for (let i = 0; i < positions.length; i += 3) {
    const k = 0.75 + random() * 0.5
    positions[i] *= k
    positions[i + 1] *= k * 0.8
    positions[i + 2] *= k
  }
  rock.updateVerticesData(VertexBuffer.PositionKind, positions)
  const material = new StandardMaterial('asteroid', scene)
  material.diffuseColor = Color3.FromHexString('#5c5550')
  material.specularColor = new Color3(0.05, 0.05, 0.05)
  rock.material = material
  rock.isPickable = false
  rock.metadata = { model: true }

  const count = 90
  const rocks = Array.from({ length: count }, () => {
    const angle = random() * Math.PI * 2
    const radius = 32 + random() * 40
    return {
      angle,
      radius,
      y: (random() - 0.5) * 24,
      scale: 0.4 + random() ** 2 * 2.6,
      spin: new Vector3(random(), random(), random()).normalize(),
      speed: 0.2 + random() * 0.6,
      drift: 0.004 + random() * 0.008,
    }
  })
  const matrices = new Float32Array(count * 16)
  rock.thinInstanceSetBuffer('matrix', matrices, 16, false)
  const m = new Matrix()
  const q = new Quaternion()
  const s = new Vector3()
  const p = new Vector3()
  let time = 0
  scene.onBeforeRenderObservable.add(() => {
    time += scene.getEngine().getDeltaTime() / 1000
    rocks.forEach((r, i) => {
      const a = r.angle + time * r.drift
      p.set(Math.cos(a) * r.radius, r.y, Math.sin(a) * r.radius)
      Quaternion.RotationAxisToRef(r.spin, time * r.speed, q)
      s.setAll(r.scale)
      Matrix.ComposeToRef(s, q, p, m)
      m.copyToArray(matrices, i * 16)
    })
    rock.thinInstanceBufferUpdated('matrix')
  })
}

/** Small red beacons on the hub that blink out of step with each other. */
function addBeacons(scene: Scene): void {
  const material = new StandardMaterial('beacon', scene)
  material.disableLighting = true
  material.emissiveColor = Color3.FromHexString('#ff4a3d')
  const spots: [number, number, number][] = [
    [0, 4.6, 0],
    [0, -4.6, 0],
    [2.1, 1.6, 0],
    [-2.1, -1.6, 0],
    [0, 0.6, 2.1],
  ]
  const beacons = spots.map((at, i) => {
    const b = CreateSphere(`beacon${i}`, { diameter: 0.35, segments: 8 }, scene)
    b.position.set(...at)
    b.material = material
    b.isPickable = false
    return b
  })
  let time = 0
  scene.onBeforeRenderObservable.add(() => {
    time += scene.getEngine().getDeltaTime() / 1000
    beacons.forEach((b, i) => b.setEnabled((time * 0.8 + i * 0.37) % 1 < 0.35))
  })
}

/** Ships docked at the station's three arms (D-115). */
function dock(node: TransformNode, armAngle: number, distance: number): void {
  const x = Math.cos(armAngle) * distance
  const z = -Math.sin(armAngle) * distance
  node.position.set(x, 0.6, z)
  node.rotationQuaternion = null
  // nose pointing away from the hub
  node.rotation.y = Math.atan2(x, z)
}

export function createStationScene(engine: Engine): Scene {
  const scene = new Scene(engine)
  // the camera sits on the -Z side, so the rim light shines that way
  setUpSpace(scene, new Vector3(0.5, -0.3, -0.85))

  // a fixed view: the menu labels are placed in screen space around it (D-113)
  const camera = new ArcRotateCamera('camera', -1.05, 1.2, 44, Vector3.Zero(), scene)
  camera.fov = 0.8
  camera.minZ = 0.1
  camera.maxZ = 3000
  // nudge the station right, clear of the module buttons on the left
  camera.targetScreenOffset = new Vector2(5, 0)

  addBackdropBodies(scene)
  addAsteroids(scene)
  addBeacons(scene)

  void loadModel(scene, 'station').then((container) => {
    const station = instantiate(container, 'station')
    const ring = station.getChildTransformNodes(false).find((n) => n.name.endsWith('Ring'))
    scene.onBeforeRenderObservable.add(() => {
      if (ring) ring.rotate(Vector3.Up(), engine.getDeltaTime() * 0.00008)
    })
  })

  void Promise.all([loadModel(scene, 'frigate'), loadModel(scene, 'barge')]).then(([frigate, barge]) => {
    dock(instantiate(frigate, 'docked-frigate'), Math.PI / 6, 7.4)
    dock(instantiate(barge, 'docked-barge'), (5 * Math.PI) / 6, 7.6)

    // traffic: frigates looping past at different heights and speeds
    const lanes = [
      { radius: 20, y: 6, speed: 0.12, phase: 0 },
      { radius: 26, y: -5, speed: -0.08, phase: 2 },
      { radius: 17, y: -9, speed: 0.15, phase: 4 },
    ]
    const ships = lanes.map((_, i) => {
      const ship = instantiate(frigate, `traffic${i}`)
      ship.rotationQuaternion = null
      return ship
    })
    let time = 0
    scene.onBeforeRenderObservable.add(() => {
      time += engine.getDeltaTime() / 1000
      lanes.forEach((lane, i) => {
        const a = lane.phase + time * lane.speed
        const ship = ships[i]
        ship.position.set(Math.cos(a) * lane.radius, lane.y, Math.sin(a) * lane.radius)
        // face along the direction of travel
        const dir = Math.sign(lane.speed)
        ship.rotation.y = Math.atan2(-Math.sin(a) * dir, Math.cos(a) * dir)
        ship.rotation.z = -0.25 * dir
      })
    })
  })

  createPipeline(scene, camera)
  return scene
}
