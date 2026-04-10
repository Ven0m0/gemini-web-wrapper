import React, { useEffect, useMemo, useRef, useState } from 'react'
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

const DEFAULT_SUGGESTED = [
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
        borderTop: '1px solid var(--color-border-hover)',
        borderBottom: '1px solid var(--color-border)',
        borderLeft: '2px solid var(--color-accent)',
        borderRight: '1px solid var(--color-border)',
        borderRadius: 0,
        padding: '8px 12px',
        fontSize: 13,
        lineHeight: 1.6,
        color: 'var(--color-text-bright)',
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
    <div style={{ alignSelf: 'flex-start', maxWidth: '84%', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      {/* Icon */}
      <div style={{
        width: 24,
        height: 24,
        borderRadius: 0,
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderTop: '1px solid var(--color-bg-active)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: 2,
        color: 'var(--color-accent)',
        boxShadow: '0 0 6px rgba(208, 162, 21, 0.15)',
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </div>
      <div style={{
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border)',
        borderLeft: '1px solid var(--color-border-subtle)',
        borderRadius: 0,
        padding: '9px 13px',
        fontSize: 13,
        lineHeight: 1.65,
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
    <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 10, alignItems: 'center' }}>
      <div style={{
        width: 24,
        height: 24,
        borderRadius: 0,
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderTop: '1px solid var(--color-bg-active)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-accent)',
        boxShadow: '0 0 6px rgba(208, 162, 21, 0.15)',
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </div>
      <div style={{
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border)',
        borderRadius: 0,
        padding: '9px 14px',
        display: 'flex',
        gap: 5,
        alignItems: 'center',
      }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: 'var(--color-accent)',
            display: 'inline-block',
            animation: 'typingDot 1.4s cubic-bezier(0.16, 1, 0.3, 1) infinite',
            animationDelay: `${i * 0.18}s`,
            opacity: 0.4,
          }} />
        ))}
      </div>
      <style>{`
        @keyframes typingDot {
          0%, 60%, 100% { opacity: 0.25; transform: translateY(0) scale(1); }
          30% { opacity: 1; transform: translateY(-3px) scale(1.1); }
        }
      `}</style>
    </div>
  )
}

function EmptyState({ onSelect }: { onSelect: (s: string) => void }) {
  const { config } = useStore()
  const repoLabel = config.owner && config.repo ? `${config.owner}/${config.repo}` : ''
  const suggestions = useMemo(() => (
    repoLabel
      ? [
          `Summarize ${repoLabel}`,
          config.path ? `Explain ${config.path}` : `Map the main entry points in ${repoLabel}`,
          'What should I inspect first?',
          'Help me plan the next change',
        ]
      : DEFAULT_SUGGESTED
  ), [config.path, repoLabel])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: 28,
      padding: '0 24px',
      position: 'relative',
    }}>
      {/* Subtle grid background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(208, 162, 21, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(208, 162, 21, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: '32px 32px',
        maskImage: 'radial-gradient(ellipse 60% 60% at 50% 50%, black 30%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      <div style={{ textAlign: 'center', position: 'relative' }}>
        {/* Icon */}
        <div style={{
          width: 52,
          height: 52,
          borderRadius: 0,
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-hover)',
          borderTop: '2px solid var(--color-accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 18px',
          color: 'var(--color-accent)',
          boxShadow: '0 0 20px rgba(208, 162, 21, 0.12), 0 4px 16px rgba(0,0,0,0.4)',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p style={{
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--color-text-bright)',
          marginBottom: 6,
          letterSpacing: '-0.01em',
        }}>New conversation</p>
        <p style={{
          fontSize: 12,
          color: 'var(--color-text-subtle)',
          fontFamily: 'var(--font-family-mono)',
          letterSpacing: '0.01em',
        }}>
          {repoLabel ? `${repoLabel} · workspace-aware chat` : 'code · json · analysis · anything'}
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxWidth: 520, position: 'relative' }}>
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSelect(s)}
            style={{
              padding: '5px 12px',
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 0,
              color: 'var(--color-text-muted)',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'var(--font-family-mono)',
              transition: 'all 150ms cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-accent)'
              e.currentTarget.style.color = 'var(--color-accent)'
              e.currentTarget.style.background = 'rgba(208, 162, 21, 0.05)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)'
              e.currentTarget.style.color = 'var(--color-text-muted)'
              e.currentTarget.style.background = 'var(--color-bg-surface)'
            }}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.5 }} aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
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
  const { config, setConfig, repoIndexStatus } = useStore()
  const providerOptions = getFlattenedProviderModels(config.providers)
  const selectedProviderId = ensureProviderSelection(config.provider, config.providers)
  const selectedModelId = ensureModelSelection(selectedProviderId, config.model, config.providers)
  const selectedProvider = getProviderById(config.providers, selectedProviderId)
  const selectedModelKey = `${selectedProviderId}::${selectedModelId}`
  const repoLabel = config.owner && config.repo ? `${config.owner}/${config.repo}` : ''
  const repoContext = useMemo(() => {
    if (!repoLabel) {
      return 'You are a concise, helpful assistant. Answer clearly and stay practical.'
    }

    const branch = config.branch || 'main'
    const fileContext = config.path ? `Active file: ${config.path}.` : 'No file is currently open.'
    const indexContext = repoIndexStatus
      ? `Repo index status: ${repoIndexStatus.status}, ${repoIndexStatus.indexed_files} indexed files, ${repoIndexStatus.symbol_count} symbols.`
      : 'Repo index status is not available yet.'
    return `You are helping inside the ${repoLabel} repository on branch ${branch}. ${indexContext} ${fileContext} Keep responses concise, practical, and grounded in the active workspace context when relevant.`
  }, [config.branch, config.path, repoIndexStatus, repoLabel])

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
      const conversationMessages = [
        { role: 'system', content: repoContext },
        ...messages
          .filter((message) => message.role !== 'system' && !message.hasError)
          .map((message) => ({ role: message.role, content: message.content })),
        { role: 'user', content: userMsg.content },
      ]

      if (enableJSONHealing) {
        const healed = await svc.chatCompletionJSON(conversationMessages)
        setMessages((p) => [...p, {
          id: `a-${Date.now()}`, role: 'assistant', content: healed.original, timestamp: Date.now(),
          isJSON: healed.success, healedData: healed.data,
          hasError: !healed.success, errorMessage: healed.errors?.join(', '),
        }])
      } else {
        const response = await svc.chatCompletion(conversationMessages)
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
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-bg-elevated)',
        flexShrink: 0,
        gap: 8,
        flexWrap: 'wrap',
      }}>
        {/* Left: title + msg count */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--color-text-subtle)',
              fontFamily: 'var(--font-family-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              Chat
            </span>
            {messages.length > 0 && (
              <span style={{
                fontSize: 10,
                color: 'var(--color-text-subtle)',
                fontFamily: 'var(--font-family-mono)',
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                padding: '0 5px',
                lineHeight: '16px',
              }}>
                {messages.length}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              padding: '4px 8px',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-surface)',
              color: repoLabel ? 'var(--color-text)' : 'var(--color-text-subtle)',
              fontSize: 11,
              fontFamily: 'var(--font-family-mono)',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {repoLabel ? `${repoLabel} · ${config.branch}` : 'No repository attached'}
            </span>
            {config.path && (
              <span style={{
                padding: '4px 8px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                color: 'var(--color-text-subtle)',
                fontSize: 11,
                fontFamily: 'var(--font-family-mono)',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {config.path}
              </span>
            )}
            {repoIndexStatus && (
              <span style={{
                padding: '4px 8px',
                border: '1px solid',
                borderColor: repoIndexStatus.status === 'indexed'
                  ? 'color-mix(in srgb, var(--color-success) 40%, transparent)'
                  : repoIndexStatus.status === 'error'
                    ? 'color-mix(in srgb, var(--color-error) 40%, transparent)'
                    : 'var(--color-border)',
                background: 'var(--color-bg)',
                color: repoIndexStatus.status === 'indexed'
                  ? 'var(--color-success)'
                  : repoIndexStatus.status === 'error'
                    ? 'var(--color-error)'
                    : 'var(--color-text-subtle)',
                fontSize: 11,
                fontFamily: 'var(--font-family-mono)',
              }}>
                index {repoIndexStatus.status}
              </span>
            )}
          </div>
        </div>

        {/* Right: controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {/* JSON healing toggle */}
          <button
            type="button"
            onClick={() => setEnableJSONHealing((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              minHeight: 32,
              padding: '6px 10px',
              fontSize: 11,
              fontFamily: 'var(--font-family-mono)',
              background: enableJSONHealing ? 'rgba(135, 154, 57, 0.15)' : 'transparent',
              border: '1px solid',
              borderColor: enableJSONHealing ? 'var(--color-success)' : 'var(--color-border)',
              borderRadius: 0,
              color: enableJSONHealing ? 'var(--color-success)' : 'var(--color-text-subtle)',
              cursor: 'pointer',
              transition: 'all 150ms ease',
              letterSpacing: '0.02em',
            }}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            JSON
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
              borderRadius: 0,
              color: 'var(--color-text-muted)',
              minHeight: 32,
              fontSize: 11,
              fontFamily: 'var(--font-family-mono)',
              padding: '6px 28px 6px 10px',
              cursor: 'pointer',
              outline: 'none',
              letterSpacing: '0.01em',
              }}
            >
              {providerOptions.map((model) => (
                <option key={model.key} value={model.key}>{model.label}</option>
              ))}
            </select>
            <svg
              width="9" height="9"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
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
                display: 'flex', alignItems: 'center', gap: 4,
                minHeight: 32,
                padding: '6px 10px',
                background: 'transparent',
                border: '1px solid transparent',
                borderRadius: 0,
                color: 'var(--color-text-subtle)',
                fontSize: 11,
                fontFamily: 'var(--font-family-mono)',
                cursor: 'pointer',
                transition: 'all 120ms ease',
                letterSpacing: '0.02em',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-error)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--color-text-subtle)' }}
              title="Clear conversation"
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Messages area ────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px clamp(12px, 3vw, 20px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
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
                  paddingLeft: msg.role === 'user' ? 0 : 34,
                  letterSpacing: '0.02em',
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
        position: 'sticky',
        bottom: 0,
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-bg-elevated)',
        padding: '10px 14px calc(10px + env(safe-area-inset-bottom, 0px))',
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
              borderRadius: 0,
              color: 'var(--color-text)',
              fontFamily: 'var(--font-family-sans)',
              fontSize: 13,
              padding: '8px 12px',
              resize: 'none',
              outline: 'none',
              minHeight: 44,
              maxHeight: 180,
              lineHeight: 1.55,
              caretColor: 'var(--color-accent)',
              transition: 'border-color 150ms ease, box-shadow 150ms ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border-hover)'
              e.currentTarget.style.boxShadow = '0 0 0 1px rgba(208, 162, 21, 0.08) inset'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            style={{
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: input.trim() && !isLoading ? 'var(--color-accent)' : 'var(--color-bg-surface)',
              border: '1px solid',
              borderColor: input.trim() && !isLoading ? 'var(--color-accent)' : 'var(--color-border)',
              borderRadius: 0,
              color: input.trim() && !isLoading ? 'var(--color-bg)' : 'var(--color-text-subtle)',
              cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
              flexShrink: 0,
              transition: 'all 150ms cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: input.trim() && !isLoading ? '0 0 8px rgba(208, 162, 21, 0.2)' : 'none',
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
          marginTop: 5,
          fontSize: 10,
          color: 'var(--color-text-subtle)',
          fontFamily: 'var(--font-family-mono)',
          letterSpacing: '0.02em',
        }}>
          <span style={{ color: enableJSONHealing ? 'var(--color-success)' : 'transparent' }}>
            ⚡ json healing active
          </span>
          <span>
            <kbd style={{ padding: '1px 4px', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 0, fontSize: 9 }}>Enter</kbd>
            {' '}send
          </span>
        </div>
      </div>
    </div>
  )
}
