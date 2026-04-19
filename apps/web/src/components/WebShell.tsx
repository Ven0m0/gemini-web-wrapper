import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../store';

// ---------------------------------------------------------------------------
// URL validation
// Accepts HTTPS git URLs and SSH git URLs.  Uses a strict character allowlist
// so that the generated clone command is safe to display and copy without
// quoting.
// ---------------------------------------------------------------------------

/** Characters that are safe in a bare (unquoted) HTTPS git URL on the command line.
 *  Note: `@` is intentionally excluded to prevent host-confusion attacks
 *  (e.g. https://attacker.com@victim.com/repo).  Token injection uses a
 *  separate, explicitly validated code path in buildCloneCommand.
 */
const SAFE_HTTPS_URL = /^https?:\/\/[a-zA-Z0-9/:._\-~%+=?#]+$/;

/** Characters that are safe in an SSH-shorthand git URL: git@host:owner/repo[.git] */
const SAFE_SSH_URL = /^git@[a-zA-Z0-9._-]+:[a-zA-Z0-9._/-]+$/;

function isValidGitUrl(url: string): boolean {
  if (!url) return false;
  return SAFE_HTTPS_URL.test(url) || SAFE_SSH_URL.test(url);
}

/** Build the clone command string. */
function buildCloneCommand(url: string, useToken: boolean, token: string): string {
  if (useToken && token && url.startsWith('https://github.com/')) {
    // Inject token as Basic-auth credential so git doesn't prompt.
    // The token is percent-encoded to handle any special characters safely.
    // NOTE: The token will be visible in the shell; the user has opted in.
    const withCreds = url.replace('https://github.com/', `https://oauth2:${encodeURIComponent(token)}@github.com/`);
    return `git clone ${withCreds}`;
  }
  return `git clone ${url}`;
}

// ---------------------------------------------------------------------------
// GitClonePanel
// ---------------------------------------------------------------------------
interface GitClonePanelProps {
  githubToken: string;
  onPrepare: (cmd: string) => void;
}

const GitClonePanel: React.FC<GitClonePanelProps> = ({ githubToken, onPrepare }) => {
  const [url, setUrl] = useState('');
  const [useToken, setUseToken] = useState(false);
  const [error, setError] = useState('');

  const isGitHubHttps = url.startsWith('https://github.com/');
  const canUseToken = Boolean(githubToken) && isGitHubHttps;

  const handlePrepare = () => {
    const trimmed = url.trim();
    if (!isValidGitUrl(trimmed)) {
      setError('Invalid git URL. Use HTTPS (https://…) or SSH (git@host:…) format.');
      return;
    }
    setError('');
    onPrepare(buildCloneCommand(trimmed, useToken, githubToken));
  };

  return (
    <div
      style={{
        padding: '8px 12px',
        background: 'var(--color-bg-surface, #1e1e1e)',
        borderBottom: '1px solid var(--color-border, #333)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted, #aaa)' }}>Git Clone Helper</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handlePrepare();
          }}
          placeholder="https://github.com/owner/repo  or  git@github.com:owner/repo.git"
          style={{
            flex: 1,
            background: 'var(--color-bg, #121212)',
            border: '1px solid var(--color-border, #333)',
            borderRadius: 3,
            color: 'var(--color-text, #ddd)',
            fontSize: 12,
            fontFamily: 'var(--font-family-mono, monospace)',
            padding: '4px 8px',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={handlePrepare}
          style={{
            padding: '4px 10px',
            fontSize: 12,
            background: 'var(--color-accent, #007acc)',
            border: 'none',
            borderRadius: 3,
            color: '#fff',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Prepare Clone
        </button>
      </div>

      {canUseToken && (
        <label
          style={{
            fontSize: 11,
            color: 'var(--color-text-muted, #aaa)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <input type="checkbox" checked={useToken} onChange={(e) => setUseToken(e.target.checked)} />
          Include GitHub token (token will be visible in the command)
        </label>
      )}

      {error && <div style={{ fontSize: 11, color: 'var(--color-error, #d14d41)' }}>{error}</div>}
    </div>
  );
};

// ---------------------------------------------------------------------------
// WebShell
// ---------------------------------------------------------------------------
export const WebShell: React.FC = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const { webShell, setWebShell, config } = useStore();

  const handleCopy = useCallback(async () => {
    if (!webShell.prepared) return;
    try {
      await navigator.clipboard.writeText(webShell.prepared);
      alert('Commands copied. Paste into the shell.');
    } catch {
      // no-op
    }
  }, [webShell.prepared]);

  useEffect(() => {
    if (!webShell.prepared || !iframeLoaded || !iframeRef.current) return;
    const target = iframeRef.current.contentWindow;
    if (!target) return;
    try {
      // Attempt to pass the prepared commands directly into the iframe.
      // webassembly.sh may or may not handle this message; we specify the
      // exact origin so browsers will only deliver to the correct frame.
      // If the frame doesn't accept the message the user can still use
      // the "Copy Commands" button below.
      target.postMessage({ type: 'run', commands: webShell.prepared }, 'https://webassembly.sh');
    } catch {
      // Cross-origin send failed silently – manual copy fallback remains.
    }
  }, [iframeLoaded, webShell.prepared]);

  return (
    <div className="tool-container" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="tool-header">
        <h2>Test Wasmer Web Shell</h2>
        <div className="tool-mode-switch">
          <button onClick={() => window.open('https://webassembly.sh/', '_blank', 'noopener,noreferrer')}>
            Open in New Tab
          </button>
          <button onClick={handleCopy}>Copy Commands</button>
        </div>
      </div>

      {/* Git clone helper */}
      <GitClonePanel githubToken={config.githubToken} onPrepare={(cmd) => setWebShell({ prepared: cmd })} />

      <div style={{ flex: 1, borderTop: '1px solid #333', overflow: 'hidden' }}>
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
        <div style={{ padding: '0.5rem', background: '#111', borderTop: '1px solid #333' }}>
          <div style={{ fontSize: 12, color: '#ccc', marginBottom: 4 }}>Prepared commands (tap to copy):</div>
          <pre
            onClick={handleCopy}
            style={{ whiteSpace: 'pre-wrap', overflow: 'auto', fontSize: 12, cursor: 'pointer' }}
          >
            {webShell.prepared}
          </pre>
        </div>
      )}
    </div>
  );
};
