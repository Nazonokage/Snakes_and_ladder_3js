import type { BoardConfig, SpecialType } from '../types/game'

/** Move the configured effects without changing their quantities or strengths. */
export function randomizeSpecials(board: BoardConfig, rng = Math.random): BoardConfig {
  const occupied = new Set([...board.snakes, ...board.ladders].flatMap(c => [c.from, c.to]))
  const free = Array.from({ length: board.size ** 2 - 2 }, (_, i) => i + 2).filter(cell => !occupied.has(cell))
  const effects = Object.values(board.specials)
  if (effects.length > free.length) throw new Error('These effects do not fit. Remove some squares or connections first.')
  for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [free[i], free[j]] = [free[j], free[i]] }
  return { ...board, specials: Object.fromEntries(effects.map((effect, i) => [free[i], { ...effect, cell: free[i] }])) }
}

/** Add exactly count effects without overwriting cells or connection endpoints. */
export function addSpecials(board: BoardConfig, type: SpecialType, count: number, rng = Math.random, value = type === 'back' ? 3 : type === 'freeze' ? 2 : 1): BoardConfig {
  if (!Number.isInteger(count) || count < 1 || count > 40) throw new Error('Enter a whole number from 1 to 40.')
  if (!Number.isInteger(value) || value < 1 || value > 6) throw new Error('Strength must be a whole number from 1 to 6.')
  const occupied = new Set([...board.snakes, ...board.ladders].flatMap(c => [c.from, c.to]))
  Object.keys(board.specials).forEach(cell => occupied.add(Number(cell)))
  const free = Array.from({ length: board.size ** 2 - 2 }, (_, i) => i + 2).filter(cell => !occupied.has(cell))
  const available = Math.min(free.length, 40 - Object.keys(board.specials).length)
  if (count > available) throw new Error(`Only ${available} more special squares fit. Remove some squares or connections first.`)
  for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [free[i], free[j]] = [free[j], free[i]] }
  const specials = { ...board.specials }
  free.slice(0, count).forEach(cell => { specials[cell] = { cell, type, value: type === 'bonus' ? 1 : value } })
  return { ...board, specials }
}
