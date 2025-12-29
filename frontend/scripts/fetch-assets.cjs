#!/usr/bin/env node
/*
  Fetches local vendor assets into public/vendor so the app can run offline:
  - Pyodide core + packages (via official tar.bz2 or CDN files)
  - Wasmer SDK ESM build

  Usage:
    # Prefer official archive (recommended)
    PYODIDE_VERSION=0.28.2 node scripts/fetch-assets.cjs pyodide-archive

    # Or set env flag (also used by 'all')
    PYODIDE_FETCH=archive PYODIDE_VERSION=0.28.2 node scripts/fetch-assets.cjs pyodide

    # Legacy CDN file-by-file fetch (smaller subset, no packages/)
    node scripts/fetch-assets.cjs pyodide

    # Other assets
    node scripts/fetch-assets.cjs wasmer
    node scripts/fetch-assets.cjs all
*/
const https = require('https')
const fs = require('fs')
const path = require('path')
const cp = require('child_process')

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

function hasCurl() {
  try {
    cp.execFileSync('curl', ['--version'], { stdio: 'ignore' })
    return true
  } catch { return false }
}

function downloadWithCurl(url, outPath) {
  ensureDir(path.dirname(outPath))
  const args = ['-L', '--fail', '--retry', '3', '--compressed']
  if (fs.existsSync(outPath)) args.push('--continue-at', '-')
  args.push('-o', outPath, url)
  try {
    console.log('curl', args.join(' '))
    cp.execFileSync('curl', args, { stdio: 'inherit' })
  } catch (e) {
    throw new Error(`curl download failed for ${url}: ${e.message}`)
  }
}

function downloadWithHttps(url, outPath) {
  return new Promise((resolve, reject) => {
    ensureDir(path.dirname(outPath))
    const file = fs.createWriteStream(outPath)
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        file.close(); try { fs.unlinkSync(outPath) } catch {}
        return reject(new Error(`GET ${url} -> ${res.statusCode}`))
      }
      res.pipe(file)
      file.on('finish', () => file.close(resolve))
    }).on('error', (err) => {
      try { file.close(); fs.unlinkSync(outPath) } catch {}
      reject(err)
    })
  })
}

async function download(url, outPath) {
  if (hasCurl()) {
    downloadWithCurl(url, outPath)
    return
  }
  await downloadWithHttps(url, outPath)
}

async function fetchPyodide(version = '0.28.2') {
  // Use official jsDelivr path for Pyodide (not npm)
  const bases = [
    `https://cdn.jsdelivr.net/pyodide/v${version}/full`,
    // legacy mirrors (best-effort fallbacks)
    `https://pyodide-cdn2.iodide.io/v${version}/full`
  ]
  const outBase = path.join('public', 'vendor', 'pyodide', version, 'full')
  const files = [
    'pyodide.js', 'pyodide.mjs', 'pyodide.asm.wasm',
    'python_stdlib.zip'
  ]
  const metaBases = [
    // Version root where metadata typically lives
    `https://cdn.jsdelivr.net/pyodide/v${version}`,
    `https://pyodide-cdn2.iodide.io/v${version}`,
    // Also try under /full in case of mirrors duplicating metadata there
    `https://cdn.jsdelivr.net/pyodide/v${version}/full`,
    `https://pyodide-cdn2.iodide.io/v${version}/full`
  ]
  // Place metadata alongside core files so indexURL (which points to /full) can resolve them by default
  const metaOutBase = path.join('public', 'vendor', 'pyodide', version, 'full')
  const metaFiles = ['repodata.json', 'pyodide-lock.json']
  for (const f of files) {
    const out = path.join(outBase, f)
    let ok = false
    for (const base of bases) {
      const url = `${base}/${f}`
      try {
        console.log('Downloading', url, '->', out)
        await download(url, out)
        ok = true
        break
      } catch (e) {
        console.warn('Failed:', url, e.message)
      }
    }
    if (!ok) console.warn(`Warning: Unable to fetch optional ${f} for Pyodide ${version}`)
  }
  // Fetch metadata files from version root
  for (const f of metaFiles) {
    const out = path.join(metaOutBase, f)
    let ok = false
    for (const base of metaBases) {
      const url = `${base}/${f}`
      try {
        console.log('Downloading', url, '->', out)
        await download(url, out)
        ok = true
        break
      } catch (e) {
        console.warn('Failed:', url, e.message)
      }
    }
    if (!ok) console.warn(`Warning: Unable to fetch optional ${f} for Pyodide ${version}`)
  }
  console.log(`Pyodide ${version} fetched to ${outBase}`)
}

async function fetchPyodideArchive(version = '0.28.2', variant = process.env.PYODIDE_VARIANT === 'core' ? 'core' : 'full') {
  // Download and extract the official release tarball which includes core files, metadata, and packages/
  // See: https://pyodide.org/en/stable/usage/downloading-and-deploying.html#serving-pyodide-packages
  const tag = version
  const file = variant === 'core' ? `pyodide-core-${version}.tar.bz2` : `pyodide-${version}.tar.bz2`
  const candidates = [
    // Common release URL patterns
    `https://github.com/pyodide/pyodide/releases/download/${tag}/${file}`,
    `https://github.com/pyodide/pyodide/releases/download/pyodide-${tag}/${file}`
  ]
  const outDir = path.join('public', 'vendor', 'pyodide', version, 'full')
  ensureDir(outDir)
  const archivePath = path.join(outDir, file)

  let downloaded = false
  for (const url of candidates) {
    try {
      console.log('Downloading', url, '->', archivePath)
      await download(url, archivePath)
      downloaded = true
      break
    } catch (e) {
      console.warn('Failed:', url, e.message)
    }
  }
  if (!downloaded) {
    throw new Error(`Unable to download Pyodide archive for ${version}`)
  }

  // Extract into outDir stripping the top-level folder in the archive
  // Requires system 'tar' with bzip2 support
  console.log(`Extracting (${variant})`, archivePath, 'to', outDir)
  try {
    cp.execFileSync('tar', ['-xjf', archivePath, '--strip-components=1', '-C', outDir], { stdio: 'inherit' })
  } catch (e) {
    throw new Error(`Extraction failed using system tar: ${e.message}`)
  } finally {
    // Keep archive for caching? Remove to save space
    try { fs.unlinkSync(archivePath) } catch {}
  }

  console.log(`Pyodide ${version} extracted to ${outDir}`)
}

async function fetchWasmerSDK() {
  // Try a stable ESM CDN path for the SDK
  const candidates = [
    'https://esm.sh/@wasmer/sdk',
    'https://cdn.jsdelivr.net/npm/@wasmer/sdk/+esm',
    'https://unpkg.com/@wasmer/sdk/dist/index.esm.js'
  ]
  const out = path.join('public', 'vendor', 'wasmer-sdk', 'index.esm.js')
  for (const url of candidates) {
    try {
      console.log('Downloading', url, '->', out)
      await download(url, out)
      console.log('Wasmer SDK fetched to', out)
      return
    } catch (e) {
      console.warn('Failed:', url, e.message)
    }
  }
  throw new Error('Unable to fetch @wasmer/sdk from known CDNs')
}

async function main() {
  const cmd = process.argv[2] || 'all'
  const useArchive = process.env.PYODIDE_FETCH === 'archive'
  if (cmd === 'pyodide-archive' || (cmd === 'all' && useArchive)) {
    await fetchPyodideArchive(process.env.PYODIDE_VERSION || '0.28.2')
  } else if (cmd === 'pyodide' || cmd === 'all') {
    await fetchPyodide(process.env.PYODIDE_VERSION || '0.28.2')
  }
  if (cmd === 'wasmer' || cmd === 'all') {
    await fetchWasmerSDK()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
