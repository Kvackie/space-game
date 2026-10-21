/** Mining screen: pick a ship and an ore field, send it, watch runs return. */

import { MINING, NAMES } from '../../data'
import { cannotMine, miningRuns, miningYield, ORE_FIELDS, startMining, type OreField } from '../../game/mining'
import { hullOf } from '../../game/ships'
import { timerEndsAt, type GameState } from '../../game/state'
import { countdown, h, progress } from '../dom'
import { formatDuration } from '../format'
import type { ScreenDef } from '../screens'

const FIELD_NAMES: Record<OreField, string> = { ore1: NAMES.oreField1, ore2: NAMES.oreField2 }

let selectedShip: string | null = null
let selectedField: OreField = 'ore1'

export const miningScreen: ScreenDef = {
  id: 'mining',
  title: 'Mining',

  status(state, now) {
    const runs = miningRuns(state)
    if (!runs.length) return 'IDLE'
    return formatDuration(Math.min(...runs.map(timerEndsAt)) - now)
  },

  render(state: GameState, ctx) {
    const miners = state.ships.filter((s) => hullOf(s).canMine)
    if (selectedShip && cannotMine(state, selectedShip)) selectedShip = null
    selectedShip ??= miners.find((s) => !cannotMine(state, s.id))?.id ?? null
    const ship = state.ships.find((s) => s.id === selectedShip)

    const runs = miningRuns(state)
    const active = h(
      'section',
      { class: 'section' },
      h('h3', { class: 'section-title' }, 'Active runs'),
      runs.length
        ? h(
            'div',
            { class: 'rows' },
            ...runs.map((run) => {
              const runShip = state.ships.find((s) => s.id === (run.data?.shipIds as string[])[0])
              return h(
                'div',
                { class: 'row' },
                h(
                  'div',
                  { class: 'row-main' },
                  h('span', { class: 'row-name' }, runShip?.name ?? 'Ship'),
                  h(
                    'span',
                    { class: 'row-detail' },
                    `${FIELD_NAMES[run.data?.field as OreField]} · +${run.data?.amount} ${NAMES[run.data?.field as OreField]}`,
                  ),
                  progress(run.startedAt, timerEndsAt(run)),
                ),
                countdown(timerEndsAt(run)),
              )
            }),
          )
        : h('p', { class: 'empty' }, 'No ships out mining.'),
    )

    const shipChoices = h(
      'div',
      { class: 'choices' },
      ...miners.map((s) => {
        const reason = cannotMine(state, s.id)
        return h(
          'button',
          {
            class: 'choice',
            type: 'button',
            'aria-pressed': String(s.id === selectedShip),
            disabled: reason !== null,
            onclick: () => {
              selectedShip = s.id
              ctx.store.changed()
            },
          },
          h('span', { class: 'row-name' }, s.name),
          h('br'),
          h('span', { class: 'row-detail' }, reason ?? `${hullOf(s).class} · ${miningYield(state, s)} ore per run`),
        )
      }),
    )

    const fieldChoices = h(
      'div',
      { class: 'choices' },
      ...ORE_FIELDS.map((field) =>
        h(
          'button',
          {
            class: 'choice',
            type: 'button',
            'aria-pressed': String(field === selectedField),
            onclick: () => {
              selectedField = field
              ctx.store.changed()
            },
          },
          h('span', { class: 'row-name' }, FIELD_NAMES[field]),
          h('br'),
          h('span', { class: 'row-detail' }, NAMES[field]),
        ),
      ),
    )

    const dispatch = h(
      'section',
      { class: 'section' },
      h('h3', { class: 'section-title' }, 'Send a ship'),
      miners.length ? shipChoices : h('p', { class: 'empty' }, 'No ship can mine.'),
      h('h3', { class: 'section-title' }, 'Ore field'),
      fieldChoices,
      h(
        'div',
        { class: 'kv' },
        h('span', {}, 'Run'),
        h(
          'span',
          {},
          ship
            ? `${formatDuration(MINING.runSeconds * 1000)} · +${miningYield(state, ship)} ${NAMES[selectedField]}`
            : formatDuration(MINING.runSeconds * 1000),
        ),
      ),
      h(
        'button',
        {
          class: 'btn',
          type: 'button',
          disabled: !ship,
          onclick: () => {
            if (selectedShip) ctx.store.update((s) => startMining(s, selectedShip!, selectedField, ctx.now()))
          },
        },
        'Start mining',
      ),
    )

    return h('div', {}, active, dispatch)
  },
}
