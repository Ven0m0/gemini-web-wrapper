import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'

export const PythonRunner: React.FC = () => {
  const { setMode } = useStore()
  const [code, setCode] = useState<string>("print('Hello from Python!')\n")
  const [stdout, setStdout] = useState<string>('')
  const [stderr, setStderr] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [ready, setReady] = useState<boolean>(false)
  const [pkgInput, setPkgInput] = useState<string>('')
  const loadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const { loadPython } = await import('../services/python')
        await loadPython()
        if (!cancelled) setReady(true)
      } catch (e) {
        if (!cancelled) {
          setStderr(String(e instanceof Error ? e.message : e))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const run = async () => {
    try {
      setLoading(true)
      const { runPythonCode } = await import('../services/python')
      const res = await runPythonCode(code)
      setStdout(res.stdout || '')
      setStderr(res.stderr || '')
    } catch (e) {
      setStderr(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }

  const install = async () => {
    const list = pkgInput.split(/[,\s]+/).map(s => s.trim()).filter(Boolean)
    if (list.length === 0) return
    try {
      setLoading(true)
      const { installMicropipPackages } = await import('../services/python')
      const res = await installMicropipPackages(list)
      setStdout(prev => (prev ? prev + '\n' : '') + (res.stdout || ''))
      setStderr(prev => (prev ? prev + '\n' : '') + (res.stderr || ''))
    } catch (e) {
      setStderr(prev => (prev ? prev + '\n' : '') + String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }

  const clear = () => {
    setStdout('')
    setStderr('')
  }

  return (
    <div className="tool-container" style={{height: '100vh'}}>
      <div className="tool-header">
        <h2>🐍 Python Runner</h2>
        <div className="tool-mode-switch">
          <button onClick={run} disabled={!ready || loading}>{loading ? 'Running…' : 'Run'}</button>
          <button onClick={clear}>Clear Output</button>
          <button className="back-btn" onClick={() => setMode('cli')}>Back to CLI</button>
        </div>
      </div>
      <div className="tool-section" style={{display: 'flex', gap: '12px', alignItems: 'stretch'}}>
        <div style={{flex: 1, minHeight: 0}}>
          <h3>Code</h3>
          <div style={{display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8}}>
            <input
              value={pkgInput}
              onChange={(e) => setPkgInput(e.target.value)}
              placeholder="micropip packages (e.g., numpy requests)"
              style={{flex: 1, background: '#111', color: '#fff', border: '1px solid #333', borderRadius: 6, padding: 8}}
            />
            <button onClick={install} disabled={loading || !ready}>Install</button>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{width: '100%', height: '50vh', background: '#111', color: '#fff', border: '1px solid #333', borderRadius: 6, padding: 8, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'}}
            placeholder="# Write Python code here"
          />
          {!ready && (
            <div style={{marginTop: 8, fontSize: 12, color: '#ccc'}}>Loading Pyodide runtime… (Tip: run /preload python to warm caches)</div>
          )}
        </div>
        <div style={{flex: 1, minHeight: 0}}>
          <h3>Output</h3>
          <div style={{background: '#0c0c0c', border: '1px solid #333', borderRadius: 6, padding: 8, height: '50vh', overflow: 'auto'}}>
            {!!stdout && (
              <div>
                <div style={{color: '#7ee787', fontSize: 12}}>stdout:</div>
                <pre style={{whiteSpace: 'pre-wrap'}}>{stdout}</pre>
              </div>
            )}
            {!!stderr && (
              <div>
                <div style={{color: '#ff7b72', fontSize: 12}}>stderr:</div>
                <pre style={{whiteSpace: 'pre-wrap'}}>{stderr}</pre>
              </div>
            )}
            {!stdout && !stderr && (
              <div style={{color: '#888', fontSize: 12}}>No output yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
