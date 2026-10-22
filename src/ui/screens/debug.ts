/** Debug menu for testing (opened from Settings): resources, timers, ships, gear, captains, pity. */

import { CAPTAINS, GACHA, GEAR, HULLS, NAMES } from '../../data'
import {
  finishTimers,
  grantAllResources,
  grantResource,
  setPity,
  spawnCaptain,
  spawnGear,
  spawnShip,
} from '../../game/debug'
import { RESOURCE_IDS, type GameState } from '../../game/state'
import { h } from '../dom'
import { formatNumber } from '../format'
import type { ScreenContext, ScreenDef } from '../screens'

function section(title: string, ...children: Node[]): HTMLElement {
  return h('section', { class: 'section' }, h('h3', { class: 'section-title' }, title), ...children)
}

export const debugScreen: ScreenDef = {
  id: 'debug',
  title: 'Debug',

  render(state: GameState, ctx: ScreenContext) {
    const act = (fn: (s: GameState) => void) => () => ctx.store.update(fn)
    const button = (label: string, onclick: () => void, secondary = true) =>
      h('button', { class: secondary ? 'btn btn-secondary' : 'btn', type: 'button', onclick }, label)

    return h(
      'div',
      {},
      h('p', { class: 'empty' }, 'Testing shortcuts. Changes are saved like any other progress.'),
      section(
        'Resources',
        h(
          'div',
          { class: 'choices' },
          button(
            '+1,000 of everything',
            act((s) => grantAllResources(s, 1000)),
            false,
          ),
        ),
        h(
          'div',
          { class: 'rows' },
          ...RESOURCE_IDS.map((id) =>
            h(
              'div',
              { class: 'row' },
              h(
                'div',
                { class: 'row-main' },
                h('span', { class: 'row-name' }, NAMES[id]),
                h('span', { class: 'row-detail data' }, formatNumber(state.resources[id])),
              ),
              button(
                '+100',
                act((s) => grantResource(s, id, 100)),
              ),
              button(
                '+1,000',
                act((s) => grantResource(s, id, 1000)),
              ),
            ),
          ),
        ),
      ),
      section(
        'Timers',
        h(
          'div',
          { class: 'choices' },
          button(
            `Finish all now (${state.timers.length} running)`,
            act((s) => finishTimers(s, ctx.now())),
            false,
          ),
        ),
      ),
      section(
        'Spawn',
        h(
          'div',
          { class: 'choices' },
          ...Object.keys(HULLS).map((hull) =>
            button(
              `+ ${HULLS[hull].name}`,
              act((s) => spawnShip(s, hull)),
            ),
          ),
          ...Object.keys(GEAR).map((type) =>
            button(
              `+ ${GEAR[type].name}`,
              act((s) => spawnGear(s, type)),
            ),
          ),
        ),
        h(
          'div',
          { class: 'choices' },
          ...Object.keys(CAPTAINS).map((def) =>
            button(
              `+ ${CAPTAINS[def].name}`,
              act((s) => spawnCaptain(s, def)),
            ),
          ),
        ),
      ),
      section(
        `Pity counter: ${state.gacha.pity} / ${GACHA.pityThreshold}`,
        h(
          'div',
          { class: 'choices' },
          button(
            'Next pull is Legendary',
            act((s) => setPity(s, GACHA.pityThreshold - 1)),
          ),
          button(
            'Reset to 0',
            act((s) => setPity(s, 0)),
          ),
        ),
      ),
    )
  },
}
