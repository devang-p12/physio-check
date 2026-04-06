import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Activity, Dumbbell, Calendar, Clock, ChevronLeft, Video, TrendingUp, AlertCircle
} from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, YAxis, Tooltip, Cell, XAxis } from 'recharts';
import PageLoader from '../components/PageLoader';

export default function CurrentPlan() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [exercises, setExercises] = useState<any[]>([]);
  const [patient, setPatient] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, [patientId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Fetch Patient Details
      const pRes = await fetch("http://localhost:5000/doctor/patients", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const pData = await pRes.json();
      const pt = pData.patients?.find((x: any) => x.id === patientId);
      if (pt) setPatient(pt);

      // Fetch exercises to mock the current active plan
      const exRes = await fetch("http://localhost:5000/doctor/exercises", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const exData = await exRes.json();
      if (exData.exercises) {
        // Mock 3 active exercises from library for UI demonstration
        setExercises(exData.exercises.slice(0, 3));
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  if (loading) {
    return <PageLoader visible={true} />;
  }

  return (
    <>
      <PageLoader visible={loading} />
      <div className="page-content font-sans pb-16">

      {/* ── HEADER ── */}
      <header className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Assigned Routine</h1>
          <p className="text-slate-500 mt-2">Active exercises currently prescribed to {patient?.name || 'this patient'}.</p>
        </div>
        <button onClick={() => navigate(`/doctor/assign?patientId=${patientId}`)} className="bg-slate-900 text-white px-4 py-2 rounded-[8px] text-sm font-semibold hover:bg-slate-800 transition">
          Modify Plan
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-6">
        <div className="space-y-6">
          {exercises.map((ex, idx) => {
            // Mock dynamic stats for UI
            const compliance = Math.floor(Math.random() * 30) + 70; // 70-100%
            const repsData = [
              { day: 'M', reps: Math.floor(Math.random() * 5) + 10 },
              { day: 'T', reps: Math.floor(Math.random() * 5) + 12 },
              { day: 'W', reps: Math.floor(Math.random() * 5) + 8 },
              { day: 'T', reps: Math.floor(Math.random() * 5) + 14 },
              { day: 'F', reps: Math.floor(Math.random() * 5) + 15 },
              { day: 'S', reps: 0 },
              { day: 'S', reps: 0 },
            ];

            return (
              <div key={ex._id || idx} className="bg-white border border-slate-200 rounded-[12px] shadow-sm overflow-hidden flex flex-col md:flex-row">
                
                {/* LEFT INFO PANEL */}
                <div className="w-full md:w-1/3 p-6 border-b md:border-b-0 md:border-r border-slate-100 bg-slate-50/50 flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                     <div className={`p-3 rounded-xl border ${ex.name === 'Reaction Exercise' ? 'bg-purple-50 border-purple-100 text-purple-600' : 'bg-teal-50 border-teal-100 text-teal-600'}`}>
                       {ex.name === 'Reaction Exercise' ? <Activity size={24} /> : <Dumbbell size={24} />}
                     </div>
                     {ex.name === 'Reaction Exercise' && (
                       <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 px-2 py-1 rounded-[6px]">
                         <Video size={12} /> Camera AI
                       </span>
                     )}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">{ex.name}</h3>
                  <p className="text-sm text-slate-500 mt-2 flex-grow">{ex.description}</p>
                  
                  <div className="mt-6 flex gap-2">
                    <span className="px-3 py-1 bg-white border border-slate-200 rounded-[6px] text-xs font-bold text-slate-600">Daily</span>
                    <span className="px-3 py-1 bg-white border border-slate-200 rounded-[6px] text-xs font-bold text-slate-600">Morning</span>
                  </div>
                </div>

                {/* MIDDLE CHARTS PANEL */}
                <div className="w-full md:w-1/3 p-6 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col justify-center">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">7-Day Compliance</p>
                      <div className="flex items-end gap-2 mt-1">
                        <p className={`text-2xl font-black ${compliance >= 80 ? 'text-emerald-600' : 'text-amber-500'}`}>{compliance}%</p>
                        {compliance >= 80 && <TrendingUp size={16} className="text-emerald-500 mb-1" />}
                      </div>
                    </div>
                  </div>

                  <div className="h-24 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={repsData}>
                        <YAxis hide domain={[0, 'dataMax']} />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} dy={10} />
                        <Tooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px', padding: '4px 8px' }} formatter={(v: any) => [`${v} reps`, 'Completed']} />
                        <Bar dataKey="reps" radius={[4, 4, 0, 0]} isAnimationActive={true} animationBegin={0} animationDuration={600} animationEasing="ease-out">
                          {repsData.map((d, i) => <Cell key={i} fill={d.reps > 0 ? (compliance >= 80 ? 'var(--success)' : 'var(--warning)') : 'var(--border-default)'} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* RIGHT STATS PANEL */}
                <div className="w-full md:w-1/3 p-6 flex flex-col justify-between">
                  <div>
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Current Prescription</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 border border-slate-100 rounded-[8px] p-3">
                        <p className="text-[11px] font-bold text-slate-500 uppercase">Sets</p>
                        <p className="text-xl font-bold text-slate-900 mt-1">3</p>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-[8px] p-3">
                        <p className="text-[11px] font-bold text-slate-500 uppercase">Reps / Set</p>
                        <p className="text-xl font-bold text-slate-900 mt-1">10</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-slate-100 pt-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                       <Clock size={16} className="text-slate-400" />
                       Assigned Oct 12, 2025
                    </div>
                    {compliance < 80 && (
                      <div className="flex items-start gap-2 text-[12px] bg-red-50 text-red-700 p-2 rounded-[6px] border border-red-100">
                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                        Patient is missing targets frequently. Consider reducing reps or modifying intensity.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            );
          })}

          {exercises.length === 0 && (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-[12px] p-16 text-center">
              <Calendar size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-bold text-slate-800">No Active Routine</h3>
              <p className="text-slate-500 mt-2 max-w-sm mx-auto mb-6">This patient currently has no exercises assigned to their daily plan.</p>
              <button onClick={() => navigate(`/doctor/assign?patientId=${patientId}`)} className="px-6 py-2 bg-teal-600 text-white rounded-[8px] font-bold hover:bg-teal-700 transition">
                Assign First Exercise
              </button>
            </div>
          )}

        </div>
      </main>
    </div>
    </>
  );
}
