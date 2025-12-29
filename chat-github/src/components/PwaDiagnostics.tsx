import React, { useEffect, useMemo, useState } from 'react'

type SwInfo = {
  supported: boolean
  scope?: string
  controller?: boolean
  state?: string
  error?: string
}

type ManifestInfo = {
  href?: string
  ok: boolean
  status?: number
  textSnippet?: string
}

type CacheInfo = {
  names: string[]
}

export const PwaDiagnostics: React.FC = () => {
  const [open, setOpen] = useState(false)
  const [displayMode, setDisplayMode] = useState<'standalone' | 'browser'>('browser')
  const [manifest, setManifest] = useState<ManifestInfo>({ ok: false })
  const [sw, setSw] = useState<SwInfo>({ supported: 'serviceWorker' in navigator })
  const [cachesInfo, setCachesInfo] = useState<CacheInfo>({ names: [] })
  const [checking, setChecking] = useState(false)

  const manifestUrl = useMemo(() => {
    const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null
    return link?.href
  }, [])

  const refresh = async () => {
    setChecking(true)
    try {
      // Display-mode
      const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (navigator as any).standalone === true
      setDisplayMode(standalone ? 'standalone' : 'browser')

      // Manifest
      let m: ManifestInfo = { ok: false }
      if (manifestUrl) {
        try {
          const res = await fetch(manifestUrl, { cache: 'no-store' })
          const text = await res.text()
          m = {
            href: manifestUrl,
            ok: res.ok,
            status: res.status,
            textSnippet: text.slice(0, 200)
          }
        } catch (e) {
          m = { href: manifestUrl, ok: false }
        }
      }
      setManifest(m)

      // SW
      const swInfo: SwInfo = { supported: 'serviceWorker' in navigator }
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration()
          if (reg) {
            swInfo.scope = reg.scope
            swInfo.controller = !!navigator.serviceWorker.controller
            swInfo.state = reg.installing?.state || reg.waiting?.state || reg.active?.state || 'active'
          } else {
            // still wait for ready in case it's pending
            try {
              const ready = await navigator.serviceWorker.ready
              swInfo.scope = ready.scope
              swInfo.controller = !!navigator.serviceWorker.controller
              swInfo.state = 'active'
            } catch (e) {
              swInfo.error = String(e)
            }
          }
        } catch (e) {
          swInfo.error = String(e)
        }
      }
      setSw(swInfo)

      // Caches
      try {
        // @ts-ignore
        if (window.caches && caches?.keys) {
          const names = await caches.keys()
          setCachesInfo({ names })
        }
      } catch {
        setCachesInfo({ names: [] })
      }
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const copy = async () => {
    const payload = {
      url: location.href,
      displayMode,
      manifest,
      sw,
      caches: cachesInfo
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      alert('PWA diagnostics copied to clipboard')
    } catch {
      alert('Copy failed')
    }
  }

  return (
    <div className="pwa-diag-root">
      <button
        className="pwa-diag-fab"
        aria-label="PWA diagnostics"
        onClick={() => setOpen(v => !v)}
        title="PWA diagnostics"
      >
        PWA
      </button>

      {open && (
        <div className="pwa-diag-panel">
          <div className="pwa-diag-header">
            <strong>PWA Diagnostics</strong>
            <div className="spacer" />
            <button className="pwa-diag-btn" onClick={refresh} disabled={checking}>{checking ? '…' : 'Refresh'}</button>
            <button className="pwa-diag-btn" onClick={copy}>Copy</button>
            <button className="pwa-diag-btn" onClick={() => setOpen(false)}>Close</button>
          </div>
          <div className="pwa-diag-body">
            <div><b>URL:</b> {location.href}</div>
            <div><b>Display Mode:</b> {displayMode}</div>
            <div><b>Manifest:</b> {manifest.href || 'N/A'} {manifest.ok ? '✅' : '❌'} {manifest.status ? `(status ${manifest.status})` : ''}</div>
            {manifest.textSnippet && (
              <pre className="pwa-diag-pre">{manifest.textSnippet}</pre>
            )}
            <div><b>Service Worker:</b> {sw.supported ? 'supported' : 'not supported'} {sw.scope ? `scope=${sw.scope}` : ''} {sw.state ? `state=${sw.state}` : ''} {sw.controller ? '(controlled)' : ''} {sw.error ? `error=${sw.error}` : ''}</div>
            <div><b>Caches:</b> {cachesInfo.names.length > 0 ? cachesInfo.names.join(', ') : '(none)'}</div>
          </div>
        </div>
      )}

      <style>{`
        .pwa-diag-root{position:fixed;left:12px;bottom:12px;z-index:1200}
        .pwa-diag-fab{background:#0ea5e9;color:#fff;border:none;border-radius:20px;padding:6px 10px;font-size:12px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.25)}
        .pwa-diag-panel{position:fixed;left:12px;bottom:52px;right:12px;max-width:520px;background:#0d1117;color:#f0f6fc;border:1px solid #30363d;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.4)}
        .pwa-diag-header{display:flex;align-items:center;gap:8px;padding:10px;border-bottom:1px solid #30363d;background:#161b22}
        .spacer{flex:1}
        .pwa-diag-btn{background:#21262d;color:#f0f6fc;border:1px solid #30363d;border-radius:6px;padding:4px 8px;font-size:12px;cursor:pointer}
        .pwa-diag-btn:disabled{opacity:.5;cursor:not-allowed}
        .pwa-diag-body{padding:10px;max-height:50vh;overflow:auto}
        .pwa-diag-pre{white-space:pre-wrap;background:#0b1220;border:1px solid #1f2a44;border-radius:6px;padding:6px;margin-top:6px;max-height:160px;overflow:auto}
        @media (max-width: 480px){.pwa-diag-panel{left:8px;right:8px}}
      `}</style>
    </div>
  )
}

