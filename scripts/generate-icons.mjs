/**
 * Generates PNG icons from the SVG source.
 * Run: node scripts/generate-icons.mjs
 * Requires: npm install -D sharp
 */
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svgPath = join(__dirname, '../public/icons/icon.svg')
const svg = readFileSync(svgPath)

let sharp
try {
  sharp = (await import('sharp')).default
} catch {
  console.error('sharp not installed. Run: npm install -D sharp')
  process.exit(1)
}

const sizes = [192, 512]
for (const size of sizes) {
  const out = join(__dirname, `../public/icons/icon-${size}.png`)
  await sharp(svg).resize(size, size).png().toFile(out)
  console.log(`Generated icon-${size}.png`)
}
console.log('Done.')
