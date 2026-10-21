/**
 * Station hub overlay (D-76, D-77): station name, resource bar and the module
 * buttons that will open each screen. The screens arrive in later build steps,
 * so the buttons are present but disabled for now.
 */

import placeholders from '../data/placeholders.json'
import './hub.css'

const MODULES = ['Fleet', 'Crafting', 'Mining', 'Expeditions', 'Recruit', 'Captains'] as const

const RESOURCES = [
  placeholders.names.ore1,
  placeholders.names.ore2,
  placeholders.names.rareResource,
  placeholders.names.pullCurrency,
]

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

export function createHub(root: HTMLElement): void {
  const header = el('header', 'hub-header')

  const title = el('div', 'hub-title')
  const titleText = el('div')
  titleText.append(el('span', 'hub-label', 'Station'), el('h1', 'hub-name', placeholders.names.station))
  title.append(titleText)

  // starting resources are zero (D-86)
  const resources = el('ul', 'hub-resources')
  resources.setAttribute('aria-label', 'Resources')
  for (const name of RESOURCES) {
    const item = el('li')
    item.append(el('span', 'hub-label', name), el('span', undefined, '0'))
    resources.append(item)
  }

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
