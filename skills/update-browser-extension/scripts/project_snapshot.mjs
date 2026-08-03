import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../../../', import.meta.url))

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8')
}

// 只输出理解项目所需的稳定事实，避免下一次 AI 先遍历 node_modules 和构建产物。
const [packageJson, manifest, background, content, app, adapterNames] = await Promise.all([
  read('package.json').then(JSON.parse),
  read('public/manifest.json').then(JSON.parse),
  read('public/background.js'),
  read('public/content.js'),
  read('src/App.vue'),
  readdir(path.join(root, 'public/content/adapters')),
])

const messagePattern = /type\s*(?:===|:)\s*['"]([A-Z][A-Z0-9_]+)['"]/g
const messages = [...`${background}\n${content}\n${app}`.matchAll(messagePattern)].map((match) => match[1])
const snapshot = {
  generatedAt: new Date().toISOString(),
  root,
  packageVersion: packageJson.version,
  manifestVersion: manifest.version,
  minimumChromeVersion: manifest.minimum_chrome_version || null,
  buildScripts: packageJson.scripts,
  permissions: manifest.permissions || [],
  hostPermissions: manifest.host_permissions || [],
  contentScripts: manifest.content_scripts?.[0]?.js || [],
  adapters: adapterNames.filter((name) => name.endsWith('.js')).sort(),
  runtimeMessages: [...new Set(messages)].sort(),
  prd: 'prd/AI简历浏览器扩展-PRD.md',
  skill: 'skills/update-browser-extension/SKILL.md',
}

process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`)
