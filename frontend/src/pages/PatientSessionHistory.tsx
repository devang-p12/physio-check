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
  Dumbbell
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-12">
      {/* Header */}
      <nav className="bg-white px-6 py-4 flex items-center gap-4 sticky top-0 z-30 border-b border-slate-100 shadow-sm">
        <button
          onClick={() => navigate("/patient")}
          className="p-2 hover:bg-slate-50 rounded-lg text-slate-500 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">Session History</h1>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {error ? (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
            <AlertCircle size={32} className="mx-auto text-red-400 mb-2" />
            <p className="text-red-700 font-medium">{error}</p>
            <button
              onClick={fetchHistory}
              className="mt-4 text-sm font-bold text-red-600 hover:text-red-800"
            >
              Try Again
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-white border rounded-2xl p-12 text-center shadow-sm">
            <Activity size={48} className="mx-auto text-slate-200 mb-4" />
            <h3 className="text-lg font-bold text-slate-900">No sessions yet</h3>
            <p className="text-slate-500 mt-1 mb-6">Complete your first exercise to see your history here.</p>
            <button
              onClick={() => navigate("/patient")}
              className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2.5 rounded-xl font-bold transition-all"
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div
                key={session._id}
                onClick={() => navigate(`/patient/session/details/${session._id}`)}
                className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-teal-200 transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg group-hover:text-teal-700 transition-colors">
                      {session.assignmentId?.exerciseId?.name ||
                        session.assignmentId?.customTemplateId?.name ||
                        "Exercise Session"}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-slate-500 text-sm">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={14} /> {formatDate(session.startTime)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={14} /> {formatTime(session.startTime)}
                      </span>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${session.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                    }`}>
                    {session.status}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mb-1">Reps</p>
                    <div className="flex items-center gap-1.5 text-slate-900">
                      <Dumbbell size={14} className="text-teal-500" />
                      <span className="font-bold">{session.analytics?.repsCompleted ?? 0}</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mb-1">Form</p>
                    <div className="flex items-center gap-1.5 text-slate-900">
                      <Trophy size={14} className="text-amber-500" />
                      <span className="font-bold">
                        {session.analytics?.formQuality?.score ? `${Math.round(session.analytics.formQuality.score)}%` : "N/A"}
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 font-medium">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mb-1">Duration</p>
                    <div className="flex items-center gap-1.5 text-slate-900">
                      <Clock size={14} className="text-blue-500" />
                      <span className="font-bold">{formatDuration(session.analytics?.totalDuration)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end text-sm font-bold text-teal-600 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  View Details <ArrowRight size={16} />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default PatientSessionHistory;