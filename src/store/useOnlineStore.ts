import { create } from 'zustand'
import { EmailAuthProvider, linkWithCredential, signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth'
import { ref, onValue, onDisconnect, set, update, remove, push, query, limitToLast, runTransaction, serverTimestamp, get, goOnline } from 'firebase/database'
import { auth, database } from '../lib/firebase'
import { useGame } from './useGameStore'
import { useDraft } from './useDraftStore'
import { unlockSound } from '../utils/feedback'
import { parseSharedGame } from '../utils/onlineProtocol'

type Member = { uid: string; name: string }
type Command = { uid: string; action: 'roll' | 'skip'; rollId: number; id: string }
export type Room = { host: Member; guest?: Member; status: 'waiting' | 'playing' | 'closed' | 'won'; private: boolean; state: string; requests?: Record<string, Member>; command?: Command }
type Presence = Member & { room: string }
type Message = { name: string; text: string }
type Win = { uid: string; name: string; at: number }
interface OnlineState {
  enabled: boolean; connected: boolean; uid: string; name: string; roomId: string; room: Room | null
  people: Presence[]; rooms: Record<string, Room>; messages: Message[]; wins: Win[]; error: string; busy: boolean
}
export const useOnline = create<OnlineState>(() => ({ enabled: false, connected: false, uid: '', name: '', roomId: '', room: null, people: [], rooms: {}, messages: [], wins: [], error: '', busy: false }))
const db = () => { if (!database) throw new Error('Add Firebase settings to .env.local, then restart the app.'); return database }
let cleanups: (() => void)[] = [], roomCleanups: (() => void)[] = []
let generation = 0, roomGeneration = 0, lastCommand = '', publishing = Promise.resolve(), applying = false
const report = (e: unknown) => {
  const code = (e as { code?: string })?.code
  const messages: Record<string, string> = {
    'auth/configuration-not-found': 'Firebase Authentication is not configured. Enable Anonymous and Email/Password sign-in in the Firebase console.',
    'auth/operation-not-allowed': 'This sign-in method is disabled. Enable it in Firebase Authentication.',
    'PERMISSION_DENIED': 'Database access was denied. Check the Realtime Database rules in Firebase.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/network-request-failed': 'Connection failed. Check your internet connection and try again.',
  }
  useOnline.setState({ error: messages[code || ''] || (e instanceof Error ? e.message : String(e)) })
}
const snapshot = () => JSON.stringify(useGame.getState(), (key, value) => key === 'spectator' || typeof value === 'function' ? undefined : value)
function applyState(raw: string) {
  const state = parseSharedGame(raw)
  applying = true
  try { useGame.setState({ ...state, spectator: true }) } finally { applying = false }
}
export async function connectOnline(name: string, email = '', password = '', register = false) {
  useOnline.setState({ busy: true, error: '' })
  try {
    db(); if (!auth) throw new Error('Firebase authentication is not configured')
    await auth.authStateReady()
    const username = name.trim().replace(/^@/, '').slice(0, 24)
    if (!username) throw new Error('Choose a username')
    if (email) {
      if (register && auth.currentUser?.isAnonymous) await linkWithCredential(auth.currentUser, EmailAuthProvider.credential(email, password))
      else if (register) await createUserWithEmailAndPassword(auth, email, password)
      else await signInWithEmailAndPassword(auth, email, password)
    } else if (!auth.currentUser) await signInAnonymously(auth)
    const user = auth.currentUser!
    await updateProfile(user, { displayName: username })
    if (useOnline.getState().enabled) await disconnectOnline()
    const token = ++generation
    useOnline.setState({ enabled: true, uid: user.uid, name: username })
    const presence = ref(db(), `presence/${user.uid}`)
    cleanups.push(onValue(ref(db(), '.info/connected'), async s => {
      useOnline.setState({ connected: s.val() === true })
      if (!s.val()) return
      try {
        await onDisconnect(presence).remove()
        if (generation !== token) return
        await set(presence, { uid: user.uid, name: username, room: useOnline.getState().roomId })
      } catch (e) { report(e) }
    }, report))
    cleanups.push(onValue(ref(db(), 'presence'), s => useOnline.setState({ people: Object.values(s.val() || {}) }), report))
    cleanups.push(onValue(ref(db(), 'rooms'), s => useOnline.setState({ rooms: s.val() || {} }), report))
    cleanups.push(onValue(ref(db(), 'leaderboard'), s => useOnline.setState({ wins: Object.values(s.val() || {}) }), report))
  } catch (e) { report(e) } finally { useOnline.setState({ busy: false }) }
}
export async function disconnectOnline() {
  await leaveRoom()
  generation++; cleanups.forEach(fn => fn()); cleanups = []
  const uid = useOnline.getState().uid
  if (uid) { await remove(ref(db(), `presence/${uid}`)); await onDisconnect(ref(db(), `presence/${uid}`)).cancel() }
  useOnline.setState({ enabled: false, connected: false, people: [], rooms: {}, uid: '', error: '' })
}
function watchRoom(id: string) {
  const token = ++roomGeneration
  lastCommand = ''; useOnline.setState({ roomId: id, messages: [] })
  const me = useOnline.getState()
  void update(ref(db(), `presence/${me.uid}`), { room: id }).catch(report)
  roomCleanups.push(onValue(ref(db(), `rooms/${id}`), s => {
    if (token !== roomGeneration) return
    const room: Room | null = s.val()
    useOnline.setState({ room })
    if (!room) { report(new Error('Room no longer exists. Leave to return to hotseat.')); return }
    if (room.status === 'closed') useGame.setState({ spectator: true })
    if (room.host.uid !== me.uid) { try { applyState(room.state) } catch (e) { report(e) }; return }
    if (room.status === 'waiting' && room.guest) {
      const g = useGame.getState()
      useGame.setState({ players: g.players.map((p, i) => ({ ...p, name: i ? room.guest!.name : room.host.name })) })
      void update(ref(db(), `rooms/${id}`), { status: 'playing', state: snapshot() }).catch(report)
    }
    const cmd = room.command, game = useGame.getState()
    if (room.status !== 'playing' || !roomReady(useOnline.getState()) || !cmd || cmd.id === lastCommand) return
    lastCommand = cmd.id
    const activeUid = game.current === 0 ? room.host.uid : room.guest?.uid
    if (cmd.uid !== activeUid || cmd.rollId !== game.rollId) return
    if (cmd.action === 'roll') game.roll(); else game.skipAnimation()
  }, report))
  roomCleanups.push(onValue(query(ref(db(), `messages/${id}`), limitToLast(50)), s => useOnline.setState({ messages: Object.values(s.val() || {}) }), report))
  let scheduled = false
  roomCleanups.push(useGame.subscribe(() => {
    if (scheduled || applying) return
    scheduled = true
    queueMicrotask(() => {
    scheduled = false
    if (token !== roomGeneration) return
    const online = useOnline.getState()
    if (applying || online.room?.host.uid !== me.uid || online.room?.status !== 'playing') return
    const state = snapshot(), game = useGame.getState()
    const winner = game.winner === null ? null : (game.winner === 0 ? online.room.host : online.room.guest)
    publishing = publishing.then(async () => {
      if (token !== roomGeneration) return
      const result = await runTransaction(ref(db(), `rooms/${id}`), (room: Room | null) => {
        if (!room || room.host.uid !== me.uid || !['playing', 'won'].includes(room.status)) return
        return { ...room, state, status: winner ? 'won' : 'playing' }
      }, { applyLocally: false })
      if (winner && result.committed) await set(ref(db(), `leaderboard/${id}`), { ...winner, at: serverTimestamp() })
    }).catch(report)
    })
  }))
}
export async function createRoom(privateRoom = false) {
  const me = useOnline.getState()
  if (!me.connected || me.roomId) throw new Error('Connect and leave your current room first')
  const roomRef = push(ref(db(), 'rooms')), id = roomRef.key!
  useGame.getState().startGame(useDraft.getState().present, [me.name, 'Waiting…'])

  await set(roomRef, { host: { uid: me.uid, name: me.name }, status: 'waiting', private: privateRoom, state: snapshot() })
  watchRoom(id)
}
export async function joinRoom(id: string) {
  if (!/^[-\w]{10,80}$/.test(id)) throw new Error('Enter a valid room code')
  const me = useOnline.getState()
  if (!me.connected || me.roomId) throw new Error('Connect and leave your current room first')
  await get(ref(db(), `rooms/${id}`))
  const result = await runTransaction(ref(db(), `rooms/${id}`), (room: Room | null) => {
    if (!room || room.status !== 'waiting' || room.guest || room.host.uid === me.uid) return
    return { ...room, requests: { ...room.requests, [me.uid]: { uid: me.uid, name: me.name } } }
  }, { applyLocally: false })
  if (!result.committed) throw new Error('Room is unavailable or already full')

  useGame.getState().startGame(useDraft.getState().present, [me.name, 'Opponent'])
  watchRoom(id)
}
export async function leaveRoom() {
  const me = useOnline.getState()
  roomGeneration++; roomCleanups.forEach(fn => fn()); roomCleanups = []
  useOnline.setState({ roomId: '', room: null, messages: [] })
  useGame.getState().startGame(useDraft.getState().present, ['Player 1', 'Player 2'])
  if (me.roomId) {
    if (me.room?.host.uid === me.uid || me.room?.guest?.uid === me.uid) await set(ref(db(), `rooms/${me.roomId}/status`), 'closed')
    else await remove(ref(db(), `rooms/${me.roomId}/requests/${me.uid}`))

    await update(ref(db(), `presence/${me.uid}`), { room: '' })
  }
}
export async function onlineCommand(action: 'roll' | 'skip') {
  const me = useOnline.getState(), game = useGame.getState(), room = me.room
  const active = game.current === 0 ? room?.host.uid : room?.guest?.uid
  if (!roomReady(me) || room?.status !== 'playing' || active !== me.uid) return
  void unlockSound()
  await set(ref(db(), `rooms/${me.roomId}/command`), { uid: me.uid, action, rollId: game.rollId, id: crypto.randomUUID() })
}
export async function sendChat(text: string) {
  const me = useOnline.getState(), clean = text.trim().slice(0, 300)
  if (!clean || !me.connected || !me.roomId || !me.room || me.room.status === 'closed' || ![me.room.host.uid, me.room.guest?.uid].includes(me.uid)) throw new Error('Connect to an active room before sending chat')
  await set(push(ref(db(), `messages/${me.roomId}`)), { name: me.name, text: clean, at: serverTimestamp() })
}
export async function onlineAction(fn: () => Promise<unknown>) {
  useOnline.setState({ busy: true, error: '' })
  try { await fn() } catch (e) { report(e) } finally { useOnline.setState({ busy: false }) }
}

export async function findMatch() {
  const me = useOnline.getState()
  const match = Object.entries(me.rooms).find(([, r]) => r.status === 'waiting' && !r.private && !r.guest && r.host.uid !== me.uid && me.people.some(p => p.uid === r.host.uid))
  if (match) await joinRoom(match[0]); else await createRoom()
}
export async function logoutOnline() {
  await disconnectOnline()
  if (auth) await signOut(auth)
}

export function roomReady(me: OnlineState): boolean {
  const room = me.room
  return Boolean(me.connected && room?.guest && [room.host.uid, room.guest.uid].every(uid => me.people.some(p => p.uid === uid && p.room === me.roomId)))
}
export function reconnectOnline() { goOnline(db()) }
export async function respondToRequest(uid: string, accept: boolean) {
  const me = useOnline.getState()
  if (!me.connected || me.room?.host.uid !== me.uid) throw new Error('Only the connected host can respond')
  const result = await runTransaction(ref(db(), 'rooms/' + me.roomId), (room: Room | null) => {
    if (!room || room.host.uid !== me.uid || room.status !== 'waiting' || room.guest || !room.requests?.[uid]) return
    const member = room.requests[uid], requests = { ...room.requests }
    delete requests[uid]
    return accept ? { ...room, guest: member, requests: {} } : { ...room, requests }
  }, { applyLocally: false })
  if (!result.committed) throw new Error('This request is no longer available')
}
