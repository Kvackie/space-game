// Per-stack download size from the Vite manifest: each page's JS and CSS,
// including shared chunks, raw and gzipped. Models are listed separately
// because every stack loads the same ones.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const dist = new URL('../dist/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')
const manifest = JSON.parse(readFileSync(join(dist, '.vite/manifest.json'), 'utf8'))

function collect(key, seen = new Set()) {
  if (seen.has(key)) return seen
  seen.add(key)
  const entry = manifest[key]
  for (const dep of entry.imports ?? []) collect(dep, seen)
  return seen
}

const kb = (n) => `${(n / 1024).toFixed(0)} KB`
const rows = []
for (const [key, entry] of Object.entries(manifest)) {
  if (!entry.isEntry || key === 'index.html') continue
  const files = new Set()
  for (const k of collect(key)) {
    files.add(manifest[k].file)
    for (const css of manifest[k].css ?? []) files.add(css)
  }
  let raw = 0
  let gz = 0
  for (const f of files) {
    const buf = readFileSync(join(dist, f))
    raw += buf.length
    gz += gzipSync(buf, { level: 9 }).length
  }
  rows.push({ page: key.replace('/index.html', ''), raw: kb(raw), gzip: kb(gz) })
}
console.table(rows)

const models = join(dist, 'models')
const modelBytes = readdirSync(models).reduce((n, f) => n + statSync(join(models, f)).size, 0)
console.log(`models (shared by all stacks): ${kb(modelBytes)}`)
