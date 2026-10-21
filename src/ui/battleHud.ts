/**
 * The HUD over the battle view: a Leave button while it plays, then the result
 * and rewards. The station hub is hidden meanwhile.
 */

import { NAMES } from '../data'
import type { BattleRecord, ResourceId } from '../game/state'
import { h } from './dom'
import { formatNumber } from './format'
import './battleHud.css'

export interface BattleHud {
  show(record: BattleRecord, onLeave: () => void): void
  showResult(record: BattleRecord): void
  hide(): void
}

export function createBattleHud(root: HTMLElement): BattleHud {
  const result = h('div', { class: 'battle-result', hidden: true })
  let leave: () => void = () => {}
  const leaveButton = h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => leave() }, 'Leave')
  const hud = h(
    'div',
    { class: 'battle-hud', hidden: true },
    h('header', { class: 'battle-bar' }, h('h2', { class: 'screen-title' }, 'Battle'), leaveButton),
    result,
  )
  root.append(hud)

  return {
    show(_record, onLeave) {
      leave = onLeave
      result.hidden = true
      hud.hidden = false
      root.classList.add('in-battle')
    },
    showResult(record) {
      const rewards = Object.entries(record.rewards).map(([id, n]) =>
        h('div', { class: 'kv' }, h('span', {}, NAMES[id as ResourceId]), h('span', {}, `+${formatNumber(n)}`)),
      )
      result.replaceChildren(
        h('h3', { class: record.won ? 'battle-outcome' : 'battle-outcome short' }, record.won ? 'Victory' : 'Defeat'),
        rewards.length
          ? h('div', {}, ...rewards)
          : h('p', { class: 'empty' }, 'No reward. Your ships returned unharmed.'),
        h('button', { class: 'btn', type: 'button', onclick: () => leave() }, 'Return to station'),
      )
      result.hidden = false
    },
    hide() {
      hud.hidden = true
      root.classList.remove('in-battle')
    },
  }
}
