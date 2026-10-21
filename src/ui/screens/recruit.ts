/**
 * Recruit screen: pull captains and exchange the rare resource (D-60, D-61).
 * Whether drop rates, the pity counter or a pull history are shown is still
 * open (GDD 5.4), so none are; results appear as a plain list for now.
 */

import { CAPTAINS, GACHA, NAMES } from '../../data'
import { cannotExchange, cannotPull, exchange, pull, pullCost, type PullResult } from '../../game/gacha'
import { h } from '../dom'
import { formatNumber } from '../format'
import type { ScreenDef } from '../screens'

let lastResults: PullResult[] = []

export const recruitScreen: ScreenDef = {
  id: 'recruit',
  title: 'Recruit',

  status: (state) => String(Math.floor(state.resources.pullCurrency / GACHA.pullPrice)),

  render(state, ctx) {
    const doPull = (count: number) =>
      ctx.store.update((s) => {
        lastResults = pull(s, count)
      })

    const pullButton = (count: number, label: string) => {
      const reason = cannotPull(state, count)
      return h(
        'button',
        {
          class: count === 1 ? 'btn' : 'btn btn-secondary',
          type: 'button',
          disabled: reason !== null,
          title: reason ?? undefined,
          onclick: () => doPull(count),
        },
        `${label} · ${formatNumber(pullCost(count))}`,
      )
    }

    const exchangeReason = cannotExchange(state)

    return h(
      'div',
      {},
      h(
        'section',
        { class: 'section' },
        h('h3', { class: 'section-title' }, 'Recruit captains'),
        h(
          'div',
          { class: 'kv' },
          h('span', {}, NAMES.pullCurrency),
          h('span', {}, formatNumber(state.resources.pullCurrency)),
        ),
        h(
          'div',
          { class: 'choices' },
          pullButton(1, 'Recruit 1'),
          pullButton(GACHA.multiPull, `Recruit ${GACHA.multiPull}`),
        ),
      ),
      lastResults.length > 0 &&
        h(
          'section',
          { class: 'section' },
          h('h3', { class: 'section-title' }, 'Recruited'),
          h(
            'div',
            { class: 'rows' },
            ...lastResults.map((r) =>
              h(
                'div',
                { class: 'row' },
                h(
                  'div',
                  { class: 'row-main' },
                  h('span', { class: 'row-name' }, CAPTAINS[r.def].name),
                  h('span', { class: `rarity-${r.rarity}` }, r.rarity),
                ),
                r.duplicate && h('span', { class: 'badge' }, `+ ${CAPTAINS[r.def].limitBreakMaterial}`),
              ),
            ),
          ),
        ),
      h(
        'section',
        { class: 'section' },
        h('h3', { class: 'section-title' }, 'Exchange'),
        h(
          'div',
          { class: 'kv' },
          h('span', {}, NAMES.rareResource),
          h('span', {}, formatNumber(state.resources.rareResource)),
        ),
        h(
          'button',
          {
            class: 'btn btn-secondary',
            type: 'button',
            disabled: exchangeReason !== null,
            title: exchangeReason ?? undefined,
            onclick: () => ctx.store.update((s) => exchange(s)),
          },
          `${GACHA.exchange.rareResource} ${NAMES.rareResource} → ${GACHA.exchange.pullCurrency} ${NAMES.pullCurrency}`,
        ),
      ),
      h(
        'section',
        { class: 'section' },
        h('h3', { class: 'section-title' }, `Pull history (last ${GACHA.historyKeep})`),
        state.gacha.history.length
          ? h(
              'div',
              { class: 'rows' },
              ...state.gacha.history.map((p) => {
                const def = CAPTAINS[p.def]
                return h(
                  'div',
                  { class: 'row' },
                  h(
                    'div',
                    { class: 'row-main' },
                    h('span', { class: 'row-name' }, def.name),
                    h(
                      'span',
                      { class: 'row-detail' },
                      new Date(p.at).toLocaleString(),
                      p.duplicate ? ` · became ${def.limitBreakMaterial}` : '',
                    ),
                  ),
                  h('span', { class: `rarity-${def.rarity}` }, def.rarity),
                )
              }),
            )
          : h('p', { class: 'empty' }, 'No pulls yet.'),
      ),
    )
  },
}
