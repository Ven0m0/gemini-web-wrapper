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
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 16px;
          box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.15);
          animation: slideUp 0.3s ease-out;
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
          gap: 12px;
          flex: 1;
        }

        .install-icon {
          font-size: 24px;
          background: rgba(255, 255, 255, 0.2);
          padding: 8px;
          border-radius: 8px;
        }

        .install-text h4 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }

        .install-text p {
          margin: 4px 0 0 0;
          font-size: 14px;
          opacity: 0.9;
        }

        .install-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .install-btn {
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .install-btn:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: translateY(-1px);
        }

        .dismiss-btn {
          background: transparent;
          border: none;
          color: white;
          font-size: 18px;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          opacity: 0.7;
          transition: opacity 0.2s ease;
        }

        .dismiss-btn:hover {
          opacity: 1;
        }

        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @media (max-width: 480px) {
          .install-banner {
            flex-direction: column;
            gap: 12px;
            text-align: center;
          }

          .install-content {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  )
}
