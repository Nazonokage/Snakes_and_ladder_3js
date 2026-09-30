import type { useGame } from '../store/useGameStore'
import { validateBoard } from './boardGenerator'
const keys = ['board', 'boardVersion', 'players', 'current', 'phase', 'dice', 'rollId', 'queue', 'stage', 'shuffling', 'reshuffled', 'mark', 'extra', 'toast', 'fx', 'winner', 'gameId'] as const
type SharedGame = Pick<ReturnType<typeof useGame.getState>, typeof keys[number]>
const integer = (n: unknown, lo: number, hi = Number.MAX_SAFE_INTEGER) => typeof n === 'number' && Number.isSafeInteger(n) && n >= lo && n <= hi
const phases = ['IDLE', 'DICE_ROLLING', 'PAWN_MOVING', 'RESOLVING_CONNECTION', 'RESOLVING_SPECIAL', 'TRIGGERING_RESHUFFLE', 'NEXT_TURN', 'WIN']
export function parseSharedGame(raw: string): SharedGame {
  if (typeof raw !== 'string' || raw.length > 100000) throw new Error('Invalid room state')
  const data = JSON.parse(raw)
  if (!data || typeof data !== 'object') throw new Error('Invalid room state')
  const board = validateBoard(data.board), total = board.size ** 2
  const cell = (n: unknown) => integer(n, 1, total)
  const valid = Array.isArray(data.players) && data.players.length === 2 && data.players.every((p: SharedGame['players'][number], i: number) =>
    p && p.id === i && typeof p.name === 'string' && p.name.length <= 24 && /^#[\da-f]{6}$/i.test(p.color) && cell(p.pos) && integer(p.skip, 0, 6)) &&
    integer(data.current, 0, 1) && phases.includes(data.phase) && ['conn', 'special', 'shuffle', 'end'].includes(data.stage) &&
    ['boardVersion', 'rollId', 'gameId'].every(k => integer(data[k], 0)) &&
    ['shuffling', 'reshuffled', 'extra'].every(k => typeof data[k] === 'boolean') &&
    (data.dice === null || integer(data.dice, 1, 6)) && (data.winner === null || integer(data.winner, 0, 1)) &&
    Array.isArray(data.queue) && data.queue.length <= 6 && data.queue.every((m: SharedGame['queue'][number]) => m && integer(m.id, 1) && ['hop', 'snake', 'ladder', 'rewind'].includes(m.kind) && cell(m.from) && cell(m.to)) &&
    (data.mark === null || (data.mark && cell(data.mark.from) && cell(data.mark.to))) &&
    (data.toast === null || (data.toast && integer(data.toast.id, 1) && typeof data.toast.text === 'string' && data.toast.text.length <= 300)) &&
    (data.fx === null || (data.fx && integer(data.fx.id, 1) && integer(data.fx.cell, 0, total) && ['land', 'ladder', 'snake', 'special', 'shuffle', 'step'].includes(data.fx.kind)))
  if (!valid) throw new Error('Invalid room state')
  return { ...Object.fromEntries(keys.map(key => [key, data[key]])), board } as SharedGame
}
