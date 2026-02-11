import React, { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { GitHubService } from '../services/github'
import { AIService } from '../services/ai'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  attachments?: string[]
}

interface ChatWindowProps {
  isOpen: boolean
  onClose: () => void
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  theme?: 'light' | 'dark' | 'auto'
  showAvatar?: boolean
  showTimestamp?: boolean
  allowAttachments?: boolean
  customGreeting?: string
  agentName?: string
  agentAvatar?: string
  companyLogo?: string
  primaryColor?: string
  backgroundColor?: string
  textColor?: string
  borderRadius?: number
  fontSize?: 'small' | 'medium' | 'large'
  soundEnabled?: boolean
  notificationsEnabled?: boolean
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  isOpen,
  onClose,
  position = 'bottom-right',
  theme = 'auto',
  showAvatar = true,
  showTimestamp = true,
  allowAttachments = true,
  customGreeting = "Hello! How can I help you today?",
  agentName = "AI Assistant",
  agentAvatar = "🤖",
  companyLogo,
  primaryColor = "#007acc",
  backgroundColor,
  textColor,
  borderRadius = 8,
  fontSize = "medium",
  soundEnabled = true,
  notificationsEnabled = true
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const { config } = useStore()

  // Auto-detect theme based on system preference
  const effectiveTheme = theme === 'auto' 
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme

  // Initialize with greeting message
  useEffect(() => {
    if (messages.length === 0 && isOpen) {
      const greetingMessage: ChatMessage = {
        id: `greeting-${Date.now()}`,
        role: 'assistant',
        content: customGreeting,
        timestamp: Date.now()
      }
      setMessages([greetingMessage])
    }
  }, [isOpen, customGreeting])

  // Handle new messages and notifications
  useEffect(() => {
    if (messages.length > 0 && !isOpen) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.role === 'assistant') {
        setUnreadCount(prev => prev + 1)
        if (notificationsEnabled) {
          showNotification(lastMessage.content)
        }
        if (soundEnabled) {
          playNotificationSound()
        }
      }
    }
  }, [messages, isOpen, notificationsEnabled, soundEnabled])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const showNotification = (message: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`${agentName}`, {
        body: message,
        icon: agentAvatar,
        badge: agentAvatar
      })
    }
  }

  const playNotificationSound = () => {
    // Create a simple notification sound
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
    
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.3)
  }

  const handleSendMessage = async () => {
    if (!input.trim()) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsTyping(true)

    try {
      const aiService = new AIService(
        config.openaiKey || '',
        config.model || 'gpt-4o-mini',
        config.temperature || 0.3
      )

      const response = await aiService.transformFile(
        input.trim(),
        'Please respond to this message conversationally.'
      )

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      const fileMessage: ChatMessage = {
        id: `file-${Date.now()}`,
        role: 'user',
        content: `📎 Uploaded file: ${file.name}`,
        timestamp: Date.now(),
        attachments: [content]
      }
      setMessages(prev => [...prev, fileMessage])
    }
    reader.readAsDataURL(file)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const getPositionStyles = () => {
    const positions = {
      'bottom-right': { bottom: '20px', right: '20px' },
      'bottom-left': { bottom: '20px', left: '20px' },
      'top-right': { top: '20px', right: '20px' },
      'top-left': { top: '20px', left: '20px' }
    }
    return positions[position]
  }

  const getThemeStyles = () => {
    if (effectiveTheme === 'dark') {
      return {
        background: backgroundColor || '#1a1a1a',
        text: textColor || '#ffffff',
        border: '#333333',
        inputBg: '#2a2a2a',
        hoverBg: '#3a3a3a'
      }
    }
    return {
      background: backgroundColor || '#ffffff',
      text: textColor || '#000000',
      border: '#e0e0e0',
      inputBg: '#f5f5f5',
      hoverBg: '#eeeeee'
    }
  }

  const themeStyles = getThemeStyles()
  const fontSizeClass = fontSize === 'small' ? 'text-sm' : fontSize === 'large' ? 'text-lg' : 'text-base'

  if (!isOpen && !isMinimized) return null

  return (
    <>
      {/* Floating button when minimized */}
      {!isOpen && (
        <div 
          className="fixed z-50 cursor-pointer transition-all duration-300 hover:scale-110"
          style={{
            ...getPositionStyles(),
            bottom: isMinimized ? '20px' : undefined
          }}
          onClick={() => setIsMinimized(false)}
        >
          <div 
            className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
            style={{ 
              backgroundColor: primaryColor,
              borderRadius: `${borderRadius}px`
            }}
          >
            <span className="text-white text-xl">{agentAvatar}</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main chat window */}
      {isOpen && (
        <div 
          className="fixed z-50 w-80 h-96 rounded-lg shadow-2xl flex flex-col transition-all duration-300"
          style={{
            ...getPositionStyles(),
            backgroundColor: themeStyles.background,
            border: `1px solid ${themeStyles.border}`,
            borderRadius: `${borderRadius}px`
          }}
        >
          {/* Header */}
          <div 
            className="flex items-center justify-between p-3 cursor-pointer"
            style={{ 
              backgroundColor: primaryColor,
              borderTopLeftRadius: `${borderRadius}px`,
              borderTopRightRadius: `${borderRadius}px`
            }}
            onClick={() => setIsMinimized(!isMinimized)}
          >
            <div className="flex items-center space-x-2">
              {showAvatar && (
                <div className="w-8 h-8 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
                  <span className="text-white">{agentAvatar}</span>
                </div>
              )}
              <div>
                <h3 className="text-white font-semibold text-sm">{agentName}</h3>
                <p className="text-white text-opacity-80 text-xs">
                  {isTyping ? 'Typing...' : 'Online'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={(e) => {
                  e.stopPropagation()
                  setIsMinimized(true)
                }}
                className="text-white hover:text-opacity-80"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation()
                  onClose()
                }}
                className="text-white hover:text-opacity-80"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${fontSizeClass}`}
                  style={{
                    backgroundColor: message.role === 'user' ? primaryColor : themeStyles.inputBg,
                    color: message.role === 'user' ? '#ffffff' : themeStyles.text,
                    borderRadius: `${borderRadius}px`
                  }}
                >
                  <div className="flex items-start space-x-2">
                    {showAvatar && message.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-full bg-white bg-opacity-20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs">{agentAvatar}</span>
                      </div>
                    )}
                    <div className="flex-1">
                      <p style={{ color: message.role === 'user' ? '#ffffff' : themeStyles.text }}>
                        {message.content}
                      </p>
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {message.attachments.map((attachment, index) => (
                            <div key={index} className="text-xs opacity-75">
                              📎 Attachment {index + 1}
                            </div>
                          ))}
                        </div>
                      )}
                      {showTimestamp && (
                        <p className="text-xs opacity-60 mt-1">
                          {formatTime(message.timestamp)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div 
                  className="rounded-lg p-3"
                  style={{ 
                    backgroundColor: themeStyles.inputBg,
                    borderRadius: `${borderRadius}px`
                  }}
                >
                  <div className="flex items-center space-x-2">
                    {showAvatar && (
                      <div className="w-6 h-6 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
                        <span className="text-xs">{agentAvatar}</span>
                      </div>
                    )}
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="p-3 border-t" style={{ borderColor: themeStyles.border }}>
            <div className="flex items-end space-x-2">
              {allowAttachments && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded hover:bg-gray-100 transition-colors"
                  style={{ color: themeStyles.text }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
              )}
              
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  className={`w-full resize-none border rounded-lg p-2 focus:outline-none focus:ring-2 ${fontSizeClass}`}
                  style={{ 
                    backgroundColor: themeStyles.inputBg,
                    borderColor: themeStyles.border,
                    color: themeStyles.text,
                    borderRadius: `${borderRadius}px`
                  }}
                  rows={1}
                />
              </div>
              
              <button
                onClick={handleSendMessage}
                disabled={!input.trim() || isTyping}
                className="p-2 rounded-lg transition-colors disabled:opacity-50"
                style={{ 
                  backgroundColor: primaryColor,
                  borderRadius: `${borderRadius}px`
                }}
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.txt"
            />
          </div>
        </div>
      )}
    </>
  )
}