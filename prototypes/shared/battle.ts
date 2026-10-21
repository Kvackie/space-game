/**
 * A tiny auto-battle used only to load the renderers: two fleets in grid
 * formations trading beam shots. Dead ships explode and respawn so the ship
 * count stays constant while measuring.
 */

import { rng } from './random'

export const MAX_HP = 100
export const BEAM_TTL = 0.3
export const BLAST_TTL = 0.9
const SPACING = 7
const RESPAWN = 2.5

export interface Ship {
  team: 0 | 1
  x: number
  y: number
  z: number
  yaw: number
  hp: number
  alive: boolean
  respawnIn: number
  cooldown: number
  homeX: number
  homeZ: number
  phase: number
}

export interface Beam {
  from: number
  to: number
  age: number
}

export interface Blast {
  x: number
  y: number
  z: number
  age: number
}

export class Battle {
  ships: Ship[] = []
  beams: Beam[] = []
  blasts: Blast[] = []
  time = 0
  private random = rng(42)

  constructor(count: number) {
    this.setCount(count)
  }

  setCount(count: number): void {
    this.ships = []
    this.beams = []
    this.blasts = []
    for (const team of [0, 1] as const) {
      const n = team === 0 ? Math.ceil(count / 2) : Math.floor(count / 2)
      const cols = Math.max(1, Math.ceil(Math.sqrt(n * 2)))
      for (let i = 0; i < n; i++) {
        const col = i % cols
        const row = Math.floor(i / cols)
        const homeX = (col - (cols - 1) / 2) * SPACING
        const homeZ = (team === 0 ? -1 : 1) * (15 + row * SPACING)
        this.ships.push({
          team,
          x: homeX,
          y: 0,
          z: homeZ,
          yaw: team === 0 ? 0 : Math.PI,
          hp: MAX_HP,
          alive: true,
          respawnIn: 0,
          cooldown: this.random() * 1.5,
          homeX,
          homeZ,
          phase: this.random() * Math.PI * 2,
        })
      }
    }
  }

  /** Rough radius of the battlefield, for framing the camera. */
  fieldSize(): number {
    let max = 0
    for (const s of this.ships) max = Math.max(max, Math.abs(s.homeX), Math.abs(s.homeZ))
    return max
  }

  step(dt: number): void {
    this.time += dt
    const t = this.time
    const alive: number[][] = [[], []]
    this.ships.forEach((s, i) => {
      if (s.alive) alive[s.team].push(i)
    })

    for (let i = 0; i < this.ships.length; i++) {
      const s = this.ships[i]
      s.x = s.homeX + Math.sin(t * 0.4 + s.phase) * 1.5
      s.y = Math.sin(t * 0.7 + s.phase) * 1.0
      s.z = s.homeZ + Math.sin(t * 0.25 + s.phase) * 2.0

      if (!s.alive) {
        s.respawnIn -= dt
        if (s.respawnIn <= 0) {
          s.alive = true
          s.hp = MAX_HP
        }
        continue
      }

      s.cooldown -= dt
      const enemies = alive[1 - s.team]
      if (s.cooldown <= 0 && enemies.length) {
        s.cooldown = 0.8 + this.random() * 1.2
        const to = enemies[Math.floor(this.random() * enemies.length)]
        const target = this.ships[to]
        this.beams.push({ from: i, to, age: 0 })
        target.hp -= 12
        if (target.hp <= 0 && target.alive) {
          target.alive = false
          target.respawnIn = RESPAWN
          this.blasts.push({ x: target.x, y: target.y, z: target.z, age: 0 })
        }
      }
    }

    for (const b of this.beams) b.age += dt
    for (const b of this.blasts) b.age += dt
    this.beams = this.beams.filter((b) => b.age < BEAM_TTL)
    this.blasts = this.blasts.filter((b) => b.age < BLAST_TTL)
  }

  /** The "tap to intervene" action used by every stack's ship card. */
  repair(index: number): void {
    const s = this.ships[index]
    if (s?.alive) s.hp = MAX_HP
  }
}
