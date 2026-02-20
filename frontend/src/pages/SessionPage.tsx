import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, 
  Send, MessageSquare, Users, Settings, X 
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

const SessionPage = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // Appointment ID

  // Media Controls State
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [chatInput, setChatInput] = useState("");
  
  // Hardcoded Chat Messages
  const [messages, setMessages] = useState([
    { id: 1, sender: "Doctor", text: "Hello! How are you feeling today?", time: "10:00 AM" },
    { id: 2, sender: "Patient", text: "I'm feeling a bit better, but my shoulder still hurts when I lift it.", time: "10:01 AM" },
    { id: 3, sender: "Doctor", text: "I see. Let's try some specific movements to check the range.", time: "10:02 AM" },
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    const newMessage = {
      id: messages.length + 1,
      sender: "Me",
      text: chatInput,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages([...messages, newMessage]);
    setChatInput("");
  };

  return (
    <div className="h-screen bg-slate-950 flex flex-col md:flex-row overflow-hidden font-sans text-slate-100">
      
      {/* ─── LEFT: VIDEO STREAM AREA ─── */}
      <div className="flex-1 relative flex flex-col bg-black">
        {/* Main Video (Remote User) */}
        <div className="flex-1 flex items-center justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10 pointer-events-none" />
          
          {/* Placeholder for Remote Video */}
          <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-500">
            {isVideoOff ? (
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                  <VideoOff size={40} />
                </div>
                <p className="font-bold uppercase tracking-widest text-xs">Video Paused</p>
              </div>
            ) : (
              <img 
                src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=1000" 
                alt="Doctor" 
                className="w-full h-full object-cover"
              />
            )}
          </div>

          {/* Local Video Preview (Self) */}
          <div className="absolute top-6 right-6 w-32 h-44 md:w-48 md:h-32 bg-slate-800 rounded-2xl border-2 border-white/20 shadow-2xl overflow-hidden z-20">
             <div className="w-full h-full bg-slate-700 flex items-center justify-center italic text-[10px]">
               You
             </div>
          </div>

          {/* User Name Tag */}
          <div className="absolute bottom-24 left-6 z-20">
            <h2 className="text-lg font-bold">Dr. Sameer (Physiotherapist)</h2>
            <p className="text-xs text-teal-400 flex items-center gap-1">
               <span className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" /> Live Session
            </p>
          </div>
        </div>

        {/* Media Control Bar */}
        <div className="h-20 bg-slate-900/80 backdrop-blur-xl border-t border-white/5 flex items-center justify-center gap-4 px-6 z-30">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`p-4 rounded-2xl transition-all ${isMuted ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          
          <button 
            onClick={() => setIsVideoOff(!isVideoOff)}
            className={`p-4 rounded-2xl transition-all ${isVideoOff ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>

          <button 
            onClick={() => navigate(-1)}
            className="p-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl transition-all px-8 flex items-center gap-2 font-bold"
          >
            <PhoneOff size={20} /> <span className="hidden md:inline">End Session</span>
          </button>
        </div>
      </div>

      {/* ─── RIGHT: CHAT SIDEBAR ─── */}
      <div className="w-full md:w-[380px] bg-white flex flex-col h-full shadow-2xl z-40">
        {/* Chat Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <MessageSquare size={20} />
            </div>
            <h3 className="font-black text-slate-900">In-Call Messages</h3>
          </div>
          <button className="text-slate-400 hover:text-slate-600"><Settings size={18}/></button>
        </div>

        {/* Message Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.sender === 'Me' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                msg.sender === 'Me' 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : 'bg-white text-slate-700 shadow-sm border border-slate-100 rounded-tl-none'
              }`}>
                {msg.text}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.time}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-100">
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100 focus-within:border-indigo-500 transition-all">
            <input 
              type="text" 
              placeholder="Type your message..."
              className="flex-1 bg-transparent border-none outline-none text-sm text-slate-900 px-2"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
            />
            <button 
              type="submit"
              className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="text-center text-[9px] text-slate-400 mt-3 font-medium uppercase tracking-widest">
            Messages are visible only during this session
          </p>
        </form>
      </div>
    </div>
  );
};

export default SessionPage;