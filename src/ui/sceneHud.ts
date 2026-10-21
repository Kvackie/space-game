/**
 * The HUD over a full-screen scene (battle replay, recruitment warp): a title
 * and a leave/skip button while it plays, then a result card. The station
 * hub is hidden meanwhile.
 */

import { h } from './dom'
import './sceneHud.css'

export interface SceneHud {
  /** Shows the bar; `controls` go next to the leave button (e.g. speed). */
  show(title: string, leaveLabel: string, onLeave: () => void, controls?: Node[]): void
  /** Replaces the bar's leave label and shows a centred result card. */
  showResult(content: Node[]): void
  hide(): void
}

export function createSceneHud(root: HTMLElement): SceneHud {
  let leave: () => void = () => {}
  const title = h('h2', { class: 'screen-title' })
  const controls = h('div', { class: 'choices' })
  const leaveButton = h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => leave() })
  const result = h('div', { class: 'scene-result', hidden: true })
  const hud = h(
    'div',
    { class: 'scene-hud', hidden: true },
    h('header', { class: 'scene-bar' }, title, h('div', { class: 'choices' }, controls, leaveButton)),
    result,
  )
  root.append(hud)

  return {
    show(text, leaveLabel, onLeave, extra = []) {
      leave = onLeave
      title.textContent = text
      leaveButton.textContent = leaveLabel
      controls.replaceChildren(...extra)
      result.hidden = true
      hud.hidden = false
      root.classList.add('in-scene')
    },
    showResult(content) {
      result.replaceChildren(...content)
      result.hidden = false
      leaveButton.textContent = 'Close'
    },
    hide() {
      hud.hidden = true
      root.classList.remove('in-scene')
    },
  }
}
