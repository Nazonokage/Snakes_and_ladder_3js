import { describe, expect, it } from 'vitest'
import { addSpecials } from './specials'
import { makeBoard, mulberry32, validateBoard } from './boardGenerator'
describe('adding special squares', () => {
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
