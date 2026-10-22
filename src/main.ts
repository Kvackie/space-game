import '@fontsource/oxanium/600.css'
import '@fontsource/oxanium/700.css'
import '@fontsource/ibm-plex-sans-condensed/400.css'
import '@fontsource/ibm-plex-sans-condensed/600.css'
import '@fontsource/jetbrains-mono/400.css'
import './theme.css'

import { Engine } from '@babylonjs/core/Engines/engine'
import type { Scene } from '@babylonjs/core/scene'
import { NAMES } from './data'
import { registerCrafting } from './game/crafting'
import { registerExpedition } from './game/expedition'
import { registerMining } from './game/mining'
import { startSession } from './game/session'
import { applyLayout, computeLayout } from './layout'
import { setLook, type Look } from './render/look'
import { applyQuality } from './render/quality'
import { createStationScene } from './render/stationScene'
import { addStationTargets } from './render/stationTargets'
import { createFpsCounter } from './ui/fps'
import { createHub } from './ui/hub'
import { wireSceneFlows } from './ui/sceneFlows'
import { ScreenHost } from './ui/screens'
import { captainsScreen } from './ui/screens/captains'
import { craftingScreen } from './ui/screens/crafting'
import { debugScreen } from './ui/screens/debug'
import { expeditionsScreen } from './ui/screens/expeditions'
import { fleetScreen } from './ui/screens/fleet'
import { miningScreen } from './ui/screens/mining'
import { recruitScreen } from './ui/screens/recruit'
import { settingsScreen } from './ui/screens/settings'

document.title = NAMES.game

const gameArea = document.getElementById('game')!
const canvas = document.getElementById('world') as HTMLCanvasElement
const ui = document.getElementById('ui')!

const engine = new Engine(canvas, true, { powerPreference: 'high-performance' }, false)
applyQuality(engine, 'high')

const relayout = () => {
  applyLayout(gameArea, computeLayout({ width: innerWidth, height: innerHeight }))
  engine.resize()
}
relayout()
addEventListener('resize', relayout)

const stationScene = createStationScene(engine)
let activeScene: Scene = stationScene
engine.runRenderLoop(() => activeScene.render())

const session = await startSession((clock) => {
  registerCrafting(clock)
  registerMining(clock)
  registerExpedition(clock)
})
if (session.loadError) console.error(`Save could not be loaded and was kept aside: ${session.loadError}`)

const { store } = session
store.subscribe((state) => {
  applyQuality(engine, state.settings.quality)
  setLook(state.settings.look as Look)
})

const screens = new ScreenHost(ui, store)
for (const screen of [
  fleetScreen,
  craftingScreen,
  miningScreen,
  expeditionsScreen,
  recruitScreen,
  captainsScreen,
  settingsScreen,
  debugScreen,
])
  screens.register(screen)
createHub(ui, store, screens)
createFpsCounter(ui, engine, store)

addStationTargets(stationScene, (id) => screens.toggle(id))

wireSceneFlows({
  ui,
  engine,
  store,
  screens,
  stationScene,
  setActiveScene: (scene) => (activeScene = scene),
})

// dev-only handle for inspecting and editing the game from the console
if (import.meta.env.DEV) {
  const transfer = await import('./save/transfer')
  Object.assign(window, { __game: { session, engine, stationScene, ...transfer } })
}
