import { useEffect, useState } from 'react'
import { useStore } from './store'
import { CLI } from './components/CLI'
import { Editor } from './components/Editor'
import { Tool } from './components/Tool'
import { ConfigOverlay } from './components/ConfigOverlay'
import { InstallPrompt } from './components/InstallPrompt'
import { WebShell } from './components/WebShell'
import { PythonRunner } from './components/PythonRunner'
import { PwaDiagnostics } from './components/PwaDiagnostics'
import { ChatWidget } from './components/ChatWidget'
import { ChatDemo } from './components/ChatDemo'
import './App.css'

function App() {
  const { mode, setConfig } = useStore()
  const [showChatDemo, setShowChatDemo] = useState(false)

  useEffect(() => {
    // Set dark theme by default
    document.documentElement.setAttribute('data-theme', 'dark')
    
    const savedConfig = localStorage.getItem('chat-github-config')
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig)
        setConfig(parsedConfig)
      } catch (error) {
        console.error('Failed to load saved config:', error)
      }
    }
  }, [setConfig])

  const renderCurrentMode = () => {
    switch (mode) {
      case 'cli':
        return <CLI />
      case 'editor':
        return <Editor />
      case 'tool':
        return <Tool />
      case 'wsh' as any:
        return <WebShell />
      case 'python' as any:
        return <PythonRunner />
      case 'chat-demo' as any:
        return <ChatDemo />
      default:
        return <CLI />
    }
  }

  return (
    <div className="app">
      {renderCurrentMode()}
      <ConfigOverlay />
      <InstallPrompt />
      <PwaDiagnostics />
      
      {/* Global Chat Widget - can be toggled on/off */}
      <ChatWidget
        position="bottom-right"
        theme="auto"
        primaryColor="#0969da"
        borderRadius={12}
        fontSize="medium"
        showAvatar={true}
        showTimestamp={true}
        allowAttachments={true}
        soundEnabled={true}
        notificationsEnabled={true}
        autoOpen={false}
        agentName="AI Assistant"
        agentAvatar="🤖"
        customGreeting="Hello! I'm your AI assistant. How can I help you today?"
        companyName="AI Assistant"
        welcomeMessage="Hi! I'm here to help with your development tasks, GitHub integration, and AI-powered code assistance."
        minimizeOnOutsideClick={true}
        persistentChat={true}
      />
    </div>
  )
}

export default App
