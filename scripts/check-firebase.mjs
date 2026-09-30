import { existsSync } from 'node:fs'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, signInAnonymously, deleteUser } from 'firebase/auth'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')
const apiKey = process.env.VITE_FIREBASE_API_KEY
const databaseURL = process.env.VITE_FIREBASE_DATABASE_URL
if (!apiKey || !databaseURL) throw new Error('Configure .env.local before checking Firebase')
let failed = false
for (const path of ['gameState', 'leaderboard']) {
  try {
    const response = await fetch(`${databaseURL.replace(/\/$/, '')}/${path}.json?shallow=true`, { signal: AbortSignal.timeout(15000) })
    console.log(`${path}: HTTP ${response.status}${response.ok ? ' (readable)' : ' (check Database rules)'}`)
    failed ||= !response.ok
  } catch (e) { failed = true; console.log(`${path}: ${e.message}`) }
}
const app = initializeApp({ apiKey, authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: process.env.VITE_FIREBASE_PROJECT_ID })
try {
  const { user } = await signInAnonymously(getAuth(app))
  console.log('Anonymous Auth: enabled')
  await deleteUser(user)
  console.log('Temporary check account removed')
} catch (e) { failed = true; console.log(`Anonymous Auth: ${e.code || e.message}`) }
finally { await deleteApp(app) }
process.exitCode = failed ? 1 : 0
