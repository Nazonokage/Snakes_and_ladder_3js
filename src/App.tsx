import { useState } from 'react'
import { GameScene } from './components/Scene/GameScene'
import { HUD } from './components/UI/HUD'
import { CustomizerModal } from './components/UI/CustomizerModal'
import { MotionDemo } from './components/UI/MotionDemo'

const motionDemo = import.meta.env.DEV && new URLSearchParams(location.search).has('motion-demo')

export default function App() {
  const [open, setOpen] = useState(false)
  const [setup, setSetup] = useState(!motionDemo)
  return (
    <>
      <div className="canvas"><GameScene /></div>
      {!setup && <HUD onEdit={() => setOpen(true)} />}
      {motionDemo && <MotionDemo />}
      {(setup || open) && <CustomizerModal setup={setup} onClose={() => { setSetup(false); setOpen(false) }} />}
    </>
  )
}
