import React from 'react';
import type { AgentMessage } from '../services/agent';
import { AgentService, finalizeCurrent, reduceAgentEvent } from '../services/agent';
import { ensureModelSelection, ensureProviderSelection, getProviderById } from '../services/providers';
import { useChatSession } from '../hooks/useChatSession';
import { useStore } from '../store';

interface Props {
  className?: string;
}

export const AgentChat: React.FC<Props> = ({ className }) => {
  const { config } = useStore();
  const { messages, setMessages, input, setInput, isLoading, setIsLoading, messagesEndRef, textareaRef, appendError } =
    useChatSession<AgentMessage>();

  const selectedProviderId = ensureProviderSelection(config.provider, config.providers);
  const selectedModelId = ensureModelSelection(selectedProviderId, config.model, config.providers);
  const selectedProvider = getProviderById(config.providers, selectedProviderId);

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

    try {
      const svc = new AgentService(config.openaiKey || '');
      const conversationMessages = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMsg.content },
      ];

      for await (const event of svc.stream({
        model: selectedModelId,
        messages: conversationMessages,
        provider: selectedProviderId,
        providerKey: selectedProvider?.apiKey,
        providerBaseUrl: selectedProvider?.baseUrl,
      })) {
        if (event.type === 'error') throw new Error(event.error);
        setMessages((prev) => reduceAgentEvent(prev, event));
      }
    } catch (err) {
      appendError(err);
    } finally {
      setMessages((prev) => finalizeCurrent(prev));
      setIsLoading(false);
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
                <details className="text-xs text-gray-500 dark:text-gray-400 mb-2 italic">
                  <summary className="cursor-pointer not-italic">Thinking</summary>
                  <div className="whitespace-pre-wrap mt-1">{msg.thinking}</div>
                </details>
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
