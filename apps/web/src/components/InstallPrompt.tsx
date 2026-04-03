import React, { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

export const InstallPrompt: React.FC = () => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    // Detect if app is already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    setIsInstalled(isStandalone)

    // Listen for beforeinstallprompt event (Chrome, Edge, Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (installPrompt) {
      installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice

      if (outcome === 'accepted') {
        setInstallPrompt(null)
        setShowPrompt(false)
      }
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    // Don't show again for this session
    sessionStorage.setItem('installPromptDismissed', 'true')
  }

  // Don't show if already installed or dismissed
  if (isInstalled || !showPrompt || sessionStorage.getItem('installPromptDismissed')) {
    return null
  }

  return (
    <div className="install-prompt">
      <div className="install-banner">
        <div className="install-content">
          <div className="install-icon">📱</div>
          <div className="install-text">
            <h4>Install GitHub Editor</h4>
            <p>Install this app for a better experience</p>
          </div>
        </div>
        <div className="install-actions">
          {installPrompt && (
            <button onClick={handleInstallClick} className="install-btn">
              Install
            </button>
          )}
          <button onClick={handleDismiss} className="dismiss-btn">
            ✕
          </button>
        </div>
      </div>

      <style>{`
        .install-prompt {
          position: fixed;
          bottom: var(--status-bar-height);
          left: var(--activity-bar-width);
          right: 0;
          z-index: 900;
          background: var(--color-bg-elevated);
          border-top: 1px solid var(--color-border);
          color: var(--color-text);
          padding: 8px 16px;
          animation: slideUp 150ms ease;
        }

        .install-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: 600px;
          margin: 0 auto;
        }

        .install-content {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
        }

        .install-icon {
          font-size: 16px;
        }

        .install-text h4 {
          margin: 0;
          font-size: 12px;
          font-weight: 500;
          color: var(--color-text);
          font-family: var(--font-family-mono);
        }

        .install-text p {
          margin: 0;
          font-size: 11px;
          color: var(--color-text-muted);
          font-family: var(--font-family-mono);
        }

        .install-actions {
          display: flex;
          gap: 6px;
          align-items: center;
        }

        .install-btn {
          background: var(--color-primary);
          border: 1px solid var(--color-primary);
          color: #fff;
          padding: 3px 10px;
          border-radius: 3px;
          font-size: 11px;
          font-family: var(--font-family-mono);
          cursor: pointer;
          transition: all 100ms ease;
        }

        .install-btn:hover {
          background: var(--color-primary-hover);
        }

        .dismiss-btn {
          background: transparent;
          border: 1px solid transparent;
          color: var(--color-text-subtle);
          font-size: 14px;
          padding: 2px 6px;
          border-radius: 3px;
          cursor: pointer;
          transition: all 100ms ease;
        }

        .dismiss-btn:hover {
          border-color: var(--color-border);
          color: var(--color-text-muted);
        }

        @keyframes slideUp {
          from { transform: translateY(8px); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }

        @media (max-width: 480px) {
          .install-prompt { left: 0; }
          .install-banner { flex-direction: column; gap: 8px; }
        }
      `}</style>
    </div>
  )
}
