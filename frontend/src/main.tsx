import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'

// iOS Safari specific fixes
if (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')) {
  // Prevent zoom on input focus
  const viewportMeta = document.querySelector('meta[name="viewport"]')
  if (viewportMeta) {
    viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no')
  }
  
  // Fix viewport height on iOS
  const setVH = () => {
    const vh = window.innerHeight * 0.01
    document.documentElement.style.setProperty('--vh', `${vh}px`)
  }
  
  setVH()
  window.addEventListener('resize', setVH)
  window.addEventListener('orientationchange', () => {
    setTimeout(setVH, 100) // Delay to ensure orientation change is complete
  })
  
  // Temporarily disable all touch prevention to test scrolling
  // TODO: Re-enable with proper logic once scrolling is confirmed working
  /*
  document.body.addEventListener('touchmove', (e) => {
    // Let all touch events through for now
  }, { passive: true })
  */
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)