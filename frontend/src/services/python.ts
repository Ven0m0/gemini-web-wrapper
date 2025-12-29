// Lightweight Pyodide loader + runner with stdout/stderr capture.
// Uses CDN by default but will work offline after /preload python warmed the cache.

export interface PythonRunResult {
  stdout: string
  stderr: string
  result?: any
}

let pyodideReady: Promise<any> | null = null

async function injectScript(src: string): Promise<void> {
  if (document.querySelector(`script[data-pyodide-src="${src}"]`)) return
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.dataset.pyodideSrc = src
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(s)
  })
}

export async function loadPython(): Promise<any> {
  if (pyodideReady) return pyodideReady
  pyodideReady = (async () => {
    const preferredBase = (window as any).__PYODIDE_BASE
    const cdnBase = 'https://cdn.jsdelivr.net/pyodide/v0.28.2/full'
    let base = preferredBase || cdnBase
    if (!(window as any).loadPyodide) {
      try {
        await injectScript(`${base}/pyodide.js`)
      } catch (e) {
        if (preferredBase) {
          // Fallback to CDN if local vendor mirror is missing
          base = cdnBase
          await injectScript(`${base}/pyodide.js`)
        } else {
          throw e
        }
      }
    }
    const loadPyodideFn = (window as any).loadPyodide
    if (typeof loadPyodideFn !== 'function') {
      throw new Error('Pyodide loader not available after script load')
    }
    const pyodide = await loadPyodideFn({ indexURL: base })
    return pyodide
  })()
  return pyodideReady
}

// Internal: compat layer for Pyodide stdout/stderr APIs across versions
function setStdoutCompat(pyodide: any, cb: (s: string) => void) {
  // Try new API (>=0.26): setStdout({ batched })
  try {
    pyodide.setStdout({ batched: cb })
    return { mode: 'obj' as const, orig: undefined }
  } catch {
    // Fallback to legacy API used in our tests/mocks
    const orig = (pyodide as any).stdout_callback
    try { pyodide.setStdout(cb) } catch {}
    return { mode: 'fn' as const, orig }
  }
}

function setStderrCompat(pyodide: any, cb: (s: string) => void) {
  try {
    pyodide.setStderr({ batched: cb })
    return { mode: 'obj' as const, orig: undefined }
  } catch {
    const orig = (pyodide as any).stderr_callback
    try { pyodide.setStderr(cb) } catch {}
    return { mode: 'fn' as const, orig }
  }
}

function restoreStdoutCompat(pyodide: any, ctx: { mode: 'obj' | 'fn', orig: any }) {
  try {
    if (ctx.mode === 'obj') {
      // Reset to default
      pyodide.setStdout()
    } else {
      pyodide.setStdout(ctx.orig)
    }
  } catch {}
}

function restoreStderrCompat(pyodide: any, ctx: { mode: 'obj' | 'fn', orig: any }) {
  try {
    if (ctx.mode === 'obj') {
      pyodide.setStderr()
    } else {
      pyodide.setStderr(ctx.orig)
    }
  } catch {}
}

export async function runPythonCode(code: string): Promise<PythonRunResult> {
  const pyodide = await loadPython()
  let outBuf = ''
  let errBuf = ''
  const outCtx = setStdoutCompat(pyodide, (s: string) => { outBuf += s })
  const errCtx = setStderrCompat(pyodide, (s: string) => { errBuf += s })
  try {
    // runPython is sync; for long tasks you may switch to runPythonAsync
    const result = pyodide.runPython(code)
    return { stdout: outBuf, stderr: errBuf, result }
  } finally {
    // restore callbacks
    restoreStdoutCompat(pyodide, outCtx)
    restoreStderrCompat(pyodide, errCtx)
  }
}

export async function runPythonCodeAsync(code: string): Promise<PythonRunResult> {
  const pyodide = await loadPython()
  let outBuf = ''
  let errBuf = ''
  const outCtx = setStdoutCompat(pyodide, (s: string) => { outBuf += s })
  const errCtx = setStderrCompat(pyodide, (s: string) => { errBuf += s })
  try {
    const result = await pyodide.runPythonAsync(code)
    return { stdout: outBuf, stderr: errBuf, result }
  } finally {
    restoreStdoutCompat(pyodide, outCtx)
    restoreStderrCompat(pyodide, errCtx)
  }
}

export async function installMicropipPackages(packages: string[]): Promise<PythonRunResult> {
  const pyodide = await loadPython()
  // Ensure micropip is available
  try {
    // loadPackage uses pyodide CDN assets; SW CacheFirst + /preload python will make this offline
    await pyodide.loadPackage('micropip')
  } catch (e) {
    // continue; import may still work if bundled
  }
  const pkgsLit = JSON.stringify(packages)
  const code = `import asyncio\nimport micropip\nasync def _install():\n    pkgs = ${pkgsLit}\n    for p in pkgs:\n        await micropip.install(p)\nasyncio.get_event_loop().run_until_complete(_install())`
  return await runPythonCodeAsync(code)
}
