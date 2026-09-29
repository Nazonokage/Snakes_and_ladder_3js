import type { BoardConfig } from '../types/game'
import { validateBoard } from './boardGenerator'
export const SCHEMA = 'snl.board'
export const DOC_VERSION = 1
export const MAX_CHARS = 100_000
export interface BoardDoc { schema: string; version: number; savedAt: string; board: BoardConfig }
export const toDoc = (board: BoardConfig): BoardDoc => ({ schema: SCHEMA, version: DOC_VERSION, savedAt: new Date().toISOString(), board })
export function parseDoc(text: string): BoardConfig {
  if (text.length > MAX_CHARS) throw new Error('File too large')
  let j: unknown
  try { j = JSON.parse(text) } catch { throw new Error('Not valid JSON') }
  const d = j as Partial<BoardDoc> | null
  if (!d || d.schema !== SCHEMA || d.version !== DOC_VERSION) throw new Error(`Expected schema ${SCHEMA} v${DOC_VERSION}`)
  return validateBoard(d.board)
}
