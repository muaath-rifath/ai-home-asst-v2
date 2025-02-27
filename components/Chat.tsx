"use client";

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import sendIcon from '../public/send.svg';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInput(event.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          prompt: input,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      if (data.success) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.response,
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(data.message || 'AI error');
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Sorry, there was an error processing your request.',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      handleSubmit(event as unknown as React.FormEvent);
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-background relative">
      <div className="flex-1">
        <div className="w-full h-[calc(100vh-8rem)] flex overflow-y-auto hide-scrollbar">
          <div className={`w-full max-w-3xl mx-auto px-3 sm:px-4 py-8 ${messages.length === 0 ? 'h-[calc(100vh-8rem)] flex items-center justify-center' : ''}`}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center space-y-3 sm:space-y-4">
                <div className="rounded-full bg-primary/10 p-3 sm:p-4">
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-primary/25" />
                </div>
                <div className="text-center">
                  <h3 className="text-sm sm:text-base font-semibold">Welcome to Sol</h3>
                  <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
                    Your AI home assistant. Ask me anything about controlling your home or get insights about energy usage.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-5">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`group relative flex max-w-[85%] items-end gap-1.5 sm:gap-2 ${
                        message.role === 'user' ? 'flex-row-reverse' : ''
                      }`}
                    >
                      {message.role === 'assistant' && (
                        <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground flex-shrink-0">
                          <span className="text-xs sm:text-sm font-semibold">S</span>
                        </div>
                      )}
                      <div
                        className={`overflow-hidden rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        {message.role === 'assistant' ? (
                          <div className="prose prose-sm sm:prose dark:prose-invert max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm sm:text-base">{message.content}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="flex items-end gap-1.5 sm:gap-2">
                      <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground flex-shrink-0">
                        <span className="text-xs sm:text-sm font-semibold">S</span>
                      </div>
                      <div className="rounded-2xl bg-muted px-3 py-2.5 sm:px-4 sm:py-3">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 animate-bounce rounded-full bg-current"></div>
                          <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 animate-bounce rounded-full bg-current [animation-delay:0.2s]"></div>
                          <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 animate-bounce rounded-full bg-current [animation-delay:0.4s]"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 border-t bg-background/80 backdrop-blur-sm p-2 sm:p-4">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="flex items-end gap-1.5 sm:gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Message Sol..."
                className="w-full rounded-full bg-muted px-3 py-2 sm:px-4 sm:py-2.5 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={isLoading}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              aria-label="Send message"
            >
              <Image
                src={sendIcon}
                alt="Send"
                width={16}
                height={16}
                className="h-4 w-4 sm:h-5 sm:w-5 invert"
              />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chat;