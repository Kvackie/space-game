/**
 * Station hub overlay (D-76, D-77): station name, resource bar and the module
 * buttons that will open each screen. The screens arrive in later build steps,
 * so the buttons are present but disabled for now.
 */

import { NAMES } from '../data'
import type { ResourceId } from '../game/state'
import type { GameStore } from '../game/store'
import './hub.css'

const MODULES = ['Fleet', 'Crafting', 'Mining', 'Expeditions', 'Recruit', 'Captains'] as const

/** Raw ores and the gacha currencies; materials and components show in Crafting. */
const HUB_RESOURCES: ResourceId[] = ['ore1', 'ore2', 'rareResource', 'pullCurrency']

const numberFormat = new Intl.NumberFormat('en')

const GEAR_ICON = `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>`

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

export function createHub(root: HTMLElement, store: GameStore): void {
  const header = el('header', 'hub-header')

  const title = el('div', 'hub-title')
  const titleText = el('div')
  titleText.append(el('span', 'hub-label', 'Station'), el('h1', 'hub-name', NAMES.station))
  title.append(titleText)

  const resources = el('ul', 'hub-resources')
  resources.setAttribute('aria-label', 'Resources')
  const amounts = HUB_RESOURCES.map((id) => {
    const item = el('li')
    const amount = el('span')
    item.append(el('span', 'hub-label', NAMES[id]), amount)
    resources.append(item)
    return amount
  })
  store.subscribe((state) => {
    HUB_RESOURCES.forEach((id, i) => (amounts[i].textContent = numberFormat.format(state.resources[id])))
  })

  const settings = el('button', 'hub-icon-button')
  settings.type = 'button'
  settings.disabled = true
  settings.setAttribute('aria-label', 'Settings')
  settings.innerHTML = GEAR_ICON

  header.append(title, resources, settings)

  const modules = el('nav', 'hub-modules')
  modules.setAttribute('aria-label', 'Station modules')
  for (const name of MODULES) {
    const button = el('button', 'hub-module')
    button.type = 'button'
    button.disabled = true
    button.append(el('span', undefined, name), el('span', 'hub-module-status', '—'))
    modules.append(button)
  }

  root.append(header, modules)
}
