import React, { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { AIService } from '../services/ai'
import {
  ensureModelSelection,
  ensureProviderSelection,
  getFlattenedProviderModels,
  getProviderById,
} from '../services/providers'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  isJSON?: boolean
  healedData?: unknown
  hasError?: boolean
  errorMessage?: string
}

const SUGGESTED = [
  'Explain quantum computing',
  'Generate a JSON response',
  'Write a haiku about code',
  'Debug my function',
]

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function UserBubble({ content }: { content: string }) {
  return (
    <div style={{
      alignSelf: 'flex-end',
      maxWidth: '72%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 4,
    }}>
      <div style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-hover)',
        borderRadius: 4,
        padding: '8px 12px',
        fontSize: 13,
        lineHeight: 1.55,
        color: 'var(--color-text)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {content}
      </div>
    </div>
  )
}

function AssistantBubble({ message }: { message: Message }) {
  const renderContent = () => {
    if (message.isJSON && message.healedData) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <pre style={{
            fontFamily: 'var(--font-family-mono)',
            fontSize: 12,
            background: 'var(--color-code-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 3,
            padding: '8px 10px',
            overflowX: 'auto',
            margin: 0,
            color: 'var(--color-success)',
          }}>
            {JSON.stringify(message.healedData, null, 2)}
          </pre>
          <span style={{ fontSize: 11, color: 'var(--color-success)', fontFamily: 'var(--font-family-mono)' }}>
            ✓ JSON healed
          </span>
        </div>
      )
    }
    if (message.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ color: 'var(--color-error)', fontSize: 13 }}>{message.content}</span>
          {message.errorMessage && (
            <span style={{
              fontSize: 11,
              color: 'var(--color-error)',
              fontFamily: 'var(--font-family-mono)',
              background: 'rgba(209,77,65,0.08)',
              padding: '2px 6px',
              borderRadius: 2,
            }}>{message.errorMessage}</span>
          )}
        </div>
      )
    }
    return (
      <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {message.content}
      </span>
    )
  }

  return (
    <div style={{ alignSelf: 'flex-start', maxWidth: '80%', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      {/* Icon */}
      <div style={{
        width: 22,
        height: 22,
        borderRadius: 3,
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: 2,
        color: 'var(--color-accent)',
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </div>
      <div style={{
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border)',
        borderRadius: 4,
        padding: '8px 12px',
        fontSize: 13,
        lineHeight: 1.55,
        color: 'var(--color-text)',
        flex: 1,
      }}>
        {renderContent()}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 8, alignItems: 'center' }}>
      <div style={{
        width: 22,
        height: 22,
        borderRadius: 3,
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-accent)',
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </div>
      <div style={{
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border)',
        borderRadius: 4,
        padding: '8px 12px',
        display: 'flex',
        gap: 4,
        alignItems: 'center',
      }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: 'var(--color-text-subtle)',
            display: 'inline-block',
            animation: 'typingDot 1.2s ease infinite',
            animationDelay: `${i * 0.2}s`,
          }} />
        ))}
      </div>
      <style>{`
        @keyframes typingDot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }
      `}</style>
    </div>
  )
}

function EmptyState({ onSelect }: { onSelect: (s: string) => void }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: 24,
      padding: '0 24px',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 4,
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 12px',
          color: 'var(--color-accent)',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p style={{ fontSize: 14, color: 'var(--color-text)', marginBottom: 4 }}>New conversation</p>
        <p style={{ fontSize: 12, color: 'var(--color-text-subtle)' }}>
          Ask anything — code, JSON healing, general questions
        </p>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxWidth: 480 }}>
        {SUGGESTED.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSelect(s)}
            style={{
              padding: '4px 10px',
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 3,
              color: 'var(--color-text-muted)',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'var(--font-family-mono)',
              transition: 'all 100ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border-hover)'
              e.currentTarget.style.color = 'var(--color-text)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)'
              e.currentTarget.style.color = 'var(--color-text-muted)'
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export const OpenRouterChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [enableJSONHealing, setEnableJSONHealing] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef    = useRef<HTMLTextAreaElement>(null)
  const { config, setConfig } = useStore()
  const providerOptions = getFlattenedProviderModels(config.providers)
  const selectedProviderId = ensureProviderSelection(config.provider, config.providers)
  const selectedModelId = ensureModelSelection(selectedProviderId, config.model, config.providers)
  const selectedProvider = getProviderById(config.providers, selectedProviderId)
  const selectedModelKey = `${selectedProviderId}::${selectedModelId}`

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => {
    const el = textareaRef.current
    if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 180) + 'px' }
  }, [input])
  useEffect(() => {
    if (selectedProviderId !== config.provider || selectedModelId !== config.model) {
      setConfig({ provider: selectedProviderId, model: selectedModelId })
    }
  }, [config.model, config.provider, selectedModelId, selectedProviderId, setConfig])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    }
    setMessages((p) => [...p, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const svc = new AIService(
        config.openaiKey || '',
        selectedModelId,
        config.temperature || 0.7,
        selectedProviderId,
        selectedProvider?.apiKey,
        selectedProvider?.baseUrl,
      )

      if (enableJSONHealing) {
        const healed = await svc.chatCompletionJSON([{ role: 'user', content: userMsg.content }])
        setMessages((p) => [...p, {
          id: `a-${Date.now()}`, role: 'assistant', content: healed.original, timestamp: Date.now(),
          isJSON: healed.success, healedData: healed.data,
          hasError: !healed.success, errorMessage: healed.errors?.join(', '),
        }])
      } else {
        const response = await svc.transformFile(userMsg.content, 'Please respond conversationally.')
        setMessages((p) => [...p, {
          id: `a-${Date.now()}`, role: 'assistant', content: response, timestamp: Date.now(),
        }])
      }
    } catch (err) {
      setMessages((p) => [...p, {
        id: `e-${Date.now()}`, role: 'assistant', timestamp: Date.now(), hasError: true,
        content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--color-bg)' }}>

      {/* ── Header bar ───────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        height: 36,
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-bg-elevated)',
        flexShrink: 0,
      }}>
        {/* Left: title + msg count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', fontFamily: 'var(--font-family-mono)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Chat
          </span>
          {messages.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--color-text-subtle)', fontFamily: 'var(--font-family-mono)' }}>
              {messages.length} {messages.length === 1 ? 'message' : 'messages'}
            </span>
          )}
        </div>

        {/* Right: controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* JSON healing toggle */}
          <button
            type="button"
            onClick={() => setEnableJSONHealing((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '2px 8px',
              fontSize: 11,
              fontFamily: 'var(--font-family-mono)',
              background: enableJSONHealing ? 'var(--color-success)' : 'var(--color-bg-surface)',
              border: '1px solid',
              borderColor: enableJSONHealing ? 'var(--color-success)' : 'var(--color-border)',
              borderRadius: 3,
              color: enableJSONHealing ? '#fff' : 'var(--color-text-muted)',
              cursor: 'pointer',
              transition: 'all 100ms ease',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            JSON healing {enableJSONHealing ? 'on' : 'off'}
          </button>

          {/* Model selector */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <select
               value={selectedModelKey}
               onChange={(e) => {
                 const [providerId, modelId] = e.target.value.split('::')
                 setConfig({ provider: providerId, model: modelId })
               }}
               style={{
                 appearance: 'none',
                 background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 3,
                color: 'var(--color-text-muted)',
                fontSize: 11,
                fontFamily: 'var(--font-family-mono)',
                padding: '2px 22px 2px 8px',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
               {providerOptions.map((model) => (
                 <option key={model.key} value={model.key}>{model.label}</option>
               ))}
             </select>
            <svg
              width="10" height="10"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ position: 'absolute', right: 6, pointerEvents: 'none', color: 'var(--color-text-subtle)' }}
              aria-hidden="true"
            >
              <title>Model selection</title>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {/* Clear button */}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setMessages([])}
              style={{
                display: 'flex', alignItems: 'center',
                padding: '2px 6px',
                background: 'transparent',
                border: '1px solid transparent',
                borderRadius: 3,
                color: 'var(--color-text-subtle)',
                fontSize: 11,
                fontFamily: 'var(--font-family-mono)',
                cursor: 'pointer',
                transition: 'all 100ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-hover)'; e.currentTarget.style.color = 'var(--color-text-muted)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-subtle)' }}
              title="Clear conversation"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Messages area ────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {messages.length === 0 ? (
          <EmptyState onSelect={setInput} />
        ) : (
          <>
            {messages.map((msg) => (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {msg.role === 'user'
                  ? <UserBubble content={msg.content} />
                  : <AssistantBubble message={msg} />}
                <span style={{
                  fontSize: 10,
                  color: 'var(--color-text-subtle)',
                  fontFamily: 'var(--font-family-mono)',
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  paddingLeft: msg.role === 'user' ? 0 : 30,
                }}>
                  {formatTime(msg.timestamp)}
                </span>
              </div>
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* ── Input area ───────────────────────────────────────────────── */}
      <div style={{
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-bg-elevated)',
        padding: '8px 12px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message... (Enter to send, Shift+Enter for new line)"
            disabled={isLoading}
            rows={1}
            style={{
              flex: 1,
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 3,
              color: 'var(--color-text)',
              fontFamily: 'var(--font-family-sans)',
              fontSize: 13,
              padding: '6px 10px',
              resize: 'none',
              outline: 'none',
              minHeight: 34,
              maxHeight: 180,
              lineHeight: 1.5,
              caretColor: 'var(--color-accent)',
              transition: 'border-color 100ms ease',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)' }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            style={{
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: input.trim() && !isLoading ? 'var(--color-primary)' : 'var(--color-bg-surface)',
              border: '1px solid',
              borderColor: input.trim() && !isLoading ? 'var(--color-primary)' : 'var(--color-border)',
              borderRadius: 3,
              color: input.trim() && !isLoading ? '#fff' : 'var(--color-text-subtle)',
              cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
              flexShrink: 0,
              transition: 'all 100ms ease',
            }}
            aria-label="Send message"
          >
            {isLoading ? (
              <span className="loading-spinner" style={{ width: 14, height: 14 }} />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 4,
          fontSize: 10,
          color: 'var(--color-text-subtle)',
          fontFamily: 'var(--font-family-mono)',
        }}>
          <span>{enableJSONHealing ? '⚡ json healing active' : ''}</span>
          <span>
            <kbd style={{ padding: '1px 4px', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 2, fontSize: 10 }}>Enter</kbd>
            {' '}send
          </span>
        </div>
      </div>
    </div>
  )
}
