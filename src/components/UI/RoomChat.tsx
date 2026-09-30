import { useEffect, useRef, useState } from 'react'
import { useOnline, sendChat, onlineAction } from '../../store/useOnlineStore'

export function RoomChat() {
  const o = useOnline(), [message, setMessage] = useState(''), [collapsed, setCollapsed] = useState(false)
  const log = useRef<HTMLDivElement>(null)
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight }, [o.messages, collapsed])
  if (!o.roomId || !o.room || ![o.room.host.uid, o.room.guest?.uid].includes(o.uid)) return null
  return <aside className="panel room-chat" aria-label="Room chat">
    <button onClick={() => setCollapsed(v => !v)} aria-expanded={!collapsed}>Chat {collapsed ? '+' : '−'}</button>
    {!collapsed && <>
      <div ref={log} className="chat-log" role="log" aria-live="polite">{o.messages.map((m, i) => <p key={i}><b>@{m.name}: </b>{m.text}</p>)}</div>
      <form className="bar" onSubmit={e => { e.preventDefault(); const text = message; void onlineAction(async () => { await sendChat(text); setMessage(current => current === text ? '' : current) }) }}>
        <input aria-label="Chat message" placeholder="Message…" maxLength={300} value={message} onChange={e => setMessage(e.target.value)} />
        <button disabled={o.busy || !o.connected || o.room.status === 'closed' || !message.trim()}>Send</button>
      </form>
      {!o.connected && <small>Reconnecting…</small>}
      {o.error && <small role="alert">{o.error}</small>}
    </>}
  </aside>
}
