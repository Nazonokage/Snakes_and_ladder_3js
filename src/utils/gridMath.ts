import * as THREE from 'three'
export const TILE = 1.2
/** Boustrophedon: row 0 (bottom) runs left->right, row 1 right->left, ... */
export function cellToRC(n: number, size: number) {
  const i = n - 1
  const row = Math.floor(i / size)
  let col = i % size
  if (row % 2 === 1) col = size - 1 - col
  return { row, col }
}
export function cellToWorld(n: number, size: number, y = 0, out = new THREE.Vector3()) {
  const { row, col } = cellToRC(n, size)
  const h = (size - 1) / 2
  return out.set((col - h) * TILE, y, (h - row) * TILE)
}
export type ConnKind = 'snake' | 'ladder' | 'rewind'
export function connectionCurve(kind: ConnKind, from: number, to: number, size: number): THREE.Curve<THREE.Vector3> {
  const a = cellToWorld(from, size, 0.3)
  const b = cellToWorld(to, size, 0.3)
  if (kind !== 'snake') return new THREE.LineCurve3(a, b)
  const d = b.clone().sub(a)
  const side = new THREE.Vector3(-d.z, 0, d.x).normalize()
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= 8; i++) {
    const t = i / 8
    const p = a.clone().lerp(b, t)
    p.addScaledVector(side, Math.sin(t * Math.PI * 3) * 0.5 * (0.4 + 0.6 * Math.sin(Math.PI * t)))
    p.y = 0.25 + Math.sin(t * Math.PI) * 0.6
    pts.push(p)
  }
  return new THREE.CatmullRomCurve3(pts)
}
