import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Bot, Send } from 'lucide-react';

interface FloatingChatbotProps {
  open: boolean;
  onToggle: () => void;
}

const TypingIndicator = () => (
  <div className="flex items-end gap-2 mb-3">
    <div className="w-6 h-6 rounded-full bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-center justify-center flex-shrink-0 shadow-sm">
      <Bot size={12} className="text-[var(--text-primary)]" />
    </div>
    <div className="bg-[var(--bg-surface-2)] rounded-2xl rounded-bl-sm px-3 py-2 border border-[var(--border-default)] shadow-sm">
      <div className="flex gap-1 items-center h-4">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  </div>
);

const Message = ({ msg }: { msg: any }) => {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex items-end gap-2 mb-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent)' }}>
          <Bot size={12} className="text-white" />
        </div>
      )}
      <div
        className={`max-w-[80%] px-[14px] py-[10px] text-[13px] leading-[1.5] shadow-sm ${
          isUser
            ? 'rounded-2xl rounded-tr-sm text-white'
            : 'rounded-2xl rounded-bl-sm text-primary'
        }`}
        style={{
          background: isUser ? 'var(--accent)' : 'var(--bg-surface-2)',
          color: isUser ? 'white' : 'var(--text-primary)',
          borderLeft: !isUser ? '3px solid var(--accent)' : 'none',
        }}
      >
        {msg.text}
        <div className="text-[11px] mt-1" style={{ color: isUser ? '#B08070' : 'var(--text-muted)' }}>
          {msg.time}
        </div>
      </div>
    </div>
  );
};

export default function FloatingChatbot({ open, onToggle }: FloatingChatbotProps) {
  const doctorName = localStorage.getItem("name") || "Doctor";
  const [messages, setMessages] = useState<any[]>([
    {
      role: 'bot',
      text: `Hi Dr. ${doctorName}! I'm your PhysioCheck AI assistant. I can help with patient recovery plans, exercise recommendations, and clinical insights. How can I help?`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const token = localStorage.getItem('token');
  const BASE_URL = "http://localhost:5000";

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (open) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, messages, isTyping]);

  const formatTime = () =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const sendMessage = async () => {
    const userText = input.trim();
    if (!userText) return;

    const userMsg = { role: 'user', text: userText, time: formatTime() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const res = await fetch(`${BASE_URL}/chatbot/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userText,
          chatHistory: JSON.stringify(messages)
        }),
      });

      const data = await res.json();
      const botText = data.reply || "I'm sorry, I couldn't understand that. Please try again.";

      setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [...prev, { role: 'bot', text: botText, time: formatTime() }]);
      }, 600);
    } catch (err) {
      setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [...prev, {
          role: 'bot',
          text: "Sorry, I'm having trouble connecting right now. Please try again shortly.",
          time: formatTime(),
        }]);
      }, 600);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      <button
        onClick={onToggle}
        className="fixed z-[100] flex items-center justify-center cursor-pointer transition-all hover:scale-105"
        style={{
          bottom: '28px',
          right: '28px',
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'var(--accent)',
          boxShadow: '0 4px 16px var(--shadow-fab)',
        }}
      >
        <div style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {open ? <X size={22} color="white" /> : <MessageCircle size={22} color="white" />}
        </div>
      </button>

      {open && (
        <div
          className="fixed z-[99] flex flex-col shadow-2xl transition-all"
          style={{
            bottom: '92px',
            right: '28px',
            width: '360px',
            height: '520px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: '16px',
            animation: 'fadeInUp 0.2s ease forwards',
          }}
        >
          <style>{`
            @keyframes fadeInUp {
              from { opacity: 0; transform: translateY(12px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          
          {/* Header */}
          <div 
            className="flex items-center justify-between px-4"
            style={{ 
              height: '48px', 
              background: 'var(--accent)', 
              borderRadius: '15px 15px 0 0' 
            }}
          >
            <div className="flex items-center gap-2">
              <Bot size={18} color="white" />
              <span className="text-white text-[14px] font-medium">AI Assistant</span>
            </div>
            <div className="px-2 py-0.5 rounded-full bg-white flex items-center justify-center">
              <span className="text-[10px] font-bold" style={{ color: 'var(--accent)' }}>PhysioCheck AI</span>
            </div>
          </div>

          {/* Chat area */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col" style={{ background: 'var(--bg-surface)' }}>
            {messages.map((msg, i) => (
              <Message key={i} msg={msg} />
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div 
            className="flex items-center gap-2 px-3 relative"
            style={{ 
              height: '56px', 
              borderTop: '1px solid var(--border-default)',
              background: 'var(--bg-surface)',
              borderRadius: '0 0 15px 15px' 
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about a patient or exercise…"
              className="flex-1 h-full bg-transparent border-none outline-none text-[13px]"
              style={{ color: 'var(--text-primary)' }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isTyping}
              className="w-8 h-8 rounded-full flex flex-shrink-0 items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'var(--accent)' }}
            >
              <Send size={14} color="white" style={{ marginLeft: '-2px' }} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
