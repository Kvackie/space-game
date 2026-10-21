/**
 * Stack 1: three.js renders everything 3D and the 2D effects; the game UI is DOM.
 * One canvas, one WebGL context.
 */

import { FrameStats } from '../shared/bench'
import { createDomGameUi } from '../shared/gameUi'
import { createHud } from '../shared/hud'
import { MODELS, modelUrl } from '../shared/scenes'
import type { StackApp } from '../shared/stack'
import { createThreeWorld, fetchModels } from '../shared/threeWorld'
import '../shared/style.css'

const stats = new FrameStats()
const canvas = document.getElementById('stage') as HTMLCanvasElement

const world = await createThreeWorld({ canvas, overlays: true, models: await fetchModels(MODELS, modelUrl) })

const ui = createDomGameUi(() => {
  if (world.selected !== null) world.battle.repair(world.selected)
})

canvas.addEventListener('pointerdown', (e) => {
  world.selected = world.pick(e.clientX, e.clientY)
})

const app: StackApp = {
  name: 'three.js + DOM UI',
  async setScene(id) {
    world.setScene(id)
  },
  setShipCount: world.setShipCount,
  setBloom: world.setBloom,
  info: world.info,
}

createHud(app, stats, (id) => ui.setVisible(id === 'battle'))

let last = performance.now()
world.renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  world.update(dt)
  world.render()
  if (world.scene === 'battle') ui.update(world.battle, world.selected)
  stats.frame(now)
})
