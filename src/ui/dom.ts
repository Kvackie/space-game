/** Tiny DOM helpers shared by the screens. */

type Child = Node | string | number | null | undefined | false
type Attrs = Record<string, string | number | boolean | EventListener | undefined>

/**
 * Creates an element. Attributes starting with "on" become listeners;
 * `true` sets a boolean attribute, `false`/undefined leaves it out.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue
    if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value)
    else if (key === 'class') node.className = String(value)
    else node.setAttribute(key, value === true ? '' : String(value))
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue
    node.append(child instanceof Node ? child : String(child))
  }
  return node
}

/** A countdown the screen host keeps current (see screens.ts). */
export const countdown = (endsAt: number) => h('span', { class: 'countdown', 'data-ends-at': endsAt })

/** A progress bar the screen host keeps current. */
export const progress = (startedAt: number, endsAt: number) =>
  h('div', { class: 'progress' }, h('div', { 'data-started-at': startedAt, 'data-ends-at': endsAt }))
