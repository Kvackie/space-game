import '@fontsource/oxanium/600.css'
import '@fontsource/oxanium/700.css'
import '@fontsource/ibm-plex-sans-condensed/400.css'
import '@fontsource/ibm-plex-sans-condensed/600.css'
import '@fontsource/jetbrains-mono/400.css'
import './theme.css'

import { Engine } from '@babylonjs/core/Engines/engine'
import type { Scene } from '@babylonjs/core/scene'
import { registerCrafting } from './game/crafting'
import { registerExpedition } from './game/expedition'
import { registerMining } from './game/mining'
import { startSession } from './game/session'
import { applyLayout, computeLayout } from './layout'
import { createBattleView, type BattleView } from './render/battleView'
import { applyQuality } from './render/quality'
import { createStationScene } from './render/stationScene'
import { createBattleHud } from './ui/battleHud'
import { createFpsCounter } from './ui/fps'
import { createHub } from './ui/hub'
import { ScreenHost } from './ui/screens'
import { captainsScreen } from './ui/screens/captains'
import { craftingScreen } from './ui/screens/crafting'
import { expeditionHooks, expeditionsScreen } from './ui/screens/expeditions'
import { fleetScreen } from './ui/screens/fleet'
import { miningScreen } from './ui/screens/mining'
import { recruitScreen } from './ui/screens/recruit'
import { settingsScreen } from './ui/screens/settings'

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
store.subscribe((state) => applyQuality(engine, state.settings.quality))

const screens = new ScreenHost(ui, store)
for (const screen of [
  fleetScreen,
  craftingScreen,
  miningScreen,
  expeditionsScreen,
  recruitScreen,
  captainsScreen,
  settingsScreen,
])
  screens.register(screen)
createHub(ui, store, screens)
createFpsCounter(ui, engine, store)

// battle replays: the battle view loads on first use
const battleHud = createBattleHud(ui)
let battleView: Promise<BattleView> | null = null
expeditionHooks.watch = async (battleId) => {
  const record = store.state.battles.find((b) => b.id === battleId)
  if (!record) return
  screens.close()
  battleView ??= createBattleView(engine)
  const view = await battleView
  const leave = () => {
    view.stop()
    battleHud.hide()
    activeScene = stationScene
  }
  battleHud.show(record, leave)
  activeScene = view.scene
  view.play(record, () => battleHud.showResult(record))
}
store.changed()

// dev-only handle for inspecting and editing the game from the console
if (import.meta.env.DEV) {
  const transfer = await import('./save/transfer')
  Object.assign(window, { __game: { session, ...transfer } })
}
