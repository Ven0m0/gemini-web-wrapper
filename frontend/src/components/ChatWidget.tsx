import React, { useState, useEffect } from 'react'
import { ChatWindow } from './ChatWindow'
import { useStore } from '../store'

interface ChatWidgetProps {
  // Position and layout
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  offset?: { x: number; y: number }
  
  // Branding
  companyName?: string
  companyLogo?: string
  agentName?: string
  agentAvatar?: string
  welcomeMessage?: string
  
  // Styling
  theme?: 'light' | 'dark' | 'auto'
  primaryColor?: string
  backgroundColor?: string
  textColor?: string
  borderRadius?: number
  fontSize?: 'small' | 'medium' | 'large'
  
  // Features
  showAvatar?: boolean
  showTimestamp?: boolean
  allowAttachments?: boolean
  soundEnabled?: boolean
  notificationsEnabled?: boolean
  
  // Behavior
  autoOpen?: boolean
  minimizeOnOutsideClick?: boolean
  persistentChat?: boolean
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({
  position = 'bottom-right',
  offset = { x: 20, y: 20 },
  companyName = 'AI Assistant',
  companyLogo,
  agentName = 'AI Assistant',
  agentAvatar = '🤖',
  welcomeMessage = "Hi! I'm here to help. What can I do for you today?",
  theme = 'auto',
  primaryColor = '#007acc',
  backgroundColor,
  textColor,
  borderRadius = 12,
  fontSize = 'medium',
  showAvatar = true,
  showTimestamp = true,
  allowAttachments = true,
  soundEnabled = true,
  notificationsEnabled = true,
  autoOpen = false,
  minimizeOnOutsideClick = true,
  persistentChat = true
}) => {
  const [isOpen, setIsOpen] = useState(autoOpen)
  const [hasInteracted, setHasInteracted] = useState(false)
  const { config } = useStore()

  // Request notification permission
  useEffect(() => {
    if (notificationsEnabled && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [notificationsEnabled])

  // Auto-open after delay if user hasn't interacted
  useEffect(() => {
    if (!autoOpen || hasInteracted) return

    const timer = setTimeout(() => {
      setIsOpen(true)
    }, 3000)

    return () => clearTimeout(timer)
  }, [autoOpen, hasInteracted])

  // Handle outside clicks
  useEffect(() => {
    if (!minimizeOnOutsideClick || !isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.chat-widget-container')) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [minimizeOnOutsideClick, isOpen])

  const handleOpen = () => {
    setIsOpen(true)
    setHasInteracted(true)
  }

  const handleClose = () => {
    setIsOpen(false)
  }

  const getPositionStyles = () => {
    const positions = {
      'bottom-right': { bottom: offset.y, right: offset.x },
      'bottom-left': { bottom: offset.y, left: offset.x },
      'top-right': { top: offset.y, right: offset.x },
      'top-left': { top: offset.y, left: offset.x }
    }
    return positions[position]
  }

  const getThemeStyles = () => {
    if (theme === 'auto') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      return {
        background: backgroundColor || (isDark ? '#1a1a1a' : '#ffffff'),
        text: textColor || (isDark ? '#ffffff' : '#000000'),
        border: isDark ? '#333333' : '#e0e0e0'
      }
    }
    return {
      background: backgroundColor || (theme === 'dark' ? '#1a1a1a' : '#ffffff'),
      text: textColor || (theme === 'dark' ? '#ffffff' : '#000000'),
      border: theme === 'dark' ? '#333333' : '#e0e0e0'
    }
  }

  const themeStyles = getThemeStyles()

  return (
    <div className="chat-widget-container">
      <ChatWindow
        isOpen={isOpen}
        onClose={handleClose}
        position={position}
        theme={theme}
        showAvatar={showAvatar}
        showTimestamp={showTimestamp}
        allowAttachments={allowAttachments}
        customGreeting={welcomeMessage}
        agentName={agentName}
        agentAvatar={agentAvatar}
        companyLogo={companyLogo}
        primaryColor={primaryColor}
        backgroundColor={themeStyles.background}
        textColor={themeStyles.text}
        borderRadius={borderRadius}
        fontSize={fontSize}
        soundEnabled={soundEnabled}
        notificationsEnabled={notificationsEnabled}
      />
    </div>
  )
}

// Default export for easy import
export default ChatWidget