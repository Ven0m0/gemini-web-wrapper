import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../store'

export const WebShell: React.FC = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const { setMode, webShell } = useStore()

  const handleBack = useCallback(() => {
    setMode('cli')
  }, [setMode])

  const handleCopy = useCallback(async () => {
    if (!webShell.prepared) return
    try {
      await navigator.clipboard.writeText(webShell.prepared)
      alert('Commands copied. Paste into the shell.')
    } catch {
      // no-op
    }
  }, [webShell.prepared])

  useEffect(() => {
    if (!webShell.prepared || !iframeLoaded || !iframeRef.current) return
    const target = iframeRef.current.contentWindow
    if (!target) return
    try {
      // Attempt to pass the prepared commands directly into the iframe.
      // webassembly.sh may or may not handle this message; we specify the
      // exact origin so browsers will only deliver to the correct frame.
      // If the frame doesn't accept the message the user can still use
      // the "Copy Commands" button below.
      target.postMessage(
        { type: 'run', commands: webShell.prepared },
        'https://webassembly.sh',
      )
    } catch {
      // Cross-origin send failed silently – manual copy fallback remains.
    }
  }, [iframeLoaded, webShell.prepared])

  return (
    <div className="tool-container" style={{height: '100vh'}}>
      <div className="tool-header">
        <h2>🧪 Wasmer Web Shell</h2>
        <div className="tool-mode-switch">
          <button onClick={() => window.open('https://webassembly.sh/', '_blank', 'noopener,noreferrer')}>Open in New Tab</button>
          <button onClick={handleCopy}>Copy Commands</button>
          <button className="back-btn" onClick={handleBack}>Back to CLI</button>
        </div>
      </div>
      <div style={{flex: 1, borderTop: '1px solid #333'}}>
        <iframe
          ref={iframeRef}
          title="webassembly.sh"
          src="https://webassembly.sh/"
          onLoad={() => setIframeLoaded(true)}
          style={{ width: '100%', height: '100%', border: 'none' }}
          sandbox="allow-scripts allow-same-origin allow-popups allow-downloads"
        />
      </div>
      {webShell.prepared && (
        <div style={{padding: '0.5rem', background: '#111', borderTop: '1px solid #333'}}>
          <div style={{fontSize: 12, color: '#ccc', marginBottom: 4}}>Prepared commands (tap to copy):</div>
          <pre onClick={handleCopy} style={{whiteSpace: 'pre-wrap', overflow: 'auto', fontSize: 12}}>{webShell.prepared}</pre>
        </div>
      )}
    </div>
  )
}
