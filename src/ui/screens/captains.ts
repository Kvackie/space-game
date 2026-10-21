/** Captains screen: the roster, and assigning a captain to a docked ship (D-68, D-74). */

import { CAPTAINS, RARITY_ORDER, type StatId } from '../../data'
import { assignCaptain, captainShip } from '../../game/fleet'
import { isIdle } from '../../game/ships'
import type { GameState } from '../../game/state'
import { h } from '../dom'
import type { ScreenDef } from '../screens'
import { STAT_LABELS } from './fleet'

let selected: string | null = null

const bonusText = (def: string) =>
  Object.entries(CAPTAINS[def].bonus)
    .map(([id, v]) => `${STAT_LABELS[id as StatId]} +${v}`)
    .join(', ')

export const captainsScreen: ScreenDef = {
  id: 'captains',
  title: 'Captains',

  status: (state) => String(state.captains.length),

  render(state: GameState, ctx) {
    const roster = [...state.captains].sort(
      (a, b) => RARITY_ORDER.indexOf(CAPTAINS[b.def].rarity) - RARITY_ORDER.indexOf(CAPTAINS[a.def].rarity),
    )
    if (!roster.some((c) => c.id === selected)) selected = roster[0]?.id ?? null
    const captain = state.captains.find((c) => c.id === selected)

    if (!roster.length) {
      return h(
        'div',
        {},
        h('p', { class: 'empty' }, 'No captains yet. Recruit them with pull currency from expeditions.'),
        h('button', { class: 'btn', type: 'button', onclick: () => ctx.open('recruit') }, 'Recruit'),
      )
    }

    const list = h(
      'section',
      { class: 'section' },
      h('h3', { class: 'section-title' }, 'Roster'),
      h(
        'div',
        { class: 'choices' },
        ...roster.map((c) => {
          const def = CAPTAINS[c.def]
          return h(
            'button',
            {
              class: 'choice',
              type: 'button',
              'aria-pressed': String(c.id === selected),
              onclick: () => {
                selected = c.id
                ctx.store.changed()
              },
            },
            h('span', { class: 'row-name' }, def.name),
            h('br'),
            h('span', { class: `rarity-${def.rarity}` }, def.rarity),
          )
        }),
      ),
    )

    if (!captain) return h('div', {}, list)
    const def = CAPTAINS[captain.def]
    const ship = captainShip(state, captain.id)

    const assign = h(
      'section',
      { class: 'section' },
      h('h3', { class: 'section-title' }, 'Assign to ship'),
      h(
        'div',
        { class: 'choices' },
        ...state.ships.map((s) =>
          h(
            'button',
            {
              class: 'choice',
              type: 'button',
              'aria-pressed': String(s.id === ship?.id),
              disabled: !isIdle(state, s) || (ship !== undefined && !isIdle(state, ship)),
              onclick: () => ctx.store.update((st) => assignCaptain(st, s.id, captain.id)),
            },
            s.name,
          ),
        ),
        ship &&
          h(
            'button',
            {
              class: 'choice',
              type: 'button',
              disabled: !isIdle(state, ship),
              onclick: () => ctx.store.update((st) => assignCaptain(st, ship.id, null)),
            },
            'Unassign',
          ),
      ),
      h('p', { class: 'empty' }, 'Captains can be moved while their ship is docked.'),
    )

    return h(
      'div',
      {},
      list,
      h(
        'section',
        { class: 'section' },
        h('h3', { class: 'section-title' }, def.name),
        h('div', { class: 'kv' }, h('span', {}, 'Rarity'), h('span', { class: `rarity-${def.rarity}` }, def.rarity)),
        h('div', { class: 'kv' }, h('span', {}, 'Bonus'), h('span', {}, bonusText(captain.def))),
        h('div', { class: 'kv' }, h('span', {}, 'Ship'), h('span', {}, ship?.name ?? 'Unassigned')),
        h(
          'div',
          { class: 'kv' },
          h('span', {}, def.limitBreakMaterial),
          h('span', {}, String(captain.limitBreakMaterial)),
        ),
        h(
          'p',
          { class: 'empty' },
          'Duplicates become Limit Break material. Limit Breaks arrive with captain levelling.',
        ),
      ),
      assign,
    )
  },
}
