import { useState } from 'react'
import { GameScene } from './components/Scene/GameScene'
import { HUD } from './components/UI/HUD'
import { CustomizerModal } from './components/UI/CustomizerModal'

export default function App() {
  const [open, setOpen] = useState(false)
  const [setup, setSetup] = useState(true)
  return (
    <>
      <div className="canvas"><GameScene /></div>
      <HUD onEdit={() => setOpen(true)} />
      {(setup || open) && <CustomizerModal setup={setup} onClose={() => { setSetup(false); setOpen(false) }} />}
    </>
  )
}
