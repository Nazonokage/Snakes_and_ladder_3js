import * as THREE from 'three'
import type { Move } from '../types/game'
import { cellToWorld, connectionCurve } from './gridMath'

// Keep tile steps readable; connections use bounded, continuous travel.
export const STEP_SECONDS = 1
export const SNAKE_TRAVEL_SECONDS = 2.2
export const SNAKE_EXIT_START = 1.6 + SNAKE_TRAVEL_SECONDS
export const SNAKE_SECONDS = SNAKE_EXIT_START + 1
export const DICE_SECONDS = 4.2
const smooth = (t: number) => { const k = THREE.MathUtils.clamp(t, 0, 1); return k * k * (3 - 2 * k) }
export const rungCount = (length: number) => Math.max(2, Math.floor(length / 0.45))
export const stepProgress = (seconds: number) => smooth(seconds / 0.8)
// Trigger from animation time, so taps coincide with contact rather than turn updates.
export function pawnStepCues(previous: number, current: number, duration: number): ('hop' | 'step')[] {
  const cues: ('hop' | 'step')[] = []
  for (let step = Math.max(0, Math.floor(previous)); step <= Math.floor(current); step++) {
    if (step >= duration) break
    if (previous < step && current >= step) cues.push('hop')
    if (previous < step + 0.8 && current >= step + 0.8) cues.push('step')
  }
  return cues
}
export const snakeProgress = (seconds: number) => smooth((seconds - 1.6) / SNAKE_TRAVEL_SECONDS)
export const tailRadius = (u: number) => 1 - 0.985 * smooth((u - 0.65) / 0.35)
export const ladderDuration = (length: number) => THREE.MathUtils.clamp(1.8 + length * 0.28, 2.2, 5.2)
export const mouthOpen = (seconds: number) => smooth(seconds / 0.5) * (1 - smooth((seconds - 1.1) / 0.6))

export function createMoveAnimation(move: Move, size: number, offset: readonly [number, number]) {
  const from = cellToWorld(move.from, size, 0.1), to = cellToWorld(move.to, size, 0.1)
  from.x += offset[0]; from.z += offset[1]; to.x += offset[0]; to.z += offset[1]
  const curve = connectionCurve(move.kind === 'hop' ? 'rewind' : move.kind, move.from, move.to, size)
  const steps = move.kind === 'ladder' ? rungCount(from.distanceTo(to)) + 1 : Math.max(1, Math.abs(move.to - move.from))
  const duration = move.kind === 'hop' ? STEP_SECONDS : move.kind === 'snake' ? SNAKE_SECONDS : move.kind === 'ladder' ? ladderDuration(from.distanceTo(to)) : steps * STEP_SECONDS
  const mouth = curve.getPoint(0).addScaledVector(curve.getTangent(0), -0.38)
  mouth.y += 0.16
  const point = new THREE.Vector3()
  // Reused pose avoids creating vectors on every frame.
  const pose = { position: new THREE.Vector3(), scale: 1, visible: true, tilt: 0, rung: 0, done: false }
  return {
    duration,
    sample(seconds: number, gentle = false) {
      const t = THREE.MathUtils.clamp(seconds, 0, duration)
      pose.scale = 1; pose.visible = true; pose.tilt = 0; pose.done = t >= duration
      if (move.kind === 'snake') {
        if (t < 1.6) {
          pose.position.lerpVectors(from, mouth, smooth(t / 1.2))
          pose.scale = 1 - 0.98 * smooth((t - 0.65) / 0.95)
          pose.tilt = gentle ? 0 : -0.5 * Math.sin(Math.PI * t / 1.6)
        } else if (t < SNAKE_EXIT_START) {
          curve.getPointAt(snakeProgress(t), pose.position)
          pose.visible = false; pose.scale = 0.02
        } else {
          curve.getPoint(1, point)
          pose.position.lerpVectors(point, to, smooth((t - SNAKE_EXIT_START) / 1))
          pose.scale = 0.02 + 0.98 * smooth((t - SNAKE_EXIT_START) / 1)
          pose.position.y += (gentle ? 0 : 0.22) * Math.sin(Math.PI * smooth((t - SNAKE_EXIT_START) / 1))
        }
      } else if (move.kind === 'ladder') {
        const u = smooth(t / duration), stride = u * steps
        const envelope = Math.sin(Math.PI * u)
        pose.position.lerpVectors(from, to, u)
        pose.position.y += envelope * (0.18 + (gentle ? 0.01 : 0.055) * Math.pow(Math.sin(Math.PI * stride), 2))
        pose.tilt = gentle ? 0 : Math.sin(Math.PI * stride) * 0.045 * envelope
        pose.rung = Math.floor(stride)

      } else {
        const step = move.kind === 'hop' ? 0 : Math.min(steps - 1, Math.floor(t))
        const local = t - step, u = stepProgress(local)
        if (move.kind === 'rewind') {
          const dir = Math.sign(move.to - move.from)
          cellToWorld(move.from + step * dir, size, 0.1, point)
          cellToWorld(move.from + (step + 1) * dir, size, 0.1, pose.position)
          pose.position.lerpVectors(point, pose.position, u)
          pose.position.x += offset[0]; pose.position.z += offset[1]
        } else pose.position.lerpVectors(from, to, u)
        pose.position.y += (gentle ? 0 : 0.42) * Math.sin(Math.PI * u)
      }
      if (pose.done) { pose.position.copy(to); pose.scale = 1; pose.visible = true; pose.tilt = 0 }
      return pose
    },
  }
}
