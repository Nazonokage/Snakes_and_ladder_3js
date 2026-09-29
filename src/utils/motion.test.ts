import { describe, expect, it } from 'vitest'
import { createMoveAnimation, pawnStepCues, tailRadius } from './motion'
import { cellToWorld } from './gridMath'

describe('visible gameplay movement', () => {
  it('plays takeoff and landing once, at the matching animation times', () => {
    expect(pawnStepCues(-0.001, 0.016, 1)).toEqual(['hop'])
    expect(pawnStepCues(0.016, 0.79, 1)).toEqual([])
    expect(pawnStepCues(0.79, 0.81, 1)).toEqual(['step'])
    expect(pawnStepCues(0.81, 1.01, 1)).toEqual([])
  })
  it('gives each backwards step its own cue without an extra hop at the end', () => {
    expect(pawnStepCues(0.99, 1.01, 3)).toEqual(['hop'])
    expect(pawnStepCues(1.79, 1.81, 3)).toEqual(['step'])
    expect(pawnStepCues(2.79, 3.01, 3)).toEqual(['step'])
  })
  for (const gentle of [false, true]) {
    it(`takes one second to cross a tile, including in gentle mode (${gentle})`, () => {
      const animation = createMoveAnimation({ id: 1, kind: 'hop', from: 10, to: 11 }, 10, [0, 0])
      const start = cellToWorld(10, 10, 0.1), end = cellToWorld(11, 10, 0.1)
      expect(animation.sample(0, gentle).position.distanceTo(start)).toBeLessThan(1e-8)
      const middle = animation.sample(0.4, gentle).position.clone()
      expect(middle.z).toBeCloseTo((start.z + end.z) / 2)
      expect(animation.sample(0.99, gentle).done).toBe(false)
      expect(animation.sample(1, gentle).done).toBe(true)
      expect(animation.sample(1, gentle).position.distanceTo(end)).toBeLessThan(1e-8)
    })
  }
  it('climbs continuously, with bounded time for long ladders', () => {
    const start = cellToWorld(3, 10, 0.1), end = cellToWorld(94, 10, 0.1)
    const animation = createMoveAnimation({ id: 2, kind: 'ladder', from: 3, to: 94 }, 10, [0, 0])
    expect(animation.duration).toBeGreaterThan(2)
    expect(animation.duration).toBeLessThanOrEqual(5.2)
    let previous = 0
    for (let frame = 1; frame < 100; frame++) {
      const pose = animation.sample(animation.duration * frame / 100)
      const progress = (pose.position.z - start.z) / (end.z - start.z)
      expect(progress).toBeGreaterThan(previous)
      expect(pose.done).toBe(false)
      previous = progress
    }
    expect(animation.sample(animation.duration).position.distanceTo(end)).toBeLessThan(1e-8)
  })
  it('tapers only the tail and keeps the tip nearly pointed', () => {
    expect(tailRadius(0.5)).toBe(1)
    expect(tailRadius(0.8)).toBeLessThan(1)
    expect(tailRadius(0.95)).toBeLessThan(tailRadius(0.8))
    expect(tailRadius(1)).toBeCloseTo(0.015)
  })
  it('swallows the pawn, hides it inside the snake, and restores it at the tail', () => {
    const animation = createMoveAnimation({ id: 3, kind: 'snake', from: 45, to: 12 }, 10, [0.28, -0.28])
    expect(animation.sample(0).scale).toBe(1)
    expect(animation.sample(1.2).scale).toBeLessThan(0.5)
    expect(animation.sample(3).visible).toBe(false)
    expect(animation.sample(4.3).visible).toBe(true)
    const finish = animation.sample(6)
    expect(finish.scale).toBe(1)
    expect(finish.done).toBe(true)
    const end = cellToWorld(12, 10, 0.1); end.x += 0.28; end.z -= 0.28
    expect(finish.position.distanceTo(end)).toBeLessThan(1e-8)
  })
  it('rewinds tile by tile around a row corner', () => {
    const animation = createMoveAnimation({ id: 4, kind: 'rewind', from: 12, to: 9 }, 10, [0, 0])
    expect(animation.sample(1).position.distanceTo(cellToWorld(11, 10, 0.1))).toBeLessThan(1e-8)
    expect(animation.sample(2).position.distanceTo(cellToWorld(10, 10, 0.1))).toBeLessThan(1e-8)
    expect(animation.sample(3).position.distanceTo(cellToWorld(9, 10, 0.1))).toBeLessThan(1e-8)
  })
})
