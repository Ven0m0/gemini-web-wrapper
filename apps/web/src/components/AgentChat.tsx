import React, { useEffect, useRef, useState } from 'react';
import type { AgentMessage } from '../services/agent';
import { AgentService } from '../services/agent';
import { ensureModelSelection, ensureProviderSelection, getProviderById } from '../services/providers';
import { useStore } from '../store';

interface Props {
  className?: string;
}

export const AgentChat: React.FC<Props> = ({ className }) => {
  const { config, repoIndexStatus: _repoIndexStatus } = useStore();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentThinking, setCurrentThinking] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedProviderId = ensureProviderSelection(config.provider, config.providers);
  const selectedModelId = ensureModelSelection(selectedProviderId, config.model, config.providers);
  const selectedProvider = getProviderById(config.providers, selectedProviderId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentThinking]);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 180) + 'px';
    }
  }, [input]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: AgentMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setCurrentThinking('');

    try {
      const svc = new AgentService(config.openaiKey || '');
      const conversationMessages = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMsg.content },
      ];

      let assistantContent = '';
      let assistantThinking = '';
      const toolCalls: NonNullable<AgentMessage['toolCalls']> = [];

      for await (const event of svc.stream({
        model: selectedModelId,
        messages: conversationMessages,
        provider: selectedProviderId,
        providerKey: selectedProvider?.apiKey,
        providerBaseUrl: selectedProvider?.baseUrl,
      })) {
        if (event.type === 'text_delta' && event.text) {
          assistantContent += event.text;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant' && last.id.startsWith('a-current')) {
              return [...prev.slice(0, -1), { ...last, content: assistantContent }];
            }
            return [
              ...prev,
              {
                id: 'a-current',
                role: 'assistant',
                content: assistantContent,
                timestamp: Date.now(),
                thinking: assistantThinking || undefined,
                toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
              },
            ];
          });
        } else if (event.type === 'thinking_delta' && event.thinking) {
          assistantThinking += event.thinking;
          setCurrentThinking(assistantThinking);
        } else if (event.type === 'tool_call') {
          toolCalls.push({ id: event.tool_id!, name: event.tool_name!, args: event.arguments || {} });
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant') {
              return [
                ...prev.slice(0, -1),
                {
                  ...last,
                  toolCalls: [
                    ...(last.toolCalls || []),
                    { id: event.tool_id!, name: event.tool_name!, args: event.arguments || {} },
                  ],
                },
              ];
            }
            return [
              ...prev,
              {
                id: 'a-current',
                role: 'assistant',
                content: assistantContent,
                timestamp: Date.now(),
                thinking: assistantThinking || undefined,
                toolCalls,
              },
            ];
          });
        } else if (event.type === 'tool_result') {
          const tc = toolCalls.find((t) => t.id === event.tool_id);
          if (tc) tc.result = event.result;
          setMessages((prev) =>
            prev.map((m) => (m.role === 'assistant' ? { ...m, toolCalls: [...(m.toolCalls || [])] } : m))
          );
        } else if (event.type === 'done') {
          setMessages((prev) => prev.map((m) => (m.id === 'a-current' ? { ...m, id: `a-${Date.now()}` } : m)));
        } else if (event.type === 'error') {
          throw new Error(event.error);
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setCurrentThinking('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className={`flex flex-col h-full ${className || ''}`}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>Start a conversation with the agent</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-lg p-3 ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}
            >
              {msg.thinking && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 italic">Thinking {msg.thinking}</div>
              )}
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-2 space-y-2">
                  {msg.toolCalls.map((tc) => (
                    <div key={tc.id} className="text-xs bg-gray-200 dark:bg-gray-700 rounded p-2">
                      <div className="font-mono">Tool {tc.name}</div>
                      {tc.result && (
                        <div className="mt-1 text-green-600 dark:text-green-400">
                          OK {tc.result.slice(0, 100)}
                          {tc.result.length > 100 ? '...' : ''}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && currentThinking && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg p-3 bg-gray-100 dark:bg-gray-800">
              <div className="text-xs text-gray-500 dark:text-gray-400 italic animate-pulse">
                Thinking {currentThinking}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message the agent... (Enter to send)"
            disabled={isLoading}
            rows={1}
            className="flex-1 resize-none bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};
