import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

if (process.env.SKIP_BETTER_SQLITE3_REBUILD === '1') {
  console.log('[postinstall] Skipping better-sqlite3 rebuild because SKIP_BETTER_SQLITE3_REBUILD=1')
  process.exit(0)
}

if (process.env.SQLITE_DRIVER === 'node:sqlite') {
  console.log('[postinstall] Skipping better-sqlite3 rebuild because SQLITE_DRIVER=node:sqlite')
  process.exit(0)
}

try {
  require.resolve('better-sqlite3')
} catch {
  console.log('[postinstall] Skipping better-sqlite3 rebuild because optional dependency is absent')
  process.exit(0)
}

const command = process.platform === 'win32' ? 'electron-rebuild.cmd' : 'electron-rebuild'
const result = spawnSync(command, ['-f', '-w', 'better-sqlite3'], {
  stdio: 'inherit',
})

if (result.error) {
  console.error(`[postinstall] Failed to run electron-rebuild: ${result.error.message}`)
  process.exit(1)
}

process.exit(result.status ?? 1)
