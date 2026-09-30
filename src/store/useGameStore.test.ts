import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { useGame } from './useGameStore'
import { useMotion } from './useMotion'
import { makeBoard } from '../utils/boardGenerator'
import type { BoardConfig } from '../types/game'
const board = (): BoardConfig => ({ ...makeBoard(6, 0, 1), snakes: [], ladders: [], specials: {} })
const start = (b = board(), pos = 1) => {
  useGame.getState().startGame(b, ['A', 'B'])
  useGame.setState(s => ({ players: s.players.map(p => ({ ...p, pos })) }))
}
const roll = (dice: number) => {
  useGame.setState({ phase: 'DICE_ROLLING', dice })
}
beforeEach(() => { vi.useFakeTimers(); useMotion.setState({ mode: 'full' }); start() })
afterEach(() => { useGame.getState().startGame(board(), ['A', 'B']); vi.useRealTimers() })
describe('turn skipping', () => {
  it('resolves a roll and leaves no delayed moves', () => {
    roll(3); useGame.getState().skipAnimation()
    expect(useGame.getState().players[0].pos).toBe(4)
    expect(useGame.getState().current).toBe(1)
    vi.runAllTimers()
    expect(useGame.getState().queue).toEqual([])
    expect(useGame.getState().phase).toBe('IDLE')
  })
  it('skips during the destination preview and resolves a snake', () => {
    start({ ...board(), snakes: [{ from: 5, to: 2 }] })
    roll(4); useGame.getState().diceSettled(); useGame.getState().skipAnimation()
    expect(useGame.getState().players[0].pos).toBe(2)
    expect(useGame.getState().current).toBe(1)
  })
  it('keeps bonus rolls, rewind penalties, freeze and ladder effects', () => {
    start({ ...board(), specials: { 4: { cell: 4, type: 'bonus' } } })
    roll(3); useGame.getState().skipAnimation(); expect(useGame.getState().current).toBe(0)
    start({ ...board(), specials: { 4: { cell: 4, type: 'back', value: 3 } } })
    roll(3); useGame.getState().skipAnimation(); expect(useGame.getState().players[0].pos).toBe(1)
    start({ ...board(), specials: { 4: { cell: 4, type: 'freeze', value: 2 } } })
    roll(3); useGame.getState().skipAnimation(); expect(useGame.getState().players[0].skip).toBe(2)
    start({ ...board(), ladders: [{ from: 4, to: 16 }] })
    roll(3); useGame.getState().skipAnimation(); expect(useGame.getState().players[0].pos).toBe(16)
  })
  it('finishes the reshuffle exactly once and preserves exact-roll wins', () => {
    start(board(), 28); roll(2); useGame.getState().skipAnimation()
    expect(useGame.getState().reshuffled).toBe(true)
    expect(useGame.getState().shuffling).toBe(false)
    const version = useGame.getState().boardVersion
    vi.runAllTimers(); expect(useGame.getState().boardVersion).toBe(version)
    start(board(), 35); roll(2); useGame.getState().skipAnimation()
    expect(useGame.getState().winner).toBeNull()
    start(board(), 35); roll(1); useGame.getState().skipAnimation()
    expect(useGame.getState().winner).toBe(0)
    expect(useGame.getState().phase).toBe('WIN')
  })
  it('restart cancels a pending move or reshuffle', () => {
    roll(3); useGame.getState().diceSettled(); start(); vi.runAllTimers()
    expect(useGame.getState().queue).toEqual([])
    start(board(), 28); roll(1); useGame.getState().diceSettled(); vi.advanceTimersByTime(1000); useGame.getState().advance()
    expect(useGame.getState().shuffling).toBe(true)
    start(); vi.runAllTimers(); expect(useGame.getState().reshuffled).toBe(false)
  })
  it('spectators cannot change the shared game', () => {
    useGame.setState({ spectator: true }); useGame.getState().roll()
    expect(useGame.getState().phase).toBe('IDLE')
    roll(3); useGame.getState().skipAnimation(); useGame.getState().diceSettled()
    expect(useGame.getState().phase).toBe('DICE_ROLLING')
  })
  it('places all players at starting position 1', () => {
    useGame.getState().startGame(board(), ['A', 'B', 'C', 'D'])
    const positions = useGame.getState().players.map(p => p.pos)
    expect(positions).toEqual([1, 1, 1, 1])
  })
})
