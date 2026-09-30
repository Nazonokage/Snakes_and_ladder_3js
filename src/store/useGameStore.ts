import { create } from 'zustand'
import type { BoardConfig, Fx, FxKind, Move, Phase, Player, Stage } from '../types/game'
import { mulberry32, reshuffleUpper } from '../utils/boardGenerator'
import { useDraft } from './useDraftStore'
import { playFeedback, unlockSound } from '../utils/feedback'
import { gentleMotion, motionOff } from './useMotion'

const COLORS = ['#e63946', '#2a9d8f', '#f4a261', '#8e6bd8']
const mkPlayers = (names: string[]): Player[] => names.map((name, i) => ({ id: i, name, color: COLORS[i], pos: 1, skip: 0 }))
let pending: (() => void) | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let skipping = false
const schedule = (fn: () => void, ms: number) => {
  pending = fn
  timer = setTimeout(() => { pending = null; fn() }, skipping || motionOff() ? 0 : ms)
}
let seq = 0
const rm = gentleMotion
const mv = (kind: Move['kind'], from: number, to: number): Move => ({ id: ++seq, kind, from, to })

interface GameState {
  board: BoardConfig; boardVersion: number; players: Player[]; current: number; phase: Phase
  dice: number | null; rollId: number; queue: Move[]; stage: Stage; shuffling: boolean; reshuffled: boolean
  mark: { from: number; to: number } | null; extra: boolean; toast: { id: number; text: string } | null; fx: Fx | null; winner: number | null; gameId: number
  startGame: (b: BoardConfig, names: string[]) => void
  spectator: boolean; skipAnimation: () => void;
  roll: () => void; diceSettled: () => void; advance: () => void
}

export const useGame = create<GameState>((set, get) => {
  const say = (text: string) => set({ toast: { id: ++seq, text } })
  /** Blink the destination first (1s), then start the move. Guarded against restarts. */
  const go = (queue: Move[], extra: Partial<GameState> = {}) => {
    const gid = get().gameId; set(extra)
    schedule(() => { if (get().gameId === gid) set({ queue }) }, rm() ? 300 : 1000)
  }
  const emit = (kind: FxKind, cell: number) => set({ fx: { id: ++seq, kind, cell } })
  const patch = (i: number, f: (p: Player) => Player) => set(s => ({ players: s.players.map((p, k) => (k === i ? f(p) : p)) }))

  const finish = () => {
    const s = get(), p = s.players[s.current], n = s.players.length
    if (p.pos === s.board.size ** 2) { playFeedback('win'); set({ phase: 'WIN', winner: p.id, mark: null }); emit('land', p.pos); return }
    set({ phase: 'NEXT_TURN', mark: null })
    let next = s.extra ? s.current : (s.current + 1) % n
    if (s.extra) say(`${p.name} rolls again!`)
    else for (let g = 0; g < n && get().players[next].skip > 0; g++) {
      const q = get().players[next]; patch(next, x => ({ ...x, skip: x.skip - 1 })); say(`${q.name} skips a turn`); next = (next + 1) % n
    }
    set({ current: next, extra: false, phase: 'IDLE', stage: 'conn' })
  }

  const resolve = () => {
    let s = get(), p = s.players[s.current]
    if (s.stage === 'conn') {
      set({ stage: 'special' })
      const sn = s.board.snakes.find(x => x.from === p.pos), ld = s.board.ladders.find(x => x.from === p.pos)
      const c = sn ? { k: 'snake' as const, ...sn } : ld ? { k: 'ladder' as const, ...ld } : null
      if (c) { go([mv(c.k, c.from, c.to)], { phase: 'RESOLVING_CONNECTION', mark: s.mark && { from: s.mark.from, to: c.to } }); say(c.k === 'snake' ? `🐍 Snake! ${c.from} → ${c.to}` : `🪜 Ladder! ${c.from} → ${c.to}`); return }
    }
    s = get(); p = s.players[s.current]
    if (s.stage === 'special') {
      set({ stage: 'shuffle' })
      const sp = s.board.specials[p.pos]
      if (sp) {
        set({ phase: 'RESOLVING_SPECIAL' }); emit('special', p.pos)
        if (sp.type === 'bonus') { set({ extra: true }); say('⭐ Bonus roll!') }
        else if (sp.type === 'skip') { patch(s.current, x => ({ ...x, skip: x.skip + (sp.value ?? 1) })); say('⏭ Skip next turn') }
        else if (sp.type === 'freeze') { patch(s.current, x => ({ ...x, skip: x.skip + (sp.value ?? 2) })); say('🧊 Frozen!') }
        else { const t = Math.max(1, p.pos - (sp.value ?? 3)); say(`↩ Back ${p.pos - t} tiles`); if (t !== p.pos) { go([mv('rewind', p.pos, t)], { mark: s.mark && { from: s.mark.from, to: t } }); return } }
      }
    }
    s = get(); p = s.players[s.current]
    if (s.stage === 'shuffle') {
      set({ stage: 'end' })
      if (!s.reshuffled && p.pos >= s.board.size ** 2 - 7) {
        const gid = s.gameId
        set({ phase: 'TRIGGERING_RESHUFFLE', reshuffled: true, shuffling: true }); say('⚡ SHIFTING REALITY! Board Reshuffled!'); emit('shuffle', 0)
        schedule(() => {
          if (get().gameId !== gid) return
          const b = reshuffleUpper(get().board, mulberry32(Date.now()))
          set(x => ({ board: b, shuffling: false, boardVersion: x.boardVersion + 1 }))
          schedule(() => { if (get().gameId === gid) finish() }, 1100)
        }, 900)
        return
      }
    }
    finish()
  }

  const init = (b: BoardConfig, names: string[]) => ({
    board: b, mark: null as { from: number; to: number } | null, players: mkPlayers(names), current: 0, phase: 'IDLE' as Phase, dice: null as number | null, queue: [] as Move[], stage: 'conn' as Stage,
    shuffling: false, reshuffled: false, extra: false, toast: null, fx: null, winner: null as number | null,
  })
  return {
    ...init(useDraft.getState().present, ['Player 1', 'Player 2']), boardVersion: 0, rollId: 0, gameId: 0, spectator: false,
    startGame: (b, names) => { clearTimeout(timer); pending = null; set(s => ({ ...init(b, names), spectator: false, boardVersion: s.boardVersion + 1, gameId: s.gameId + 1 })) },
    skipAnimation: () => {
      if (get().spectator || ['IDLE', 'WIN'].includes(get().phase)) return
      skipping = true
      try {
        for (let i = 0; i < 200 && !['IDLE', 'WIN'].includes(get().phase); i++) {
          if (pending) { clearTimeout(timer); const fn = pending; pending = null; fn() }
          else if (get().phase === 'DICE_ROLLING') get().diceSettled()
          else if (get().queue.length) get().advance()
          else break
        }
      } finally { skipping = false }
      playFeedback('land')
    },
    roll: () => { if (get().spectator || get().phase !== 'IDLE') return; void unlockSound().then(() => { if (get().phase === 'DICE_ROLLING') playFeedback('roll') }); set(s => ({ phase: 'DICE_ROLLING', dice: 1 + Math.floor(Math.random() * 6), rollId: s.rollId + 1 })) },
    diceSettled: () => {
      const s = get(); if (s.spectator || s.phase !== 'DICE_ROLLING' || s.dice == null) return
      const p = s.players[s.current], total = s.board.size ** 2
      set({ stage: 'end' })
      if (p.pos + s.dice > total) { say('Need an exact roll to finish'); finish(); return }
      go(Array.from({ length: s.dice }, (_, i) => mv('hop', p.pos + i, p.pos + i + 1)), { phase: 'PAWN_MOVING', stage: 'conn', mark: { from: p.pos, to: p.pos + s.dice } })
    },
    advance: () => {
      const s = get(), m = s.queue[0]; if (s.spectator || !m) return
      if (m.kind === 'snake' || m.kind === 'ladder') playFeedback('land')
      patch(s.current, p => ({ ...p, pos: m.to }))
      const rest = s.queue.slice(1); set({ queue: rest })
      if (m.kind !== 'hop') emit(m.kind === 'snake' ? 'snake' : m.kind === 'ladder' ? 'ladder' : 'land', m.to)
      else emit(rest.length ? 'step' : 'land', m.to)
      if (!rest.length) resolve()
    },
  }
})
