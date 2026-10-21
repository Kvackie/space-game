/**
 * Typed access to the game data. placeholders.json holds every temporary value
 * (GDD rule 0.2.5); rules.json holds decided ones.
 */

import placeholders from './placeholders.json'
import rules from './rules.json'

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythical'
export type Row = 'front' | 'middle' | 'back'
export type StatId = 'hp' | 'defence' | 'cargo' | 'miningYield' | 'firepower'
export type Stats = Partial<Record<StatId, number>>

export interface HullDef {
  name: string
  class: string
  canMine: boolean
  canFight: boolean
  stats: Stats
  gearSlots: number
  innateSkill: string | null
}

export interface RecipeDef {
  name: string
  inputs: Record<string, number>
  output: { resource: string; amount: number } | { ship: string } | { gear: string }
  seconds: number
}

export interface CaptainDef {
  name: string
  rarity: Rarity
  bonus: Stats
}

export const NAMES = placeholders.names
export const HULLS = placeholders.hulls as Record<string, HullDef>
export const GEAR = placeholders.gear as Record<string, { name: string; tier: string; bonus: Stats }>
export const SKILLS = placeholders.skills
export const RECIPES = placeholders.crafting.recipes as Record<string, RecipeDef>
export const CRAFTING = { maxConcurrentJobs: placeholders.crafting.maxConcurrentJobs }
export const MINING = placeholders.mining
export const EXPEDITION = placeholders.expedition
export const ENEMIES = placeholders.enemies as Record<string, { name: string; stats: Stats }>
export const ENEMY_GROUP = placeholders.enemyGroup as { enemy: string; row: Row }[]
export const BATTLE = placeholders.battle
export const CAPTAINS = placeholders.captains as Record<string, CaptainDef>
export const GACHA = { ...placeholders.gacha, ...rules.gacha, rates: rules.gacha.rates as Record<Rarity, number> }
export const ROWS = rules.formationRows as Row[]
export const RARITY_ORDER = rules.rarityOrder as Rarity[]
export const STARTING_SHIP = rules.startingShip
