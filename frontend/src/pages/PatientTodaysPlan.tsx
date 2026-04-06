import React, { useEffect, useState } from "react";
import { CheckCircle2, Dumbbell, Play, Trophy, Clock, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";

const PatientTodaysPlan = () => {
  const navigate = useNavigate();
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodayExercises();
  }, []);

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

  return (
    <div className="page-content">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="p-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/patient")}
              className="p-2 rounded-lg transition"
              style={{ color: 'var(--p-text-secondary)', background: 'var(--p-bg-surface)', border: '1px solid var(--p-border)' }}
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <div className="text-[18px] font-semibold" style={{ color: 'var(--p-text-primary)' }}>
                Today&apos;s Detailed Plan
              </div>
              <div className="text-[12px]" style={{ color: 'var(--p-text-muted)' }}>
                {completedCount} of {totalCount} completed
              </div>
            </div>
          </div>
        </div>

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="p-card rounded-2xl p-4 animate-pulse h-28"
                style={{ background: 'var(--p-bg-surface)', border: '1px solid var(--p-border)' }}
              />
            ))}
          </div>
        )}

        {!loading && exercises.length === 0 && (
          <div
            className="p-card rounded-[2rem] p-12 text-center mt-12"
            style={{ background: 'var(--p-bg-surface)', border: '1px solid var(--p-border)' }}
          >
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'var(--p-bg-active)' }}>
              <CheckCircle2 size={36} style={{ color: 'var(--p-blue)' }} />
            </div>
            <p className="text-2xl font-black tracking-tight" style={{ color: 'var(--p-text-primary)' }}>All caught up!</p>
            <p className="mt-2" style={{ color: 'var(--p-text-secondary)' }}>You have completed all your exercises for today or none were assigned.</p>
            <button
              onClick={() => navigate("/patient")}
              className="mt-6 px-6 py-3 rounded-xl font-semibold transition"
              style={{ background: 'var(--p-navy)', color: 'var(--p-cream)' }}
            >
              Back to Dashboard
            </button>
          </div>
        )}

        {(!loading && exercises.length > 0) && (
          <div className="p-card rounded-[2rem] overflow-hidden"
            style={{ background: 'var(--p-bg-surface)', border: '1px solid var(--p-border)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead style={{ background: 'var(--p-bg-surface2)', borderBottom: '1px solid var(--p-border)' }}>
                  <tr>
                    <th className="py-4 px-6 text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--p-text-muted)' }}>Exercise</th>
                    <th className="py-4 px-6 text-[11px] font-black uppercase tracking-widest text-center" style={{ color: 'var(--p-text-muted)' }}>Prescription</th>
                    <th className="py-4 px-6 text-[11px] font-black uppercase tracking-widest text-center" style={{ color: 'var(--p-text-muted)' }}>Form Specs</th>
                    <th className="py-4 px-6 text-[11px] font-black uppercase tracking-widest text-center" style={{ color: 'var(--p-text-muted)' }}>Status</th>
                    <th className="py-4 px-6 text-[11px] font-black uppercase tracking-widest text-right" style={{ color: 'var(--p-text-muted)' }}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(exercises as any[]).map((ex) => {
                    const prescription = typeof ex.prescription === "string" ? JSON.parse(ex.prescription) : ex.prescription;
                    const tolerance = prescription.tolerance ?? 0;

                    return (
                      <tr key={ex.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="py-5 px-6">
                           <div className="flex items-center gap-4">
                             <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${ex.completedToday ? "bg-teal-100 text-teal-600" : "bg-slate-100 text-slate-500"}`}>
                               {ex.completedToday ? <CheckCircle2 size={24} /> : <Dumbbell size={24} />}
                             </div>
                             <div>
                               <h3 className="font-bold text-slate-900 group-hover:text-teal-700 transition">
                                 {ex.customTemplate?.name ?? ex.exercise?.name ?? `Exercise #${ex.exerciseId}`}
                               </h3>
                               {ex.customTemplateId && <span className="text-[9px] bg-teal-50 text-teal-700 font-bold px-2 py-0.5 rounded uppercase tracking-widest mt-1 inline-block">Custom</span>}
                             </div>
                           </div>
                        </td>
                        <td className="py-5 px-6 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <span className="flex items-center gap-1.5 text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">
                              <Trophy size={14} className="text-amber-500" /> {prescription.sets} <span className="text-slate-400 font-medium">sets ×</span> {prescription.repsPerSet} <span className="text-slate-400 font-medium">reps</span>
                            </span>
                          </div>
                        </td>
                        <td className="py-5 px-6 text-center">
                          <div className="flex flex-col items-center justify-center gap-1.5">
                            {tolerance > 0 ? (
                               <span className="text-[10px] bg-orange-50 text-orange-600 font-bold px-2 py-1 rounded border border-orange-100 uppercase tracking-widest">
                                 ±{tolerance}° ease
                               </span>
                            ) : <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Strict Form</span>}
                            {ex.exercise?.duration && (
                               <span className="flex items-center gap-1 text-xs text-slate-500 font-medium pt-1">
                                 <Clock size={12} className="text-blue-400" /> ~{ex.exercise.duration}s hold
                               </span>
                            )}
                          </div>
                        </td>
                        <td className="py-5 px-6 text-center">
                           {ex.completedToday ? (
                             <span className="text-[10px] bg-emerald-100 text-emerald-700 font-black px-3 py-1 rounded-full uppercase tracking-wider relative top-0.5">Done</span>
                           ) : (
                             <span className="text-[10px] bg-slate-100 text-slate-500 font-black px-3 py-1 rounded-full uppercase tracking-wider relative top-0.5">Pending</span>
                           )}
                        </td>
                        <td className="py-5 px-6 text-right">
                           <button
                             className="w-12 h-12 ml-auto rounded-full bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center shadow-lg shadow-teal-200 transition-all active:scale-95 group-hover:scale-110"
                             onClick={() =>
                               ex.customTemplateId
                                 ? navigate(`/patient/custom-session?id=${ex.id}`)
                                 : ex.exercise?.name === 'Reaction Exercise'
                                 ? navigate(`/patient/reaction-session?id=${ex.id}`)
                                 : navigate(`/patient/session?id=${ex.id}&tolerance=${tolerance}`)
                             }
                           >
                             <Play size={18} fill="white" className="ml-1" />
                           </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientTodaysPlan;
