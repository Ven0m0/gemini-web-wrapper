import React, { useState } from 'react'
import { ChatWidget } from './ChatWidget'
import { ChatDesignSystem } from './ChatDesignSystem'

export const ChatDemo: React.FC = () => {
  const [selectedTheme, setSelectedTheme] = useState('modern')
  const [selectedPosition, setSelectedPosition] = useState('bottom-right')
  const [primaryColor, setPrimaryColor] = useState('#007acc')
  const [borderRadius, setBorderRadius] = useState(12)
  const [fontSize, setFontSize] = useState('medium')
  const [showAvatar, setShowAvatar] = useState(true)
  const [showTimestamp, setShowTimestamp] = useState(true)
  const [allowAttachments, setAllowAttachments] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [autoOpen, setAutoOpen] = useState(false)
  const [customGreeting, setCustomGreeting] = useState("Hello! How can I help you today?")
  const [agentName, setAgentName] = useState("AI Assistant")
  const [agentAvatar, setAgentAvatar] = useState("🤖")

  const currentTheme = ChatDesignSystem.themes[selectedTheme as keyof typeof ChatDesignSystem.themes]

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Chat Widget Demo</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Configuration Panel */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Configuration</h2>
            
            {/* Basic Settings */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
                <select 
                  value={selectedTheme} 
                  onChange={(e) => setSelectedTheme(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {Object.entries(ChatDesignSystem.themes).map(([key, theme]) => (
                    <option key={key} value={key}>{theme.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
                <select 
                  value={selectedPosition} 
                  onChange={(e) => setSelectedPosition(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="top-left">Top Left</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
                <div className="flex items-center space-x-2">
                  <input 
                    type="color" 
                    value={primaryColor} 
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-12 h-8 border border-gray-300 rounded cursor-pointer"
                  />
                  <input 
                    type="text" 
                    value={primaryColor} 
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Border Radius</label>
                <input 
                  type="range" 
                  min="0" 
                  max="24" 
                  value={borderRadius} 
                  onChange={(e) => setBorderRadius(Number(e.target.value))}
                  className="w-full"
                />
                <div className="text-sm text-gray-500 mt-1">{borderRadius}px</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Font Size</label>
                <select 
                  value={fontSize} 
                  onChange={(e) => setFontSize(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Agent Name</label>
                <input 
                  type="text" 
                  value={agentName} 
                  onChange={(e) => setAgentName(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Agent Avatar</label>
                <input 
                  type="text" 
                  value={agentAvatar} 
                  onChange={(e) => setAgentAvatar(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="🤖 or URL"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Welcome Message</label>
                <textarea 
                  value={customGreeting} 
                  onChange={(e) => setCustomGreeting(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                />
              </div>
            </div>

            {/* Feature Toggles */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Features</h3>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input 
                    type="checkbox" 
                    checked={showAvatar} 
                    onChange={(e) => setShowAvatar(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Show Avatar</span>
                </label>

                <label className="flex items-center">
                  <input 
                    type="checkbox" 
                    checked={showTimestamp} 
                    onChange={(e) => setShowTimestamp(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Show Timestamp</span>
                </label>

                <label className="flex items-center">
                  <input 
                    type="checkbox" 
                    checked={allowAttachments} 
                    onChange={(e) => setAllowAttachments(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Allow Attachments</span>
                </label>

                <label className="flex items-center">
                  <input 
                    type="checkbox" 
                    checked={soundEnabled} 
                    onChange={(e) => setSoundEnabled(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Sound Notifications</span>
                </label>

                <label className="flex items-center">
                  <input 
                    type="checkbox" 
                    checked={notificationsEnabled} 
                    onChange={(e) => setNotificationsEnabled(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Browser Notifications</span>
                </label>

                <label className="flex items-center">
                  <input 
                    type="checkbox" 
                    checked={autoOpen} 
                    onChange={(e) => setAutoOpen(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Auto-open on page load</span>
                </label>
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Live Preview</h2>
            
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-medium text-gray-700 mb-2">Current Configuration</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <div>Theme: <span className="font-medium">{currentTheme.name}</span></div>
                <div>Position: <span className="font-medium">{selectedPosition}</span></div>
                <div>Primary Color: <span className="font-medium">{primaryColor}</span></div>
                <div>Border Radius: <span className="font-medium">{borderRadius}px</span></div>
                <div>Font Size: <span className="font-medium">{fontSize}</span></div>
              </div>
            </div>

            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                💡 The chat widget will appear in the {selectedPosition} corner of this page. 
                Click the button below to test it!
              </p>
            </div>

            <button
              onClick={() => {
                // Request notification permission
                if (notificationsEnabled && 'Notification' in window && Notification.permission === 'default') {
                  Notification.requestPermission()
                }
              }}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              Test Chat Widget
            </button>
          </div>
        </div>

        {/* Live Chat Widget */}
        <ChatWidget
          position={selectedPosition as any}
          theme={selectedTheme as any}
          primaryColor={primaryColor}
          backgroundColor={currentTheme.colors.background}
          textColor={currentTheme.colors.text}
          borderRadius={borderRadius}
          fontSize={fontSize as any}
          showAvatar={showAvatar}
          showTimestamp={showTimestamp}
          allowAttachments={allowAttachments}
          soundEnabled={soundEnabled}
          notificationsEnabled={notificationsEnabled}
          autoOpen={autoOpen}
          agentName={agentName}
          agentAvatar={agentAvatar}
          customGreeting={customGreeting}
          companyName={companyName}
          welcomeMessage={customGreeting}
        />
      </div>
    </div>
  )
}

export default ChatDemo