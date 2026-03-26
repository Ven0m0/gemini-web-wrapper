import React from 'react'

// Design tokens based on web search best practices
export const chatDesignTokens = {
  // Colors following WCAG accessibility guidelines
  colors: {
    light: {
      background: '#ffffff',
      surface: '#f8f9fa',
      primary: '#007acc',
      secondary: '#6c757d',
      text: '#212529',
      textSecondary: '#6c757d',
      border: '#dee2e6',
      success: '#28a745',
      warning: '#ffc107',
      error: '#dc3545',
      hover: '#f8f9fa'
    },
    dark: {
      background: '#1a1a1a',
      surface: '#2d2d2d',
      primary: '#4dabf7',
      secondary: '#adb5bd',
      text: '#ffffff',
      textSecondary: '#adb5bd',
      border: '#495057',
      success: '#51cf66',
      warning: '#ffd43b',
      error: '#ff6b6b',
      hover: '#2d2d2d'
    }
  },
  
  // Typography following design system principles
  typography: {
    fontFamily: {
      sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      mono: 'SF Mono, Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace'
    },
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem'   // 24px
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75
    }
  },
  
  // Spacing following 8px grid system
  spacing: {
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    '2xl': '3rem',   // 48px
    '3xl': '4rem'    // 64px
  },
  
  // Border radius for modern rounded design
  borderRadius: {
    none: '0',
    sm: '0.25rem',   // 4px
    md: '0.5rem',    // 8px
    lg: '0.75rem',   // 12px
    xl: '1rem',      // 16px
    '2xl': '1.5rem', // 24px
    full: '9999px'
  },
  
  // Shadows for depth and elevation
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
  },
  
  // Transitions for smooth animations
  transitions: {
    fast: '150ms ease-in-out',
    normal: '250ms ease-in-out',
    slow: '350ms ease-in-out'
  },
  
  // Z-index for layering
  zIndex: {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modal: 1040,
    popover: 1050,
    tooltip: 1060
  }
}

// Predefined themes based on research
export const chatThemes = {
  modern: {
    name: 'Modern',
    colors: {
      primary: '#007acc',
      secondary: '#6c757d',
      background: '#ffffff',
      surface: '#f8f9fa',
      text: '#212529'
    },
    borderRadius: '0.75rem',
    shadows: 'md'
  },
  
  minimal: {
    name: 'Minimal',
    colors: {
      primary: '#000000',
      secondary: '#666666',
      background: '#ffffff',
      surface: '#f5f5f5',
      text: '#000000'
    },
    borderRadius: '0.25rem',
    shadows: 'sm'
  },
  
  corporate: {
    name: 'Corporate',
    colors: {
      primary: '#1f2937',
      secondary: '#4b5563',
      background: '#ffffff',
      surface: '#f9fafb',
      text: '#111827'
    },
    borderRadius: '0.5rem',
    shadows: 'lg'
  },
  
  playful: {
    name: 'Playful',
    colors: {
      primary: '#8b5cf6',
      secondary: '#ec4899',
      background: '#ffffff',
      surface: '#fdf2f8',
      text: '#1f2937'
    },
    borderRadius: '1rem',
    shadows: 'xl'
  },
  
  dark: {
    name: 'Dark',
    colors: {
      primary: '#4dabf7',
      secondary: '#adb5bd',
      background: '#1a1a1a',
      surface: '#2d2d2d',
      text: '#ffffff'
    },
    borderRadius: '0.75rem',
    shadows: 'md'
  }
}

// Component styles following design system principles
export const chatComponentStyles = {
  message: {
    user: (theme: 'light' | 'dark') => ({
      backgroundColor: chatDesignTokens.colors[theme].primary,
      color: '#ffffff',
      borderRadius: chatDesignTokens.borderRadius.lg,
      padding: chatDesignTokens.spacing.md,
      maxWidth: '70%',
      wordWrap: 'break-word' as const
    }),
    
    assistant: (theme: 'light' | 'dark') => ({
      backgroundColor: chatDesignTokens.colors[theme].surface,
      color: chatDesignTokens.colors[theme].text,
      borderRadius: chatDesignTokens.borderRadius.lg,
      padding: chatDesignTokens.spacing.md,
      maxWidth: '70%',
      wordWrap: 'break-word' as const,
      border: `1px solid ${chatDesignTokens.colors[theme].border}`
    }),
    
    system: (theme: 'light' | 'dark') => ({
      backgroundColor: 'transparent',
      color: chatDesignTokens.colors[theme].textSecondary,
      fontStyle: 'italic',
      textAlign: 'center' as const,
      padding: chatDesignTokens.spacing.sm
    })
  },
  
  input: (theme: 'light' | 'dark') => ({
    backgroundColor: chatDesignTokens.colors[theme].surface,
    color: chatDesignTokens.colors[theme].text,
    border: `1px solid ${chatDesignTokens.colors[theme].border}`,
    borderRadius: chatDesignTokens.borderRadius.md,
    padding: chatDesignTokens.spacing.md,
    fontSize: chatDesignTokens.typography.fontSize.base,
    lineHeight: chatDesignTokens.typography.lineHeight.normal,
    transition: chatDesignTokens.transitions.fast,
    ':focus': {
      outline: 'none',
      borderColor: chatDesignTokens.colors[theme].primary,
      boxShadow: `0 0 0 2px ${chatDesignTokens.colors[theme].primary}20`
    }
  }),
  
  button: (theme: 'light' | 'dark', variant: 'primary' | 'secondary' = 'primary') => ({
    backgroundColor: variant === 'primary' 
      ? chatDesignTokens.colors[theme].primary 
      : chatDesignTokens.colors[theme].surface,
    color: variant === 'primary' ? '#ffffff' : chatDesignTokens.colors[theme].text,
    border: variant === 'primary' ? 'none' : `1px solid ${chatDesignTokens.colors[theme].border}`,
    borderRadius: chatDesignTokens.borderRadius.md,
    padding: `${chatDesignTokens.spacing.sm} ${chatDesignTokens.spacing.md}`,
    fontSize: chatDesignTokens.typography.fontSize.base,
    fontWeight: chatDesignTokens.typography.fontWeight.medium,
    cursor: 'pointer',
    transition: chatDesignTokens.transitions.fast,
    ':hover': {
      opacity: 0.9,
      transform: 'translateY(-1px)'
    },
    ':disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
      transform: 'none'
    }
  }),
  
  avatar: (size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizes = {
      sm: { width: '2rem', height: '2rem', fontSize: chatDesignTokens.typography.fontSize.sm },
      md: { width: '2.5rem', height: '2.5rem', fontSize: chatDesignTokens.typography.fontSize.base },
      lg: { width: '3rem', height: '3rem', fontSize: chatDesignTokens.typography.fontSize.lg }
    }
    
    return {
      width: sizes[size].width,
      height: sizes[size].height,
      borderRadius: chatDesignTokens.borderRadius.full,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: sizes[size].fontSize,
      fontWeight: chatDesignTokens.typography.fontWeight.medium,
      overflow: 'hidden'
    }
  },
  
  typingIndicator: {
    container: {
      display: 'flex',
      alignItems: 'center',
      gap: chatDesignTokens.spacing.xs,
      padding: chatDesignTokens.spacing.sm
    },
    
    dot: (theme: 'light' | 'dark') => ({
      width: '0.5rem',
      height: '0.5rem',
      borderRadius: chatDesignTokens.borderRadius.full,
      backgroundColor: chatDesignTokens.colors[theme].textSecondary,
      animation: 'typing 1.4s infinite ease-in-out'
    })
  }
}

// CSS animations for chat components
export const chatAnimations = `
  @keyframes typing {
    0%, 60%, 100% {
      transform: translateY(0);
    }
    30% {
      transform: translateY(-0.25rem);
    }
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(0.5rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(1rem);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  .chat-message {
    animation: fadeIn 0.3s ease-out;
  }
  
  .chat-window {
    animation: slideIn 0.3s ease-out;
  }
  
  .typing-indicator {
    animation: typing 1.4s infinite ease-in-out;
  }
`

// Accessibility features
export const chatAccessibility = {
  ariaLabels: {
    chatWindow: 'Chat window',
    messageInput: 'Type your message',
    sendButton: 'Send message',
    attachmentButton: 'Add attachment',
    closeButton: 'Close chat',
    minimizeButton: 'Minimize chat',
    agentAvatar: 'Agent avatar',
    userAvatar: 'Your avatar',
    typingIndicator: 'Agent is typing'
  },
  
  keyboardShortcuts: {
    sendMessage: 'Enter',
    newLine: 'Shift+Enter',
    closeChat: 'Escape',
    minimizeChat: 'M',
    focusInput: 'Tab'
  },
  
  screenReaderAnnouncements: {
    newMessage: 'New message from agent',
    messageSent: 'Message sent',
    chatOpened: 'Chat window opened',
    chatClosed: 'Chat window closed',
    fileUploaded: 'File uploaded successfully',
    error: 'Error occurred'
  }
}

// Responsive design breakpoints
export const chatBreakpoints = {
  mobile: '(max-width: 640px)',
  tablet: '(max-width: 768px)',
  desktop: '(min-width: 769px)'
}

// Export everything as a comprehensive design system
export const ChatDesignSystem = {
  tokens: chatDesignTokens,
  themes: chatThemes,
  components: chatComponentStyles,
  animations: chatAnimations,
  accessibility: chatAccessibility,
  breakpoints: chatBreakpoints
}

export default ChatDesignSystem