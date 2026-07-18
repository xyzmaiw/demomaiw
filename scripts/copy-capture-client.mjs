#!/usr/bin/env node
/**
 * Ensures public/capture-client.js is present in dist after build.
 * Vite already copies public/ assets; this is a safety net + source sync hook.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'public', 'capture-client.js')
const dest = join(root, 'dist', 'capture-client.js')

if (!existsSync(src)) {
  console.error('Missing public/capture-client.js')
  process.exit(1)
}

mkdirSync(dirname(dest), { recursive: true })
copyFileSync(src, dest)
console.log('Copied capture-client.js to dist/')
