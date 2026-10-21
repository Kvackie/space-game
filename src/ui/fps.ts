/** Optional FPS counter (D-94), bottom-right of the game area. */

import type { Engine } from '@babylonjs/core/Engines/engine'
import type { GameStore } from '../game/store'
import { h } from './dom'

const UPDATE_MS = 500

export function createFpsCounter(root: HTMLElement, engine: Engine, store: GameStore): void {
  const counter = h('div', { class: 'fps', 'aria-hidden': 'true', hidden: true })
  root.append(counter)
  store.subscribe((state) => (counter.hidden = !state.settings.showFps))
  setInterval(() => {
    if (!counter.hidden) counter.textContent = `${Math.round(engine.getFps())} FPS`
  }, UPDATE_MS)
}
