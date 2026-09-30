import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runTransaction } from 'firebase/database'
import { respondToRequest, roomReady, useOnline, type Room } from './useOnlineStore'
vi.mock('../lib/firebase', () => ({ database: {}, auth: null }))
vi.mock('firebase/database', async original => ({ ...await original<typeof import('firebase/database')>(), ref: vi.fn(), runTransaction: vi.fn() }))
const room = (): Room => ({ host: { uid: 'host', name: 'Host' }, status: 'waiting', private: false, state: '{}', requests: { guest: { uid: 'guest', name: 'Guest' }, other: { uid: 'other', name: 'Other' } } })
beforeEach(() => { vi.clearAllMocks(); useOnline.setState({ uid: 'host', connected: true, roomId: 'room', room: room(), people: [] }) })
describe('online approval and reconnect guards', () => {
  it('accepts one requested player and clears competing requests', async () => {
    vi.mocked(runTransaction).mockImplementation(async (_ref, change) => {
      const next = change(room()) as Room
      expect(next.guest?.uid).toBe('guest')
      expect(next.requests).toEqual({})
      expect(change({ ...room(), guest: { uid: 'other', name: 'Other' } })).toBeUndefined()
      return { committed: true } as Awaited<ReturnType<typeof runTransaction>>
    })
    await respondToRequest('guest', true)
    expect(runTransaction).toHaveBeenCalledOnce()
  })
  it('declines only the selected request without starting a game', async () => {
    vi.mocked(runTransaction).mockImplementation(async (_ref, change) => {
      const next = change(room()) as Room
      expect(next.guest).toBeUndefined()
      expect(next.status).toBe('waiting')
      expect(Object.keys(next.requests || {})).toEqual(['other'])
      return { committed: true } as Awaited<ReturnType<typeof runTransaction>>
    })
    await respondToRequest('guest', false)
  })
  it('rejects responses from a guest or disconnected host', async () => {
    useOnline.setState({ uid: 'guest' })
    await expect(respondToRequest('guest', true)).rejects.toThrow()
    useOnline.setState({ uid: 'host', connected: false })
    await expect(respondToRequest('guest', true)).rejects.toThrow()
    expect(runTransaction).not.toHaveBeenCalled()
  })
  it('requires both players in the room and resumes when presence returns', () => {
    useOnline.setState({ room: { ...room(), guest: { uid: 'guest', name: 'Guest' }, status: 'playing' } })
    expect(roomReady(useOnline.getState())).toBe(false)
    const people = [{ uid: 'host', name: 'Host', room: 'room' }, { uid: 'guest', name: 'Guest', room: 'room' }]
    useOnline.setState({ people })
    expect(roomReady(useOnline.getState())).toBe(true)
    useOnline.setState({ connected: false })
    expect(roomReady(useOnline.getState())).toBe(false)
    useOnline.setState({ connected: true, people: people.slice(0, 1) })
    expect(roomReady(useOnline.getState())).toBe(false)
    useOnline.setState({ people })
    expect(roomReady(useOnline.getState())).toBe(true)
  })
})
