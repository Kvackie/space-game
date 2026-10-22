/**
 * Screens open in one side panel over the station (D-76, D-82). A screen
 * renders from the game state; it is rebuilt when the state changes, and
 * countdowns and progress bars tick in place in between, so buttons are not
 * replaced under the player's finger every second.
 *
 * Settings and Debug open over whatever screen is up (D-119): the 3D view stays
 * as it is, and closing them goes back to that screen.
 */

import type { GameState } from '../game/state'
import type { GameStore } from '../game/store'
import { h } from './dom'
import { formatDuration } from './format'
import './screens.css'

export type ScreenId = 'fleet' | 'crafting' | 'mining' | 'expeditions' | 'recruit' | 'captains' | 'settings' | 'debug'

export interface ScreenContext {
  store: GameStore
  now: () => number
  open: (id: ScreenId) => void
}

export interface ScreenDef {
  id: ScreenId
  title: string
  /** Short live status for the hub button, e.g. a countdown or "IDLE". */
  status?: (state: GameState, now: number) => string
  render: (state: GameState, ctx: ScreenContext) => Node
}

const TICK_MS = 250

const OVERLAYS: readonly ScreenId[] = ['settings', 'debug']
const isOverlay = (id: ScreenId | null) => id !== null && OVERLAYS.includes(id)

export class ScreenHost {
  private screens = new Map<ScreenId, ScreenDef>()
  private panel: HTMLElement
  private title: HTMLElement
  private body: HTMLElement
  private listeners = new Set<() => void>()
  current: ScreenId | null = null
  /** The screen under an open overlay, to return to when it closes. */
  private behind: ScreenId | null = null
  readonly ctx: ScreenContext

  constructor(root: HTMLElement, store: GameStore) {
    this.ctx = { store, now: Date.now, open: (id) => this.open(id) }
    this.title = h('h2', { class: 'screen-title', id: 'screen-title' })
    this.body = h('div', { class: 'screen-body' })
    this.panel = h(
      'section',
      { class: 'screen', 'aria-labelledby': 'screen-title', hidden: true },
      h(
        'header',
        { class: 'screen-header' },
        this.title,
        h('button', { class: 'screen-close', type: 'button', 'aria-label': 'Close', onclick: () => this.close() }, '×'),
      ),
      this.body,
    )
    root.append(this.panel)

    store.subscribe(() => this.render())
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close()
    })
    setInterval(() => this.tick(), TICK_MS)
  }

  register(def: ScreenDef): void {
    this.screens.set(def.id, def)
  }

  has(id: ScreenId): boolean {
    return this.screens.has(id)
  }

  get(id: ScreenId): ScreenDef | undefined {
    return this.screens.get(id)
  }

  /** Called whenever the open screen changes (the hub highlights it). */
  onChange(listener: () => void): void {
    this.listeners.add(listener)
  }

  /** The screen that decides the 3D view: the one under an overlay, if any. */
  get base(): ScreenId | null {
    return isOverlay(this.current) ? this.behind : this.current
  }

  open(id: ScreenId): void {
    const def = this.screens.get(id)
    if (!def) return
    if (!isOverlay(id)) this.behind = null
    else if (!isOverlay(this.current)) this.behind = this.current
    this.current = id
    this.title.textContent = def.title
    this.panel.hidden = false
    this.render()
    for (const l of this.listeners) l()
  }

  toggle(id: ScreenId): void {
    if (this.current === id) this.close()
    else this.open(id)
  }

  /** Closes the screen; an overlay goes back to the screen it was opened over. */
  close(): void {
    const back = isOverlay(this.current) ? this.behind : null
    if (back) {
      this.open(back)
      return
    }
    this.home()
  }

  /** Closes every screen, back to the station. */
  home(): void {
    this.behind = null
    this.current = null
    this.panel.hidden = true
    this.body.replaceChildren()
    for (const l of this.listeners) l()
  }

  private render(): void {
    if (!this.current) return
    const def = this.screens.get(this.current)!
    const scroll = this.body.scrollTop
    this.body.replaceChildren(def.render(this.ctx.store.state, this.ctx))
    this.body.scrollTop = scroll
    this.tick()
  }

  /** Updates every countdown and progress bar on the page. */
  private tick(): void {
    const now = this.ctx.now()
    for (const node of document.querySelectorAll<HTMLElement>('[data-ends-at]')) {
      const endsAt = Number(node.dataset.endsAt)
      if (node.dataset.startedAt) {
        const start = Number(node.dataset.startedAt)
        node.style.width = `${Math.min(100, Math.max(0, ((now - start) / (endsAt - start)) * 100))}%`
      } else {
        node.textContent = formatDuration(endsAt - now)
      }
    }
    for (const l of this.listeners) l()
  }
}
