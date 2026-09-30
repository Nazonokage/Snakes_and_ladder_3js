import { describe, expect, it } from 'vitest'
import { parseSharedGame } from './onlineProtocol'
import { useGame } from '../store/useGameStore'
const raw = (extra = {}) => JSON.stringify({ ...useGame.getState(), ...extra })
describe('online state validation', () => {
  it('accepts a valid board snapshot and strips actions and unknown fields', () => {
    const result = parseSharedGame(raw({ roll: 'bad', injected: true }))
    expect(result.players).toHaveLength(2)
    expect(result).not.toHaveProperty('roll')
    expect(result).not.toHaveProperty('injected')
  })
  it('rejects invalid turns, pawn positions, moves, and messages', () => {
    for (const bad of [{ current: 9 }, { phase: 'bad' }, { dice: 7 }, { players: [null, null] }, { queue: [{ id: 1, from: 1, to: 1000, kind: 'hop' }] }, { toast: { id: 1, text: {} } }]) {
      expect(() => parseSharedGame(raw(bad))).toThrow('Invalid room state')
    }
  })
  it('rejects malformed and oversized payloads', () => {
    expect(() => parseSharedGame('null')).toThrow()
    expect(() => parseSharedGame('x'.repeat(100001))).toThrow()
  })
})
