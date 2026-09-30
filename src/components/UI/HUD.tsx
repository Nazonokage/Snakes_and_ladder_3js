import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DicePreview } from '../Scene/GameScene'
import { useSound } from '../../utils/feedback'
import { useMotion } from '../../store/useMotion'
import { useGame } from '../../store/useGameStore'
import { useOnline, onlineCommand, onlineAction, roomReady } from '../../store/useOnlineStore'
import { MediaMemeOverlay } from './MediaMemeOverlay'

export function HUD({ onEdit, onOnline }: { onEdit: () => void; onOnline: () => void }) {
  const g = useGame(), motion = useMotion(), sound = useSound(), online = useOnline()
  const inRoom = Boolean(online.roomId)
  const myTurn = !inRoom || (roomReady(online) && online.room?.status === 'playing' && (g.current === 0 ? online.room.host.uid : online.room.guest?.uid) === online.uid)
  const [memes, setMemes] = useState(() => { try { return localStorage.getItem('snl.scares') !== 'off' } catch { return true } })
  const [show, setShow] = useState<string | null>(null)
  useEffect(() => {
    if (!g.toast) return
    setShow(g.toast.text)
    const t = setTimeout(() => setShow(null), 2600)
    return () => clearTimeout(t)
  }, [g.toast])
  const panel = useRef<HTMLElement>(null)
  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number } | null>(null)
  const [position, setPosition] = useState({ x: 12, y: 12 })
  const [collapsed, setCollapsed] = useState(false)
  const constrain = (x: number, y: number) => ({
    x: Math.max(12, Math.min(x, window.innerWidth - (panel.current?.offsetWidth ?? 190) - 12)),
    y: Math.max(12, Math.min(y, window.innerHeight - (panel.current?.offsetHeight ?? 50) - 12)),
  })
  useLayoutEffect(() => {
    const keepVisible = () => setPosition(p => { const next = constrain(p.x, p.y); return next.x === p.x && next.y === p.y ? p : next })
    const observer = new ResizeObserver(keepVisible)
    if (panel.current) observer.observe(panel.current)
    window.addEventListener('resize', keepVisible)
    return () => { observer.disconnect(); window.removeEventListener('resize', keepVisible) }
  }, [])
  const cur = g.players[g.current]
  const command = (action: 'roll' | 'skip') => inRoom ? void onlineAction(() => onlineCommand(action)) : action === 'roll' ? g.roll() : g.skipAnimation()
  return (
    <div className="hud" data-motion={motion.mode}>
      <aside ref={panel} className="panel players movable-controls" style={{ left: position.x, top: position.y }} aria-label="Game controls">
        <div className="controls-header">
          <button className="controls-handle" aria-label="Move controls" title="Drag to move; use arrow keys when focused"
            onPointerDown={e => { if (e.button !== 0) return; drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, left: position.x, top: position.y }; e.currentTarget.setPointerCapture(e.pointerId) }}
            onPointerMove={e => { const d = drag.current; if (d?.id === e.pointerId) setPosition(constrain(d.left + e.clientX - d.x, d.top + e.clientY - d.y)) }}
            onPointerUp={e => { drag.current = null; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId) }}
            onPointerCancel={() => { drag.current = null }} onLostPointerCapture={() => { drag.current = null }}
            onKeyDown={e => {
              if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
              e.preventDefault(); const step = e.shiftKey ? 50 : 20
              setPosition(p => constrain(p.x + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0), p.y + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0)))
            }}>⠿ Controls</button>
          <button aria-expanded={!collapsed} aria-controls="game-control-options" onClick={() => setCollapsed(v => !v)}>{collapsed ? 'Show' : 'Hide'}</button>
        </div>
        <div id="game-control-options" className="controls-options" hidden={collapsed}>
        {g.players.map((p, i) => (
          <div key={p.id} className={`row ${i === g.current ? 'on' : ''}`}>
            <span className="dot" style={{ background: p.color }} />{inRoom ? '@' : ''}{p.name}<b>{p.pos}</b>{p.skip > 0 && <em>skip×{p.skip}</em>}
          </div>
        ))}
        <button disabled={inRoom} onClick={onEdit}>⚙ Customize</button>
        <button onClick={onOnline}>{inRoom ? 'Online · chat & room' : 'Online mode'}</button>
        <button onClick={motion.toggle} title="Cycle Full, Gentle, and Off">Motion: {motion.mode === 'full' ? 'Full' : motion.mode === 'gentle' ? 'Gentle' : 'Off'}</button>
        <button onClick={sound.toggle} aria-pressed={sound.enabled}>Sound: {sound.enabled ? 'On' : 'Off'}</button>
        <button onClick={() => { setMemes(!memes); try { localStorage.setItem('snl.scares', memes ? 'off' : 'on') } catch { /* Optional storage. */ } }}>Memes &amp; Media: {memes ? 'On' : 'Off'}</button>
        </div>
      </aside>
      <DicePreview onRoll={() => command('roll')} disabled={g.phase !== 'IDLE' || !myTurn || online.busy} />
      <div className="dock">
        <button className="roll" disabled={g.phase !== 'IDLE' || !myTurn || online.busy} onClick={() => command('roll')}>
          {g.phase === 'IDLE' ? `🎲 ${cur.name}: Roll` : g.phase === 'DICE_ROLLING' ? 'Rolling…' : g.dice ? `Rolled ${g.dice}` : '…'}
        </button>
        {!['IDLE', 'WIN'].includes(g.phase) && <button className="skip" disabled={!myTurn || online.busy} onClick={() => command('skip')}>Skip animation ⏩</button>}
        {inRoom && <small>{online.room?.status === 'waiting' ? 'Waiting for opponent' : online.room?.status === 'closed' ? 'Room closed · open Online to leave' : !roomReady(online) ? 'Connection interrupted · waiting to reconnect' : myTurn ? 'Your turn' : 'Opponent’s turn'}</small>}
        <small>{g.phase.replace(/_/g, ' ')}</small>
      </div>
      <MediaMemeOverlay enabled={memes} />
      {show && <div className={`toast ${show.startsWith('⚡') ? 'big' : ''}`} role="status">{show}</div>}
      {g.phase === 'WIN' && g.winner !== null && (
        <div className="overlay">
          <div className="panel win">
            <h1>🏆 {inRoom ? '@' : ''}{g.players[g.winner].name} wins!</h1>
            <img src="/image/snake_dancing.png" alt="Dancing Snake" className="dancing-snake-img" />
            <p className="win-meme-text">🐍 The Snake is Dancing for the Champion! 💃🕺</p>
            <div className={motion.mode === 'full' ? 'confetti' : ''} aria-hidden="true">🎉 ✨ 🎊 ✨ 🎉</div>
            {inRoom ? <button onClick={onOnline}>Room &amp; leaderboard</button> : <button onClick={() => g.startGame(g.board, g.players.map(p => p.name))}>Play again</button>}
          </div>
        </div>
      )}
    </div>
  )
}
