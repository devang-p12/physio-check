import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, RotateCcw, ChevronDown, Mic, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SUGGESTED_PROMPTS = [
  "What exercises help with lower back pain?",
  "How do I know if I need physiotherapy?",
  "What should I do after a muscle strain?",
  "How long does recovery from a knee injury take?",
  "What are the best stretches for tight hamstrings?",
  "Can physiotherapy help with posture correction?",
];

const TypingIndicator = () => (
  <div className="flex items-end gap-3 mb-5">
    <div className="w-8 h-8 rounded-xl bg-[#457B9D] flex items-center justify-center flex-shrink-0 shadow-md shadow-[#457B9D]/30">
      <Sparkles size={14} className="text-[#F1FAEE]" />
    </div>
    <div className="bg-white border border-[#A8DADC]/40 rounded-2xl rounded-bl-sm px-5 py-3.5 shadow-sm">
      <div className="flex gap-1.5 items-center h-4">
        <span className="w-2 h-2 rounded-full bg-[#A8DADC] animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 rounded-full bg-[#457B9D] animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 rounded-full bg-[#1D3557] animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  </div>
);

const Message = ({ msg, isNew }: { msg: any; isNew: boolean }) => {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex items-end gap-3 mb-5 ${isUser ? 'flex-row-reverse' : ''} ${isNew ? 'animate-fadeIn' : ''}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-[#457B9D] flex items-center justify-center flex-shrink-0 shadow-md shadow-[#457B9D]/30">
          <Sparkles size={14} className="text-[#F1FAEE]" />
        </div>
      )}
      {isUser && (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1D3557] to-[#457B9D] flex items-center justify-center flex-shrink-0 shadow-md text-[#F1FAEE] text-xs font-black">
          Y
        </div>
      )}
      <div className={`max-w-[78%] px-5 py-3.5 text-[15px] leading-relaxed ${
        isUser
          ? 'bg-gradient-to-br from-[#1D3557] to-[#457B9D] text-[#F1FAEE] rounded-2xl rounded-br-sm shadow-md shadow-[#1D3557]/20'
          : 'bg-white border border-[#A8DADC]/30 text-[#1D3557] rounded-2xl rounded-bl-sm shadow-sm'
      }`}>
        {msg.text}
        <div className={`text-[10px] mt-2 font-semibold ${isUser ? 'text-[#A8DADC]' : 'text-[#457B9D]/50'}`}>
          {msg.time}
        </div>
      </div>
    </div>
  );
};

const ChatbotPage = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [newMsgIndex, setNewMsgIndex] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const token = localStorage.getItem('token');
  const BASE_URL = "http://localhost:5000";

  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

  const fetchGreeting = async () => {
    try {
      setIsTyping(true);
      const res = await fetch(`${BASE_URL}/chatbot/greeting`, {
        headers: { 'Authorization': `Bearer ${token}` },
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

  useEffect(() => { fetchGreeting(); }, []);
  useEffect(() => { scrollToBottom(); }, [messages, isTyping]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100);
  };

  const formatTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const sendMessage = async (text?: string) => {
    const userText = (text || input).trim();
    if (!userText) return;

    setMessages(prev => {
      setNewMsgIndex(prev.length);
      return [...prev, { role: 'user', text: userText, time: formatTime() }];
    });
    setInput('');
    setIsTyping(true);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    try {
      const res = await fetch(`${BASE_URL}/chatbot/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ message: userText, chatHistory: JSON.stringify(messages) }),
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
    } catch {
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

  const handleReset = () => {
    setMessages([]);
    setInput('');
    fetchGreeting();
    inputRef.current?.focus();
  };

  const isEmpty = messages.length === 0;

  /* ──────────── INPUT BOX (shared, rendered in two positions) ──────────── */
  const InputBox = () => (
    <div className={`w-full ${isEmpty ? 'max-w-2xl' : 'max-w-3xl'} mx-auto`}>
      <div className="flex items-end gap-3 bg-white rounded-3xl border-2 border-[#F1FAEE] shadow-xl shadow-[#1D3557]/5 px-5 py-3 focus-within:border-[#457B9D] focus-within:shadow-[#A8DADC]/20 transition-all">
        <textarea
          ref={inputRef}
          rows={1}
          className="flex-1 bg-transparent text-[15px] text-[#1D3557] placeholder-[#457B9D]/40 leading-relaxed max-h-36 overflow-y-auto py-1 font-medium"
          style={{ resize: 'none' }}
          placeholder="Message PhysioAI..."
          value={input}
          onChange={e => {
            setInput(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 144) + 'px';
          }}
          onKeyDown={handleKeyDown}
        />
        <div className="flex items-center gap-2 flex-shrink-0">
          <button className="text-[#457B9D]/40 hover:text-[#457B9D] transition mb-0.5">
            <Mic size={18} />
          </button>
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isTyping}
            className="w-9 h-9 rounded-2xl bg-[#457B9D] flex items-center justify-center text-[#F1FAEE] shadow-lg shadow-[#457B9D]/30 hover:bg-[#A8DADC] hover:text-[#1D3557] hover:shadow-[#A8DADC]/40 hover:scale-105 transition-all disabled:opacity-30 disabled:scale-100 disabled:shadow-none"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
      <p className="text-center text-[10px] text-[#457B9D]/40 mt-3 font-semibold">
        PhysioAI can make mistakes. Always consult your doctor for medical decisions.
      </p>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-[#F1FAEE] font-sans overflow-hidden">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease forwards; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(168,218,220,0.5); border-radius: 999px; }
        .prompt-scroll::-webkit-scrollbar { height: 0; }
      `}</style>

      {/* ─── MINIMAL TOP BAR ─── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#A8DADC]/20 bg-[#F1FAEE]/80 backdrop-blur-md flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1D3557] to-[#457B9D] flex items-center justify-center shadow-md shadow-[#1D3557]/20">
            <Sparkles size={16} className="text-[#F1FAEE]" />
          </div>
          <div>
            <h1 className="text-[#1D3557] text-[15px] font-black tracking-tight leading-none">PhysioAI</h1>
            <p className="text-[#457B9D]/60 text-[10px] font-bold uppercase tracking-widest mt-0.5">Health Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-[#457B9D] hover:text-[#1D3557] px-3 py-2 rounded-xl bg-white border border-[#A8DADC]/30 shadow-sm hover:shadow-md transition-all font-bold"
          >
            <RotateCcw size={12} /> New chat
          </button>
        </div>
      </header>

      {/* ─── MAIN CONTENT AREA ─── */}
      {isEmpty ? (
        /* ── CHATGPT-STYLE CENTERED EMPTY STATE ── */
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-6">
          
          {/* Branding */}
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#1D3557] to-[#457B9D] flex items-center justify-center shadow-2xl shadow-[#1D3557]/25">
              <Sparkles size={36} className="text-[#F1FAEE]" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-[#A8DADC] rounded-full border-2 border-[#F1FAEE] flex items-center justify-center shadow-sm">
              <Activity size={11} className="text-[#1D3557]" />
            </div>
          </div>

          <h2 className="text-3xl font-black text-[#1D3557] tracking-tight mb-2 text-center">How can I help you today?</h2>
          <p className="text-[#457B9D] text-[15px] mb-10 max-w-sm text-center leading-relaxed font-medium">
            Ask me about recovery exercises, symptoms, or physiotherapy advice.
          </p>

          {/* ── CENTERED INPUT BOX ── */}
          <div className="w-full max-w-2xl mb-8">
            <InputBox />
          </div>

          {/* ── SINGLE HORIZONTAL SCROLLABLE SUGGESTIONS ── */}
          <div className="w-full max-w-2xl overflow-hidden">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#457B9D]/60 mb-3 text-center">Suggested questions</p>
            <div className="prompt-scroll flex gap-3 overflow-x-auto pb-2 px-1">
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(prompt)}
                  className="flex-shrink-0 text-left px-4 py-3 rounded-2xl bg-white border border-[#A8DADC]/40 shadow-sm text-sm text-[#1D3557] font-semibold hover:border-[#457B9D] hover:shadow-md hover:-translate-y-0.5 transition-all whitespace-nowrap"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ── CONVERSATION VIEW ── */
        <>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto"
          >
            <div className="max-w-3xl mx-auto px-4 py-8">
              {messages.map((msg, i) => (
                <Message key={i} msg={msg} isNew={i === newMsgIndex} />
              ))}
              {isTyping && <TypingIndicator />}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Scroll to bottom */}
          {showScrollBtn && (
            <button
              onClick={scrollToBottom}
              className="fixed bottom-28 right-6 w-10 h-10 rounded-full bg-[#1D3557] shadow-xl shadow-[#1D3557]/20 flex items-center justify-center text-[#F1FAEE] hover:bg-[#457B9D] transition-all z-20"
            >
              <ChevronDown size={16} />
            </button>
          )}

          {/* ── INPUT PINNED TO BOTTOM ── */}
          <div className="bg-[#F1FAEE]/90 backdrop-blur-xl border-t border-[#A8DADC]/20 px-4 pt-4 pb-5 flex-shrink-0 shadow-xl shadow-[#1D3557]/5">
            <InputBox />
          </div>
        </>
      )}
    </div>
  );
};

export default ChatbotPage;