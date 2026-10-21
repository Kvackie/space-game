/** The station hub's 3D scene: the placeholder station turning slowly in dark space. */

import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import type { Engine } from '@babylonjs/core/Engines/engine'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Scene } from '@babylonjs/core/scene'
import { instantiate, loadModel, setUpSpace } from './common'
import { createPipeline } from './quality'

export function createStationScene(engine: Engine): Scene {
  const scene = new Scene(engine)
  setUpSpace(scene)

  const camera = new ArcRotateCamera('camera', -Math.PI / 3, Math.PI / 2.6, 52, Vector3.Zero(), scene)
  camera.fov = 0.8
  camera.minZ = 0.1
  camera.maxZ = 2000
  scene.onBeforeRenderObservable.add(() => {
    camera.alpha += engine.getDeltaTime() * 0.00002
  })

  void loadModel(scene, 'station').then((container) => {
    const station = instantiate(container, 'station')
    const ring = station.getChildTransformNodes(false).find((n) => n.name.endsWith('Ring'))
    scene.onBeforeRenderObservable.add(() => {
      if (ring) ring.rotate(Vector3.Up(), engine.getDeltaTime() * 0.00008)
    })
  })

  createPipeline(scene, camera)
  return scene
}
