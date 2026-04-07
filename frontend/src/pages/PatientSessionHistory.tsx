import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Clock,
  Activity,
  Calendar,
  ArrowRight,
  Trophy,
  AlertCircle,
  Dumbbell,
  Search,
  ChevronRight,
} from "lucide-react";

interface Session {
  _id: string;
  assignmentId: {
    _id: string;
    exerciseId?: { name: string };
    customTemplateId?: { name: string };
  };
  startTime: string;
  endTime?: string;
  status: string;
  analytics?: {
    repsCompleted?: number;
    formQuality?: { score: number };
    totalDuration?: number;
  };
}

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    completed: "bg-[#A8DADC]/20 text-[#1D3557] border border-[#A8DADC]/40",
    "in-progress": "bg-[#457B9D]/10 text-[#457B9D] border border-[#457B9D]/20",
    default: "bg-[#F1FAEE] text-[#1D3557]/60 border border-[#1D3557]/10",
  };
  const cls = styles[status] ?? styles["default"];
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${cls}`}>
      {status}
    </span>
  );
};

const PatientSessionHistory: React.FC = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  useEffect(() => { fetchHistory(); }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:5000/session/history", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to load session history");
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const filteredSessions = sessions.filter((session) => {
    const name = session.assignmentId?.exerciseId?.name || session.assignmentId?.customTemplateId?.name || "Exercise Session";
    return name.toLowerCase().includes(searchQuery.toLowerCase()) || session.status.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const totalPages = Math.ceil(filteredSessions.length / itemsPerPage);
  const currentSessions = filteredSessions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F1FAEE] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#A8DADC] border-t-[#1D3557] rounded-full animate-spin" />
          <p className="text-[#457B9D] font-bold text-sm uppercase tracking-widest">Loading sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans bg-[#F1FAEE] pb-20">

      {/* ── DEEP OCEAN HEADER ── */}
      <section className="relative w-full bg-gradient-to-br from-[#1D3557] via-[#1D3557] to-[#457B9D] px-6 py-12 md:px-12 md:py-16 overflow-hidden rounded-b-[3rem] shadow-2xl shadow-[#1D3557]/20 mb-10">

        {/* Decorative radial glow */}
        <div className="absolute top-[-20%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#A8DADC]/10 via-transparent to-transparent z-0 opacity-80" />
        {/* Grid texture */}
        <div className="absolute inset-0 z-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(rgba(168,218,220,1) 1px, transparent 1px), linear-gradient(90deg, rgba(168,218,220,1) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="max-w-7xl mx-auto relative z-10">
          <button
            onClick={() => navigate("/patient")}
            className="flex items-center text-[#A8DADC] font-bold text-sm mb-6 hover:text-white transition-colors group"
          >
            <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
          </button>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-[#F1FAEE] tracking-tight mb-2">Session History</h1>
              <p className="text-[#A8DADC] text-lg">Review your past sessions and track your recovery progress.</p>
            </div>

            {/* Stats chips */}
            <div className="flex flex-wrap gap-3">
              <div className="px-5 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-center">
                <div className="text-2xl font-black text-[#F1FAEE]">{sessions.length}</div>
                <div className="text-[10px] uppercase tracking-widest font-bold text-[#A8DADC]">Total Sessions</div>
              </div>
              <div className="px-5 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-center">
                <div className="text-2xl font-black text-[#F1FAEE]">
                  {sessions.filter(s => s.status === "completed").length}
                </div>
                <div className="text-[10px] uppercase tracking-widest font-bold text-[#A8DADC]">Completed</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 md:px-12">

        {/* Search bar */}
        <div className="flex justify-end mb-8">
          <div className="relative group w-full max-w-sm">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#457B9D]/60 transition-colors group-focus-within:text-[#457B9D]" size={18} />
            <input
              type="text"
              placeholder="Search by exercise or status..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-12 pr-4 py-3.5 bg-white border-2 border-[#F1FAEE] rounded-2xl text-[15px] focus:outline-none focus:ring-4 focus:ring-[#A8DADC]/20 focus:border-[#457B9D] transition-all font-semibold text-[#1D3557] shadow-md"
            />
          </div>
        </div>

        {/* Error state */}
        {error ? (
          <div className="bg-[#E63946]/10 border border-[#E63946]/20 p-8 rounded-3xl text-center max-w-xl mx-auto">
            <AlertCircle size={36} className="mx-auto mb-3 text-[#E63946]" />
            <p className="font-bold text-[#E63946] mb-4">{error}</p>
            <button
              onClick={fetchHistory}
              className="px-6 py-2.5 bg-white border border-[#E63946]/30 text-[#E63946] rounded-xl font-bold hover:bg-[#E63946] hover:text-white transition-all text-sm"
            >
              Try Again
            </button>
          </div>

        ) : sessions.length === 0 ? (
          <div className="bg-white rounded-3xl p-16 text-center shadow-xl shadow-[#1D3557]/5 border border-[#1D3557]/5 max-w-xl mx-auto mt-6">
            <Activity size={48} className="mx-auto mb-4 text-[#A8DADC]" />
            <h3 className="text-xl font-black text-[#1D3557] mb-2">No sessions yet</h3>
            <p className="text-[#457B9D] font-medium mb-8">Complete your first exercise session to see your history here.</p>
            <button
              onClick={() => navigate("/patient")}
              className="px-8 py-3.5 bg-[#1D3557] text-[#F1FAEE] rounded-2xl font-black uppercase tracking-widest hover:bg-[#457B9D] transition-all shadow-xl shadow-[#1D3557]/20"
            >
              Go to Dashboard
            </button>
          </div>

        ) : (
          <>
            {/* Session Cards Grid */}
            <div className="flex flex-col gap-4">
              {currentSessions.map((session) => {
                const name = session.assignmentId?.exerciseId?.name || session.assignmentId?.customTemplateId?.name || "Exercise Session";
                const score = session.analytics?.formQuality?.score;
                const reps = session.analytics?.repsCompleted ?? 0;
                const duration = session.analytics?.totalDuration;

                return (
                  <div
                    key={session._id}
                    onClick={() => navigate(`/patient/session/details/${session._id}`)}
                    className="bg-white rounded-2xl px-6 py-5 shadow-md shadow-[#1D3557]/[0.04] border border-[#1D3557]/5 flex items-center gap-5 cursor-pointer hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#1D3557]/[0.06] transition-all duration-200 relative overflow-hidden group"
                  >
                    {/* Hover glow left accent */}
                    <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#457B9D] to-[#A8DADC] opacity-0 group-hover:opacity-100 transition-opacity rounded-l-2xl" />

                    {/* Icon */}
                    <div className="w-12 h-12 bg-[#457B9D]/10 rounded-2xl flex items-center justify-center text-[#457B9D] shrink-0 border border-[#457B9D]/20 group-hover:bg-[#457B9D] group-hover:text-[#F1FAEE] transition-all">
                      <Activity size={22} />
                    </div>

                    {/* Exercise name + date */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-[#1D3557] text-[16px] leading-tight truncate">{name}</h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Calendar size={12} className="text-[#457B9D]" />
                        <span className="text-[12px] font-semibold text-[#457B9D]">{formatDate(session.startTime)}</span>
                        <span className="text-[#1D3557]/20 mx-1">•</span>
                        <Clock size={12} className="text-[#457B9D]/50" />
                        <span className="text-[12px] font-semibold text-[#457B9D]/50">{formatTime(session.startTime)}</span>
                      </div>
                    </div>

                    {/* Analytics pills */}
                    <div className="hidden md:flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1.5 bg-[#F1FAEE] border border-[#A8DADC]/40 px-3 py-2 rounded-xl">
                        <Dumbbell size={14} className="text-[#457B9D]" />
                        <span className="text-[13px] font-black text-[#1D3557]">{reps}</span>
                        <span className="text-[10px] uppercase tracking-wider font-bold text-[#457B9D]/60">reps</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-[#F1FAEE] border border-[#A8DADC]/40 px-3 py-2 rounded-xl">
                        <Trophy size={14} className="text-[#457B9D]" />
                        <span className="text-[13px] font-black text-[#1D3557]">{score ? `${Math.round(score)}%` : "—"}</span>
                        <span className="text-[10px] uppercase tracking-wider font-bold text-[#457B9D]/60">score</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-[#F1FAEE] border border-[#A8DADC]/40 px-3 py-2 rounded-xl">
                        <Clock size={14} className="text-[#457B9D]" />
                        <span className="text-[13px] font-black text-[#1D3557]">{formatDuration(duration)}</span>
                      </div>
                    </div>

                    {/* Status + action */}
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <StatusBadge status={session.status} />
                      <div className="w-9 h-9 rounded-xl bg-[#F1FAEE] border border-[#A8DADC]/30 flex items-center justify-center text-[#457B9D] group-hover:bg-[#457B9D] group-hover:text-[#F1FAEE] transition-all">
                        <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Empty search result */}
            {filteredSessions.length === 0 && (
              <div className="text-center py-20 bg-white rounded-3xl border border-[#1D3557]/5 shadow-xl shadow-[#1D3557]/[0.02]">
                <Search className="mx-auto text-[#A8DADC] mb-4" size={44} />
                <p className="text-[#457B9D] font-bold text-lg">No sessions found matching "{searchQuery}".</p>
                <p className="text-[#1D3557]/40 mt-1 text-sm">Try adjusting your search terms.</p>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-10 bg-white px-6 py-5 rounded-[2rem] shadow-lg shadow-[#1D3557]/[0.02] border border-[#1D3557]/5">
                <span className="text-sm text-[#457B9D] font-bold">
                  Page <span className="text-[#1D3557]">{currentPage}</span> of <span className="text-[#1D3557]">{totalPages}</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="w-10 h-10 flex items-center justify-center border-2 border-[#F1FAEE] rounded-xl bg-white text-[#457B9D] disabled:opacity-40 hover:border-[#A8DADC] hover:text-[#1D3557] transition-all font-bold"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`w-10 h-10 rounded-xl text-[14px] font-black transition-all ${currentPage === i + 1 ? "bg-[#1D3557] text-white shadow-md shadow-[#1D3557]/30" : "bg-transparent text-[#457B9D] hover:bg-[#F1FAEE]"}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="w-10 h-10 flex items-center justify-center border-2 border-[#F1FAEE] rounded-xl bg-white text-[#457B9D] disabled:opacity-40 hover:border-[#A8DADC] hover:text-[#1D3557] transition-all font-bold"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PatientSessionHistory;