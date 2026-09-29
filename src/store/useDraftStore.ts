import { create } from 'zustand'
import type { BoardConfig } from '../types/game'
import { makeBoard, validateBoard } from '../utils/boardGenerator'
import { parseDoc, toDoc } from '../utils/boardDoc'
const KEY = 'snl.draft.v1', MAX = 50
let startNotice = ''
const persist = (b: BoardConfig) => { try { localStorage.setItem(KEY, JSON.stringify(toDoc(b))) } catch { /* storage unavailable */ } }
const load = (): BoardConfig => {
  let t: string | null = null
  try { t = localStorage.getItem(KEY) } catch { /* ignore */ }
  if (t) { try { return parseDoc(t) } catch { startNotice = 'Saved draft was invalid; default board loaded.' } }
  return makeBoard(10, 0.5, 20260929)
}
interface DraftState {
  present: BoardConfig; past: BoardConfig[]; future: BoardConfig[]; notice: string
  commit: (b: BoardConfig) => string | null
  undo: () => void; redo: () => void; reset: () => void
}
export const useDraft = create<DraftState>((set, get) => ({
  present: load(), past: [], future: [], notice: startNotice,
  commit: b => {
    let v: BoardConfig
    try { v = validateBoard(b) } catch (e) { return (e as Error).message }
    set(s => ({ past: [...s.past, s.present].slice(-MAX), present: v, future: [], notice: '' })); persist(v); return null
  },
  undo: () => { const { past, present, future } = get(); if (!past.length) return; const p = past[past.length - 1]; set({ past: past.slice(0, -1), present: p, future: [present, ...future] }); persist(p) },
  redo: () => { const { past, present, future } = get(); if (!future.length) return; set({ past: [...past, present], present: future[0], future: future.slice(1) }); persist(future[0]) },
  reset: () => { const b = makeBoard(10, 0.5, 20260929); set(s => ({ past: [...s.past, s.present].slice(-MAX), present: b, future: [], notice: '' })); persist(b) },
}))
