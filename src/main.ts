import '@fontsource/oxanium/600.css'
import '@fontsource/oxanium/700.css'
import '@fontsource/ibm-plex-sans-condensed/400.css'
import '@fontsource/ibm-plex-sans-condensed/600.css'
import '@fontsource/jetbrains-mono/400.css'
import './theme.css'

import { Engine } from '@babylonjs/core/Engines/engine'
import { startSession } from './game/session'
import { applyLayout, computeLayout } from './layout'
import { createStationScene } from './render/stationScene'
import { createHub } from './ui/hub'

/** Device pixel ratio cap: sharper than this costs a lot on phones for little gain. */
const MAX_PIXEL_RATIO = 2

const gameArea = document.getElementById('game')!
const canvas = document.getElementById('world') as HTMLCanvasElement
const ui = document.getElementById('ui')!

const engine = new Engine(canvas, true, { powerPreference: 'high-performance' }, false)
engine.setHardwareScalingLevel(1 / Math.min(devicePixelRatio, MAX_PIXEL_RATIO))

const relayout = () => {
  applyLayout(gameArea, computeLayout({ width: innerWidth, height: innerHeight }))
  engine.resize()
}
relayout()
addEventListener('resize', relayout)

const scene = createStationScene(engine)
engine.runRenderLoop(() => scene.render())

const session = await startSession()
if (session.loadError) console.error(`Save could not be loaded and was kept aside: ${session.loadError}`)
createHub(ui, session.store)

// dev-only handle for inspecting and editing the game from the console
if (import.meta.env.DEV) {
  const transfer = await import('./save/transfer')
  Object.assign(window, { __game: { session, ...transfer } })
}
