/**
 * Full-screen scenes over the station: battle replays (D-110) and the
 * recruitment warp (D-109). Each 3D view loads on first use.
 */

import type { Engine } from '@babylonjs/core/Engines/engine'
import type { Scene } from '@babylonjs/core/scene'
import { CAPTAINS, NAMES, RARITY_ORDER } from '../data'
import type { PullResult } from '../game/gacha'
import type { ResourceId } from '../game/state'
import type { GameStore } from '../game/store'
import { createBattleView, type BattleView } from '../render/battleView'
import { createDockView, type DockView } from '../render/dockView'
import { createWarpView, type WarpView } from '../render/warpView'
import { h } from './dom'
import { portrait } from './portrait'
import { formatNumber } from './format'
import { createSceneHud } from './sceneHud'
import type { ScreenHost } from './screens'
import { expeditionHooks } from './screens/expeditions'
import { fleetSelection } from './screens/fleet'
import { recruitHooks } from './screens/recruit'

const SPEEDS = [1, 2, 4]

export function wireSceneFlows(opts: {
  ui: HTMLElement
  engine: Engine
  store: GameStore
  screens: ScreenHost
  stationScene: Scene
  setActiveScene: (scene: Scene) => void
}): void {
  const { ui, engine, store, screens, stationScene, setActiveScene } = opts
  const hud = createSceneHud(ui)
  let battleView: Promise<BattleView> | null = null
  let warpView: Promise<WarpView> | null = null

  const backToStation = (reopen?: 'recruit' | 'expeditions') => {
    hud.hide()
    setActiveScene(stationScene)
    if (reopen) screens.open(reopen)
  }

  expeditionHooks.watch = async (battleId) => {
    const record = store.state.battles.find((b) => b.id === battleId)
    if (!record) return
    screens.close()
    battleView ??= createBattleView(engine)
    const view = await battleView

    let speed = 1
    const speedButtons = SPEEDS.map((s) =>
      h(
        'button',
        {
          class: 'choice',
          type: 'button',
          'aria-pressed': String(s === speed),
          onclick: () => {
            speed = s
            view.setSpeed(s)
            speedButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(SPEEDS[i] === s)))
          },
        },
        `${s}×`,
      ),
    )
    view.setSpeed(speed)

    hud.show(
      'Battle',
      'Leave',
      () => {
        view.stop()
        backToStation('expeditions')
      },
      speedButtons,
    )
    setActiveScene(view.scene)
    view.play(record, () => {
      const rewards = Object.entries(record.rewards).map(([id, n]) =>
        h('div', { class: 'kv' }, h('span', {}, NAMES[id as ResourceId]), h('span', {}, `+${formatNumber(n)}`)),
      )
      hud.showResult([
        h('h3', { class: record.won ? 'scene-outcome' : 'scene-outcome short' }, record.won ? 'Victory' : 'Defeat'),
        rewards.length
          ? h('div', {}, ...rewards)
          : h('p', { class: 'empty' }, 'No reward. Your ships returned unharmed.'),
      ])
    })
  }

  recruitHooks.warp = async (results: PullResult[]) => {
    if (!results.length) return
    screens.close()
    warpView ??= createWarpView(engine)
    const view = await warpView
    // one warp in the colour of the best rarity pulled (D-109)
    const best = results.reduce(
      (a, r) => (RARITY_ORDER.indexOf(r.rarity) > RARITY_ORDER.indexOf(a) ? r.rarity : a),
      results[0].rarity,
    )

    const showResults = () =>
      hud.showResult([
        h('h3', { class: 'scene-outcome' }, results.length === 1 ? 'Captain arrived' : 'Captains arrived'),
        h(
          'div',
          { class: 'rows' },
          ...results.map((r) =>
            h(
              'div',
              { class: 'row' },
              portrait(CAPTAINS[r.def].portrait, r.rarity, CAPTAINS[r.def].name, 'small'),
              h(
                'div',
                { class: 'row-main' },
                h('span', { class: 'row-name' }, CAPTAINS[r.def].name),
                h('span', { class: `rarity-${r.rarity}` }, r.rarity),
              ),
              r.duplicate && h('span', { class: 'badge' }, `+ ${CAPTAINS[r.def].limitBreakMaterial}`),
            ),
          ),
        ),
      ])

    hud.show('Recruitment', 'Skip', () => {
      if (ended) backToStation('recruit')
      else view.skip()
    })
    let ended = false
    setActiveScene(view.scene)
    view.play(best, () => {
      ended = true
      showResults()
    })
  }

  // Fleet opens the docking bay; the bay shows the ship selected in the Fleet panel (D-114)
  let dockView: Promise<DockView> | null = null
  let inDock = false
  const syncDock = async () => {
    if (screens.current === 'fleet') {
      dockView ??= createDockView(engine)
      const view = await dockView
      if (screens.current !== 'fleet') return
      const ship = fleetSelection(store.state)
      if (ship) view.show(ship.hull, ship.id)
      if (!inDock) setActiveScene(view.scene)
      inDock = true
    } else if (inDock) {
      inDock = false
      setActiveScene(stationScene)
    }
  }
  screens.onChange(() => void syncDock())
  store.subscribe(() => void syncDock())

  // screens render their Watch button only once the hook exists
  store.changed()
}
