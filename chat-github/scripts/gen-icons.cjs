#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xEDB88320 & (-(c & 1)));
    }
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function hexToRgba(hex) {
  const h = hex.replace('#', '');
  const bigint = parseInt(h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r, g, b, 255];
}

function makePng(width, height, painter) {
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const raw = Buffer.alloc((stride + 1) * height); // +1 filter byte per row
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter type 0
    for (let x = 0; x < width; x++) {
      const i = rowStart + 1 + x * 4;
      const [r, g, b, a] = painter(x, y, width, height);
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a;
    }
  }
  const idat = zlib.deflateSync(raw);

  const sig = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = chunk('IHDR', ihdrData);
  const idatChunk = chunk('IDAT', idat);
  const iend = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idatChunk, iend]);
}

function drawIcon(size, opts = {}) {
  const bg = hexToRgba(opts.bg || '#0d1117');
  const primary = hexToRgba(opts.primary || '#0969da');
  const accent = hexToRgba(opts.accent || '#ffffff');
  return makePng(size, size, (x, y, w, h) => {
    // Background
    let px = bg;
    // Draw primary circle
    const cx = w / 2, cy = h / 2;
    const r1 = w * 0.38; // primary radius
    const dx = x - cx + 0.5, dy = y - cy + 0.5;
    const d2 = dx*dx + dy*dy;
    if (d2 <= r1*r1) px = primary;
    // Draw accent inner dot
    const r2 = w * 0.1;
    if (d2 <= r2*r2) px = accent;
    return px;
  });
}

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function writeIcon(file, size) {
  const buf = drawIcon(size);
  fs.writeFileSync(file, buf);
  console.log('wrote', file, size + 'x' + size);
}

const outDir = path.resolve(__dirname, '..', 'public');
ensureDir(outDir);

writeIcon(path.join(outDir, 'apple-touch-icon.png'), 180);
writeIcon(path.join(outDir, 'icon-192.png'), 192);
writeIcon(path.join(outDir, 'icon-512.png'), 512);
writeIcon(path.join(outDir, 'maskable-icon-512x512.png'), 512);

console.log('Done generating icons.');

