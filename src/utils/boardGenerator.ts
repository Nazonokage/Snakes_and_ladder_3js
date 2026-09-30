import type { BoardConfig, Connection, SpecialEffect, SpecialType } from '../types/game'
import { cellToRC } from './gridMath'

export type Rng = () => number
export const mulberry32 = (a: number): Rng => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
export const DEFAULT_COLORS = { primary: '#f2e2b8', secondary: '#7fb69e', special: '#ffb347' }
export const SPECIAL_TYPES: SpecialType[] = ['skip', 'bonus', 'back', 'freeze']

/** Every endpoint is unique across snakes, ladders and specials, so connections can never chain into a loop. */
export function genConnections(size: number, ns: number, nl: number, rng: Rng, lo: number, hi: number, used: Set<number>) {
  const snakes: Connection[] = [], ladders: Connection[] = []
  const pick = () => lo + Math.floor(rng() * (hi - lo + 1))
  const place = (snake: boolean) => {
    for (let k = 0; k < 300; k++) {
      const a = pick(), b = pick()
      if (a === b || used.has(a) || used.has(b)) continue
      if (cellToRC(a, size).row === cellToRC(b, size).row) continue
      used.add(a); used.add(b)
      const hiC = Math.max(a, b), loC = Math.min(a, b)
      if (snake) snakes.push({ from: hiC, to: loC }); else ladders.push({ from: loC, to: hiC })
      return
    }
  }
  for (let i = 0; i < ns; i++) place(true)
  for (let i = 0; i < nl; i++) place(false)
  return { snakes, ladders }
}

export function makeBoard(size: number, density: number, seed: number, colors = DEFAULT_COLORS, specials?: Record<number, SpecialEffect>): BoardConfig {
  const total = size * size
  const rng = mulberry32(seed)
  const sp: Record<number, SpecialEffect> = specials ? { ...specials } : {}
  if (!specials) {
    const types: SpecialType[] = ['bonus', 'bonus', 'bonus', 'back', 'skip', 'freeze']
    types.forEach((type, i) => {
      const lo = type === 'bonus' ? 3 + Math.floor(i * (total - 6) / 3) : 3
      const width = type === 'bonus' ? Math.floor((total - 6) / 3) : total - 6
      let cell = lo + Math.floor(rng() * width)
      while (sp[cell]) cell = cell >= total - 2 ? 3 : cell + 1
      sp[cell] = { cell, type, value: type === 'back' ? 3 : type === 'freeze' ? 2 : 1 }
    })
  }
  const used = new Set<number>(Object.keys(sp).map(Number))
  const n = Math.max(2, Math.round(size * (0.3 + density * 0.7)))
  const g = genConnections(size, n, n, rng, 2, total - 1, used)
  return { size, cellColors: colors, snakes: g.snakes, ladders: g.ladders, specials: sp }
}

/** Endgame twist: keep the lower half, regenerate everything above it. */
export function reshuffleUpper(board: BoardConfig, rng: Rng): BoardConfig {
  const total = board.size * board.size, half = Math.floor(total / 2)
  const keep = (c: Connection) => Math.max(c.from, c.to) <= half
  const snakes = board.snakes.filter(keep), ladders = board.ladders.filter(keep)
  const used = new Set<number>([...snakes, ...ladders].flatMap(c => [c.from, c.to]))
  Object.keys(board.specials).forEach(k => used.add(Number(k)))
  const g = genConnections(board.size, Math.max(2, board.snakes.length - snakes.length), Math.max(2, board.ladders.length - ladders.length), rng, half + 1, total - 1, used)
  return { ...board, snakes: [...snakes, ...g.snakes], ladders: [...ladders, ...g.ladders] }
}

const HEX = /^#[0-9a-fA-F]{6}$/
export function validateBoard(x: unknown): BoardConfig {
  const b = x as Partial<BoardConfig> | null
  if (!b || typeof b !== 'object') throw new Error('Board must be an object')
  const size = Number(b.size)
  if (!Number.isInteger(size) || size < 6 || size > 12) throw new Error('Board size must be an integer 6-12')
  const total = size * size
  const cc = b.cellColors
  if (!cc || ![cc.primary, cc.secondary, cc.special].every(c => typeof c === 'string' && HEX.test(c))) throw new Error('Colors must be #rrggbb')
  const used = new Set<number>()
  const cell = (n: unknown) => {
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 2 || n > total - 1) throw new Error(`Cell ${String(n)} out of range 2-${total - 1}`)
    if (used.has(n)) throw new Error(`Cell ${n} is used twice`)
    used.add(n); return n
  }
  const conns = (arr: unknown, snake: boolean): Connection[] => {
    if (!Array.isArray(arr) || arr.length > 60) throw new Error('Invalid connection list')
    return arr.map((c: Connection) => {
      const from = cell(c?.from), to = cell(c?.to)
      if (snake ? from <= to : from >= to) throw new Error(`${snake ? 'Snake' : 'Ladder'} ${from}->${to} points the wrong way`)
      return { from, to }
    })
  }
  const snakes = conns(b.snakes, true), ladders = conns(b.ladders, false)
  const specials: Record<number, SpecialEffect> = {}
  const raw = b.specials
  if (!raw || typeof raw !== 'object' || Object.keys(raw).length > 40) throw new Error('Invalid specials')
  for (const [k, v] of Object.entries(raw)) {
    if (!v || Number(k) !== v.cell || !SPECIAL_TYPES.includes(v.type)) throw new Error(`Invalid special at ${k}`)
    if (v.value !== undefined && (!Number.isInteger(v.value) || v.value < 1 || v.value > 6)) throw new Error(`Special ${k} value must be 1-6`)
    specials[cell(v.cell)] = { cell: v.cell, type: v.type, value: v.value }
  }
  return { size, cellColors: { primary: cc.primary, secondary: cc.secondary, special: cc.special }, snakes, ladders, specials }
}
