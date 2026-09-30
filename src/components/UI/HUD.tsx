import { useEffect, useState } from 'react'
import { DicePreview } from '../Scene/GameScene'
import { useSound } from '../../utils/feedback'
import { useMotion } from '../../store/useMotion'
import { useGame } from '../../store/useGameStore'
import { useOnline, onlineCommand, onlineAction } from '../../store/useOnlineStore'
import { MediaMemeOverlay } from './MediaMemeOverlay'

export function HUD({ onEdit, onOnline }: { onEdit: () => void; onOnline: () => void }) {
  const g = useGame(), motion = useMotion(), sound = useSound(), online = useOnline()
  const inRoom = Boolean(online.roomId)
  const myTurn = !inRoom || (online.connected && online.room?.status === 'playing' && (g.current === 0 ? online.room.host.uid : online.room.guest?.uid) === online.uid)
  const [memes, setMemes] = useState(() => { try { return localStorage.getItem('snl.scares') !== 'off' } catch { return true } })
  const [show, setShow] = useState<string | null>(null)
  useEffect(() => {
    if (!g.toast) return
    setShow(g.toast.text)
    const t = setTimeout(() => setShow(null), 2600)
    return () => clearTimeout(t)
  }, [g.toast])
  const cur = g.players[g.current]
  const command = (action: 'roll' | 'skip') => inRoom ? void onlineAction(() => onlineCommand(action)) : action === 'roll' ? g.roll() : g.skipAnimation()
  return (
    <div className="hud" data-motion={motion.mode}>
      <aside className="panel players">
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
      </aside>
      <DicePreview onRoll={() => command('roll')} disabled={g.phase !== 'IDLE' || !myTurn || online.busy} />
      <div className="dock">
        <button className="roll" disabled={g.phase !== 'IDLE' || !myTurn || online.busy} onClick={() => command('roll')}>
          {g.phase === 'IDLE' ? `🎲 ${cur.name}: Roll` : g.phase === 'DICE_ROLLING' ? 'Rolling…' : g.dice ? `Rolled ${g.dice}` : '…'}
        </button>
        {!['IDLE', 'WIN'].includes(g.phase) && <button className="skip" disabled={!myTurn || online.busy} onClick={() => command('skip')}>Skip animation ⏩</button>}
        {inRoom && <small>{online.room?.status === 'waiting' ? 'Waiting for opponent' : online.room?.status === 'closed' ? 'Room closed · open Online to leave' : myTurn ? 'Your turn' : 'Opponent’s turn'}</small>}
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
