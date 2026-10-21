/**
 * Sample game UI drawn with plain DOM, used by the three.js and Babylon stacks.
 * (The Phaser stack draws the same panels with Phaser instead.)
 *
 * Fleet status bottom-left, a ship card bottom-right when a ship is tapped,
 * and a Repair button as the example of tapping to intervene.
 */

import { MAX_HP, type Battle } from './battle'
import { TEAM_COLOURS } from './scenes'

export interface GameUi {
  setVisible(on: boolean): void
  update(battle: Battle, selected: number | null): void
}

export function createDomGameUi(onRepair: () => void): GameUi {
  const root = document.createElement('div')
  root.className = 'game-ui'
  root.innerHTML = `
    <div class="game-hint">Tap a ship</div>
    <div class="game-fleet">
      ${[0, 1]
        .map(
          (t) => `<div class="fleet-row"><span style="color:${TEAM_COLOURS[t]}">${t ? 'Red' : 'Blue'} fleet</span>
          <div class="bar"><div class="fill" style="background:${TEAM_COLOURS[t]}"></div></div><span class="count"></span></div>`,
        )
        .join('')}
    </div>
    <div class="game-card">
      <div class="card-title"></div>
      <div class="bar"><div class="fill"></div></div>
      <div class="card-hp"></div>
      <button class="card-repair">Repair</button>
    </div>`
  document.body.appendChild(root)

  const fills = root.querySelectorAll<HTMLDivElement>('.game-fleet .fill')
  const counts = root.querySelectorAll<HTMLSpanElement>('.game-fleet .count')
  const card = root.querySelector<HTMLDivElement>('.game-card')!
  const cardTitle = card.querySelector<HTMLDivElement>('.card-title')!
  const cardFill = card.querySelector<HTMLDivElement>('.fill')!
  const cardHp = card.querySelector<HTMLDivElement>('.card-hp')!
  card.querySelector('button')!.addEventListener('click', onRepair)

  return {
    setVisible(on) {
      root.style.display = on ? '' : 'none'
    },
    update(battle, selected) {
      for (const team of [0, 1]) {
        const ships = battle.ships.filter((s) => s.team === team)
        const alive = ships.filter((s) => s.alive).length
        fills[team].style.width = `${(alive / Math.max(1, ships.length)) * 100}%`
        counts[team].textContent = `${alive}/${ships.length}`
      }
      const ship = selected === null ? null : battle.ships[selected]
      card.style.display = ship ? '' : 'none'
      if (ship) {
        cardTitle.textContent = `${ship.team ? 'Raider' : 'Frigate'} #${selected}`
        cardTitle.style.color = TEAM_COLOURS[ship.team]
        cardFill.style.width = `${(Math.max(0, ship.hp) / MAX_HP) * 100}%`
        cardFill.style.background = TEAM_COLOURS[ship.team]
        cardHp.textContent = ship.alive ? `Hull ${Math.max(0, ship.hp)} / ${MAX_HP}` : 'Destroyed — respawning'
      }
    },
  }
}
