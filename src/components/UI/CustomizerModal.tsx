import { useEffect, useRef, useState } from 'react'
import { useDraft } from '../../store/useDraftStore'
import { useGame } from '../../store/useGameStore'
import { makeBoard, SPECIAL_TYPES } from '../../utils/boardGenerator'
import { parseDoc, toDoc, MAX_CHARS } from '../../utils/boardDoc'
import type { BoardConfig, SpecialType } from '../../types/game'

export function CustomizerModal({ onClose, setup = false }: { onClose: () => void; setup?: boolean }) {
  const d = useDraft(), b = d.present
  const start = useGame(s => s.startGame)
  const [names, setNames] = useState<string[]>(() => useGame.getState().players.map(p => p.name))
  const setCount = (n: number) => setNames(prev => Array.from({ length: n }, (_, i) => prev[i] ?? `Player ${i + 1}`))
  useEffect(() => { if (setup) start(b, names) }, [b, names, setup, start]) // live board preview behind the setup panel
  const [density, setDensity] = useState(0.5)
  const [cell, setCell] = useState(5)
  const [type, setType] = useState<SpecialType>('skip')
  const [err, setErr] = useState(d.notice)
  const file = useRef<HTMLInputElement>(null)
  const commit = (nb: BoardConfig) => setErr(d.commit(nb) ?? '')
  const regen = (size = b.size) => {
    const sp = Object.fromEntries(Object.entries(b.specials).filter(([k]) => Number(k) <= size * size - 1))
    commit(makeBoard(size, density, Date.now(), b.cellColors, sp))
  }
  const addSpecial = () => commit({ ...b, specials: { ...b.specials, [cell]: { cell, type, value: type === 'back' ? 3 : type === 'freeze' ? 2 : 1 } } })
  const removeSpecial = (c: number) => { const s = { ...b.specials }; delete s[c]; commit({ ...b, specials: s }) }
  const exportJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(toDoc(b), null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = 'snakes-ladders-board.json'; a.click(); URL.revokeObjectURL(url)
  }
  const importJson = async (f: File | undefined) => {
    if (!f) return
    if (f.size > MAX_CHARS) { setErr('File too large'); return }
    try { commit(parseDoc(await f.text())) } catch (e) { setErr((e as Error).message) }
    if (file.current) file.current.value = ''
  }
  return (
    <div className={`overlay ${setup ? 'side' : ''}`} onClick={setup ? undefined : onClose}>
      <div className="panel modal" onClick={e => e.stopPropagation()}>
        <h2>{setup ? 'Game setup' : 'Board editor'} <span className="tag">Draft only</span></h2>
        <p className="hint">production defaults → draft → validated export. Edits reach the game only via “Apply &amp; restart”.</p>
        <label>Board size
          <select value={b.size} onChange={e => regen(Number(e.target.value))}>{[6, 7, 8, 9, 10, 11, 12].map(n => <option key={n}>{n}</option>)}</select>
        </label>
        <div className="colors">
          {(['primary', 'secondary', 'special'] as const).map(k => (
            <label key={k + b.cellColors[k]}>{k}
              <input type="color" defaultValue={b.cellColors[k]} onBlur={e => { if (e.target.value !== b.cellColors[k]) commit({ ...b, cellColors: { ...b.cellColors, [k]: e.target.value } }) }} />
            </label>
          ))}
        </div>
        <label>Density {density.toFixed(2)}<input type="range" min={0} max={1} step={0.05} value={density} onChange={e => setDensity(Number(e.target.value))} /></label>
        <button onClick={() => regen()}>Regenerate snakes &amp; ladders ({b.snakes.length}🐍 {b.ladders.length}🪜)</button>
        <div className="specials">
          <input type="number" min={2} max={b.size * b.size - 1} value={cell} onChange={e => setCell(Number(e.target.value))} />
          <select value={type} onChange={e => setType(e.target.value as SpecialType)}>{SPECIAL_TYPES.map(t => <option key={t}>{t}</option>)}</select>
          <button onClick={addSpecial}>Add</button>
        </div>
        <div className="chips">{Object.values(b.specials).map(s => <span key={s.cell} className="chip">{s.cell}: {s.type}<button aria-label={`remove ${s.cell}`} onClick={() => removeSpecial(s.cell)}>×</button></span>)}</div>
        <label>Players
          <select value={names.length} onChange={e => setCount(Number(e.target.value))}>{[2, 3, 4].map(n => <option key={n}>{n}</option>)}</select>
        </label>
        {names.map((n, i) => <input key={i} value={n} maxLength={14} aria-label={`Player ${i + 1} name`} onChange={e => setNames(names.map((x, k) => (k === i ? e.target.value : x)))} />)}
        {err && <p className="err" role="alert">{err}</p>}
        <div className="bar">
          <button disabled={!d.past.length} onClick={d.undo}>Undo</button>
          <button disabled={!d.future.length} onClick={d.redo}>Redo</button>
          <button onClick={exportJson}>Export</button>
          <button onClick={() => file.current?.click()}>Import</button>
          <button onClick={() => { if (confirm('Reset all draft changes?')) d.reset() }}>Reset</button>
          <input ref={file} type="file" accept="application/json" hidden onChange={e => void importJson(e.target.files?.[0])} />
        </div>
        <div className="bar">{!setup && <button onClick={onClose}>Close</button>}<button className="roll" onClick={() => { start(b, names.map((n, i) => n.trim() || `Player ${i + 1}`)); onClose() }}>{setup ? '▶ Start game' : 'Apply & restart'}</button></div>
      </div>
    </div>
  )
}
