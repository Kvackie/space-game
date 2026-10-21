/**
 * Stack 3: two stacked canvases, as in code-animation-modelling.
 * three.js draws the 3D world underneath; Phaser runs the loop, loading and
 * input, and draws the battle effects and the game UI on a transparent canvas
 * on top. Two WebGL contexts.
 */

import Phaser from 'phaser'
import { BEAM_TTL, BLAST_TTL, MAX_HP } from '../shared/battle'
import { FrameStats } from '../shared/bench'
import { createHud } from '../shared/hud'
import { MODELS, modelUrl, TEAM_COLOURS, type ModelId, type SceneId } from '../shared/scenes'
import type { StackApp } from '../shared/stack'
import * as tex from '../shared/textures'
import { createThreeWorld, type ThreeWorld } from '../shared/threeWorld'
import '../shared/style.css'

const stats = new FrameStats()
const canvas = document.getElementById('stage') as HTMLCanvasElement
const teamHex = TEAM_COLOURS.map((c) => Phaser.Display.Color.HexStringToColor(c).color)
const FONT = 'system-ui, sans-serif'
const MAX_BLASTS = 96

let world: ThreeWorld

/** Loads the models through Phaser's loader (real progress bar), then builds the 3D world. */
class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  preload() {
    const { width, height } = this.scale
    const bar = this.add.rectangle(width / 2 - 140, height / 2, 0, 6, 0x7fe0ff).setOrigin(0, 0.5)
    this.add.rectangle(width / 2, height / 2, 280, 6, 0x1f2b50).setDepth(-1)
    this.load.on('progress', (p: number) => (bar.width = 280 * p))
    for (const id of MODELS) this.load.binary(id, modelUrl(id))
  }

  async create() {
    const models = Object.fromEntries(MODELS.map((id) => [id, this.cache.binary.get(id) as ArrayBuffer])) as Record<
      ModelId,
      ArrayBuffer
    >
    world = await createThreeWorld({ canvas, overlays: false, models })
    // dev-only handle for inspecting the world from the console
    if (import.meta.env.DEV) Object.assign(window, { __world: world })
    this.scene.start('Overlay')
  }
}

/** Drives the three.js world each frame and draws all 2D on top of it. */
class OverlayScene extends Phaser.Scene {
  private fx!: Phaser.GameObjects.Graphics
  private blasts: Phaser.GameObjects.Image[] = []
  private ui!: Phaser.GameObjects.Container
  private fleetText: Phaser.GameObjects.Text[] = []
  private fleetBars!: Phaser.GameObjects.Graphics
  private card!: Phaser.GameObjects.Container
  private cardTitle!: Phaser.GameObjects.Text
  private cardHp!: Phaser.GameObjects.Text
  private cardBar!: Phaser.GameObjects.Graphics
  private hint!: Phaser.GameObjects.Text

  constructor() {
    super('Overlay')
  }

  create() {
    const res = Math.min(devicePixelRatio, 2)
    // flipbook frames cut from the shared explosion strip
    const strip = this.textures.addCanvas('blast', tex.explosionStrip())!
    for (let f = 0; f < tex.EXPLOSION_FRAMES; f++) strip.add(f, 0, f * 128, 0, 128, 128)

    this.fx = this.add.graphics()
    for (let i = 0; i < MAX_BLASTS; i++) {
      this.blasts.push(this.add.image(0, 0, 'blast', 0).setBlendMode(Phaser.BlendModes.ADD).setVisible(false))
    }

    // ---- game UI: fleet panel, ship card with a Repair button, hint
    this.ui = this.add.container(0, 0)
    const fleetPanel = this.add.graphics()
    this.fleetBars = this.add.graphics()
    this.ui.add([fleetPanel, this.fleetBars])
    for (const t of [0, 1]) {
      const label = this.add
        .text(0, 0, t ? 'Red fleet' : 'Blue fleet', { fontFamily: FONT, fontSize: '12px', color: TEAM_COLOURS[t] })
        .setResolution(res)
      const count = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '12px', color: '#e8eefc' }).setResolution(res)
      this.fleetText.push(label, count)
      this.ui.add([label, count])
    }

    this.card = this.add.container(0, 0)
    const cardBg = this.add.graphics()
    cardBg.fillStyle(0x1c2a5c, 0.9).fillRoundedRect(0, 0, 200, 112, 12)
    cardBg.lineStyle(1, 0x8cbeff, 0.4).strokeRoundedRect(0, 0, 200, 112, 12)
    this.cardTitle = this.add.text(12, 10, '', { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold' }).setResolution(res)
    this.cardBar = this.add.graphics()
    this.cardHp = this.add.text(12, 48, '', { fontFamily: FONT, fontSize: '12px', color: '#c9d4f2' }).setResolution(res)
    const button = this.add.graphics()
    button.fillGradientStyle(0x7fe0ff, 0xb48cff, 0x7fe0ff, 0xb48cff, 1).fillRoundedRect(12, 70, 176, 32, 8)
    const buttonText = this.add
      .text(100, 86, 'Repair', { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#0b1020' })
      .setOrigin(0.5)
      .setResolution(res)
    const hit = this.add.zone(12, 70, 176, 32).setOrigin(0).setInteractive({ useHandCursor: true })
    hit.on('pointerdown', () => {
      if (world.selected !== null) world.battle.repair(world.selected)
    })
    this.card.add([cardBg, this.cardTitle, this.cardBar, this.cardHp, button, buttonText, hit])
    this.ui.add(this.card)

    this.hint = this.add
      .text(0, 10, 'Tap a ship', { fontFamily: FONT, fontSize: '13px', backgroundColor: '#ffffff22', padding: { x: 12, y: 4 } })
      .setOrigin(0.5, 0)
      .setResolution(res)
    this.ui.add(this.hint)

    const layout = () => {
      const { width, height } = this.scale
      fleetPanel.clear()
      fleetPanel.fillStyle(0x1c2a5c, 0.9).fillRoundedRect(12, height - 80, 220, 68, 12)
      fleetPanel.lineStyle(1, 0x8cbeff, 0.4).strokeRoundedRect(12, height - 80, 220, 68, 12)
      this.fleetText.forEach((t, i) => t.setPosition(i % 2 ? 224 : 24, height - 70 + Math.floor(i / 2) * 26))
      this.card.setPosition(width - 212, height - 124)
      this.hint.setX(width / 2)
    }
    layout()
    this.scale.on('resize', layout)

    // taps on the 3D world select a ship; taps on UI are handled by the UI
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length) return
      world.selected = world.pick(p.x, p.y)
    })

    app.ready()
  }

  update(_time: number, delta: number) {
    world.update(Math.min(0.1, delta / 1000))
    world.render()
    stats.frame()

    const battleOn = world.scene === 'battle'
    this.ui.setVisible(battleOn)
    this.fx.clear()
    if (!battleOn) {
      for (const b of this.blasts) b.setVisible(false)
      return
    }
    this.drawBattle()
  }

  /** World units to screen pixels at a given point, for sizing 2D art to match the 3D scene. */
  private pxPerUnit(x: number, y: number, z: number): number {
    const cam = world.camera
    const d = Math.hypot(cam.position.x - x, cam.position.y - y, cam.position.z - z)
    return innerHeight / (2 * Math.tan((cam.fov * Math.PI) / 360) * d)
  }

  private drawBattle() {
    const { battle } = world
    const fx = this.fx

    // beams: a wide faint stroke under a thin bright one, fading out
    for (const beam of battle.beams) {
      const a = battle.ships[beam.from]
      const b = battle.ships[beam.to]
      const pa = world.project(a.x, a.y, a.z)
      const pb = world.project(b.x, b.y, b.z)
      if (!pa.visible || !pb.visible) continue
      const k = 1 - beam.age / BEAM_TTL
      fx.lineStyle(6 * k, teamHex[a.team], 0.25 * k).lineBetween(pa.x, pa.y, pb.x, pb.y)
      fx.lineStyle(2 * k, 0xffffff, 0.9 * k).lineBetween(pa.x, pa.y, pb.x, pb.y)
    }

    // health bars, sized like the world-space bars in the other stacks
    for (const s of battle.ships) {
      if (!s.alive) continue
      const p = world.project(s.x, s.y + 2.4, s.z)
      if (!p.visible) continue
      const ppu = this.pxPerUnit(s.x, s.y, s.z)
      const w = 3 * ppu
      const h = Math.max(2, 0.4 * ppu)
      fx.fillStyle(0x0a0f24, 0.7).fillRect(p.x - w / 2, p.y - h / 2, w, h)
      fx.fillStyle(teamHex[s.team], 1).fillRect(p.x - w / 2, p.y - h * 0.33, (w * Math.max(0, s.hp)) / MAX_HP, h * 0.66)
    }

    // explosions: flipbook frames picked from the blast's age
    this.blasts.forEach((img, i) => {
      const blast = battle.blasts[i]
      const p = blast && world.project(blast.x, blast.y, blast.z)
      img.setVisible(!!p?.visible)
      if (!blast || !p?.visible) return
      const k = blast.age / BLAST_TTL
      const size = (6 + k * 6) * this.pxPerUnit(blast.x, blast.y, blast.z)
      img.setPosition(p.x, p.y).setDisplaySize(size, size)
      img.setFrame(Math.min(tex.EXPLOSION_FRAMES - 1, Math.floor(k * tex.EXPLOSION_FRAMES)))
    })

    const sel = world.selected === null ? null : battle.ships[world.selected]
    if (sel?.alive) {
      const p = world.project(sel.x, sel.y, sel.z)
      const r = (3 + Math.sin(battle.time * 6) * 0.3) * this.pxPerUnit(sel.x, sel.y, sel.z)
      fx.lineStyle(2, 0xffffff, 0.9).strokeCircle(p.x, p.y, r)
    }

    // fleet panel and ship card
    this.fleetBars.clear()
    const { height } = this.scale
    for (const t of [0, 1]) {
      const ships = battle.ships.filter((s) => s.team === t)
      const alive = ships.filter((s) => s.alive).length
      const y = height - 64 + t * 26
      this.fleetBars.fillStyle(0xffffff, 0.15).fillRoundedRect(96, y, 90, 8, 4)
      this.fleetBars.fillStyle(teamHex[t], 1).fillRoundedRect(96, y, (90 * alive) / Math.max(1, ships.length), 8, 4)
      this.fleetText[t * 2 + 1].setText(`${alive}/${ships.length}`).setOrigin(1, 0)
    }

    this.card.setVisible(!!sel)
    if (sel && world.selected !== null) {
      this.cardTitle.setText(`${sel.team ? 'Raider' : 'Frigate'} #${world.selected}`).setColor(TEAM_COLOURS[sel.team])
      this.cardBar.clear()
      this.cardBar.fillStyle(0xffffff, 0.15).fillRoundedRect(12, 34, 176, 8, 4)
      this.cardBar.fillStyle(teamHex[sel.team], 1).fillRoundedRect(12, 34, (176 * Math.max(0, sel.hp)) / MAX_HP, 8, 4)
      this.cardHp.setText(sel.alive ? `Hull ${Math.max(0, sel.hp)} / ${MAX_HP}` : 'Destroyed — respawning')
    }
  }
}

// The harness needs the world, which exists only after Phaser's boot scene has loaded it.
let resolveReady: () => void
const ready = new Promise<void>((r) => (resolveReady = r))
const app: StackApp & { ready(): void } = {
  name: 'Phaser + three.js',
  ready: () => resolveReady(),
  async setScene(id: SceneId) {
    await ready
    world.setScene(id)
  },
  setShipCount(n) {
    world?.setShipCount(n)
  },
  setBloom(on) {
    world?.setBloom(on)
  },
  info() {
    return world ? world.info() : { drawCalls: 0, triangles: 0 }
  },
}

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'phaser-root',
  transparent: true,
  scale: { mode: Phaser.Scale.RESIZE },
  render: { antialias: true },
  scene: [BootScene, OverlayScene],
})

createHud(app, stats)

// dev-only handle for inspecting Phaser from the console
if (import.meta.env.DEV) Object.assign(window, { __game: game })
