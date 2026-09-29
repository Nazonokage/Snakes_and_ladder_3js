export type SpecialType = 'skip' | 'bonus' | 'back' | 'freeze'
export interface SpecialEffect { cell: number; type: SpecialType; value?: number }
export interface Connection { from: number; to: number }
export interface BoardConfig {
  size: number
  cellColors: { primary: string; secondary: string; special: string }
  snakes: Connection[]
  ladders: Connection[]
  specials: Record<number, SpecialEffect>
}
export type Phase = 'IDLE' | 'DICE_ROLLING' | 'PAWN_MOVING' | 'RESOLVING_CONNECTION' | 'RESOLVING_SPECIAL' | 'TRIGGERING_RESHUFFLE' | 'NEXT_TURN' | 'WIN'
export type Stage = 'conn' | 'special' | 'shuffle' | 'end'
export interface Player { id: number; name: string; color: string; pos: number; skip: number }
export interface Move { id: number; kind: 'hop' | 'snake' | 'ladder' | 'rewind'; from: number; to: number }
export type FxKind = 'land' | 'ladder' | 'snake' | 'special' | 'shuffle' | 'step'
export interface Fx { id: number; kind: FxKind; cell: number }
