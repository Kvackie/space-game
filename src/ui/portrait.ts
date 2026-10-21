/**
 * Stand-in captain portraits (D-11, D-101), drawn as SVG from a few traits per
 * captain so they share one consistent anime style. Replace with real art
 * later; the traits live with the captains in placeholders.json.
 */

import type { PortraitTraits, Rarity } from '../data'

const RARITY_GLOW: Record<Rarity, string> = {
  common: '#9aa3ad',
  rare: '#5b8fd1',
  epic: '#a98bd4',
  legendary: '#d1ad5b',
  mythical: '#e07fb8',
}

/** Back hair, drawn behind the head. */
const BACK_HAIR: Record<PortraitTraits['style'], string> = {
  long: 'M52 92 C48 40 152 40 148 92 L160 214 L122 196 L100 150 L78 196 L40 214 Z',
  bob: 'M54 92 C48 38 152 38 146 92 L152 146 L128 140 L100 120 L72 140 L48 146 Z',
  ponytail: 'M56 90 C50 40 150 40 144 90 L146 120 L56 120 Z M140 74 C176 80 182 140 164 190 C160 150 150 120 136 104 Z',
  short: 'M58 92 C52 44 148 44 142 92 L140 116 L60 116 Z',
  twintails:
    'M56 90 C50 40 150 40 144 90 L144 118 L56 118 Z M56 80 C24 96 22 170 40 206 C44 160 52 130 66 108 Z M144 80 C176 96 178 170 160 206 C156 160 148 130 134 108 Z',
}

/** Fringe over the forehead: one jagged anime-style edge for everyone, tinted. */
const FRINGE = 'M58 92 C54 46 146 46 142 92 L132 74 L124 96 L112 70 L102 98 L90 70 L80 96 L70 74 Z'

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const c = (shift: number) => Math.max(0, Math.min(255, ((n >> shift) & 255) + amount))
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0')}`
}

function eye(cx: number, colour: string, wink = false): string {
  if (wink) return `<path d="M${cx - 10} 102 Q${cx} 108 ${cx + 10} 102" stroke="#1a1418" stroke-width="3" fill="none"/>`
  return `
    <ellipse cx="${cx}" cy="102" rx="10" ry="8" fill="#f4f1f2"/>
    <ellipse cx="${cx}" cy="103" rx="6.5" ry="7.5" fill="${colour}"/>
    <ellipse cx="${cx}" cy="105" rx="3.5" ry="4.5" fill="${shade(colour, -90)}"/>
    <circle cx="${cx - 2.5}" cy="99.5" r="2.2" fill="#fff"/>
    <path d="M${cx - 12} 96 Q${cx} 88 ${cx + 12} 95" stroke="#1a1418" stroke-width="3.5" fill="none" stroke-linecap="round"/>`
}

function accessory(kind: PortraitTraits['accessory'], uniform: string): string {
  switch (kind) {
    case 'headset':
      return `<path d="M54 86 C54 34 146 34 146 86" stroke="#2a3346" stroke-width="5" fill="none"/>
        <rect x="46" y="84" width="12" height="22" rx="4" fill="#2a3346"/>
        <path d="M52 104 Q60 128 82 128" stroke="#2a3346" stroke-width="3" fill="none"/>
        <circle cx="84" cy="128" r="3" fill="#e2473f"/>`
    case 'visor':
      return `<path d="M58 92 L142 92 L138 112 L62 112 Z" fill="#5fa8d9" opacity="0.45"/>
        <path d="M58 92 L142 92" stroke="#9fd2f5" stroke-width="2"/>`
    case 'eyepatch':
      return `<path d="M56 84 L146 98" stroke="#111" stroke-width="3"/>
        <ellipse cx="116" cy="103" rx="12" ry="10" fill="#141418"/>`
    case 'scar':
      return `<path d="M82 112 L94 132" stroke="${shade(uniform, 40)}" stroke-width="2.5" opacity="0.8"/>
        <path d="M84 118 L90 116 M87 124 L93 122" stroke="${shade(uniform, 40)}" stroke-width="1.5" opacity="0.8"/>`
    default:
      return ''
  }
}

export function portraitSvg(traits: PortraitTraits, rarity: Rarity, title: string): string {
  const { skin, hair, style, eyes, uniform } = traits
  const glow = RARITY_GLOW[rarity]
  const id = `p${Math.random().toString(36).slice(2, 8)}`
  return `<svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title}">
  <defs>
    <linearGradient id="${id}bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0f1626"/><stop offset="1" stop-color="${shade(glow, -120)}"/>
    </linearGradient>
    <radialGradient id="${id}halo" cx="0.5" cy="0.38" r="0.6">
      <stop offset="0" stop-color="${glow}" stop-opacity="0.35"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="200" height="240" fill="url(#${id}bg)"/>
  <path d="M0 40 L200 0 L200 18 L0 58 Z M0 220 L200 180 L200 190 L0 230 Z" fill="${glow}" opacity="0.08"/>
  <rect width="200" height="240" fill="url(#${id}halo)"/>
  <path d="${BACK_HAIR[style]}" fill="${shade(hair, -30)}"/>
  <rect x="88" y="132" width="24" height="26" fill="${shade(skin, -24)}"/>
  <path d="M24 240 C28 184 62 160 100 160 C138 160 172 184 176 240 Z" fill="${uniform}"/>
  <path d="M74 164 L100 200 L126 164 L114 160 L100 180 L86 160 Z" fill="${shade(uniform, -30)}"/>
  <path d="M60 176 L72 240 M140 176 L128 240" stroke="#e2473f" stroke-width="3"/>
  <path d="M86 160 L100 180 L114 160" stroke="#5fa8d9" stroke-width="2" fill="none"/>
  <ellipse cx="100" cy="98" rx="40" ry="48" fill="${skin}"/>
  <path d="M62 112 C70 140 84 146 100 146 C116 146 130 140 138 112 C130 132 116 140 100 140 C84 140 70 132 62 112 Z" fill="${shade(skin, -18)}"/>
  ${eye(84, eyes)}
  ${traits.accessory === 'eyepatch' ? '' : eye(116, eyes)}
  <path d="M99 112 L97 120 L101 120" stroke="${shade(skin, -60)}" stroke-width="1.5" fill="none"/>
  <path d="M92 128 Q100 131 108 128" stroke="${shade(skin, -80)}" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="${FRINGE}" fill="${hair}"/>
  <path d="M76 62 Q96 54 114 58" stroke="${shade(hair, 45)}" stroke-width="2" fill="none" opacity="0.35"/>
  ${accessory(traits.accessory, uniform)}
</svg>`
}

/** A portrait element framed in its rarity colour (D-83). */
export function portrait(traits: PortraitTraits, rarity: Rarity, title: string, size: 'small' | 'large'): HTMLElement {
  const frame = document.createElement('div')
  frame.className = `portrait portrait-${size} portrait-${rarity}`
  frame.innerHTML = portraitSvg(traits, rarity, title)
  return frame
}
