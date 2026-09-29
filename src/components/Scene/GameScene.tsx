import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type React from 'react'
import type { ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { useGame } from '../../store/useGameStore'
import { TILE, cellToRC, cellToWorld, connectionCurve } from '../../utils/gridMath'
import type { Connection, FxKind } from '../../types/game'

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const GLYPH = { skip: '⏭', bonus: '★', back: '↩', freeze: '❄' } as const
const OFF: [number, number][] = [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]]
const PS = 1.25 // pawn scale
const REST = new THREE.Vector3()

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
  const { curve, hp, eyes, tongue, yaw } = useMemo(() => {
    const curve = connectionCurve('snake', c.from, c.to, size)
    const head = curve.getPoint(0), tan = curve.getTangent(0), side = new THREE.Vector3(-tan.z, 0, tan.x)
    const hp = head.clone().setY(head.y + 0.14)
    const eyes = [1, -1].map(s => hp.clone().addScaledVector(tan, 0.2).addScaledVector(side, s * 0.15).setY(hp.y + 0.16))
    return { curve, hp, eyes, tongue: hp.clone().addScaledVector(tan, 0.5).setY(hp.y - 0.04), yaw: Math.atan2(tan.x, tan.z) }
  }, [c.from, c.to, size])
  const color = useMemo(() => new THREE.Color().setHSL(((c.from * 47) % 360) / 360, 0.6, 0.45), [c.from])
  return (
    <Rise>
      <mesh castShadow><tubeGeometry args={[curve, 64, 0.17, 10, false]} /><meshStandardMaterial color={color} map={skinTex()} roughness={0.25} metalness={0.1} /></mesh>
      <mesh position={hp} rotation={[0, yaw, 0]} scale={[1, 0.75, 1.25]} castShadow><sphereGeometry args={[0.3, 20, 14]} /><meshStandardMaterial color={color} roughness={0.25} /></mesh>
      {eyes.map((e, i) => <mesh key={i} position={e}><sphereGeometry args={[0.075, 10, 8]} /><meshStandardMaterial color="#ffee00" emissive="#ffee00" emissiveIntensity={2} /></mesh>)}
      <mesh position={tongue} rotation={[0, yaw, 0]}><boxGeometry args={[0.05, 0.02, 0.22]} /><meshBasicMaterial color="#e5173f" /></mesh>
    </Rise>
  )
}
function Ladder({ c, size }: { c: Connection; size: number }) {
  const a = cellToWorld(c.from, size), b = cellToWorld(c.to, size)
  const len = a.distanceTo(b), mid = a.clone().lerp(b, 0.5), yaw = Math.atan2(b.x - a.x, b.z - a.z)
  const rungs = Math.max(2, Math.floor(len / 0.45))
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
  const st = useRef({ id: 0, t: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), curve: null as THREE.Curve<THREE.Vector3> | null })
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const color = useGame(s => s.players[i]?.color)
  useFrame((_, dt) => {
    const s = useGame.getState(), grp = g.current, p = s.players[i]; if (!grp || !p) return
    const o = OFF[i], size = s.board.size, q = st.current
    const rest = cellToWorld(p.pos, size, 0.1, REST); rest.x += o[0]; rest.z += o[1]
    const m = s.current === i ? s.queue[0] : undefined
    if (!m) { q.id = 0; grp.position.copy(rest); grp.scale.setScalar(PS); PAWN_POS[i].copy(rest); return }
    if (m.id !== q.id) {
      q.id = m.id; q.t = 0; q.from.copy(grp.position)
      q.to.copy(cellToWorld(m.to, size, 0.1)); q.to.x += o[0]; q.to.z += o[1]
      q.curve = m.kind === 'hop' ? null : connectionCurve(m.kind, m.from, m.to, size)
    }
    const fast = reduced(), hop = m.kind === 'hop'
    const dur = fast ? 0.01 : hop ? 0.5 : m.kind === 'rewind' ? 0.8 : 1.6
    const gap = hop && !fast ? 0.2 : 0
    q.t += dt
    const k = Math.min(1, q.t / dur), e = k * k * (3 - 2 * k)
    let sy = 1
    if (q.curve) {
      q.curve.getPoint(m.kind === 'rewind' ? e : k, tmp)
      grp.position.set(tmp.x + o[0], tmp.y - 0.15 + (m.kind === 'rewind' ? Math.sin(Math.PI * e) * 0.6 : 0), tmp.z + o[1])
    } else {
      grp.position.lerpVectors(q.from, q.to, e); grp.position.y += Math.sin(Math.PI * k) * 0.75
      if (!fast) sy = 1 + 0.3 * Math.sin(Math.PI * k) - (gap ? 0.3 * Math.sin(Math.PI * Math.min(1, Math.max(0, (q.t - dur) / gap))) : 0)
    }
    grp.scale.set(PS / Math.sqrt(sy), PS * sy, PS / Math.sqrt(sy))
    PAWN_POS[i].copy(grp.position)
    if (q.t >= dur + gap) s.advance()
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
    if (!s.queue[0] || q.n >= TN) return
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
const AX = new THREE.Vector3()
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
/** Thrown from the player's side: arc in, bounce off the tray floor (~4 bounces, walls), tumbling, then settle on the rolled face. */
function Dice() {
  const size = useGame(s => s.board.size)
  const ref = useRef<THREE.Group>(null)
  const c = useMemo(() => trayC(size), [size])
  const st = useRef({ id: 0, t: 0, ts: 0, phase: 'done' as 'fly' | 'settle' | 'done', p: new THREE.Vector3(), v: new THREE.Vector3(), w: new THREE.Vector3(), b: 0, inside: false, qf: new THREE.Quaternion() })
  useEffect(() => { ref.current?.position.set(c.x, c.y + 0.5, c.z) }, [c])
  useFrame((_, dt) => {
    const s = useGame.getState(), g = ref.current, q = st.current; if (!g) return
    if (s.rollId !== q.id) {
      q.id = s.rollId; q.t = 0; q.b = 0; q.inside = false; q.phase = 'fly'
      q.p.set(c.x - 3 + Math.random() * 1.2, 2.6, (size * TILE) / 2 + 2.5 + Math.random())
      q.v.set((c.x - q.p.x) / 1.3 + (Math.random() - 0.5), 3.2, (c.z - q.p.z) / 1.3 + (Math.random() - 0.5) * 1.5)
      q.w.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(12)
      g.position.copy(q.p)
    }
    if (q.phase === 'done' || s.dice == null) return
    if (reduced()) { g.position.set(c.x, c.y + 0.5, c.z); g.quaternion.copy(TARGET[s.dice]); q.phase = 'done'; s.diceSettled(); return }
    q.t += dt
    if (q.phase === 'fly') {
      const d = Math.min(dt, 0.033), hx = 1.25
      q.v.y -= 12 * d; q.p.addScaledVector(q.v, d)
      g.rotateOnWorldAxis(AX.copy(q.w).normalize(), q.w.length() * d)
      if (q.p.y <= c.y + 0.5 && q.v.y < 0) { q.p.y = c.y + 0.5; q.v.y *= -0.55; q.v.x *= 0.6; q.v.z *= 0.6; q.w.multiplyScalar(0.65); q.b++; q.inside = true }
      if (q.inside) {
        if (q.p.x < c.x - hx) { q.p.x = c.x - hx; q.v.x = Math.abs(q.v.x) * 0.5 } else if (q.p.x > c.x + hx) { q.p.x = c.x + hx; q.v.x = -Math.abs(q.v.x) * 0.5 }
        if (q.p.z < c.z - hx) { q.p.z = c.z - hx; q.v.z = Math.abs(q.v.z) * 0.5 } else if (q.p.z > c.z + hx) { q.p.z = c.z + hx; q.v.z = -Math.abs(q.v.z) * 0.5 }
      }
      g.position.copy(q.p)
      if (q.b >= 4 || q.t > 3.6) { q.phase = 'settle'; q.ts = 0; q.qf.copy(g.quaternion) }
    } else {
      q.ts += dt
      const k = Math.min(1, q.ts / 0.6)
      g.quaternion.copy(q.qf).slerp(TARGET[s.dice], k * k * (3 - 2 * k)); g.position.y = c.y + 0.5
      if (k >= 1) { q.phase = 'done'; s.diceSettled() }
    }
  })
  return (
    <group ref={ref} position={[c.x, c.y + 0.5, c.z]}>
      <RoundedBox args={[1, 1, 1]} radius={0.12} smoothness={4} castShadow><meshStandardMaterial color="#fafafa" roughness={0.3} /></RoundedBox>
      {FACES.map(([n, v]) => (
        <group key={v} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...n))}>
          {PIPS[v].map(([x, y], i) => <mesh key={i} position={[x * 0.24, y * 0.24, 0.5]} scale={[1, 1, 0.3]}><sphereGeometry args={[0.075, 10, 8]} /><meshStandardMaterial color={v === 1 ? '#d62828' : '#151515'} /></mesh>)}
        </group>
      ))}
    </group>
  )
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

export function GameScene() {
  const size = useGame(s => s.board.size)
  return (
    <Canvas key={size} shadows dpr={[1, 2]} gl={{ powerPreference: 'high-performance' }} camera={{ position: [0, size * 1.25, size * 0.95], fov: 45 }}>
      <color attach="background" args={['#101522']} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[8, 14, 6]} intensity={1.3} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} />
      {new URLSearchParams(location.search).has('perf') && <PerfProbe />}
      <Board /><Tray /><Connections /><Marks /><Trail /><Pawns /><Dice /><Fx />
      <OrbitControls maxPolarAngle={Math.PI / 2.2} minDistance={6} maxDistance={40} />
    </Canvas>
  )
}
