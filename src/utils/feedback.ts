import { create } from 'zustand'

type Cue = 'roll' | 'hop' | 'step' | 'land' | 'climb' | 'snake' | 'win'
let context: AudioContext | undefined
let master: GainNode | undefined
let lastClimb = -1
const savedSound = () => { try { return localStorage.getItem('snl.sound') !== 'off' } catch { return true } }
export const useSound = create<{ enabled: boolean; toggle: () => void }>((set, get) => ({
  enabled: savedSound(),
  toggle: () => {
    const enabled = !get().enabled; set({ enabled })
    try { localStorage.setItem('snl.sound', enabled ? 'on' : 'off') } catch { /* Optional persistence. */ }
    if (context && master) {
      master.gain.cancelScheduledValues(context.currentTime)
      master.gain.setTargetAtTime(enabled ? 0.3 : 0, context.currentTime, 0.015)
    }
    if (enabled) void unlockSound().then(() => playFeedback('step'))
  },
}))

// Only called from a user gesture: browsers may suspend audio until interaction.
export async function unlockSound() {
  if (!useSound.getState().enabled) return
  try {
    if (!context) {
      context = new AudioContext()
      master = context.createGain(); master.gain.value = 0.3; master.connect(context.destination)
    }
    if (context.state === 'suspended') await context.resume()
  } catch { /* Sound must never block gameplay on unsupported devices. */ }
}

export function playFeedback(cue: Cue) {
  const ctx = context, output = master
  if (!ctx || !output || ctx.state !== 'running' || !useSound.getState().enabled) return
  if (cue === 'climb' && ctx.currentTime - lastClimb < 0.12) return
  if (cue === 'climb') lastClimb = ctx.currentTime
  const tone = (frequency: number, end: number, duration: number, delay = 0, volume = 0.3) => {
    const oscillator = ctx.createOscillator(), gain = ctx.createGain(), at = ctx.currentTime + delay
    oscillator.type = cue === 'climb' || cue === 'win' ? 'sine' : 'triangle'
    oscillator.frequency.setValueAtTime(frequency, at)
    oscillator.frequency.exponentialRampToValueAtTime(end, at + duration)
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(volume, at + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration)
    oscillator.connect(gain); gain.connect(output)
    oscillator.start(at); oscillator.stop(at + duration + 0.02)
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
  }
  if (cue === 'roll') { [0, 0.07, 0.16].forEach((delay, i) => tone(220 + i * 70, 80, 0.09, delay, 0.25)) }
  else if (cue === 'hop') tone(230, 440, 0.11, 0, 0.2)
  else if (cue === 'step') {
    // A crisp wooden tap over a soft low knock, audible on small speakers.
    tone(740, 330, 0.045, 0, 0.5)
    tone(180, 95, 0.12, 0, 0.4)
  }
  else if (cue === 'land') tone(150, 65, 0.16, 0, 0.4)
  else if (cue === 'climb') { tone(1050, 620, 0.045, 0, 0.3); tone(360, 280, 0.09, 0, 0.25) }
  else if (cue === 'snake') { tone(420, 65, 0.5, 0, 0.25); tone(110, 55, 0.14, 1.1, 0.3) }
  else [523, 659, 784].forEach((frequency, i) => tone(frequency, frequency, 0.28, i * 0.14, 0.2))
}
