// Experimental: Compile C to WebAssembly in-browser using @wasmer/sdk and the LLVM/Clang package.
// This requires network access to fetch the package from Wasmer's registry at runtime.

export interface WasmerCompileResult {
  wasm: Uint8Array
  stdout: string
  stderr: string
}

export type WasmerProgress = (stage: string, message: string) => void

export async function compileCWithWasmer(
  source: string,
  filename = 'program.c',
  onProgress?: WasmerProgress
): Promise<WasmerCompileResult> {
  // Test hook: allow Playwright to inject a mock compiler to avoid network
  if (typeof window !== 'undefined' && (window as any).__mockCompileCWithWasmer) {
    const res = await (window as any).__mockCompileCWithWasmer(source, filename)
    return res as WasmerCompileResult
  }
  // Lazy-load the SDK to avoid increasing initial bundle size
  // Avoid bundler resolution by computing module specifier at runtime
  async function dynImport(spec: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      return await (new Function('m', 'return import(m)'))(spec)
    } catch {
      return null
    }
  }
  let sdk: any = null
  // Local-only SDK loading
  onProgress?.('sdk', 'Loading Wasmer SDK (local path only)...')
  if (typeof window !== 'undefined') {
    const override = (window as any).__WASMER_SDK_URL
    const localCandidates = [
      override,
      // Prefer GitHub Pages base path
      '/Chat_github/vendor/wasmer-sdk/index.esm.js',
      // Also support root deployment
      '/vendor/wasmer-sdk/index.esm.js',
      // Relative path for dev
      'vendor/wasmer-sdk/index.esm.js'
    ].filter(Boolean) as string[]
    for (const url of localCandidates) {
      sdk = await dynImport(url)
      if (sdk) break
    }
  }
  if (!sdk) {
    throw new Error('Wasmer SDK not available locally. Place SDK at /Chat_github/vendor/wasmer-sdk/index.esm.js (or set window.__WASMER_SDK_URL to a local path).')
  }
  // Resolve Wasmer API shape across different module formats/CDNs
  const api: any = (sdk && (sdk.Wasmer || sdk.default?.Wasmer || sdk.default || sdk))
  if (!api) {
    throw new Error('Wasmer SDK loaded but no usable API was found')
  }
  // Initialize SDK (per docs: Wasmer.initialize()) or older: init()
  if (typeof api.initialize === 'function') {
    onProgress?.('sdk', 'Initializing Wasmer SDK...')
    await api.initialize()
  } else if (typeof api.init === 'function') {
    onProgress?.('sdk', 'Initializing Wasmer SDK...')
    await api.init()
  }

  // Create a virtual filesystem and write source
  // Per docs: Wasmer.createFs() — try common variants
  const createFsCandidate = (api.createFs || api.createFS || api.FS?.create || api.fs?.create || (api.FS ? () => new api.FS() : undefined))
  if (typeof createFsCandidate !== 'function') {
    const keys = Object.keys(api).slice(0, 20).join(', ')
    throw new Error(`Wasmer SDK missing createFs(); available keys: [${keys}] — try setting window.__WASMER_SDK_URL to a compatible SDK (e.g., 'https://esm.sh/@wasmer/sdk') and re-run /cc.`)
  }
  onProgress?.('fs', 'Creating in-memory filesystem...')
  const fs = await createFsCandidate.call(api)
  await fs.writeFile(`/work/${filename}`, new TextEncoder().encode(source))

  // Choose a clang package (adjust via window.__WASMER_PKG if needed)
  const clangPkg = (typeof window !== 'undefined' && (window as any).__WASMER_PKG)
    ? (window as any).__WASMER_PKG
    : 'wasmer/clang:latest'

  // Compile to standalone wasm. For clang in Wasmer, --target=wasm32-wasi with no entry can be used,
  // but we default to exporting main; users may add their own flags later.
  const outName = filename.replace(/\.c$/i, '.wasm')
  const args = [
    `--target=wasm32-wasi`, `-O3`, `-Wl,--export-all`, `-Wl,--no-entry`,
    `-o`, `/work/${outName}`, `/work/${filename}`
  ]

  if (typeof api.runPackage !== 'function') {
    throw new Error('Wasmer SDK missing runPackage()')
  }
  onProgress?.('pkg', `Fetching package ${clangPkg}...`)
  onProgress?.('compile', 'Compiling to WebAssembly (wasm32-wasi, O3)...')
  const runPkg = (api.runPackage || api.packages?.run || api.run)
  if (typeof runPkg !== 'function') {
    const keys = Object.keys(api).slice(0, 20).join(', ')
    throw new Error(`Wasmer SDK missing runPackage(); available keys: [${keys}]`)
  }
  const result = await runPkg.call(api, clangPkg, {
    args,
    mount: { '/work': fs },
    env: {}
  })

  // Read outputs
  let stdout = ''
  let stderr = ''
  try { stdout = new TextDecoder().decode(await result.stdout?.bytes()) } catch {}
  try { stderr = new TextDecoder().decode(await result.stderr?.bytes()) } catch {}

  onProgress?.('result', 'Reading build outputs...')
  const wasm = await fs.readFile(`/work/${outName}`)
  if (!wasm || !(wasm instanceof Uint8Array)) {
    throw new Error(`Wasmer compile failed: output file missing. Stderr: ${stderr}`)
  }
  onProgress?.('done', 'Compilation complete')
  return { wasm, stdout, stderr }
}
