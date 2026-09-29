import { useEffect } from 'react'
import { useGame } from '../../store/useGameStore'
import { unlockSound } from '../../utils/feedback'
import type { BoardConfig, Move } from '../../types/game'

// Deterministic, development-only encounters for checking choreography at real scale.
const board: BoardConfig = {
  size: 6, cellColors: { primary: '#f2e2b8', secondary: '#7fb69e', special: '#ffb347' },
  snakes: [{ from: 16, to: 5 }], ladders: [{ from: 8, to: 28 }], specials: {},
}
let sequence = 100000
export function MotionDemo() {
  useEffect(() => { useGame.getState().startGame(board, ['Demo', 'Observer']) }, [])
  const run = (kind: Move['kind'], from: number, to: number) => {
    void unlockSound()
    useGame.getState().startGame(board, ['Demo', 'Observer'])
    useGame.setState(s => ({
      players: s.players.map((p, i) => i === 0 ? { ...p, pos: from } : p),
      queue: kind === 'hop'
        ? Array.from({ length: to - from }, (_, i) => ({ id: ++sequence, kind, from: from + i, to: from + i + 1 }))
        : [{ id: ++sequence, kind, from, to }],
      phase: 'PAWN_MOVING', stage: 'end', mark: { from, to },
    }))
  }
  return <div className="motion-demo panel">
    <button onClick={() => run('hop', 9, 14)}>Tile steps</button>
    <button onClick={() => run('snake', 16, 5)}>Snake encounter</button>
    <button onClick={() => run('ladder', 8, 28)}>Ladder climb</button>
    <button onClick={() => { useGame.getState().startGame(board, ['Demo', 'Observer']); useGame.getState().roll() }}>Dice throw</button>
  </div>
}
