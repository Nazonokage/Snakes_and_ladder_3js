import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { CustomizerModal } from './CustomizerModal'
import { useGame } from '../../store/useGameStore'
import { makeBoard } from '../../utils/boardGenerator'

// Layout effects are browser-only; these checks exercise the rendered form values.
vi.mock('react', async importOriginal => {
  const react = await importOriginal<typeof import('react')>()
  return { ...react, useLayoutEffect: react.useEffect }
})

describe('setup selector values', () => {
  const markup = () => renderToStaticMarkup(<CustomizerModal onClose={() => {}} onOnline={() => {}} />)

  it('submits numeric player counts and completes a full round for each count', () => {
    const html = markup()
    for (const count of [2, 3, 4]) {
      const value = html.match(new RegExp(`<option value="([^"]+)"[^>]*>${count} Players</option>`))?.[1]
      expect(Number(value)).toBe(count)
      const names = Array.from({ length: Number(value) }, (_, i) => `Player ${i + 1}`)
      const board = { ...makeBoard(6, 0, 1), snakes: [], ladders: [], specials: {} }
      useGame.getState().startGame(board, names)
      for (let i = 0; i < count; i++) {
        expect(useGame.getState().players[useGame.getState().current].name).toBe(names[i])
        useGame.setState({ phase: 'DICE_ROLLING', dice: 1 })
        useGame.getState().skipAnimation()
      }
      expect(useGame.getState().current).toBe(0)
      expect(useGame.getState().players.map(p => p.pos)).toEqual(Array(count).fill(2))
    }
  })

  it('submits numeric board sizes instead of their display labels', () => {
    const html = markup()
    for (const size of [6, 7, 8, 9, 10, 11, 12]) {
      const value = html.match(new RegExp(`<option value="([^"]+)"[^>]*>${size} × ${size}</option>`))?.[1]
      expect(Number(value)).toBe(size)
      expect(makeBoard(Number(value), 0.5, 1).size).toBe(size)
    }
  })
})
