import { useEffect, useState } from 'react'
import { DicePreview } from '../Scene/GameScene'
import { useSound } from '../../utils/feedback'
import { useMotion } from '../../store/useMotion'
import { useGame } from '../../store/useGameStore'

export function HUD({ onEdit }: { onEdit: () => void }) {
  const g = useGame()
  const motion = useMotion()
  const sound = useSound()
  const [show, setShow] = useState<string | null>(null)
  useEffect(() => {
    if (!g.toast) return
    setShow(g.toast.text)
    const t = setTimeout(() => setShow(null), 2600)
    return () => clearTimeout(t)
  }, [g.toast])
  const cur = g.players[g.current]
  return (
    <div className="hud">
      <aside className="panel players">
        {g.players.map((p, i) => (
          <div key={p.id} className={`row ${i === g.current ? 'on' : ''}`}>
            <span className="dot" style={{ background: p.color }} />{p.name}<b>{p.pos}</b>{p.skip > 0 && <em>skip×{p.skip}</em>}
          </div>
        ))}
        <button onClick={onEdit}>⚙ Customize</button>
        <button onClick={motion.toggle} title="Gentle motion keeps tile and ladder steps visible with less bouncing">Motion: {motion.mode === 'full' ? 'Full' : 'Gentle'}</button>
        <button onClick={sound.toggle} aria-pressed={sound.enabled}>Sound: {sound.enabled ? 'On' : 'Off'}</button>
      </aside>
      <DicePreview />
      <div className="dock">
        <button className="roll" disabled={g.phase !== 'IDLE'} onClick={g.roll}>
          {g.phase === 'IDLE' ? `🎲 ${cur.name}: Roll` : g.phase === 'DICE_ROLLING' ? 'Rolling…' : g.dice ? `Rolled ${g.dice}` : '…'}
        </button>
        <small>{g.phase.replace(/_/g, ' ')}</small>
      </div>
      {show && <div className={`toast ${show.startsWith('⚡') ? 'big' : ''}`} role="status">{show}</div>}
      {g.phase === 'WIN' && g.winner !== null && (
        <div className="overlay"><div className="panel win"><h1>🏆 {g.players[g.winner].name} wins!</h1>
          <button onClick={() => g.startGame(g.board, g.players.map(p => p.name))}>Play again</button></div></div>
      )}
    </div>
  )
}
