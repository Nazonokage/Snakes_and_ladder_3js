import { useState } from 'react'
import { firebaseConfigured } from '../../lib/firebase'
import { useOnline, connectOnline, disconnectOnline, createRoom, respondToRequest, reconnectOnline, logoutOnline, joinRoom, leaveRoom, onlineAction } from '../../store/useOnlineStore'

export function OnlinePanel({ onClose }: { onClose: () => void }) {
  const o = useOnline()
  const [name, setName] = useState(o.name || '')
  const [email, setEmail] = useState(''), [password, setPassword] = useState('')
  const [register, setRegister] = useState(false), [search, setSearch] = useState('')
  const [code, setCode] = useState('')
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
        <div className="bar"><button disabled={o.busy || !o.connected} onClick={() => void onlineAction(() => createRoom())}>Host public room</button><button disabled={o.busy || !o.connected} onClick={() => void onlineAction(() => createRoom(true))}>Create unlisted room</button></div>
        <p className="hint">Your current board draft is shared with your opponent. Edit it in Customize before creating a room.</p>
        <form className="bar" onSubmit={e => { e.preventDefault(); void onlineAction(() => joinRoom(code.trim())) }}><input aria-label="Room code" placeholder="Room code" value={code} onChange={e => setCode(e.target.value)} /><button disabled={o.busy || !o.connected}>Request to join</button></form>
        <label>Find live players<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search username" /></label>
        <div className="online-list">{o.people.filter(p => p.uid !== o.uid && p.name.toLowerCase().includes(search.toLowerCase())).map(p => {
          const room = o.rooms[p.room]
          return <div className="row" key={p.uid}><span>@{p.name}</span>{room?.status === 'waiting' && !room.private && !room.guest ? <button disabled={o.busy} onClick={() => void onlineAction(() => joinRoom(p.room))}>Request to join</button> : <small>{p.room ? 'In a room' : 'In lobby'}</small>}</div>
        })}</div>
        <button disabled={o.busy} onClick={() => void onlineAction(disconnectOnline)}>Switch to hotseat</button>
        <button disabled={o.busy} onClick={() => void onlineAction(logoutOnline)}>Sign out</button>
      </> : <>
        <p>Room code: <strong className="room-code">{o.roomId}</strong></p>
        <p>{o.room?.status === 'closed' ? 'A player left this room. Leave to start another match.' : o.room?.host.uid === o.uid && o.room.status === 'waiting' ? 'Choose a join request to accept below.' : o.room?.status === 'waiting' ? o.room.requests?.[o.uid] ? 'Waiting for host approval…' : 'Your request was declined. Leave to choose another host.' : o.room?.guest?.uid !== o.uid && o.room?.host.uid !== o.uid ? 'The host accepted another player. Leave to choose another host.' : 'Close this panel to play. Chat is at the bottom left.'}</p>
        {o.room?.host.uid === o.uid && o.room.status === 'waiting' && Object.values(o.room.requests || {}).map(p => <div className="row" key={p.uid}><span>@{p.name} wants to join</span><button disabled={o.busy || !o.connected} onClick={() => void onlineAction(() => respondToRequest(p.uid, true))}>Accept</button><button disabled={o.busy || !o.connected} onClick={() => void onlineAction(() => respondToRequest(p.uid, false))}>Decline</button></div>)}
        <button disabled={o.busy} onClick={() => void onlineAction(leaveRoom)}>Leave room</button>
      </>}
      {!o.connected && <button onClick={reconnectOnline}>Retry connection</button>}
      <h3>Leaderboard · wins</h3>
      <ol>{ranks.slice(0, 10).map(p => <li key={p.uid}>@{p.name} — {p.wins}</li>)}</ol>
    </>}
    {o.error && <p className="err" role="alert">{o.error}</p>}
  </section></div>
}
