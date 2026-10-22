/**
 * Settings (D-94): save export/import, reset (with confirmation), graphics
 * quality, FPS counter.
 */

import { newGame, type Settings } from '../../game/state'
import { exportSave, importSave } from '../../save/transfer'
import { h } from '../dom'
import type { ScreenDef } from '../screens'

const CONFIRM_MS = 4000

let message: { text: string; error: boolean } | null = null
let confirmResetUntil = 0

export const settingsScreen: ScreenDef = {
  id: 'settings',
  title: 'Settings',

  render(state, ctx) {
    const set = (patch: Partial<Settings>) => ctx.store.update((s) => Object.assign(s.settings, patch))
    const say = (text: string, error = false) => {
      message = { text, error }
      ctx.store.changed()
    }

    const fileInput = h('input', {
      type: 'file',
      accept: 'application/json,.json',
      hidden: true,
      onchange: async () => {
        const file = fileInput.files?.[0]
        if (!file) return
        try {
          const imported = await importSave(file)
          message = { text: 'Save imported.', error: false }
          ctx.store.replace(imported)
        } catch (error) {
          say(error instanceof Error ? error.message : 'That file could not be imported.', true)
        }
      },
    }) as HTMLInputElement

    const confirming = ctx.now() < confirmResetUntil

    const toggle = (label: string, pressed: boolean, onclick: () => void) =>
      h('button', { class: 'choice', type: 'button', 'aria-pressed': String(pressed), onclick }, label)

    return h(
      'div',
      {},
      h(
        'section',
        { class: 'section' },
        h('h3', { class: 'section-title' }, 'Graphics quality'),
        h(
          'div',
          { class: 'choices' },
          toggle('High', state.settings.quality === 'high', () => set({ quality: 'high' })),
          toggle('Low', state.settings.quality === 'low', () => set({ quality: 'low' })),
        ),
        h('p', { class: 'empty' }, 'Low turns off glow and anti-aliasing and renders at lower resolution.'),
      ),
      h(
        'section',
        { class: 'section' },
        h('h3', { class: 'section-title' }, 'FPS counter'),
        h(
          'div',
          { class: 'choices' },
          toggle('Show', state.settings.showFps, () => set({ showFps: true })),
          toggle('Hide', !state.settings.showFps, () => set({ showFps: false })),
        ),
      ),
      h(
        'section',
        { class: 'section' },
        h('h3', { class: 'section-title' }, 'Save'),
        h(
          'div',
          { class: 'choices' },
          h('button', { class: 'btn', type: 'button', onclick: () => exportSave(state) }, 'Export save'),
          h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => fileInput.click() }, 'Import save'),
          fileInput,
        ),
        h(
          'p',
          { class: 'empty' },
          'Your progress is saved in this browser automatically. Export a copy to keep it safe or move it to another device.',
        ),
        message && h('p', { class: message.error ? 'short' : 'empty', role: 'status' }, message.text),
      ),
      h(
        'section',
        { class: 'section' },
        h('h3', { class: 'section-title' }, 'Reset'),
        h(
          'button',
          {
            class: confirming ? 'btn' : 'btn btn-secondary',
            type: 'button',
            onclick: () => {
              if (ctx.now() < confirmResetUntil) {
                confirmResetUntil = 0
                message = { text: 'Save reset. A new game has started.', error: false }
                ctx.store.replace(newGame(ctx.now()))
              } else {
                confirmResetUntil = ctx.now() + CONFIRM_MS
                ctx.store.changed()
                setTimeout(() => ctx.store.changed(), CONFIRM_MS)
              }
            },
          },
          confirming ? 'Tap again to erase everything' : 'Reset save',
        ),
      ),
      h(
        'section',
        { class: 'section' },
        h('h3', { class: 'section-title' }, 'Testing'),
        h(
          'button',
          { class: 'btn btn-secondary', type: 'button', onclick: () => ctx.open('debug') },
          'Open debug menu',
        ),
      ),
    )
  },
}
