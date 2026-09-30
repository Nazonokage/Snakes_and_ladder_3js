import { create } from 'zustand'

type MotionMode = 'full' | 'gentle' | 'off'
const initial = (): MotionMode => {
  try {
    const saved = localStorage.getItem('snl.motion')
    if (saved === 'full' || saved === 'gentle' || saved === 'off') return saved
  } catch { /* Storage is optional. */ }
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'off' : 'full'
}

export const useMotion = create<{ mode: MotionMode; toggle: () => void }>((set, get) => ({
  mode: initial(),
  toggle: () => {
    const mode = get().mode === 'full' ? 'gentle' : get().mode === 'gentle' ? 'off' : 'full'
    set({ mode })
    try { localStorage.setItem('snl.motion', mode) } catch { /* Storage is optional. */ }
  },
}))

export const gentleMotion = () => useMotion.getState().mode !== 'full'

export const motionOff = () => useMotion.getState().mode === 'off'
