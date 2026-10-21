/**
 * Expeditions screen: place ships in Front / Middle / Back (the only player
 * input in combat, D-73), send them, and review past battles.
 */

import { ENEMIES, ENEMY_GROUP, EXPEDITION, NAMES, ROWS, type Row } from '../../data'
import { activeExpedition, cannotSendExpedition, startExpedition, type FormationSlot } from '../../game/expedition'
import { hullOf, isIdle, shipStats } from '../../game/ships'
import { timerEndsAt, type GameState, type ResourceId } from '../../game/state'
import { countdown, h, progress } from '../dom'
import { formatDuration, formatNumber } from '../format'
import type { ScreenDef } from '../screens'

const ROW_LABELS: Record<Row, string> = { front: 'Front', middle: 'Middle', back: 'Back' }

/** Chosen row per ship id; absent = stays home. */
const formation = new Map<string, Row>()

/** Lets the battle view hook in (step 8). */
export const expeditionHooks: { watch?: (battleId: string) => void } = {}

const rewardText = (rewards: Partial<Record<ResourceId, number>>) =>
  Object.entries(rewards)
    .map(([id, n]) => `+${formatNumber(n)} ${NAMES[id as ResourceId]}`)
    .join(', ') || 'No reward'

export const expeditionsScreen: ScreenDef = {
  id: 'expeditions',
  title: 'Expeditions',

  status(state, now) {
    const active = activeExpedition(state)
    if (active) return formatDuration(timerEndsAt(active) - now)
    return state.battles[0] ? (state.battles[0].won ? 'WON' : 'LOST') : 'READY'
  },

  render(state: GameState, ctx) {
    const active = activeExpedition(state)
    const fighters = state.ships.filter((s) => hullOf(s).canFight)
    for (const id of formation.keys()) {
      const ship = state.ships.find((s) => s.id === id)
      if (!ship || !isIdle(state, ship)) formation.delete(id)
    }
    const slots: FormationSlot[] = [...formation].map(([shipId, row]) => ({ shipId, row }))
    const reason = cannotSendExpedition(state, slots)

    const status = h(
      'section',
      { class: 'section' },
      h('h3', { class: 'section-title' }, NAMES.expedition),
      active
        ? h(
            'div',
            { class: 'section' },
            h('div', { class: 'kv' }, h('span', {}, 'Battle in'), countdown(timerEndsAt(active))),
            progress(active.startedAt, timerEndsAt(active)),
          )
        : h(
            'p',
            { class: 'empty' },
            `${formatDuration(EXPEDITION.seconds * 1000)} out, then one battle. Win: ${rewardText(EXPEDITION.rewards)}.`,
          ),
    )

    const intel = h(
      'section',
      { class: 'section' },
      h('h3', { class: 'section-title' }, `Enemy · ${NAMES.enemyGroup}`),
      h(
        'div',
        {},
        ...ENEMY_GROUP.map(({ enemy, row }) => {
          const def = ENEMIES[enemy]
          return h(
            'div',
            { class: 'kv' },
            h('span', {}, `${ROW_LABELS[row]} · ${def.name}`),
            h('span', {}, `HP ${def.stats.hp} · DEF ${def.stats.defence} · FP ${def.stats.firepower}`),
          )
        }),
      ),
    )

    const setup = h(
      'section',
      { class: 'section' },
      h('h3', { class: 'section-title' }, `Formation (up to ${EXPEDITION.maxShips} ships)`),
      fighters.length
        ? h(
            'div',
            { class: 'rows' },
            ...fighters.map((ship) => {
              const idle = isIdle(state, ship)
              const stats = shipStats(state, ship)
              const choice = (label: string, row: Row | null) =>
                h(
                  'button',
                  {
                    class: 'choice',
                    type: 'button',
                    disabled: !idle || !!active,
                    'aria-pressed': String((formation.get(ship.id) ?? null) === row),
                    onclick: () => {
                      if (row) formation.set(ship.id, row)
                      else formation.delete(ship.id)
                      ctx.store.changed()
                    },
                  },
                  label,
                )
              return h(
                'div',
                { class: 'row', style: 'flex-wrap: wrap' },
                h(
                  'div',
                  { class: 'row-main' },
                  h('span', { class: 'row-name' }, ship.name),
                  h(
                    'span',
                    { class: 'row-detail data' },
                    idle ? `HP ${stats.hp} · DEF ${stats.defence} · FP ${stats.firepower}` : 'Away',
                  ),
                ),
                h(
                  'div',
                  { class: 'choices' },
                  ...ROWS.map((row) => choice(ROW_LABELS[row], row)),
                  choice('Stay', null),
                ),
              )
            }),
          )
        : h('p', { class: 'empty' }, 'No combat ships yet. Build a Frigate in Crafting.'),
      h(
        'button',
        {
          class: 'btn',
          type: 'button',
          disabled: reason !== null,
          title: reason ?? undefined,
          onclick: () => {
            ctx.store.update((s) => startExpedition(s, slots, ctx.now()))
            formation.clear()
          },
        },
        'Launch expedition',
      ),
      reason && !active && fighters.length > 0 && h('p', { class: 'empty' }, reason),
    )

    const history = h(
      'section',
      { class: 'section' },
      h('h3', { class: 'section-title' }, 'Battle reports'),
      state.battles.length
        ? h(
            'div',
            { class: 'rows' },
            ...state.battles.map((battle) =>
              h(
                'div',
                { class: 'row' },
                h(
                  'div',
                  { class: 'row-main' },
                  h('span', { class: battle.won ? 'row-name' : 'row-name short' }, battle.won ? 'Victory' : 'Defeat'),
                  h(
                    'span',
                    { class: 'row-detail' },
                    `${new Date(battle.at).toLocaleString()} · ${rewardText(battle.rewards)}`,
                  ),
                ),
                expeditionHooks.watch &&
                  h(
                    'button',
                    { class: 'btn btn-secondary', type: 'button', onclick: () => expeditionHooks.watch?.(battle.id) },
                    'Watch',
                  ),
              ),
            ),
          )
        : h('p', { class: 'empty' }, 'No battles yet.'),
    )

    return h('div', {}, status, intel, setup, history)
  },
}
