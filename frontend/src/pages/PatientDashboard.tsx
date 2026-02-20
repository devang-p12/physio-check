import React, { useEffect, useState } from "react";
import {
  Activity,
  Play,
  CheckCircle2,
  Flame,
  Trophy,
  Clock,
  LogOut,
  Settings,
  Dumbbell,
  TrendingUp,
  ChevronRight,
  Bell,
  UserRoundSearch,
  MessageCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const PatientDashboard = () => {
  const navigate = useNavigate();
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [patientName, setPatientName] = useState("Patient");
  const [streak, setStreak] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [calendar, setCalendar] = useState<Record<string, number>>({});

  useEffect(() => {
    const name = localStorage.getItem("name");
    if (name) setPatientName(name);
    fetchTodayExercises();

    // Re-fetch whenever the tab regains focus (e.g. returning from a session)
    const onVisible = () => { if (document.visibilityState === 'visible') fetchTodayExercises(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    window.location.replace("/login");
  };

  const fetchTodayExercises = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/patient/todays-exercises");
      setExercises(data.exercises || []);
      setStreak(data.streak ?? 0);
      setTotalSessions(data.totalSessions ?? 0);
      setCalendar(data.calendar ?? {});
    } catch (err) {
      console.error("Failed to fetch exercises");
    }
    setLoading(false);
  };

  const completedCount = exercises.filter((e: any) => e.completedToday).length;
  const totalCount = exercises.length;
  const progressPct = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  const circumference = 2 * Math.PI * 28;

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-20">
      {/* NAV */}
      <nav className="bg-white px-6 py-4 flex justify-between items-center sticky top-0 z-30 border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center text-teal-600">
            <Activity size={20} strokeWidth={2.5} />
          </div>
          <span className="font-bold text-slate-900">PhysioCheck</span>
          <button
            onClick={() => navigate("/patient/doctors")}
            className="hidden md:flex items-center gap-1.5 ml-4 px-3 py-2 text-sm font-medium text-slate-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
          >
            <UserRoundSearch size={15} /> Find a Doctor
          </button>
          <button
            onClick={() => navigate("/patient/chatbot")}
            className="hidden md:flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
          >
            <MessageCircle size={15} /> AI Assistant
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/patient/history")}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-teal-600 hover:bg-teal-50 rounded-lg transition"
          >
            <TrendingUp size={15} /> History
          </button>
          <button
            onClick={() => navigate("/patient/settings")}
            className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
          >
            <Settings size={20} />
          </button>
          <button className="p-2 text-slate-400 hover:text-slate-600 transition">
            <Bell size={20} />
          </button>
          <img
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${patientName}`}
            alt="User"
            className="w-8 h-8 rounded-full border"
          />
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
          >
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* GREETING */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {greeting()}, {patientName}!
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Let's keep your recovery on track.</p>
        </div>

        {/* TOP ROW: progress + stats + heatmap */}
        <div className="grid grid-cols-2 gap-3 items-stretch">

          {/* LEFT: progress + bottom mini-row */}
          <div className="flex flex-col gap-3">
            {/* Progress */}
            <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl p-4 text-white shadow-lg shadow-teal-200/40 flex items-center gap-3">
              <div className="relative w-14 h-14 shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="5" />
                  <circle
                    cx="32" cy="32" r="28" fill="none" stroke="white" strokeWidth="5"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - (circumference * progressPct) / 100}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{progressPct}%</span>
              </div>
              <div className="min-w-0">
                <p className="text-teal-100 text-[10px] font-medium">Today's Progress</p>
                <p className="text-2xl font-black leading-tight">
                  {completedCount}<span className="text-teal-200 font-normal text-base">/{totalCount}</span>
                </p>
                <p className="text-teal-100 text-[10px] mt-0.5">exercises done</p>
              </div>
            </div>

            {/* Remaining + total sessions */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-3 border shadow-sm flex flex-col items-center justify-center text-center gap-0.5">
                <Dumbbell size={16} className="text-teal-500" />
                <p className="text-xl font-black text-slate-900">{totalCount - completedCount}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Left</p>
              </div>
              <div className="bg-white rounded-2xl p-3 border shadow-sm flex flex-col items-center justify-center text-center gap-0.5">
                <TrendingUp size={16} className="text-purple-400" />
                <p className="text-xl font-black text-slate-900">{totalSessions}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Sessions</p>
              </div>
            </div>
          </div>

          {/* RIGHT: activity heatmap card with streak in remaining space */}
          {(() => {
            const allKeys = Object.keys(calendar).sort();
            const today = new Date().toISOString().split('T')[0];
            const keys = allKeys.filter(k => k <= today);

            const cells: { date: string; count: number }[] = keys.map(k => ({ date: k, count: calendar[k] ?? 0 }));
            const firstDay = cells.length > 0 ? new Date(cells[0].date + 'T00:00:00Z') : null;
            const padCount = firstDay ? firstDay.getUTCDay() : 0;
            const padded: (typeof cells[0] | null)[] = [...Array(padCount).fill(null), ...cells];
            const weeks: (typeof cells[0] | null)[][] = [];
            for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));

            const dayLabels = ['S','M','T','W','T','F','S'];
            const color = (n: number) =>
              n === 0 ? 'bg-slate-100' : n === 1 ? 'bg-teal-200' : n === 2 ? 'bg-teal-400' : 'bg-teal-600';

            return (
              <div className={`bg-white rounded-2xl border shadow-sm p-3 flex flex-col gap-2 ${streak >= 3 ? 'border-orange-200' : ''}`}>
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Activity Chart</span>
                  <div className="flex items-center gap-0.5">
                    {['bg-slate-100','bg-teal-200','bg-teal-400','bg-teal-600'].map(c => (
                      <span key={c} className={`w-2 h-2 rounded-sm ${c}`} />
                    ))}
                  </div>
                </div>

                {/* Grid + streak side by side */}
                <div className="flex gap-2 items-start">
                {cells.length > 0 ? (
                  <div className="flex gap-0.5 shrink-0">
                    <div className="flex flex-col gap-0.5 mr-0.5 shrink-0">
                      <span className="h-2.5" />
                      {dayLabels.map((l, i) => (
                        <span key={i} className="h-2.5 w-2.5 text-[8px] text-slate-400 flex items-center justify-center">{l}</span>
                      ))}
                    </div>
                    {weeks.map((week, wi) => {
                      const first = week.find(c => c !== null);
                      const monthLabel = (() => {
                        if (!first) return '';
                        const d = new Date(first.date + 'T00:00:00Z');
                        return d.getUTCDate() <= 7 ? d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }) : '';
                      })();
                      return (
                        <div key={wi} className="flex flex-col gap-0.5 shrink-0">
                          <span className="h-2.5 text-[8px] text-slate-400 text-center leading-none">{monthLabel}</span>
                          {Array(7).fill(null).map((_, di) => {
                            const cell = week[di];
                            return (
                              <div
                                key={di}
                                title={cell ? `${cell.date}: ${cell.count} session${cell.count !== 1 ? 's' : ''}` : ''}
                                className={`w-2.5 h-2.5 rounded-sm ${cell ? color(cell.count) : 'bg-transparent'}`}
                              />
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-300 text-center py-2">No activity yet</p>
                )}

                  {/* Streak in remaining white space */}
                  <div className="flex-1 flex flex-col items-center justify-center text-center gap-1 self-stretch">
                    <Flame size={22} className={streak >= 3 ? 'text-orange-500' : 'text-slate-300'} />
                    <p className="text-4xl font-black text-slate-900 leading-none">{streak}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-0.5">Day Streak</p>
                  </div>
                </div>{/* end grid+streak row */}
              </div>
            );
          })()}

        </div>{/* end grid */}

        {/* TODAY'S PLAN */}
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Dumbbell size={18} className="text-teal-600" />
            Today's Plan
            <span className="text-xs font-normal bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full ml-1">
              {totalCount}
            </span>
          </h2>

          {loading && (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="bg-white rounded-2xl p-4 border animate-pulse h-24" />
              ))}
            </div>
          )}

          {!loading && exercises.length === 0 && (
            <div className="bg-white rounded-2xl p-8 border shadow-sm text-center">
              <CheckCircle2 size={32} className="mx-auto text-teal-400 mb-2" />
              <p className="font-semibold text-slate-700">All caught up!</p>
              <p className="text-sm text-slate-400 mt-1">No exercises assigned for today.</p>
            </div>
          )}

          <div className="space-y-3">
            {(exercises as any[]).map((ex) => {
              const prescription = typeof ex.prescription === "string"
                ? JSON.parse(ex.prescription) : ex.prescription;
              const repsText = `${prescription.sets} sets × ${prescription.repsPerSet} reps`;
              const tolerance = prescription.tolerance ?? 0;

              return (
                <div
                  key={ex.id}
                  className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md hover:border-teal-200 ${ex.completedToday ? 'border-teal-200 bg-teal-50/30' : ''}`}
                >
                  <div className="p-4 flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${ex.completedToday ? "bg-teal-50 text-teal-500" : "bg-slate-50 text-slate-400"}`}>
                      {ex.completedToday ? <CheckCircle2 size={22} /> : <Dumbbell size={22} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 truncate">
                        {ex.exercise?.name ?? `Exercise #${ex.exerciseId}`}
                      </h3>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Trophy size={11} /> {repsText}
                        </span>
                        {ex.exercise?.duration && (
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Clock size={11} /> ~{ex.exercise.duration}s
                          </span>
                        )}
                        {tolerance > 0 && (
                          <span className="text-[10px] bg-orange-50 text-orange-600 font-semibold px-1.5 py-0.5 rounded-full">
                            ±{tolerance}° ease
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {ex.completedToday && (
                        <span className="text-xs bg-teal-100 text-teal-700 font-bold px-2.5 py-1 rounded-full">Done</span>
                      )}
                      <button
                        className="w-11 h-11 rounded-full bg-teal-500 hover:bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-200 transition-all active:scale-95"
                        onClick={() =>
                          ex.exercise?.name === 'Reaction Exercise'
                            ? navigate(`/patient/reaction-session?id=${ex.id}`)
                            : navigate(`/patient/session?id=${ex.id}&tolerance=${tolerance}`)
                        }
                      >
                        <Play size={18} fill="white" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* QUICK LINKS */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate("/patient/history")}
            className="bg-white border rounded-2xl p-4 flex items-center justify-between hover:border-teal-300 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-teal-50 transition-colors">
                <TrendingUp size={16} className="text-slate-500 group-hover:text-teal-600" />
              </div>
              <span className="text-sm font-semibold text-slate-700">History</span>
            </div>
            <ChevronRight size={16} className="text-slate-300 group-hover:text-teal-500" />
          </button>
          <button
            onClick={() => navigate("/patient/settings")}
            className="bg-white border rounded-2xl p-4 flex items-center justify-between hover:border-teal-300 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-teal-50 transition-colors">
                <Settings size={16} className="text-slate-500 group-hover:text-teal-600" />
              </div>
              <span className="text-sm font-semibold text-slate-700">Settings</span>
            </div>
            <ChevronRight size={16} className="text-slate-300 group-hover:text-teal-500" />
          </button>
        </div>
      </main>
    </div>
  );
};

export default PatientDashboard;
