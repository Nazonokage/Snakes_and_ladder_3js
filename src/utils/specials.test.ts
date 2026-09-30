import { describe, expect, it } from 'vitest'
import { addSpecials, randomizeSpecials } from './specials'
import { makeBoard, mulberry32, validateBoard } from './boardGenerator'
describe('adding special squares', () => {
  it.each(['back', 'freeze', 'skip'] as const)('places the exact quantity and strength for %s', type => {
    const board = makeBoard(10, 0.5, 7)
    const next = addSpecials(board, type, 7, mulberry32(3), 5)
    const added = Object.values(next.specials).filter(s => !board.specials[s.cell])
    expect(added).toHaveLength(7)
    expect(added.every(s => s.type === type && s.value === 5)).toBe(true)
    expect(() => validateBoard(next)).not.toThrow()
    for (const value of [0, 7, 1.5, NaN]) expect(() => addSpecials(board, type, 2, Math.random, value)).toThrow()
  })
  it('preserves effects when resizing and rejects boards too small for them', () => {
    const board = addSpecials(makeBoard(12, 0.5, 7), 'back', 5, mulberry32(3), 6)
    const resized = randomizeSpecials({ ...board, size: 6, snakes: [], ladders: [] }, mulberry32(2))
    expect(Object.keys(resized.specials)).toHaveLength(Object.keys(board.specials).length)
    expect(() => validateBoard(resized)).not.toThrow()
    const full = addSpecials(board, 'skip', 29, mulberry32(4))
    expect(() => randomizeSpecials({ ...full, size: 6, snakes: [], ladders: [] })).toThrow()
  })
  it('randomizes positions while preserving every configured effect and value', () => {
    const board = addSpecials(makeBoard(10, 0.5, 7), 'freeze', 8, mulberry32(3))
    const effects = (b: typeof board) => Object.values(b.specials).map(s => `${s.type}:${s.value}`).sort()
    const next = randomizeSpecials(board, mulberry32(42))
    expect(effects(next)).toEqual(effects(board))
    expect(next.specials).not.toEqual(board.specials)
    expect(next.snakes).toEqual(board.snakes)
    expect(next.ladders).toEqual(board.ladders)
    expect(() => validateBoard(next)).not.toThrow()
    expect(randomizeSpecials({ ...board, specials: {} }).specials).toEqual({})
  })
  it('adds the requested quantity without replacing existing effects or connections', () => {
    const board = makeBoard(6, 0.5, 7)
    const next = addSpecials(board, 'bonus', 5, mulberry32(3))
    expect(Object.keys(next.specials)).toHaveLength(Object.keys(board.specials).length + 5)
    expect(next.specials).toMatchObject(board.specials)
    expect(next.snakes).toEqual(board.snakes)
    expect(next.ladders).toEqual(board.ladders)
    expect(() => validateBoard(next)).not.toThrow()
    expect(Object.keys(board.specials)).toHaveLength(6)
  })
  it('rejects invalid quantities and insufficient space without partial additions', () => {
    const board = makeBoard(6, 1, 1)
    for (const count of [0, -1, 1.5, NaN, 41, 40]) expect(() => addSpecials(board, 'bonus', count)).toThrow()
    expect(Object.keys(board.specials)).toHaveLength(6)
  })
})
