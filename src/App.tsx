import { useState } from 'react'
import { GameScene } from './components/Scene/GameScene'
import { HUD } from './components/UI/HUD'
import { CustomizerModal } from './components/UI/CustomizerModal'
import { OnlinePanel } from './components/UI/OnlinePanel'
import { MotionDemo } from './components/UI/MotionDemo'

const motionDemo = import.meta.env.DEV && new URLSearchParams(location.search).has('motion-demo')

export default function App() {
  const [onlineOpen, setOnlineOpen] = useState(false)
  const [open, setOpen] = useState(false)
  const [setup, setSetup] = useState(!motionDemo)
  return (
    <>
      <div className="canvas"><GameScene /></div>
      {!setup && <HUD onEdit={() => setOpen(true)} onOnline={() => setOnlineOpen(true)} />}
      {onlineOpen && <OnlinePanel onClose={() => setOnlineOpen(false)} />}
      {motionDemo && <MotionDemo />}
      {(setup || open) && <CustomizerModal onOnline={() => { setSetup(false); setOpen(false); setOnlineOpen(true) }} setup={setup} onClose={() => { setSetup(false); setOpen(false) }} />}
    </>
  )
}
