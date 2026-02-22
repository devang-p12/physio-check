import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Send,
  Bot,
  User,
  Loader2,
  Activity,
  TrendingUp,
  ChevronRight,
  Sparkles,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SessionSummary {
  exerciseName: string;
  exerciseMode: "workout" | "stretch";
  reps: number;
  targetReps: number;
  formScore: number;
  bestStretchDist?: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface PostSessionChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  sessionSummary: SessionSummary;
  assignmentId: string;
}

// ─── Quick-reply chips ────────────────────────────────────────────────────────

const QUICK_REPLIES = [
  "How can I improve my form?",
  "What muscles am I working?",
  "Does this exercise help with pain relief?",
  "How often should I do this?",
  "Am I ready to progress?",
];

// ─── System prompt builder ────────────────────────────────────────────────────

function buildSystemPrompt(summary: SessionSummary, patient: any): string {
  // Extract data safely from your MongoDB object
  const pName = patient?.name || "the patient";
  const pCondition = patient?.condition || "general rehabilitation";
  const pNotes = patient?.notes || "No specific therapist notes provided.";

  return `You are PhysioBot, a clinical assistant for PhysioCheck. 
  
PATIENT CONTEXT (from DB):
- Name: ${pName}
- Diagnosis: ${pCondition}
- Therapist Notes: ${pNotes}

SESSION PERFORMANCE:
- Exercise: ${summary.exerciseName}
- Score: ${summary.formScore}% 
- Reps: ${summary.reps}/${summary.targetReps}

TASK:
Generate a concise "Session Clinical Report". 
Use this exact structure:
1. **Summary**: A professional assessment of today's performance.
2. **Clinical Correlation**: How this specific exercise helps their ${pCondition}.
3. **Recommendation**: One technical adjustment or recovery tip.
4. **Safety**: A brief reminder to monitor for specific pain related to their condition.

Tone: Professional, clinical, yet encouraging. Max 120 words.`;
}
// ─── Gemini API call — proxied through backend ────────────────────────────────

async function callGemini(
  sysPrompt: string,
  history: Message[],
  userMessage: string
): Promise<string> {
  const contents = [
    { role: "user", parts: [{ text: sysPrompt }] },
    {
      role: "model",
      parts: [{ text: "Understood. I am PhysioBot, ready to assist the patient with their physiotherapy session recap." }],
    },
    ...history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    { role: "user", parts: [{ text: userMessage }] },
  ];

  const token = localStorage.getItem("token");
  const res = await fetch("http://localhost:5000/api/gemini/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ contents }),
  });

  if (!res.ok) {
    // Pass full server error so catch block can extract the friendly message
    const errData = await res.json().catch(() => ({}));
    throw new Error(JSON.stringify(errData));
  }

  const data = await res.json();
  return data.text ?? "I couldn't generate a response. Please try again.";
}

// ─── Component ────────────────────────────────────────────────────────────────

const PostSessionChatbot: React.FC<PostSessionChatbotProps> = ({
  isOpen,
  onClose,
  sessionSummary,
  assignmentId,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [patient, setPatient] = useState<any>(null);
  const [quickRepliesVisible, setQuickRepliesVisible] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasInitialized = useRef(false);
  const lastRequestTime = useRef(0);
  const MIN_GAP_MS = 6000; // must match backend cooldown

  // ── Scroll to bottom ──────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Init on open ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || hasInitialized.current) return;
    hasInitialized.current = true;

    const init = async () => {
  setIsLoading(true);
  const token = localStorage.getItem("token");

  try {
    // 1. Fetch patient profile (MongoDB)
    const res = await fetch("http://localhost:5000/patient/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    let fetchedPatient = null;
    if (res.ok) {
      const data = await res.json();
      // Adjust this line based on your actual API response structure
      fetchedPatient = data.patient || data.user || data;
      setPatient(fetchedPatient);
    }

    // 2. Build the system prompt with the data we just got
    const prompt = buildSystemPrompt(sessionSummary, fetchedPatient);
    setSystemPrompt(prompt);

    // 3. Immediately trigger the Report generation
    // We pass the "Generate report" command as the first user message
    const reportMsg = await callGemini(
      prompt, 
      [], 
      "Please analyze my session data and my medical history to provide my recovery report."
    );

    setMessages([{ 
      role: "assistant", 
      content: reportMsg, 
      timestamp: new Date() 
    }]);

  } catch (error) {
    console.error("Report generation failed:", error);
    setMessages([{ 
      role: "assistant", 
      content: "I've processed your session, but I'm having trouble generating the detailed report. You did great!", 
      timestamp: new Date() 
    }]);
  } finally {
    setQuickRepliesVisible(true);
    setIsLoading(false);
  }
};

    init();
  }, [isOpen]);

  // ── Reset on close ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      hasInitialized.current = false;
      setMessages([]);
      setQuickRepliesVisible(false);
      setInput("");
      lastRequestTime.current = 0;
    }
  }, [isOpen]);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      // Client-side cooldown guard (mirrors backend 6s limit)
      const now = Date.now();
      const elapsed = now - lastRequestTime.current;
      if (elapsed < MIN_GAP_MS) {
        const waitSecs = Math.ceil((MIN_GAP_MS - elapsed) / 1000);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Please wait ${waitSecs} more second${waitSecs > 1 ? "s" : ""} before sending another message.`,
            timestamp: new Date(),
          },
        ]);
        return;
      }

      setQuickRepliesVisible(false);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: trimmed, timestamp: new Date() },
      ]);
      setInput("");
      setIsLoading(true);
      lastRequestTime.current = Date.now();

      try {
        const reply = await callGemini(systemPrompt, messages, trimmed);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: reply, timestamp: new Date() },
        ]);
      } catch (e: any) {
        // Extract server's friendly message if available
        let errMsg = "Sorry, I had trouble connecting. Please try again.";
        try {
          const parsed = JSON.parse(e.message);
          if (parsed?.message) errMsg = parsed.message;
        } catch {
          if (e.message?.includes("429")) {
            errMsg = "I'm a little busy right now. Please wait a few seconds and try again.";
          }
        }
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: errMsg, timestamp: new Date() },
        ]);
      } finally {
        setIsLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [isLoading, messages, systemPrompt]
  );

  // ── Performance grade ─────────────────────────────────────────────────────
  const completionPct = Math.round(
    (sessionSummary.reps / Math.max(sessionSummary.targetReps, 1)) * 100
  );
  const formGrade =
    sessionSummary.formScore >= 80
      ? { label: "Excellent", color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30" }
      : sessionSummary.formScore >= 60
        ? { label: "Good", color: "text-teal-400", bg: "bg-teal-500/15 border-teal-500/30" }
        : sessionSummary.formScore >= 40
          ? { label: "Fair", color: "text-yellow-400", bg: "bg-yellow-500/15 border-yellow-500/30" }
          : { label: "Keep Trying", color: "text-slate-400", bg: "bg-slate-700/50 border-slate-600" };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-lg h-[90vh] max-h-[760px] flex flex-col rounded-3xl overflow-hidden shadow-2xl border border-slate-700/80"
          style={{ background: "linear-gradient(160deg, #0f172a 0%, #1e293b 50%, #0f1a2e 100%)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="shrink-0 px-5 pt-5 pb-4 border-b border-slate-700/60">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/30">
                  <Bot size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-white font-extrabold text-base leading-none">PhysioBot</h2>
                  <p className="text-teal-400 text-[11px] font-medium mt-0.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-pulse" />
                    AI Recovery Assistant
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-700/60 hover:bg-slate-600 text-slate-400 hover:text-white transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Session summary chips */}
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700/50 border border-slate-600/50">
                <Activity size={13} className="text-teal-400" />
                <span className="text-white text-xs font-semibold">{sessionSummary.exerciseName}</span>
              </div>
              {sessionSummary.exerciseMode === "workout" ? (
                <>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700/50 border border-slate-600/50">
                    <TrendingUp size={13} className="text-violet-400" />
                    <span className="text-white text-xs font-semibold">
                      {sessionSummary.reps}/{sessionSummary.targetReps} reps
                    </span>
                    <span
                      className={`text-[10px] font-bold ${completionPct >= 100 ? "text-emerald-400" : "text-slate-400"
                        }`}
                    >
                      ({completionPct}%)
                    </span>
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${formGrade.bg}`}>
                    <Sparkles size={13} className={formGrade.color} />
                    <span className={`text-xs font-bold ${formGrade.color}`}>
                      Form: {sessionSummary.formScore}% — {formGrade.label}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500/15 border border-violet-500/30">
                    <TrendingUp size={13} className="text-violet-400" />
                    <span className="text-violet-300 text-xs font-semibold">
                      {sessionSummary.reps}/{sessionSummary.targetReps} reps
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/30">
                    <TrendingUp size={13} className="text-fuchsia-400" />
                    <span className="text-fuchsia-300 text-xs font-semibold">
                      Range:{" "}
                      {sessionSummary.bestStretchDist != null
                        ? sessionSummary.bestStretchDist.toFixed(2)
                        : "N/A"}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Messages ── */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`shrink-0 w-7 h-7 rounded-xl flex items-center justify-center ${msg.role === "assistant"
                    ? "bg-gradient-to-br from-teal-500 to-emerald-600 shadow-md shadow-teal-500/30"
                    : "bg-slate-600"
                    }`}
                >
                  {msg.role === "assistant" ? (
                    <Bot size={14} className="text-white" />
                  ) : (
                    <User size={14} className="text-white" />
                  )}
                </div>
                <div
                  className={`max-w-[82%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === "assistant"
                    ? "bg-slate-700/60 border border-slate-600/50 text-slate-100 rounded-tl-sm"
                    : "bg-teal-500 text-white rounded-tr-sm shadow-md shadow-teal-500/20"
                    }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-7 h-7 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
                  <Bot size={14} className="text-white" />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-slate-700/60 border border-slate-600/50 flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Quick replies ── */}
          {quickRepliesVisible && !isLoading && (
            <div className="shrink-0 px-4 pb-2">
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">
                Suggested Questions
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_REPLIES.map((qr) => (
                  <button
                    key={qr}
                    onClick={() => sendMessage(qr)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-700/70 border border-slate-600 hover:border-teal-500/60 hover:bg-slate-600/70 text-slate-300 hover:text-white text-xs font-medium transition-all"
                  >
                    <ChevronRight size={11} className="text-teal-400" />
                    {qr}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Input ── */}
          <div className="shrink-0 px-4 py-4 border-t border-slate-700/60">
            <div className="flex items-center gap-3 bg-slate-700/50 border border-slate-600/60 rounded-2xl px-4 py-2.5 focus-within:border-teal-500/50 focus-within:bg-slate-700/70 transition">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
                placeholder="Ask about your recovery..."
                className="flex-1 bg-transparent text-white text-sm placeholder-slate-500 outline-none"
                disabled={isLoading}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all active:scale-95 shadow-md shadow-teal-500/30"
              >
                {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
            <p className="text-center text-[10px] text-slate-600 mt-2">
              Powered by Gemini · Not a substitute for professional advice
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default PostSessionChatbot;