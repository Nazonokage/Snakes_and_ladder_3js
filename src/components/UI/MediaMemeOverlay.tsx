import { useEffect, useState, useRef } from 'react'
import { useGame } from '../../store/useGameStore'
import { useMotion } from '../../store/useMotion'

interface MemeEvent {
  id: string | number
  type: 'snake' | 'ladder' | 'evilLarry' | 'catSnake'
  title: string
  subText: string
  image?: string
  video?: string
}

const SNAKE_VIDEOS = [
  '/vids/emotionaldmg.mp4',
  '/vids/Man gets bit by snake entering his home.mp4'
]

export function MediaMemeOverlay({ enabled }: { enabled: boolean }) {
  const g = useGame()
  const motion = useMotion()
  const [activeMeme, setActiveMeme] = useState<MemeEvent | null>(null)
  const lastProcessedRef = useRef<string | number>('')
  const videoRef = useRef<HTMLVideoElement>(null)

  // Listen to snake, ladder, rewind, freeze triggers
  useEffect(() => {
    if (!enabled || motion.mode === 'off') return

    const snakeMove = g.queue.find(m => m.kind === 'snake')
    const ladderMove = g.queue.find(m => m.kind === 'ladder')
    const rewindMove = g.queue.find(m => m.kind === 'rewind')

    // 1. Snake Bite -> Video Popup
    if (snakeMove && lastProcessedRef.current !== `snake-${snakeMove.id}`) {
      lastProcessedRef.current = `snake-${snakeMove.id}`
      const vid = SNAKE_VIDEOS[Math.floor(Math.random() * SNAKE_VIDEOS.length)]
      setActiveMeme({
        id: `snake-${snakeMove.id}`,
        type: 'snake',
        title: '🐍 BITTEN BY A SNAKE!',
        subText: 'EMOTIONAL DAMAGE! Sliding all the way down!',
        video: vid
      })
      return
    }

    // 2. Ladder Climb -> climbing_ladder.png
    if (ladderMove && lastProcessedRef.current !== `ladder-${ladderMove.id}`) {
      lastProcessedRef.current = `ladder-${ladderMove.id}`
      setActiveMeme({
        id: `ladder-${ladderMove.id}`,
        type: 'ladder',
        title: '🪜 CLIMBING THE LADDER!',
        subText: 'Stairway to heaven! To the moon! 🚀',
        image: '/image/climbing_ladder.png'
      })
      return
    }

    // 3. Rewind (Back tile) -> evilLarry.png
    if (rewindMove && lastProcessedRef.current !== `rewind-${rewindMove.id}`) {
      lastProcessedRef.current = `rewind-${rewindMove.id}`
      setActiveMeme({
        id: `rewind-${rewindMove.id}`,
        type: 'evilLarry',
        title: '🦹 EVIL LARRY SAY: GO BACK!',
        subText: 'Back to where you came from! ↩',
        image: '/image/evilLarry.png'
      })
      return
    }

    // Freeze Special Tile -> evilLarry.png
    const curPlayer = g.players[g.current]
    if (g.phase === 'RESOLVING_SPECIAL' && curPlayer) {
      const sp = g.board.specials[curPlayer.pos]
      if (sp && sp.type === 'freeze' && lastProcessedRef.current !== `freeze-${g.fx?.id}`) {
        lastProcessedRef.current = `freeze-${g.fx?.id ?? Date.now()}`
        setActiveMeme({
          id: lastProcessedRef.current,
          type: 'evilLarry',
          title: '🧊 EVIL LARRY FROZE YOU!',
          subText: 'You are frozen for upcoming turns! ❄️',
          image: '/image/evilLarry.png'
        })
      }
    }
  }, [g.queue, g.fx, g.phase, enabled, motion.mode, g.current, g.players, g.board.specials])

  // 4. Cat Snake when nearby a snake head
  useEffect(() => {
    if (!enabled || motion.mode === 'off' || g.phase !== 'IDLE') return
    const curPlayer = g.players[g.current]
    if (!curPlayer) return

    const nearbySnake = g.board.snakes.find(s => s.from > curPlayer.pos && s.from <= curPlayer.pos + 2)
    if (nearbySnake && lastProcessedRef.current !== `catsnake-${nearbySnake.from}-${curPlayer.pos}`) {
      lastProcessedRef.current = `catsnake-${nearbySnake.from}-${curPlayer.pos}`
      setActiveMeme({
        id: lastProcessedRef.current,
        type: 'catSnake',
        title: '🐱🐍 CAT SNAKE NEARBY!',
        subText: `Psst... Meow! Snake head ahead at tile ${nearbySnake.from}!`,
        image: '/image/catfacedsnake.png'
      })
    }
  }, [g.phase, g.current, g.players, g.board.snakes, enabled, motion.mode])

  // Auto-dismiss timer
  useEffect(() => {
    if (!activeMeme) return
    const timer = setTimeout(() => setActiveMeme(null), activeMeme.video ? 3600 : 2800)
    return () => clearTimeout(timer)
  }, [activeMeme])

  if (!activeMeme) return null

  return (
    <div className="meme-overlay" onClick={() => setActiveMeme(null)} role="dialog" aria-label="Meme Popup">
      <div className="meme-card" onClick={e => e.stopPropagation()}>
        <button className="meme-close" onClick={() => setActiveMeme(null)} aria-label="Close meme">×</button>
        {activeMeme.video ? (
          <video
            ref={videoRef}
            src={activeMeme.video}
            autoPlay
            playsInline
            muted={false}
            className="meme-media video"
            onEnded={() => setActiveMeme(null)}
          />
        ) : activeMeme.image ? (
          <img src={activeMeme.image} alt={activeMeme.title} className="meme-media image" />
        ) : null}
        <div className="meme-text">
          <h3>{activeMeme.title}</h3>
          <p>{activeMeme.subText}</p>
        </div>
      </div>
    </div>
  )
}
