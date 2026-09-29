import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type React from 'react'
import type { ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { useGame } from '../../store/useGameStore'
import { TILE, cellToRC, cellToWorld, connectionCurve } from '../../utils/gridMath'
import { playFeedback } from '../../utils/feedback'
import { gentleMotion } from '../../store/useMotion'
import { createMoveAnimation, DICE_SECONDS, mouthOpen, pawnStepCues, rungCount, snakeProgress, SNAKE_EXIT_START, tailRadius } from '../../utils/motion'
import type { Connection, FxKind } from '../../types/game'

const reduced = gentleMotion
const GLYPH = { skip: '⏭', bonus: '★', back: '↩', freeze: '❄' } as const
const OFF: [number, number][] = [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]]
const PS = 1.25 // pawn scale
const REST = new THREE.Vector3()
const SNAKE_ACTION = { from: 0, seconds: 0 }

/* ---------- Board: 1 instanced mesh for tiles + 1 textured plane for every label (was ~2 draw calls per tile) ---------- */
function Board() {
  const b = useGame(s => s.board)
  const n = b.size * b.size, half = (b.size * TILE) / 2 + 0.3
  const inst = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = inst.current; if (!m) return
    const d = new THREE.Object3D(), c = new THREE.Color()
    for (let k = 0; k < n; k++) {
      const cell = k + 1, { row, col } = cellToRC(cell, b.size), sp = b.specials[cell]
      cellToWorld(cell, b.size, 0, d.position); d.updateMatrix(); m.setMatrixAt(k, d.matrix)
      m.setColorAt(k, c.set(sp ? b.cellColors.special : (row + col) % 2 ? b.cellColors.secondary : b.cellColors.primary))
    }
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [b, n])
  const labels = useMemo(() => {
    const px = 96, cv = document.createElement('canvas'); cv.width = cv.height = b.size * px
    const x = cv.getContext('2d')!; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#222'
    for (let cell = 1; cell <= n; cell++) {
      const { row, col } = cellToRC(cell, b.size), sp = b.specials[cell], cx = (col + 0.5) * px, cy = (b.size - 1 - row + 0.5) * px
      x.font = 'bold 30px system-ui, sans-serif'; x.fillText(String(cell), cx, cy - (sp ? 16 : 0))
      if (sp) { x.font = '34px system-ui, sans-serif'; x.fillText(GLYPH[sp.type], cx, cy + 22) }
    }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return tex
  }, [b.size, b.specials, n])
  useEffect(() => () => labels.dispose(), [labels])
  return (
    <group>
      <mesh position={[0, -0.15, 0]} receiveShadow><boxGeometry args={[half * 2, 0.2, half * 2]} /><meshStandardMaterial color="#2b2f45" /></mesh>
      <instancedMesh key={n} ref={inst} args={[undefined, undefined, n]} receiveShadow><boxGeometry args={[TILE * 0.96, 0.2, TILE * 0.96]} /><meshStandardMaterial /></instancedMesh>
      <mesh position={[0, 0.112, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[b.size * TILE, b.size * TILE]} /><meshBasicMaterial map={labels} transparent depthWrite={false} /></mesh>
    </group>
  )
}

/* ---------- Snakes & ladders: authored data -> procedural meshes ---------- */
function Rise({ children }: { children: ReactNode }) {
  const r = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    const g = r.current; if (!g) return
    const t = useGame.getState().shuffling ? 0.001 : 1
    if (Math.abs(t - g.scale.y) < 0.002) { g.scale.y = t; return }
    g.scale.y += (t - g.scale.y) * Math.min(1, dt * (reduced() ? 60 : 4))
  })
  return <group ref={r} scale={[1, 0.001, 1]}>{children}</group>
}
let skin: THREE.CanvasTexture | null = null
const skinTex = () => {
  if (skin) return skin
  const c = document.createElement('canvas'); c.width = 64; c.height = 8
  const x = c.getContext('2d')!; x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 8); x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, 24, 8)
  skin = new THREE.CanvasTexture(c); skin.wrapS = THREE.RepeatWrapping; skin.repeat.set(18, 1); return skin
}
function Snake({ c, size }: { c: Connection; size: number }) {
  const body = useRef<THREE.TubeGeometry>(null)
  const headRef = useRef<THREE.Group>(null)
  const jawRef = useRef<THREE.Group>(null)
  const tongueRef = useRef<THREE.Group>(null)
  const original = useRef<Float32Array | null>(null)
  const { curve, hp, yaw, centers } = useMemo(() => {
    const curve = connectionCurve('snake', c.from, c.to, size)
    const tan = curve.getTangent(0).negate()
    return { curve, hp: curve.getPoint(0).add(new THREE.Vector3(0, 0.16, 0)),
      yaw: Math.atan2(tan.x, tan.z), centers: Array.from({ length: 65 }, (_, i) => curve.getPointAt(i / 64)) }
  }, [c.from, c.to, size])
  const color = useMemo(() => new THREE.Color().setHSL(((c.from * 47) % 360) / 360, 0.65, 0.46), [c.from])
  useLayoutEffect(() => {
    if (body.current) {
      original.current = new Float32Array(body.current.attributes.position.array)
      ;(body.current.attributes.position as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage)
      // Waves and the swallowed-piece bulge extend beyond the resting tube.
      body.current.computeBoundingSphere()
      if (body.current.boundingSphere) body.current.boundingSphere.radius += 0.7
    }
  }, [curve])
  useFrame(({ clock }) => {
    const geometry = body.current, base = original.current
    if (!geometry || !base) return
    const t = clock.elapsedTime, phase = c.from * 0.73, quiet = reduced()
    const eating = SNAKE_ACTION.from === c.from
    const seconds = SNAKE_ACTION.seconds, progress = snakeProgress(seconds)
    const swelling = eating && seconds >= 1.6 && seconds < SNAKE_EXIT_START
    const pos = geometry.attributes.position
    for (let j = 0; j < pos.count; j++) {
      const ring = Math.floor(j / 11), u = ring / 64, center = centers[ring]
      const envelope = Math.sin(Math.PI * u)
      const wave = Math.sin(u * Math.PI * 5 - t * 2.4 + phase) * (quiet ? 0.07 : 0.3) * envelope
      // Move the swallowed piece visibly through the snake as a travelling bulge.
      const bulge = tailRadius(u) * (swelling ? 1 + 1.65 * Math.exp(-Math.pow((u - progress) / 0.085, 2)) : 1)
      pos.setXYZ(j, center.x + (base[j * 3] - center.x) * bulge + Math.cos(yaw) * wave,
        center.y + (base[j * 3 + 1] - center.y) * bulge + Math.sin(u * Math.PI * 4 - t * 2.4 + phase) * (quiet ? 0.015 : 0.07) * envelope,
        center.z + (base[j * 3 + 2] - center.z) * bulge - Math.sin(yaw) * wave)
    }
    pos.needsUpdate = true
    geometry.computeVertexNormals()
    if (headRef.current) {
      headRef.current.rotation.y = yaw + (eating ? 0 : Math.sin(t * 1.8 + phase) * (quiet ? 0.025 : 0.17))
      headRef.current.position.y = hp.y + (eating ? 0 : Math.sin(t * 2 + phase) * (quiet ? 0.01 : 0.055))
    }
    if (jawRef.current) jawRef.current.rotation.x = -mouthOpen(eating ? seconds : 0) * 1.05
    if (tongueRef.current) {
      const cycle = (t + phase) % 2.8
      const flick = cycle < 1.6 ? Math.pow(Math.sin(cycle / 1.6 * Math.PI * 2), 2) : 0
      tongueRef.current.scale.z = 0.04 + flick * 0.96
      tongueRef.current.rotation.y = quiet ? 0 : Math.sin(t * 15) * 0.1
      tongueRef.current.visible = !eating && flick > 0.02
    }
  })
  return (
    <Rise>
      <mesh castShadow><tubeGeometry ref={body} args={[curve, 64, 0.2, 10, false]} /><meshStandardMaterial color={color} map={skinTex()} roughness={0.4} /></mesh>
      <group ref={headRef} position={hp} rotation={[0, yaw, 0]}>
        <mesh position={[0, -0.055, 0.08]} scale={[1, 0.35, 1.25]} castShadow><sphereGeometry args={[0.36, 20, 14]} /><meshStandardMaterial color={color} /></mesh>
        <mesh position={[0, 0.015, 0.12]} scale={[1, 0.08, 1.15]}><sphereGeometry args={[0.29, 16, 12]} /><meshStandardMaterial color="#650f29" /></mesh>
        <group ref={jawRef} position={[0, 0.055, -0.18]}>
          <mesh position={[0, 0.055, 0.25]} scale={[1, 0.5, 1.25]} castShadow><sphereGeometry args={[0.36, 20, 14]} /><meshStandardMaterial color={color} roughness={0.3} /></mesh>
          {[-1, 1].map(x => <group key={x}>
            <mesh position={[x * 0.2, 0.18, 0.36]}><sphereGeometry args={[0.095, 12, 10]} /><meshStandardMaterial color="#ffec6b" /></mesh>
            <mesh position={[x * 0.2, 0.19, 0.435]} scale={[0.45, 1, 0.4]}><sphereGeometry args={[0.055, 10, 8]} /><meshStandardMaterial color="#111111" /></mesh>
            <mesh position={[x * 0.19, -0.07, 0.48]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.04, 0.19, 8]} /><meshStandardMaterial color="#fff4d6" /></mesh>
          </group>)}
        </group>
        <group ref={tongueRef} position={[0, 0.035, 0.38]}>
          <mesh position={[0, 0, 0.24]}><boxGeometry args={[0.065, 0.025, 0.48]} /><meshBasicMaterial color="#ff3867" /></mesh>
          {[-1, 1].map(x => <mesh key={x} position={[x * 0.055, 0, 0.53]} rotation={[0, x * 0.55, 0]}><boxGeometry args={[0.03, 0.025, 0.2]} /><meshBasicMaterial color="#ff3867" /></mesh>)}
        </group>
      </group>
    </Rise>
  )
}
function Ladder({ c, size }: { c: Connection; size: number }) {
  const a = cellToWorld(c.from, size), b = cellToWorld(c.to, size)
  const len = a.distanceTo(b), mid = a.clone().lerp(b, 0.5), yaw = Math.atan2(b.x - a.x, b.z - a.z)
  const rungs = rungCount(len)
  return (
    <Rise>
      <group position={[mid.x, 0.18, mid.z]} rotation={[0, yaw, 0]}>
        {[-0.28, 0.28].map(x => <mesh key={x} position={[x, 0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.04, 0.04, len, 8]} /><meshStandardMaterial color="#b5793a" /></mesh>)}
        {Array.from({ length: rungs }, (_, i) => <mesh key={i} position={[0, 0, -len / 2 + ((i + 1) * len) / (rungs + 1)]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.03, 0.03, 0.56, 6]} /><meshStandardMaterial color="#d9a05b" /></mesh>)}
      </group>
    </Rise>
  )
}
function Connections() {
  const board = useGame(s => s.board), v = useGame(s => s.boardVersion)
  return <group key={v}>{board.snakes.map(c => <Snake key={`s${c.from}`} c={c} size={board.size} />)}{board.ladders.map(c => <Ladder key={`l${c.from}`} c={c} size={board.size} />)}</group>
}

/* ---------- Pawns: lathe profile, one hop per tile with squash/stretch + landing pause, curve slides ---------- */
const PAWN_POS = Array.from({ length: 4 }, () => new THREE.Vector3())
const PROFILE = [[0, 0], [0.3, 0], [0.3, 0.08], [0.17, 0.2], [0.11, 0.5], [0.2, 0.56], [0.2, 0.62], [0.1, 0.68], [0, 0.68]].map(([x, y]) => new THREE.Vector2(x, y))
function Pawn({ i }: { i: number }) {
  const g = useRef<THREE.Group>(null)
  const st = useRef({ id: 0, t: 0, soundTime: -0.001, rung: 0, animation: null as ReturnType<typeof createMoveAnimation> | null })
  const color = useGame(s => s.players[i]?.color)
  useFrame((_, dt) => {
    const s = useGame.getState(), grp = g.current, p = s.players[i]; if (!grp || !p) return
    const o = OFF[i], q = st.current, m = s.current === i ? s.queue[0] : undefined
    if (s.current === i) SNAKE_ACTION.from = 0
    if (!m) {
      q.id = 0; q.animation = null
      cellToWorld(p.pos, s.board.size, 0.1, REST); REST.x += o[0]; REST.z += o[1]
      grp.position.copy(REST); grp.scale.setScalar(PS); grp.rotation.set(0, 0, 0); grp.visible = true
      PAWN_POS[i].copy(REST); return
    }
    if (m.id !== q.id) {
      q.id = m.id; q.t = 0; q.rung = 0; q.soundTime = -0.001
      if (m.kind === 'snake') playFeedback('snake')
      q.animation = createMoveAnimation(m, s.board.size, o)
    }
    // Clamp a background-tab gap rather than consuming a whole move in one frame.
    q.t += Math.min(dt, 0.05)
    if (m.kind === 'snake') { SNAKE_ACTION.from = m.from; SNAKE_ACTION.seconds = q.t }
    const pose = q.animation!.sample(q.t, reduced())
    if (m.kind === 'hop' || m.kind === 'rewind') {
      for (const cue of pawnStepCues(q.soundTime, q.t, q.animation!.duration)) playFeedback(cue)
    }
    q.soundTime = q.t
    if (m.kind === 'ladder' && pose.rung !== q.rung) { q.rung = pose.rung; playFeedback('climb') }
    grp.position.copy(pose.position); grp.visible = pose.visible
    grp.scale.setScalar(PS * pose.scale); grp.rotation.z = pose.tilt
    PAWN_POS[i].copy(grp.position)
    if (pose.done) { SNAKE_ACTION.from = 0; s.advance() }
  })
  return (
    <group ref={g} scale={PS}>
      <mesh castShadow><latheGeometry args={[PROFILE, 24]} /><meshStandardMaterial color={color} roughness={0.35} /></mesh>
      <mesh position={[0, 0.8, 0]} castShadow><sphereGeometry args={[0.17, 16, 12]} /><meshStandardMaterial color={color} roughness={0.35} /></mesh>
    </group>
  )
}
/** Blinking rings: orange = where the turn started, green = where it will end (follows snakes/ladders). */
function Marks() {
  const a = useRef<THREE.Mesh>(null), b = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const s = useGame.getState()
    const upd = (r: THREE.Mesh | null, cell: number | undefined, phase: number) => {
      if (!r) return
      r.visible = cell !== undefined; if (cell === undefined) return
      cellToWorld(cell, s.board.size, 0.13, r.position)
      const w = Math.abs(Math.sin(clock.elapsedTime * 5 + phase))
      ;(r.material as THREE.MeshBasicMaterial).opacity = reduced() ? 0.75 : 0.25 + 0.6 * w
      r.scale.setScalar(reduced() ? 1 : 1 + 0.12 * w)
    }
    upd(a.current, s.mark?.from, 0); upd(b.current, s.mark?.to, Math.PI / 2)
  })
  const ring = (ref: React.RefObject<THREE.Mesh>, color: string) => (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} visible={false}><ringGeometry args={[0.36, 0.55, 32]} /><meshBasicMaterial color={color} transparent depthWrite={false} side={THREE.DoubleSide} /></mesh>
  )
  return <>{ring(a, '#ffb347')}{ring(b, '#4dff88')}</>
}
/** Bead trail behind the moving pawn (cap 160, reset every roll). */
const TN = 160
function Trail() {
  const m = useRef<THREE.InstancedMesh>(null)
  const st = useRef({ n: 0, key: -1, last: new THREE.Vector3(1e9, 0, 0) })
  const d = useMemo(() => new THREE.Object3D(), [])
  useFrame(() => {
    const s = useGame.getState(), mesh = m.current, q = st.current; if (!mesh) return
    const key = s.gameId * 1000 + s.rollId
    if (key !== q.key) { q.key = key; q.n = 0; mesh.count = 0; q.last.set(1e9, 0, 0) }
    if (!s.queue[0] || s.queue[0].kind === 'snake' || q.n >= TN) return
    const p = PAWN_POS[s.current]; if (p.distanceToSquared(q.last) < 0.03) return
    ;(mesh.material as THREE.MeshBasicMaterial).color.set(s.players[s.current].color)
    d.position.set(p.x, p.y + 0.12, p.z); d.updateMatrix(); mesh.setMatrixAt(q.n++, d.matrix)
    mesh.count = q.n; mesh.instanceMatrix.needsUpdate = true; q.last.copy(p)
  })
  return <instancedMesh ref={m} args={[undefined, undefined, TN]} frustumCulled={false}><sphereGeometry args={[0.055, 8, 6]} /><meshBasicMaterial transparent opacity={0.85} /></instancedMesh>
}
function Pawns() { const n = useGame(s => s.players.length); return <>{Array.from({ length: n }, (_, i) => <Pawn key={i} i={i} />)}</> }

/* ---------- Dice: rounded cube, tumble then slerp to the face for the rolled value ---------- */
const FACES: [[number, number, number], number][] = [[[0, 1, 0], 1], [[0, -1, 0], 6], [[1, 0, 0], 3], [[-1, 0, 0], 4], [[0, 0, 1], 2], [[0, 0, -1], 5]]
const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
}
const E = (x: number, y: number, z: number) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z))
const TARGET: Record<number, THREE.Quaternion> = { 1: E(0, 0, 0), 6: E(Math.PI, 0, 0), 3: E(0, 0, Math.PI / 2), 4: E(0, 0, -Math.PI / 2), 2: E(-Math.PI / 2, 0, 0), 5: E(Math.PI / 2, 0, 0) }
const DICE_POSE = { position: new THREE.Vector3(0, 0.5, 0), rotation: new THREE.Quaternion() }
const trayC = (size: number) => new THREE.Vector3((size * TILE) / 2 + 2.6, 0.1, 0)
function Tray() {
  const c = trayC(useGame(s => s.board.size))
  return (
    <group position={c}>
      <mesh position={[0, -0.05, 0]} receiveShadow><boxGeometry args={[3.6, 0.1, 3.6]} /><meshStandardMaterial color="#1f5a44" roughness={1} /></mesh>
      <mesh position={[0, -0.12, 0]}><boxGeometry args={[3.9, 0.1, 3.9]} /><meshStandardMaterial color="#5a3b22" /></mesh>
    </group>
  )
}
/** Continuous toss with diminishing bounces and a slow settle onto the rolled face. */
function Dice() {
  const size = useGame(s => s.board.size)
  const ref = useRef<THREE.Group>(null)
  const c = useMemo(() => trayC(size), [size])
  const st = useRef({ id: 0, game: -1, t: 0, active: false,
    start: new THREE.Vector3(), end: new THREE.Vector3(), initial: new THREE.Quaternion(),
    spin: new THREE.Quaternion(), matrix: new THREE.Matrix4(), axis: new THREE.Vector3() })
  useFrame((_, dt) => {
    const s = useGame.getState(), g = ref.current, q = st.current; if (!g) return
    if (q.game !== s.gameId) {
      q.game = s.gameId; q.id = s.phase === 'DICE_ROLLING' ? s.rollId - 1 : s.rollId; q.active = false
      g.position.set(c.x, c.y + 0.5, c.z); g.quaternion.identity()
      DICE_POSE.position.set(0, 0.5, 0); DICE_POSE.rotation.identity()
    }
    if (s.rollId !== q.id && s.phase === 'DICE_ROLLING') {
      q.id = s.rollId; q.t = 0; q.active = true
      q.start.copy(g.position); q.initial.copy(g.quaternion)
      q.end.set(c.x + (Math.random() - 0.5) * 1.2, c.y + 0.5, c.z + (Math.random() - 0.5) * 1.2)
      q.axis.set(0.6 + Math.random(), 0.3 + Math.random(), 0.6 + Math.random()).normalize()
    }
    if (!q.active || s.dice == null) return
    const previousTime = q.t
    q.t += Math.min(dt, 0.05)
    for (const bounce of [0.48, 0.7, 0.84]) {
      if (previousTime < bounce * DICE_SECONDS && q.t >= bounce * DICE_SECONDS) playFeedback('land')
    }
    const k = Math.min(1, q.t / DICE_SECONDS)
    g.position.lerpVectors(q.start, q.end, THREE.MathUtils.smoothstep(k, 0, 0.88))
    let height = 0
    if (k < 0.48) height = 2.8 * Math.sin(Math.PI * k / 0.48)
    else if (k < 0.7) height = 0.75 * Math.sin(Math.PI * (k - 0.48) / 0.22)
    else if (k < 0.84) height = 0.24 * Math.sin(Math.PI * (k - 0.7) / 0.14)
    else if (k < 0.92) height = 0.06 * Math.sin(Math.PI * (k - 0.84) / 0.08)
    if (reduced()) height *= 0.2
    q.spin.setFromAxisAngle(q.axis, Math.PI * (reduced() ? 2 : 8) * (1 - Math.pow(1 - k, 2)))
    g.quaternion.copy(q.initial).premultiply(q.spin)
    g.quaternion.slerp(TARGET[s.dice], THREE.MathUtils.smoothstep(k, 0.7, 1))
    const m = q.matrix.makeRotationFromQuaternion(g.quaternion).elements
    const support = 0.5 * (Math.abs(m[1]) + Math.abs(m[5]) + Math.abs(m[9]))
    g.position.y = c.y + support + height
    DICE_POSE.position.copy(g.position).sub(c); DICE_POSE.rotation.copy(g.quaternion)
    if (k >= 1) { q.active = false; s.diceSettled() }
  })
  return (
    <group ref={ref} position={[c.x, c.y + 0.5, c.z]}>
      <DiceAppearance />
    </group>
  )
}

function DiceAppearance() {
  return <>      <RoundedBox args={[1, 1, 1]} radius={0.12} smoothness={4} castShadow><meshStandardMaterial color="#fafafa" roughness={0.3} /></RoundedBox>
      {FACES.map(([n, v]) => (
        <group key={v} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...n))}>
          {PIPS[v].map(([x, y], i) => <mesh key={i} position={[x * 0.24, y * 0.24, 0.5]} scale={[1, 1, 0.3]}><sphereGeometry args={[0.075, 10, 8]} /><meshStandardMaterial color={v === 1 ? '#d62828' : '#151515'} /></mesh>)}
        </group>
      ))}</>
}
function PreviewDie() {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!ref.current) return
    ref.current.position.copy(DICE_POSE.position)
    ref.current.quaternion.copy(DICE_POSE.rotation)
  })
  return <group ref={ref}><DiceAppearance /></group>
}
export function DicePreview() {
  const phase = useGame(s => s.phase), value = useGame(s => s.dice)
  return <section className="dice-preview panel" aria-label="Dice animation">
    <strong>{phase === 'DICE_ROLLING' ? 'Rolling the dice…' : value ? 'Rolled ' + value : 'Ready to roll'}</strong>
    <div className="dice-viewport" aria-hidden="true">
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [4, 4.8, 6], fov: 42 }} onCreated={({ camera }) => camera.lookAt(0, 1.3, 0)}>
        <ambientLight intensity={1.3} />
        <directionalLight position={[3, 6, 4]} intensity={2} castShadow shadow-mapSize={[256, 256]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[3.8, 3.8]} /><meshStandardMaterial color="#246249" roughness={1} /></mesh>
        <PreviewDie />
      </Canvas>
    </div>
    <small>{phase === 'DICE_ROLLING' ? 'Toss · tumble · settle' : 'Watch your roll here'}</small>
  </section>
}

/* ---------- VFX: one pooled particle system (64 cap, zero per-frame allocation, off under reduced motion) ---------- */
const N = 64
const FX_COL: Record<FxKind, string> = { land: '#ffffff', ladder: '#ffd166', snake: '#ef476f', special: '#06d6a0', shuffle: '#b388ff', step: '#dddddd' }
function Fx() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const pool = useRef(Array.from({ length: N }, () => ({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3() })))
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const col = useMemo(() => new THREE.Color(), [])
  const fx = useGame(s => s.fx)
  const busy = useRef(1)
  useEffect(() => {
    const m = mesh.current
    if (!fx || !m || reduced()) return
    const base = fx.cell ? cellToWorld(fx.cell, useGame.getState().board.size, 0.3) : new THREE.Vector3(0, 1, 0)
    const want = fx.kind === 'shuffle' ? 28 : fx.kind === 'step' ? 4 : 10
    col.set(FX_COL[fx.kind])
    let c = 0
    for (let i = 0; i < N && c < want; i++) {
      const q = pool.current[i]; if (q.life > 0) continue
      q.life = q.max = 0.6 + Math.random() * 0.5; q.p.copy(base)
      const spread = fx.kind === 'shuffle' ? 4 : 1.2
      q.v.set((Math.random() - 0.5) * spread, 1 + Math.random() * 1.5, (Math.random() - 0.5) * spread)
      m.setColorAt(i, col); c++
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    busy.current = 1
  }, [fx, col])
  useFrame((_, dt) => {
    const m = mesh.current; if (!m || !busy.current) return
    let alive = 0
    pool.current.forEach((q, i) => {
      if (q.life > 0) { alive++; q.life -= dt; q.v.y -= 4 * dt; q.p.addScaledVector(q.v, dt) }
      dummy.position.copy(q.p); dummy.scale.setScalar(q.life > 0 ? Math.max(0.01, q.life / q.max) : 0.0001); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix)
    })
    busy.current = alive ? 1 : 0; m.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[undefined, undefined, N]} frustumCulled={false}><sphereGeometry args={[0.07, 8, 6]} /><meshBasicMaterial /></instancedMesh>
}

/** Open the page with ?perf to see fps, draw calls, triangles, geometries and textures. */
function PerfProbe() {
  const gl = useThree(s => s.gl)
  const el = useMemo(() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:9;font:11px monospace;background:#000a;color:#8f8;padding:4px 8px;border-radius:6px;pointer-events:none'; document.body.appendChild(d); return d }, [])
  const acc = useRef({ t: 0, f: 0 })
  useEffect(() => () => el.remove(), [el])
  useFrame((_, dt) => {
    const a = acc.current; a.t += dt; a.f++
    if (a.t >= 0.5) { el.textContent = `${(a.f / a.t).toFixed(0)} fps · ${gl.info.render.calls} calls · ${(gl.info.render.triangles / 1000).toFixed(1)}k tris · ${gl.info.memory.geometries} geo · ${gl.info.memory.textures} tex`; a.t = 0; a.f = 0 }
  })
  return null
}

function BoardFraming({ boardSize }: { boardSize: number }) {
  const { camera, size } = useThree()
  useLayoutEffect(() => {
    const perspective = camera as THREE.PerspectiveCamera
    const half = boardSize * TILE / 2 + 0.3
    const tangent = Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2))
    const distance = 1.12 * (half * 0.6 + Math.max(half * 0.8 / tangent, half / (tangent * size.width / size.height)))
    camera.position.set(0, distance * 0.8, distance * 0.6)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }, [camera, boardSize, size.width, size.height])
  return null
}

export function GameScene() {
  const size = useGame(s => s.board.size)
  return (
    <Canvas key={size} shadows dpr={[1, 2]} gl={{ powerPreference: 'high-performance' }} camera={{ position: [0, size * 1.25, size * 0.95], fov: 45 }}>
      <color attach="background" args={['#101522']} />
      <BoardFraming boardSize={size} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[8, 14, 6]} intensity={1.3} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} />
      {new URLSearchParams(location.search).has('perf') && <PerfProbe />}
      <Board /><Tray /><Pawns /><Connections /><Marks /><Trail /><Dice /><Fx />
      <OrbitControls enableDamping dampingFactor={0.07} maxPolarAngle={Math.PI / 2.2} minDistance={6} maxDistance={40} />
    </Canvas>
  )
}
