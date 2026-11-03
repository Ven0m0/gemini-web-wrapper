import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '../utils/error';

interface ChatMessageBase {
  id: string;
  role: string;
  content: string;
  timestamp: number;
}

/** Shared chat state: messages, input, loading flag, auto-scroll and textarea auto-resize. */
export function useChatSession<M extends ChatMessageBase>() {
  const [messages, setMessages] = useState<M[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 180) + 'px';
    }
  }, [input]);

  const appendError = (err: unknown, extra?: Partial<M>) =>
    setMessages((prev) => [
      ...prev,
      {
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${errorMessage(err)}`,
        timestamp: Date.now(),
        ...extra,
      } as M,
    ]);

  return {
    messages,
    setMessages,
    input,
    setInput,
    isLoading,
    setIsLoading,
    messagesEndRef,
    textareaRef,
    appendError,
  };
}
