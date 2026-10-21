/** Crafting screen: stock, the running job, and every recipe with a Start button. */

import { GEAR, HULLS, NAMES, RECIPES, type RecipeDef } from '../../data'
import { cannotCraft, craftingJobs, startCraft } from '../../game/crafting'
import { timerEndsAt, type GameState, type ResourceId } from '../../game/state'
import { countdown, h, progress } from '../dom'
import { formatDuration, formatNumber } from '../format'
import type { ScreenDef } from '../screens'

const GROUPS: { title: string; recipes: string[] }[] = [
  { title: 'Refining', recipes: ['refineOre1', 'refineOre2'] },
  { title: 'Manufacturing', recipes: ['component'] },
  { title: 'Shipyard', recipes: ['frigate'] },
  { title: 'Gear', recipes: ['autocannon'] },
]

const STOCK: ResourceId[] = ['ore1', 'ore2', 'material1', 'material2', 'component']

function outputLabel(output: RecipeDef['output']): string {
  if ('resource' in output) return `${output.amount} ${NAMES[output.resource as ResourceId]}`
  if ('ship' in output) return `1 ${HULLS[output.ship].class} (${HULLS[output.ship].name})`
  return `1 ${GEAR[output.gear].name}`
}

export const craftingScreen: ScreenDef = {
  id: 'crafting',
  title: 'Crafting',

  status(state, now) {
    const job = craftingJobs(state)[0]
    return job ? formatDuration(timerEndsAt(job) - now) : 'IDLE'
  },

  render(state: GameState, ctx) {
    const job = craftingJobs(state)[0]

    const stock = h(
      'section',
      { class: 'section' },
      h('h3', { class: 'section-title' }, 'Stock'),
      h(
        'div',
        {},
        ...STOCK.map((id) =>
          h('div', { class: 'kv' }, h('span', {}, NAMES[id]), h('span', {}, formatNumber(state.resources[id]))),
        ),
      ),
    )

    const current = h(
      'section',
      { class: 'section' },
      h('h3', { class: 'section-title' }, 'Current job'),
      job
        ? h(
            'div',
            { class: 'section' },
            h(
              'div',
              { class: 'kv' },
              h('span', {}, RECIPES[job.data?.recipe as string]?.name ?? 'Job'),
              countdown(timerEndsAt(job)),
            ),
            progress(job.startedAt, timerEndsAt(job)),
          )
        : h('p', { class: 'empty' }, 'Idle. Start a recipe below.'),
    )

    const groups = GROUPS.map((group) =>
      h(
        'section',
        { class: 'section' },
        h('h3', { class: 'section-title' }, group.title),
        h(
          'div',
          { class: 'rows' },
          ...group.recipes.map((id) => {
            const recipe = RECIPES[id]
            const reason = cannotCraft(state, id)
            const inputs = Object.entries(recipe.inputs).map(([res, n]) => {
              const have = state.resources[res as ResourceId]
              return h(
                'span',
                { class: have < n ? 'short' : '' },
                `${n} ${NAMES[res as ResourceId]} (${formatNumber(have)})`,
              )
            })
            return h(
              'div',
              { class: 'row' },
              h(
                'div',
                { class: 'row-main' },
                h('span', { class: 'row-name' }, recipe.name),
                h('span', { class: 'row-detail data' }, ...inputs.flatMap((s, i) => (i ? [' + ', s] : [s]))),
                h(
                  'span',
                  { class: 'row-detail' },
                  `→ ${outputLabel(recipe.output)} · ${formatDuration(recipe.seconds * 1000)}`,
                ),
              ),
              h(
                'button',
                {
                  class: 'btn',
                  type: 'button',
                  disabled: reason !== null,
                  title: reason ?? undefined,
                  onclick: () => ctx.store.update((s) => startCraft(s, id, ctx.now())),
                },
                'Start',
              ),
            )
          }),
        ),
      ),
    )

    return h('div', {}, current, stock, ...groups)
  },
}
