/**
 * Generates simple solid-color PNG icons using only Node built-ins.
 * Run once: node scripts/make-placeholder-icons.mjs
 * For production icons, use scripts/generate-icons.mjs (requires sharp).
 */
import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function u32be(n) {
  const b = Buffer.alloc(4)
  b.writeUInt32BE(n, 0)
  return b
}

function crc32(buf) {
  let crc = 0xffffffff
  for (const byte of buf) {
    crc ^= byte
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const len = u32be(data.length)
  const crcInput = Buffer.concat([typeBytes, data])
  const crcBytes = u32be(crc32(crcInput))
  return Buffer.concat([len, typeBytes, data, crcBytes])
}

function makePNG(size, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // color type: RGB
  // compression, filter, interlace = 0

  // Build raw scanlines: each row = 0x00 (filter byte) + RGB * size
  const row = Buffer.alloc(1 + size * 3)
  row[0] = 0
  for (let x = 0; x < size; x++) {
    row[1 + x * 3] = r
    row[2 + x * 3] = g
    row[3 + x * 3] = b
  }
  const raw = Buffer.concat(Array(size).fill(row))
  const compressed = deflateSync(raw)

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ])
}

const outDir = join(__dirname, '../public/icons')
mkdirSync(outDir, { recursive: true })

// Indigo-500 ≈ #6366f1 = rgb(99, 102, 241)
for (const size of [192, 512]) {
  const png = makePNG(size, 99, 102, 241)
  writeFileSync(join(outDir, `icon-${size}.png`), png)
  console.log(`Created icon-${size}.png (${size}×${size} indigo solid)`)
}
console.log('Done. For branded icons run: npm install -D sharp && node scripts/generate-icons.mjs')
