# Chat Widget Design Guide

## Overview

The chat widget is a fully customizable, modern chat interface designed following best practices from leading design systems like Salesforce Lightning, Telerik, and HelpCrunch. It provides a professional, accessible, and brandable chat experience.

## Features

### 🎨 Customization
- **Positioning**: 4 corner positions with custom offsets
- **Theming**: Light, dark, or auto (system preference)
- **Colors**: Full color customization (primary, background, text)
- **Typography**: 3 font sizes with responsive scaling
- **Branding**: Company logo, agent avatars, custom greetings
- **Layout**: Border radius, shadows, spacing controls

### 💬 Chat Features
- **Real-time messaging** with typing indicators
- **File attachments** (images, documents)
- **Message timestamps** with formatting options
- **Avatar display** for both user and agent
- **Sound notifications** with customizable tones
- **Browser notifications** with permission handling
- **Persistent chat** across page reloads

### 🔧 Technical Features
- **Responsive design** with mobile-first approach
- **Accessibility** (WCAG 2.1 compliant)
- **Keyboard navigation** with shortcuts
- **Auto-open** with customizable delay
- **Minimize/maximize** with smooth animations
- **Offline support** with fallback UI

## Usage

### Basic Implementation
```tsx
import { ChatWidget } from './components/ChatWidget'

function App() {
  return (
    <ChatWidget
      position="bottom-right"
      theme="auto"
      primaryColor="#007acc"
      agentName="Support Agent"
      agentAvatar="🤖"
      welcomeMessage="Hello! How can I help you today?"
    />
  )
}
```

### Advanced Customization
```tsx
<ChatWidget
  // Positioning
  position="bottom-left"
  offset={{ x: 30, y: 30 }}
  
  // Branding
  companyName="Your Company"
  companyLogo="/logo.png"
  agentName="Sarah"
  agentAvatar="👩‍💼"
  welcomeMessage="Welcome! I'm here to help with any questions."
  
  // Styling
  theme="dark"
  primaryColor="#8b5cf6"
  backgroundColor="#1a1a1a"
  textColor="#ffffff"
  borderRadius={16}
  fontSize="large"
  
  // Features
  showAvatar={true}
  showTimestamp={true}
  allowAttachments={true}
  soundEnabled={true}
  notificationsEnabled={true}
  autoOpen={false}
  
  // Behavior
  minimizeOnOutsideClick={true}
  persistentChat={true}
/>
```

## Design System

### Color Tokens
The widget uses a comprehensive color system:

```typescript
const colors = {
  light: {
    background: '#ffffff',
    surface: '#f8f9fa',
    primary: '#007acc',
    text: '#212529',
    border: '#dee2e6'
  },
  dark: {
    background: '#1a1a1a',
    surface: '#2d2d2d',
    primary: '#4dabf7',
    text: '#ffffff',
    border: '#495057'
  }
}
```

### Typography
Following design system principles:
- Font sizes: 12px, 14px, 16px, 18px, 20px, 24px
- Line heights: 1.25, 1.5, 1.75
- Font weights: 400, 500, 600, 700

### Spacing
8px grid system:
- 4px, 8px, 16px, 24px, 32px, 48px, 64px

### Predefined Themes
```typescript
const themes = {
  modern: { primary: '#007acc', borderRadius: '12px' },
  minimal: { primary: '#000000', borderRadius: '4px' },
  corporate: { primary: '#1f2937', borderRadius: '8px' },
  playful: { primary: '#8b5cf6', borderRadius: '16px' },
  dark: { primary: '#4dabf7', borderRadius: '12px' }
}
```

## Accessibility Features

### ARIA Labels
- Proper labeling for all interactive elements
- Screen reader announcements for new messages
- Descriptive labels for buttons and inputs

### Keyboard Navigation
- `Enter`: Send message
- `Shift+Enter`: New line
- `Escape`: Close chat
- `Tab`: Navigate between elements

### Screen Reader Support
- New message announcements
- Typing indicator descriptions
- Error message alerts
- Status updates

## Responsive Design

### Mobile Optimizations
- Touch-friendly button sizes (minimum 44px)
- Optimized spacing for small screens
- Collapsible interface elements
- Gesture support for swipe actions

### Breakpoints
- Mobile: < 640px
- Tablet: 640px - 768px
- Desktop: > 768px

## Performance

### Optimizations
- Lazy loading of chat window
- Efficient message rendering
- Optimized animations
- Minimal bundle size

### Best Practices
- Debounced input handling
- Virtual scrolling for long conversations
- Image optimization for attachments
- Efficient state management

## Integration Examples

### With React Router
```tsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ChatWidget } from './components/ChatWidget'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
      </Routes>
      <ChatWidget position="bottom-right" />
    </Router>
  )
}
```

### With Authentication
```tsx
function App() {
  const { user } = useAuth()
  
  return (
    <ChatWidget
      agentName={user?.name || 'Support Agent'}
      agentAvatar={user?.avatar || '👤'}
      persistentChat={true}
    />
  )
}
```

### With Analytics
```tsx
function App() {
  const { trackEvent } = useAnalytics()
  
  const handleMessageSend = (message: string) => {
    trackEvent('chat_message_sent', { message_length: message.length })
  }
  
  return (
    <ChatWidget
      onMessageSend={handleMessageSend}
    />
  )
}
```

## Customization Guide

### Branding
1. **Logo**: Add company logo in header
2. **Colors**: Match brand colors
3. **Typography**: Use brand fonts
4. **Messaging**: Customize welcome messages

### Styling
1. **Position**: Choose corner placement
2. **Size**: Adjust widget dimensions
3. **Animations**: Customize transitions
4. **Effects**: Add shadows and borders

### Behavior
1. **Auto-open**: Set delay for automatic opening
2. **Persistence**: Maintain chat across sessions
3. **Notifications**: Configure browser alerts
4. **Sound**: Enable/disable notification sounds

## Troubleshooting

### Common Issues
1. **Widget not appearing**: Check CSS conflicts
2. **Messages not sending**: Verify API configuration
3. **Notifications not working**: Check browser permissions
4. **Styling issues**: Ensure proper theme application

### Debug Mode
Enable debug logging:
```tsx
<ChatWidget debug={true} />
```

## Browser Support
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+
- Mobile browsers (iOS Safari, Chrome Android)

## License
MIT License - Feel free to use and modify as needed.