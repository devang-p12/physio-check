import React, { useEffect, useState } from "react";
import { CheckCircle2, Dumbbell, Play, Trophy, Clock, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";

const PatientTodaysPlan = () => {
  const navigate = useNavigate();
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchTodayExercises(); }, []);

  const fetchTodayExercises = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/patient/todays-exercises");
      setExercises(data.exercises || []);
    } catch (err) {
      console.error("Failed to fetch exercises");
    }
    setLoading(false);
  };

  const completedCount = exercises.filter((e: any) => e.completedToday).length;
  const totalCount = exercises.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

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
              <h1 className="text-4xl md:text-5xl font-black text-[#F1FAEE] tracking-tight mb-2">Today's Plan</h1>
              <p className="text-[#A8DADC] text-lg">
                {completedCount} of {totalCount} exercises completed
              </p>
            </div>

            {/* Progress chip */}
            <div className="flex items-center gap-4">
              <div className="px-6 py-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl">
                <div className="text-3xl font-black text-[#F1FAEE]">{progressPct}%</div>
                <div className="text-[10px] uppercase tracking-widest font-bold text-[#A8DADC] mt-0.5">Complete</div>
              </div>
              {/* Progress bar */}
              <div className="w-40 hidden md:block">
                <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#A8DADC] to-[#F1FAEE] rounded-full transition-all duration-700"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="text-[10px] text-[#A8DADC]/70 font-semibold mt-1 uppercase tracking-widest">{completedCount}/{totalCount} done</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 md:px-12">

        {/* Loading skeletons */}
        {loading && (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl px-6 py-5 h-20 animate-pulse border border-[#1D3557]/5 shadow-md" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && exercises.length === 0 && (
          <div className="bg-white rounded-3xl p-16 text-center shadow-xl shadow-[#1D3557]/5 border border-[#1D3557]/5 max-w-xl mx-auto mt-6">
            <div className="w-20 h-20 rounded-3xl bg-[#A8DADC]/20 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 size={36} className="text-[#457B9D]" />
            </div>
            <p className="text-2xl font-black text-[#1D3557] tracking-tight mb-2">All caught up!</p>
            <p className="text-[#457B9D] font-medium mb-8">You've completed all your exercises for today — or none were assigned.</p>
            <button
              onClick={() => navigate("/patient")}
              className="px-8 py-3.5 bg-[#1D3557] text-[#F1FAEE] rounded-2xl font-black uppercase tracking-widest hover:bg-[#457B9D] transition-all shadow-xl shadow-[#1D3557]/20"
            >
              Back to Dashboard
            </button>
          </div>
        )}

        {/* Exercise list */}
        {!loading && exercises.length > 0 && (
          <div className="flex flex-col gap-4">
            {(exercises as any[]).map((ex) => {
              const prescription = typeof ex.prescription === "string" ? JSON.parse(ex.prescription) : ex.prescription;
              const tolerance = prescription.tolerance ?? 0;
              const name = ex.customTemplate?.name ?? ex.exercise?.name ?? `Exercise #${ex.exerciseId}`;
              const isDone = ex.completedToday;

              return (
                <div
                  key={ex.id}
                  className="bg-white rounded-2xl px-6 py-5 shadow-md shadow-[#1D3557]/[0.04] border border-[#1D3557]/5 flex items-center gap-5 relative overflow-hidden group hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#1D3557]/[0.06] transition-all duration-200"
                >
                  {/* Left accent bar */}
                  <div className={`absolute inset-y-0 left-0 w-1 rounded-l-2xl transition-opacity duration-200 ${isDone ? "opacity-100 bg-[#A8DADC]" : "opacity-0 group-hover:opacity-100 bg-gradient-to-b from-[#457B9D] to-[#A8DADC]"}`} />

                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-all ${isDone ? "bg-[#A8DADC]/20 text-[#457B9D] border-[#A8DADC]/30" : "bg-[#F1FAEE] text-[#457B9D] border-[#A8DADC]/20 group-hover:bg-[#457B9D] group-hover:text-[#F1FAEE] group-hover:border-[#457B9D]"}`}>
                    {isDone ? <CheckCircle2 size={22} /> : <Dumbbell size={22} />}
                  </div>

                  {/* Exercise name */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-[#1D3557] text-[16px] truncate">{name}</h3>
                      {ex.customTemplateId && (
                        <span className="text-[9px] bg-[#A8DADC]/20 text-[#457B9D] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border border-[#A8DADC]/30">Custom</span>
                      )}
                    </div>
                    <p className="text-[#457B9D]/60 text-[12px] font-semibold mt-0.5">Tap play to begin this exercise</p>
                  </div>

                  {/* Prescription pill */}
                  <div className="hidden md:flex items-center gap-1.5 bg-[#F1FAEE] border border-[#A8DADC]/40 px-4 py-2 rounded-xl shrink-0">
                    <Trophy size={14} className="text-[#457B9D]" />
                    <span className="text-[13px] font-black text-[#1D3557]">{prescription.sets}</span>
                    <span className="text-[11px] text-[#457B9D]/60 font-bold">sets ×</span>
                    <span className="text-[13px] font-black text-[#1D3557]">{prescription.repsPerSet}</span>
                    <span className="text-[11px] text-[#457B9D]/60 font-bold">reps</span>
                  </div>

                  {/* Form specs */}
                  <div className="hidden lg:flex items-center gap-2 shrink-0">
                    {tolerance > 0 ? (
                      <span className="text-[10px] bg-[#1D3557]/5 text-[#1D3557] font-black px-3 py-1.5 rounded-xl border border-[#1D3557]/10 uppercase tracking-widest">
                        ±{tolerance}° ease
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#457B9D]/50 uppercase font-black tracking-widest">Strict Form</span>
                    )}
                    {ex.exercise?.duration && (
                      <span className="flex items-center gap-1 text-[10px] text-[#457B9D] font-bold">
                        <Clock size={12} /> ~{ex.exercise.duration}s
                      </span>
                    )}
                  </div>

                  {/* Status badge */}
                  <div className="shrink-0">
                    {isDone ? (
                      <span className="text-[10px] bg-[#A8DADC]/20 text-[#1D3557] font-black px-3 py-1.5 rounded-full uppercase tracking-wider border border-[#A8DADC]/40">Done ✓</span>
                    ) : (
                      <span className="text-[10px] bg-[#F1FAEE] text-[#457B9D]/70 font-black px-3 py-1.5 rounded-full uppercase tracking-wider border border-[#A8DADC]/30">Pending</span>
                    )}
                  </div>

                  {/* Play button */}
                  <button
                    className="w-11 h-11 ml-1 rounded-2xl bg-[#457B9D] hover:bg-[#A8DADC] text-[#F1FAEE] hover:text-[#1D3557] flex items-center justify-center shadow-lg shadow-[#457B9D]/30 hover:shadow-[#A8DADC]/40 transition-all hover:scale-105 active:scale-95 shrink-0"
                    onClick={() =>
                      ex.customTemplateId
                        ? navigate(`/patient/custom-session?id=${ex.id}`)
                        : ex.exercise?.name === "Reaction Exercise"
                        ? navigate(`/patient/reaction-session?id=${ex.id}`)
                        : navigate(`/patient/session?id=${ex.id}&tolerance=${tolerance}`)
                    }
                  >
                    <Play size={17} fill="currentColor" className="ml-0.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientTodaysPlan;
