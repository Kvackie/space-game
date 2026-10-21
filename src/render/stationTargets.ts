/**
 * Tap targets on the station (D-76, D-100): an in-world label on each part of
 * the station (D-57); tapping it opens that module's screen. Which part
 * stands for which module is a placeholder until the station has real modules.
 */

import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import type { Scene } from '@babylonjs/core/scene'
import '@babylonjs/core/Culling/ray'

export type StationTarget = 'fleet' | 'crafting' | 'mining' | 'expeditions' | 'recruit' | 'captains'

/** Station-space anchor per module (glTF axes: +Y up), on the placeholder model's parts. */
const TARGETS: { id: StationTarget; label: string; at: [number, number, number] }[] = [
  { id: 'fleet', label: 'Fleet', at: [8, 2.6, -4.5] }, // docking arm
  { id: 'expeditions', label: 'Expeditions', at: [-8.5, 2.6, -4.5] }, // docking arm
  { id: 'recruit', label: 'Recruit', at: [0, 2.6, 9] }, // docking arm
  { id: 'crafting', label: 'Crafting', at: [0, 7.2, 0] }, // hub top
  { id: 'mining', label: 'Mining', at: [10, 7.6, 0] }, // solar array
  { id: 'captains', label: 'Captains', at: [0, -7.2, 0] }, // hub bottom
]

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
  g.fillStyle = hover ? 'rgba(226, 71, 63, 0.92)' : 'rgba(15, 22, 38, 0.86)'
  g.fill()
  g.strokeStyle = hover ? '#ffffff' : 'rgba(95, 168, 217, 0.8)'
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

export function addStationTargets(scene: Scene, onTap: (id: StationTarget) => void): void {
  const labels = TARGETS.map(({ id, label, at }) => {
    const texture = new DynamicTexture(`target-${id}`, TEXTURE, scene, false)
    texture.hasAlpha = true
    const material = new StandardMaterial(`target-${id}`, scene)
    material.disableLighting = true
    material.emissiveColor = Color3.White()
    material.diffuseTexture = texture
    material.useAlphaFromDiffuseTexture = true
    material.backFaceCulling = false

    const plane = CreatePlane(`target-${id}`, { width: 8, height: 2 }, scene)
    plane.material = material
    plane.position = new Vector3(...at)
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL
    plane.renderingGroupId = 1
    plane.metadata = { target: id }
    drawLabel(texture, label, false)
    return { id, label, plane, texture, hover: false }
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
          l.plane.scaling.setAll(hover ? 1.15 : 1)
        }
      }
      scene.getEngine().getRenderingCanvas()!.style.cursor = hit?.hit ? 'pointer' : ''
    }
  })
}
