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
  ChevronRight
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
    formQuality?: {
      score: number;
    };
    totalDuration?: number;
  };
}

const PatientSessionHistory: React.FC = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchHistory();
  }, []);

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Filter & Pagination Logic
  const filteredSessions = sessions.filter(session => {
    const name = session.assignmentId?.exerciseId?.name || session.assignmentId?.customTemplateId?.name || "Exercise Session";
    return name.toLowerCase().includes(searchQuery.toLowerCase()) || session.status.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const totalPages = Math.ceil(filteredSessions.length / itemsPerPage);
  const currentSessions = filteredSessions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-12">
      {/* Header */}
      <nav className="bg-white px-6 py-4 flex items-center justify-between sticky top-0 z-30 border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/patient")}
            className="p-2 hover:bg-slate-50 rounded-lg text-slate-500 hover:text-teal-600 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Session History</h1>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Search & Stats Bar */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Your Activity Logs</h2>
            <p className="text-slate-500 text-sm mt-1">Review your past sessions and track your progress.</p>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search by exercise name..." 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm w-full md:w-64 shadow-sm"
            />
          </div>
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center max-w-2xl mx-auto">
            <AlertCircle size={32} className="mx-auto text-red-500 mb-2" />
            <p className="text-red-700 font-bold">{error}</p>
            <button
              onClick={fetchHistory}
              className="mt-4 text-sm font-bold bg-white text-red-600 border border-red-200 px-4 py-2 rounded-xl hover:bg-red-50 transition"
            >
              Try Again
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-3xl p-16 text-center shadow-sm max-w-2xl mx-auto mt-12">
            <Activity size={48} className="mx-auto text-slate-200 mb-4" />
            <h3 className="text-xl font-black text-slate-900">No sessions yet</h3>
            <p className="text-slate-500 mt-2 mb-8">Complete your first exercise session to see your history here.</p>
            <button
              onClick={() => navigate("/patient")}
              className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-teal-200 transition-all"
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                 <thead className="bg-slate-50 border-b border-slate-100">
                   <tr>
                     <th className="py-4 px-6 text-[11px] font-black uppercase tracking-widest text-slate-500">Exercise Name</th>
                     <th className="py-4 px-6 text-[11px] font-black uppercase tracking-widest text-slate-500">Date & Time</th>
                     <th className="py-4 px-6 text-[11px] font-black uppercase tracking-widest text-slate-500">Analytics</th>
                     <th className="py-4 px-6 text-[11px] font-black uppercase tracking-widest text-slate-500">Status</th>
                     <th className="py-4 px-6 text-[11px] font-black uppercase tracking-widest text-slate-500 text-right">Details</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {currentSessions.map((session) => (
                      <tr 
                        key={session._id} 
                        onClick={() => navigate(`/patient/session/details/${session._id}`)}
                        className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                      >
                         <td className="py-5 px-6">
                           <div className="flex items-center gap-4">
                             <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600 shrink-0 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                               <Activity size={20} />
                             </div>
                             <p className="font-bold text-slate-900 group-hover:text-teal-700 transition">
                               {session.assignmentId?.exerciseId?.name || session.assignmentId?.customTemplateId?.name || "Exercise Session"}
                             </p>
                           </div>
                         </td>
                         <td className="py-5 px-6">
                           <div className="flex flex-col gap-1">
                             <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                               <Calendar size={14} className="text-teal-500" /> {formatDate(session.startTime)}
                             </span>
                             <span className="flex items-center gap-1.5 text-xs text-slate-500">
                               <Clock size={14} /> {formatTime(session.startTime)}
                             </span>
                           </div>
                         </td>
                         <td className="py-5 px-6">
                           <div className="flex items-center gap-4">
                              <div className="flex flex-col items-start gap-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400">Reps</span>
                                <span className="flex items-center gap-1 text-sm font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                                  <Dumbbell size={12} className="text-slate-500" /> {session.analytics?.repsCompleted ?? 0}
                                </span>
                              </div>
                              <div className="flex flex-col items-start gap-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400">Score</span>
                                <span className="flex items-center gap-1 text-sm font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                                  <Trophy size={12} className="text-amber-500" /> 
                                  {session.analytics?.formQuality?.score ? `${Math.round(session.analytics.formQuality.score)}%` : "N/A"}
                                </span>
                              </div>
                              <div className="flex flex-col items-start gap-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400">Duration</span>
                                <span className="flex items-center gap-1 text-sm font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                                  <Clock size={12} className="text-blue-500" /> 
                                  {formatDuration(session.analytics?.totalDuration)}
                                </span>
                              </div>
                           </div>
                         </td>
                         <td className="py-5 px-6">
                           <span className={`inline-block px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                             session.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 
                             session.status === 'in-progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                           }`}>
                             {session.status}
                           </span>
                         </td>
                         <td className="py-5 px-6 text-right">
                           <button className="text-teal-600 bg-teal-50 hover:bg-teal-100 px-4 py-2 rounded-lg text-sm font-bold transition flex items-center justify-end gap-1 ml-auto group-hover:bg-teal-600 group-hover:text-white">
                             View <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                           </button>
                         </td>
                      </tr>
                    ))}
                 </tbody>
               </table>
               
               {filteredSessions.length === 0 && !error && (
                  <div className="text-center py-20 bg-slate-50/50">
                    <p className="text-slate-400 font-medium">No sessions found matching your search.</p>
                  </div>
               )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <span className="text-sm text-slate-500 font-medium">
                  Page <span className="font-bold text-slate-900">{currentPage}</span> of <span className="font-bold text-slate-900">{totalPages}</span>
                </span>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 border border-slate-200 rounded-lg bg-white disabled:opacity-50 hover:bg-slate-50 transition"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 border border-slate-200 rounded-lg bg-white disabled:opacity-50 hover:bg-slate-50 transition"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default PatientSessionHistory;