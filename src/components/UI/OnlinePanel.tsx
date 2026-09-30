import { useState } from 'react'
import { firebaseConfigured } from '../../lib/firebase'
import { useOnline, connectOnline, disconnectOnline, createRoom, findMatch, logoutOnline, joinRoom, leaveRoom, sendChat, onlineAction } from '../../store/useOnlineStore'

export function OnlinePanel({ onClose }: { onClose: () => void }) {
  const o = useOnline()
  const [name, setName] = useState(o.name || '')
  const [email, setEmail] = useState(''), [password, setPassword] = useState('')
  const [register, setRegister] = useState(false), [search, setSearch] = useState('')
  const [code, setCode] = useState(''), [message, setMessage] = useState('')
  const ranks = Object.values(o.wins.reduce<Record<string, { uid: string; name: string; wins: number }>>((all, win) => {
    const row = all[win.uid] || { uid: win.uid, name: win.name, wins: 0 }; row.wins++; all[win.uid] = row; return all
  }, {})).sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name))
  const rank = ranks.findIndex(p => p.uid === o.uid)
  return <div className="overlay online-overlay"><section className="panel modal" role="dialog" aria-modal="true" aria-label="Online mode">
    <div className="bar"><h2>Online mode</h2><button onClick={onClose}>Close</button></div>
    {!firebaseConfigured && <p className="err">Online setup is incomplete. Add the Firebase settings from .env.example to .env.local and restart the app. Hotseat is ready to play.</p>}
    {!o.enabled ? <form onSubmit={e => { e.preventDefault(); void connectOnline(name, email, password, register) }}>
      <label>Username<input required maxLength={24} value={name} onChange={e => setName(e.target.value)} /></label>
      <p className="hint">Continue as a guest, or enter email and password for a saved account.</p>
      <label>Email (optional)<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Password<input type="password" minLength={6} autoComplete={register ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} /></label>
      <label><span><input type="checkbox" checked={register} onChange={e => setRegister(e.target.checked)} /> Create account / upgrade guest</span></label>
      <button disabled={!firebaseConfigured || o.busy}>Connect</button>
    </form> : <>
      <p>@{o.name} · {o.connected ? 'Connected' : 'Reconnecting…'} · {rank < 0 ? 'No wins yet' : `Rank #${rank + 1} · ${ranks[rank].wins} wins`}</p>
      {!o.roomId ? <>
        <div className="bar"><button disabled={o.busy || !o.connected} onClick={() => void onlineAction(findMatch)}>Find opponent</button><button disabled={o.busy || !o.connected} onClick={() => void onlineAction(() => createRoom(true))}>Create unlisted room</button></div>
        <p className="hint">Your current board draft is shared with your opponent. Edit it in Customize before creating a room.</p>
        <form className="bar" onSubmit={e => { e.preventDefault(); void onlineAction(() => joinRoom(code.trim())) }}><input aria-label="Room code" placeholder="Room code" value={code} onChange={e => setCode(e.target.value)} /><button disabled={o.busy || !o.connected}>Join</button></form>
        <label>Find live players<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search username" /></label>
        <div className="online-list">{o.people.filter(p => p.uid !== o.uid && p.name.toLowerCase().includes(search.toLowerCase())).map(p => {
          const room = o.rooms[p.room]
          return <div className="row" key={p.uid}><span>@{p.name}</span>{room?.status === 'waiting' && !room.private && !room.guest ? <button disabled={o.busy} onClick={() => void onlineAction(() => joinRoom(p.room))}>Play</button> : <small>{p.room ? 'In a room' : 'In lobby'}</small>}</div>
        })}</div>
        <button disabled={o.busy} onClick={() => void onlineAction(disconnectOnline)}>Switch to hotseat</button>
        <button disabled={o.busy} onClick={() => void onlineAction(logoutOnline)}>Sign out</button>
      </> : <>
        <p>Room code: <strong className="room-code">{o.roomId}</strong></p>
        <p>{o.room?.status === 'waiting' ? 'Waiting for an opponent. Share the code, or let another player find you.' : o.room?.status === 'closed' ? 'This room closed because a player left or disconnected. Leave and create a new room.' : 'Close this panel to play. Open it again for chat.'}</p>
        <div className="chat-log" role="log" aria-label="Room chat">{o.messages.map((m, i) => <p key={i}><b>@{m.name}: </b>{m.text}</p>)}</div>
        <form className="bar" onSubmit={e => { e.preventDefault(); const text = message; void onlineAction(async () => { await sendChat(text); setMessage('') }) }}><input aria-label="Chat message" maxLength={300} value={message} onChange={e => setMessage(e.target.value)} /><button disabled={o.busy || !o.connected || !message.trim()}>Send</button></form>
        <button disabled={o.busy} onClick={() => void onlineAction(leaveRoom)}>Leave room</button>
      </>}
      <h3>Leaderboard · wins</h3>
      <ol>{ranks.slice(0, 10).map(p => <li key={p.uid}>@{p.name} — {p.wins}</li>)}</ol>
    </>}
    {o.error && <p className="err" role="alert">{o.error}</p>}
  </section></div>
}
