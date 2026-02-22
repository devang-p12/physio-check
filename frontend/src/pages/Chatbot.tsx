import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, RotateCcw, ChevronDown, Paperclip, Mic } from 'lucide-react';

const SUGGESTED_PROMPTS = [
  "What exercises help with lower back pain?",
  "How do I know if I need physiotherapy?",
  "What should I do after a muscle strain?",
  "How long does recovery from a knee injury take?",
];

const TypingIndicator = () => (
  <div className="flex items-end gap-3 mb-6">
    <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center flex-shrink-0 shadow-lg">
      <Sparkles size={14} className="text-white" />
    </div>
    <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-sm px-5 py-4 shadow-sm">
      <div className="flex gap-1.5 items-center h-4">
        <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  </div>
);

const Message = ({ msg, isNew }) => {
  const isUser = msg.role === 'user';
  return (
    <div
      className={`flex items-end gap-3 mb-6 ${isUser ? 'flex-row-reverse' : ''} ${isNew ? 'animate-fadeIn' : ''}`}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center flex-shrink-0 shadow-lg">
          <Sparkles size={14} className="text-white" />
        </div>
      )}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-lg text-white text-xs font-black">
          Y
        </div>
      )}
      <div
        className={`max-w-[75%] px-5 py-4 text-sm leading-relaxed shadow-sm ${isUser
            ? 'bg-gradient-to-br from-teal-600 to-emerald-600 text-white rounded-2xl rounded-br-sm'
            : 'bg-white border border-slate-100 text-slate-700 rounded-2xl rounded-bl-sm'
          }`}
      >
        {msg.text}
        <div className={`text-[10px] mt-2 font-medium ${isUser ? 'text-indigo-200' : 'text-slate-400'}`}>
          {msg.time}
        </div>
      </div>
    </div>
  );
};

const ChatbotPage = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [newMsgIndex, setNewMsgIndex] = useState(null);
  const bottomRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const token = localStorage.getItem('token');
  const BASE_URL = "http://localhost:5000";

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchGreeting = async () => {
    try {
      setIsTyping(true);
      const res = await fetch(`${BASE_URL}/chatbot/greeting`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.reply) {
        setMessages([{ role: 'bot', text: data.reply, time: formatTime() }]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    fetchGreeting();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100);
  };

  const formatTime = () =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const sendMessage = async (text) => {
    const userText = (text || input).trim();
    if (!userText) return;

    const userMsg = { role: 'user', text: userText, time: formatTime() };
    setMessages(prev => {
      setNewMsgIndex(prev.length);
      return [...prev, userMsg];
    });
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
        setMessages(prev => {
          setNewMsgIndex(prev.length);
          return [...prev, { role: 'bot', text: botText, time: formatTime() }];
        });
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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleReset = () => {
    setMessages([]);
    setInput('');
    fetchGreeting();
    inputRef.current?.focus();
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="h-screen flex flex-col bg-[#FAF9F7] font-sans">

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        
        .font-display { font-family: 'Lora', Georgia, serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease forwards; }

        textarea { resize: none; }
        textarea:focus { outline: none; }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 999px; }
      `}</style>

      {/* ─── HEADER ─── */}
      <header className="font-body bg-white/80 backdrop-blur border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-teal-600 flex items-center justify-center shadow-lg shadow-teal-200">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <h1 className="font-display text-base font-semibold text-slate-900 leading-tight">PhysioAI</h1>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Your health assistant</p>
          </div>
        </div>
        <button
          onClick={handleReset}
          title="New conversation"
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 px-3 py-2 rounded-xl hover:bg-slate-100 transition-all font-medium"
        >
          <RotateCcw size={13} /> New chat
        </button>
      </header>

      {/* ─── CHAT AREA ─── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto font-body"
      >
        {isEmpty ? (
          /* ── EMPTY STATE ── */
          <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
            <div className="w-16 h-16 rounded-3xl bg-teal-600 flex items-center justify-center shadow-2xl shadow-teal-200 mb-6">
              <Sparkles size={28} className="text-white" />
            </div>
            <h2 className="font-display text-2xl text-slate-800 mb-2">How can I help you?</h2>
            <p className="text-slate-400 text-sm max-w-sm mb-10 leading-relaxed">
              Ask me anything about your symptoms, recovery, exercises, or appointments.
            </p>

            {/* Suggested prompts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(prompt)}
                  className="text-left px-4 py-3.5 rounded-2xl border border-slate-200 bg-white text-sm text-slate-600 hover:border-teal-300 hover:bg-teal-50/50 hover:text-teal-700 transition-all shadow-sm font-medium leading-snug"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto px-4 py-8">
            {messages.map((msg, i) => (
              <Message key={i} msg={msg} isNew={i === newMsgIndex} />
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-28 right-6 w-9 h-9 rounded-full bg-white border border-slate-200 shadow-lg flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all z-20 font-body"
        >
          <ChevronDown size={16} />
        </button>
      )}

      {/* ─── INPUT BAR ─── */}
      <div className="font-body bg-white/90 backdrop-blur border-t border-slate-100 px-4 py-4 flex-shrink-0">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-end gap-3 bg-white rounded-3xl border border-slate-200 shadow-lg shadow-slate-100 px-4 py-3 focus-within:border-teal-400 focus-within:shadow-teal-50 transition-all">
            <button className="text-slate-300 hover:text-slate-500 transition mb-0.5 flex-shrink-0">
              <Paperclip size={18} />
            </button>
            <textarea
              ref={inputRef}
              rows={1}
              className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 leading-relaxed font-body max-h-32 overflow-y-auto py-0.5"
              placeholder="Message PhysioAI..."
              value={input}
              onChange={e => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
              }}
              onKeyDown={handleKeyDown}
            />
            <div className="flex items-center gap-2 flex-shrink-0">
              <button className="text-slate-300 hover:text-slate-500 transition mb-0.5">
                <Mic size={18} />
              </button>
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isTyping}
                className="w-8 h-8 rounded-2xl bg-teal-600 flex items-center justify-center text-white shadow-lg shadow-teal-200 hover:shadow-teal-300 hover:scale-105 transition-all disabled:opacity-30 disabled:scale-100 disabled:shadow-none hover:bg-teal-700"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
          <p className="text-center text-[10px] text-slate-400 mt-3 font-medium">
            PhysioAI can make mistakes. Always consult your doctor for medical decisions.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatbotPage;