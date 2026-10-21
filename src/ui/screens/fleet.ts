/** Fleet screen: every ship, and the selected ship's stats, gear slots and captain. */

import { CAPTAINS, GEAR, SKILLS, type StatId } from '../../data'
import { fitGear, spareGear } from '../../game/fleet'
import { hullOf, isIdle, shipStats } from '../../game/ships'
import type { GameState, Ship } from '../../game/state'
import { h } from '../dom'
import type { ScreenDef } from '../screens'

export const STAT_LABELS: Record<StatId, string> = {
  hp: 'HP',
  defence: 'Defence',
  cargo: 'Cargo',
  miningYield: 'Mining yield',
  firepower: 'Firepower',
}

/** What a ship is doing, from the timers it belongs to. */
export function shipActivity(state: GameState, ship: Ship): string {
  const timer = state.timers.find((t) => (t.data?.shipIds as string[] | undefined)?.includes(ship.id))
  if (!timer) return 'Docked'
  return timer.kind === 'mining' ? 'Mining' : 'On expedition'
}

let selected: string | null = null

function detail(
  state: GameState,
  ship: Ship,
  open: (id: 'captains') => void,
  update: (fn: (s: GameState) => void) => void,
) {
  const hull = hullOf(ship)
  const stats = shipStats(state, ship)
  const docked = isIdle(state, ship)
  const skill = hull.innateSkill ? SKILLS[hull.innateSkill as keyof typeof SKILLS] : null
  const captain = state.captains.find((c) => c.id === ship.captainId)
  const spare = spareGear(state)

  const roles = [hull.canMine && 'mining', hull.canFight && 'combat'].filter(Boolean).join(' and ') || 'no role'

  const slots = ship.gear.map((gearId, slot) => {
    const item = gearId ? state.gear.find((g) => g.id === gearId) : null
    return h(
      'div',
      { class: 'row' },
      h(
        'div',
        { class: 'row-main' },
        h('span', { class: 'row-name' }, item ? GEAR[item.type].name : 'Empty slot'),
        item &&
          h(
            'span',
            { class: 'row-detail' },
            h('span', { class: 'badge' }, GEAR[item.type].tier),
            ' ',
            Object.entries(GEAR[item.type].bonus)
              .map(([id, v]) => `${STAT_LABELS[id as StatId]} +${v}`)
              .join(', '),
          ),
      ),
      item
        ? h(
            'button',
            {
              class: 'btn btn-secondary',
              type: 'button',
              disabled: !docked,
              onclick: () => update((s) => fitGear(s, ship.id, slot, null)),
            },
            'Remove',
          )
        : spare[0] &&
            h(
              'button',
              {
                class: 'btn',
                type: 'button',
                disabled: !docked,
                onclick: () => update((s) => fitGear(s, ship.id, slot, spare[0].id)),
              },
              `Fit ${GEAR[spare[0].type].name}`,
            ),
    )
  })

  return h(
    'div',
    {},
    h(
      'section',
      { class: 'section' },
      h('h3', { class: 'section-title' }, `${hull.class} · ${roles} · ${shipActivity(state, ship)}`),
      h(
        'div',
        {},
        ...(Object.keys(STAT_LABELS) as StatId[])
          .filter((id) => stats[id] !== undefined)
          .map((id) => {
            const base = hull.stats[id]!
            const value = stats[id]!
            return h(
              'div',
              { class: 'kv' },
              h('span', {}, STAT_LABELS[id]),
              h('span', {}, value === base ? String(value) : `${value} (${base} +${value - base})`),
            )
          }),
      ),
      skill && h('p', { class: 'empty' }, `Innate skill: ${skill.name}. ${skill.description}`),
    ),
    h(
      'section',
      { class: 'section' },
      h('h3', { class: 'section-title' }, `Gear (${hull.gearSlots} ${hull.gearSlots === 1 ? 'slot' : 'slots'})`),
      hull.gearSlots
        ? h('div', { class: 'rows' }, ...slots)
        : h('p', { class: 'empty' }, 'This hull has no gear slots.'),
      !docked && h('p', { class: 'empty' }, 'Refitting is possible when the ship is docked.'),
    ),
    h(
      'section',
      { class: 'section' },
      h('h3', { class: 'section-title' }, 'Captain'),
      h(
        'div',
        { class: 'row' },
        h(
          'div',
          { class: 'row-main' },
          h('span', { class: 'row-name' }, captain ? CAPTAINS[captain.def].name : 'No captain'),
          captain &&
            h('span', { class: `row-detail rarity-${CAPTAINS[captain.def].rarity}` }, CAPTAINS[captain.def].rarity),
        ),
        h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => open('captains') }, 'Captains'),
      ),
    ),
  )
}

export const fleetScreen: ScreenDef = {
  id: 'fleet',
  title: 'Fleet',

  status: (state) => String(state.ships.length),

  render(state, ctx) {
    if (!state.ships.some((s) => s.id === selected)) selected = state.ships[0]?.id ?? null
    const ship = state.ships.find((s) => s.id === selected)

    const list = h(
      'section',
      { class: 'section' },
      h('h3', { class: 'section-title' }, 'Ships'),
      h(
        'div',
        { class: 'choices' },
        ...state.ships.map((s) =>
          h(
            'button',
            {
              class: 'choice',
              type: 'button',
              'aria-pressed': String(s.id === selected),
              onclick: () => {
                selected = s.id
                ctx.store.changed()
              },
            },
            h('span', { class: 'row-name' }, s.name),
            h('br'),
            h('span', { class: 'row-detail' }, `${hullOf(s).class} · ${shipActivity(state, s)}`),
          ),
        ),
      ),
    )

    return h(
      'div',
      {},
      list,
      ship &&
        detail(
          state,
          ship,
          (id) => ctx.open(id),
          (fn) => ctx.store.update(fn),
        ),
    )
  },
}
