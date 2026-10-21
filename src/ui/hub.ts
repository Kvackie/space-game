/**
 * Station hub overlay (D-76, D-77): station name, resource bar and the module
 * buttons that open each screen, with a live status per module.
 */

import { NAMES } from '../data'
import type { ResourceId } from '../game/state'
import type { GameStore } from '../game/store'
import { h } from './dom'
import { formatNumber } from './format'
import type { ScreenHost, ScreenId } from './screens'
import './hub.css'

const MODULES: { id: ScreenId; label: string }[] = [
  { id: 'fleet', label: 'Fleet' },
  { id: 'crafting', label: 'Crafting' },
  { id: 'mining', label: 'Mining' },
  { id: 'expeditions', label: 'Expeditions' },
  { id: 'recruit', label: 'Recruit' },
  { id: 'captains', label: 'Captains' },
]

/** Raw ores and the gacha currencies; materials and components show in Crafting. */
const HUB_RESOURCES: ResourceId[] = ['ore1', 'ore2', 'rareResource', 'pullCurrency']

const GEAR_ICON = `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>`

export function createHub(root: HTMLElement, store: GameStore, screens: ScreenHost): void {
  const amounts = HUB_RESOURCES.map(() => h('span'))
  store.subscribe((state) => {
    HUB_RESOURCES.forEach((id, i) => (amounts[i].textContent = formatNumber(state.resources[id])))
  })

  const settings = h('button', {
    class: 'hub-icon-button',
    type: 'button',
    'aria-label': 'Settings',
    disabled: !screens.has('settings'),
    onclick: () => screens.toggle('settings'),
  })
  settings.innerHTML = GEAR_ICON

  const header = h(
    'header',
    { class: 'hub-header' },
    h(
      'div',
      { class: 'hub-title' },
      h('div', {}, h('span', { class: 'hub-label' }, 'Station'), h('h1', { class: 'hub-name' }, NAMES.station)),
    ),
    h(
      'ul',
      { class: 'hub-resources', 'aria-label': 'Resources' },
      ...HUB_RESOURCES.map((id, i) => h('li', {}, h('span', { class: 'hub-label' }, NAMES[id]), amounts[i])),
    ),
    settings,
  )

  const buttons = MODULES.map(({ id, label }) => {
    const status = h('span', { class: 'hub-module-status' }, '—')
    const button = h(
      'button',
      { class: 'hub-module', type: 'button', disabled: !screens.has(id), onclick: () => screens.toggle(id) },
      h('span', {}, label),
      status,
    )
    return { id, button, status }
  })

  const refresh = () => {
    const now = Date.now()
    for (const { id, button, status } of buttons) {
      button.setAttribute('aria-pressed', String(screens.current === id))
      const text = screens.get(id)?.status?.(store.state, now) ?? '—'
      if (status.textContent !== text) status.textContent = text
    }
  }
  screens.onChange(refresh)
  store.subscribe(refresh)

  root.append(
    header,
    h('nav', { class: 'hub-modules', 'aria-label': 'Station modules' }, ...buttons.map((b) => b.button)),
  )
}
