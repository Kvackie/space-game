/**
 * Tap targets on the station (D-76, D-100, D-113): an in-world label for each
 * module, held at a fixed spot on screen around the station so labels never
 * drift or overlap; each bobs gently and has a thin leader line to the station
 * part it stands for. Which part stands for which module is a placeholder.
 */

import type { Camera } from '@babylonjs/core/Cameras/camera'
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateLines } from '@babylonjs/core/Meshes/Builders/linesBuilder'
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh'
import type { Scene } from '@babylonjs/core/scene'
import '@babylonjs/core/Culling/ray'

export type StationTarget = 'fleet' | 'crafting' | 'mining' | 'expeditions' | 'recruit' | 'captains'

/**
 * Each label's spot as fractions of the game area (left→right, top→bottom),
 * kept clear of the module buttons on the left, and the station part its
 * leader line points at (station space, +Y up).
 */
const TARGETS: { id: StationTarget; label: string; screen: [number, number]; part: [number, number, number] }[] = [
  { id: 'crafting', label: 'Crafting', screen: [0.5, 0.2], part: [0, 4.5, 0] }, // hub top
  { id: 'mining', label: 'Mining', screen: [0.83, 0.24], part: [6.5, 5, 0] }, // solar array
  { id: 'expeditions', label: 'Expeditions', screen: [0.38, 0.5], part: [-6.5, 0.6, -3.75] }, // docked barge arm
  { id: 'fleet', label: 'Fleet', screen: [0.88, 0.56], part: [6.5, 0.6, -3.75] }, // docked frigate arm
  { id: 'recruit', label: 'Recruit', screen: [0.48, 0.84], part: [0, 0.6, 4.3] }, // docking arm
  { id: 'captains', label: 'Captains', screen: [0.78, 0.86], part: [0, -4.5, 0] }, // hub bottom
]

/** How far in front of the camera the labels float, in world units. */
const LABEL_DEPTH = 26
const LABEL_SIZE = { width: 5.6, height: 1.4 }
const BOB = { height: 0.12, speed: 0.9 }
const TEXTURE = { width: 512, height: 128 }

function drawLabel(texture: DynamicTexture, text: string, hover: boolean): void {
  const g = texture.getContext() as CanvasRenderingContext2D
  const { width: w, height: h } = TEXTURE
  g.clearRect(0, 0, w, h)
  // angled Nikke-style plate with a signal-red accent (D-82, D-84)
  g.beginPath()
  g.moveTo(24, 16)
  g.lineTo(w - 8, 16)
  g.lineTo(w - 40, h - 16)
  g.lineTo(8, h - 16)
  g.closePath()
  g.fillStyle = hover ? 'rgba(226, 71, 63, 0.95)' : 'rgba(15, 22, 38, 0.9)'
  g.fill()
  g.strokeStyle = hover ? '#ffffff' : 'rgba(95, 168, 217, 0.85)'
  g.lineWidth = 3
  g.stroke()
  g.fillStyle = hover ? '#070b14' : '#e2473f'
  g.fillRect(28, 34, 8, h - 68)
  g.font = '700 54px Oxanium, sans-serif'
  g.textBaseline = 'middle'
  g.fillStyle = hover ? '#070b14' : '#d5ddeb'
  g.fillText(text.toUpperCase(), 56, h / 2 + 3)
  texture.update()
}

/** The world point that appears at a screen fraction, LABEL_DEPTH in front of the camera. */
function worldAt(scene: Scene, camera: Camera, fx: number, fy: number): Vector3 {
  const engine = scene.getEngine()
  const w = engine.getRenderWidth()
  const h = engine.getRenderHeight()
  const view = camera.getViewMatrix(true)
  const projection = camera.getProjectionMatrix(true)
  const ahead = camera.position.add(camera.getDirection(Vector3.Forward(scene.useRightHandedSystem)).scale(LABEL_DEPTH))
  const depth = Vector3.Project(ahead, Matrix.Identity(), view.multiply(projection), camera.viewport.toGlobal(w, h)).z
  return Vector3.Unproject(new Vector3(fx * w, fy * h, depth), w, h, Matrix.Identity(), view, projection)
}

export function addStationTargets(scene: Scene, onTap: (id: StationTarget) => void): void {
  const labels = TARGETS.map(({ id, label, screen, part }, i) => {
    const texture = new DynamicTexture(`target-${id}`, TEXTURE, scene, false)
    texture.hasAlpha = true
    const material = new StandardMaterial(`target-${id}`, scene)
    material.disableLighting = true
    material.emissiveColor = Color3.White()
    material.diffuseTexture = texture
    material.useAlphaFromDiffuseTexture = true
    material.backFaceCulling = false

    const plane = CreatePlane(`target-${id}`, LABEL_SIZE, scene)
    plane.material = material
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL
    plane.renderingGroupId = 1
    plane.metadata = { target: id }
    drawLabel(texture, label, false)

    const anchor = new Vector3(...part)
    const line: LinesMesh = CreateLines(`target-${id}-line`, { points: [anchor, anchor], updatable: true }, scene)
    line.color = Color3.FromHexString('#5fa8d9')
    line.alpha = 0.55
    line.isPickable = false
    line.renderingGroupId = 1

    return { id, label, screen, anchor, plane, texture, hover: false, base: Vector3.Zero(), phase: i * 1.1, line }
  })

  // place labels on screen; redo whenever the canvas size changes
  let placedFor = ''
  const place = () => {
    const camera = scene.activeCamera
    const engine = scene.getEngine()
    const key = `${engine.getRenderWidth()}x${engine.getRenderHeight()}`
    if (!camera || key === placedFor) return
    const spots = labels.map((l) => worldAt(scene, camera, l.screen[0], l.screen[1]))
    // the camera may not be ready on the very first frame; try again next frame
    if (spots.some((p) => !Number.isFinite(p.x + p.y + p.z))) return
    placedFor = key
    labels.forEach((l, i) => (l.base = spots[i]))
  }

  let time = 0
  scene.onBeforeRenderObservable.add(() => {
    place()
    time += scene.getEngine().getDeltaTime() / 1000
    const up = scene.activeCamera?.upVector ?? Vector3.Up()
    for (const l of labels) {
      l.plane.position.copyFrom(l.base).addInPlace(up.scale(Math.sin(time * BOB.speed + l.phase) * BOB.height))
      CreateLines(l.line.name, { points: [l.plane.position, l.anchor], instance: l.line })
    }
  })

  // redraw once the display font has loaded, so labels use Oxanium
  void document.fonts?.ready.then(() => labels.forEach((l) => drawLabel(l.texture, l.label, l.hover)))

  const isTarget = (mesh: unknown) => labels.some((l) => l.plane === mesh)

  scene.onPointerObservable.add((info) => {
    if (info.type === PointerEventTypes.POINTERTAP) {
      const hit = scene.pick(scene.pointerX, scene.pointerY, isTarget)
      const id = hit?.pickedMesh?.metadata?.target as StationTarget | undefined
      if (id) onTap(id)
    } else if (info.type === PointerEventTypes.POINTERMOVE) {
      const hit = scene.pick(scene.pointerX, scene.pointerY, isTarget)
      for (const l of labels) {
        const hover = hit?.pickedMesh === l.plane
        if (hover !== l.hover) {
          l.hover = hover
          drawLabel(l.texture, l.label, hover)
          l.plane.scaling.setAll(hover ? 1.1 : 1)
          l.line.color = hover ? Color3.FromHexString('#e2473f') : Color3.FromHexString('#5fa8d9')
        }
      }
      scene.getEngine().getRenderingCanvas()!.style.cursor = hit?.hit ? 'pointer' : ''
    }
  })
}
