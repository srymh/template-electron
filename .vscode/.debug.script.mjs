// @ts-check
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

const pkg = createRequire(import.meta.url)('../package.json')
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

// write .debug.env
const envContent = Object.entries(pkg.debug?.env).map(
  ([key, val]) => `${key}=${val}`,
)
fs.writeFileSync(
  path.join(__dirname, '.debug.env'),
  envContent.join('\n') + '\n',
)

// bootstrap
const cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const shell = process.platform === 'win32'
const childEnv = {
  ...process.env,
  VSCODE_DEBUG: 'true',
}
spawn(cmd, ['run', 'dev'], {
  stdio: 'inherit',
  cwd: projectRoot,
  env: childEnv,
  shell,
})
