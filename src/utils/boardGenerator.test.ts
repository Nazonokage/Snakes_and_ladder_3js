import { describe, expect, it } from 'vitest'
import { makeBoard, reshuffleUpper, mulberry32, validateBoard } from './boardGenerator'
import { parseDoc, toDoc } from './boardDoc'
import { cellToRC } from './gridMath'
const ends = (b: ReturnType<typeof makeBoard>) => [...b.snakes, ...b.ladders].flatMap(c => [c.from, c.to])
describe('board', () => {
  it('has unique endpoints (no chains) and validates for every size', () => {
    for (let s = 6; s <= 12; s++) { const b = makeBoard(s, 0.5, s); expect(new Set(ends(b)).size).toBe(ends(b).length); validateBoard(b) }
  })
  it('reshuffle keeps the lower half and stays valid', () => {
    const b = makeBoard(10, 0.6, 7), r = reshuffleUpper(b, mulberry32(3)); validateBoard(r)
    b.snakes.filter(c => Math.max(c.from, c.to) <= 50).forEach(c => expect(r.snakes).toContainEqual(c))
  })
  it('zig-zag mapping', () => { expect(cellToRC(10, 10)).toEqual({ row: 0, col: 9 }); expect(cellToRC(11, 10)).toEqual({ row: 1, col: 9 }); expect(cellToRC(20, 10)).toEqual({ row: 1, col: 0 }) })
  it('doc roundtrip and rejection', () => {
    const b = makeBoard(8, 0.5, 1); expect(parseDoc(JSON.stringify(toDoc(b)))).toEqual(b)
    expect(() => parseDoc('{"schema":"x"}')).toThrow(); expect(() => parseDoc('x'.repeat(200000))).toThrow()
  })
})
