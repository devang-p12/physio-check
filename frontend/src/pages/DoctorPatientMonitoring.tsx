import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Heart, Activity, TrendingUp, Flame, Dumbbell,
  Clock, ChevronRight, Calendar, User, Target, CheckCircle2, Zap,
} from 'lucide-react';

const DoctorPatientMonitoring = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [patientData, setPatientData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionFilter, setSessionFilter] = useState<'all' | string>('all');

  const [googleFitData, setGoogleFitData] = useState<any | null>(null);

  useEffect(() => {
    if (patientId) {
      fetchPatientPerformance();
    }
  }, [patientId]);

  const fetchPatientPerformance = async () => {

  const fetchPatientGoogleFit = async (startTime: string, endTime: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/doctor/patient/${patientId}/google-fit?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGoogleFitData(data);
      } else {
        console.warn('Failed to fetch patient google fit', await res.text());
      }
    } catch (err) {
      console.error('Error fetching patient google fit:', err);
    }
  };
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/doctor/patient/${patientId}/performance`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
      // fetch Google Fit for last 7 days
      const end = new Date();
      const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      fetchPatientGoogleFit(start.toISOString(), end.toISOString());
        const data = await response.json();
        console.log('Doctor /patient/:id/performance response:', data);
        setPatientData(data);
      }
    } catch (error) {
      console.error('Error fetching patient performance:', error);
    } finally {
      setLoading(false);
    }
  };

  const fmtDate = (d?: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' });
  };

  const fmtDuration = (s?: number) => {
    if (!s) return '—';
    const m = Math.floor(s / 60), sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const formColor = (score?: number) => {
    if (!score) return 'bg-slate-100 text-slate-500';
    if (score >= 85) return 'bg-green-100 text-green-700';
    if (score >= 70) return 'bg-teal-100 text-teal-700';
    if (score >= 50) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  const toleranceColor = (t: number) => {
    if (t === 0) return 'bg-slate-100 text-slate-600';
    if (t <= 10) return 'bg-yellow-50 text-yellow-700';
    return 'bg-orange-50 text-orange-700';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500" />
      </div>
    );
  }

  if (!patientData) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center">
          <User size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">Patient not found</h3>
          <button onClick={() => navigate('/doctor')} className="mt-4 text-sm text-teal-600 font-medium hover:underline">
            Back to Dashboard
          </button>
        </div>

        {googleFitData && (
          <div className="max-w-7xl mx-auto px-6">
            <div className="bg-white rounded-2xl border p-4 mb-4 flex items-center gap-6">
              <div>
                <p className="text-xs text-slate-500 font-medium">Google Fit (7d)</p>
                <p className="text-lg font-bold text-slate-900">{googleFitData.avgHeartRate ? `${googleFitData.avgHeartRate} bpm` : '—'}</p>
                <p className="text-sm text-slate-500">Avg heart rate</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Calories (7d)</p>
                <p className="text-lg font-bold text-slate-900">{googleFitData.totalCalories ?? '—'}</p>
                <p className="text-sm text-slate-500">Total calories</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const { patient, summary, allSessions = [], assignments = [] } = patientData as any;
  const activeAssignments = assignments.filter((a: any) => !a.completed);
  const completedAssignments = assignments.filter((a: any) => a.completed);
  const remainingSessionsCount = assignments.reduce((acc: number, a: any) => {
    if (a.completed) return acc;
    if (typeof a.remainingSessions === 'number') return acc + a.remainingSessions;
    const prescribed = a.totalPrescribed ?? 0;
    const done = a.totalSessions ?? 0;
    return acc + Math.max(0, prescribed - done);
  }, 0);
  const filteredSessions = sessionFilter === 'all'
    ? allSessions
    : allSessions.filter((s: any) => s.exerciseName === sessionFilter);
  const uniqueExercises = [...new Set(allSessions.map((s: any) => s.exerciseName))] as string[];

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-16">

      {/* ── HEADER ── */}
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center gap-4">
          <button
            onClick={() => navigate('/doctor')}
            className="p-2.5 hover:bg-slate-50 border rounded-xl transition-colors text-slate-600"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-bold text-lg">
              {patient.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{patient.name}</h1>
              <p className="text-sm text-slate-500">{patient.email}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── STAT STRIP ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard icon={<Activity size={22} className="text-teal-600" />} bg="bg-teal-50"
            label="Total Sessions" value={summary.totalSessions} />
          <StatCard icon={<Calendar size={22} className="text-amber-500" />} bg="bg-amber-50"
            label="Remaining Sessions" value={typeof remainingSessionsCount === 'number' ? remainingSessionsCount : '—'} />
          <StatCard icon={<Zap size={22} className="text-orange-500" />} bg="bg-orange-50"
            label="Total Reps" value={summary.totalReps || 0} />

          {/* STREAK card — glows orange when ≥ 3 */}
          <div className={`col-span-2 lg:col-span-1 bg-white rounded-2xl border p-5 flex items-center gap-4 shadow-sm ${
            summary.streak >= 3 ? 'border-orange-300 shadow-orange-100' : ''}`}>
            <div className={`p-3 rounded-xl ${summary.streak >= 3 ? 'bg-orange-100' : 'bg-slate-100'}`}>
              <Flame size={22} className={summary.streak >= 3 ? 'text-orange-500' : 'text-slate-400'} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Current Streak</p>
              <p className="text-2xl font-bold text-slate-900">
                {summary.streak ?? 0}
                <span className="text-sm font-normal text-slate-500 ml-1">
                  {summary.streak === 1 ? 'day' : 'days'}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* ── LEFT: SESSION HISTORY ── */}
          <div className="lg:col-span-8 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                Session History
                <span className="text-xs font-normal bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                  {allSessions.length}
                </span>
              </h2>
              {uniqueExercises.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  <FilterChip active={sessionFilter === 'all'} label="All" onClick={() => setSessionFilter('all')} />
                  {uniqueExercises.map((ex) => (
                    <FilterChip key={ex} active={sessionFilter === ex} label={ex} onClick={() => setSessionFilter(ex)} />
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              {filteredSessions.length === 0 ? (
                <div className="py-16 text-center">
                  <Activity size={36} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500 text-sm">No sessions recorded yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredSessions.map((session: any) => (
                    <div
                      key={session.id}
                      onClick={() => navigate(`/doctor/session/${session.id}`)}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 cursor-pointer transition-colors group"
                    >
                      {/* Date block */}
                      <div className="w-12 text-center shrink-0">
                        <p className="text-[11px] font-bold text-slate-400 uppercase">
                          {new Date(session.startTime).toLocaleDateString('en-US', { month: 'short' })}
                        </p>
                        <p className="text-xl font-bold text-slate-800 leading-none">
                          {new Date(session.startTime).getDate()}
                        </p>
                      </div>
                      <div className="w-px h-10 bg-slate-200 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-sm truncate">{session.exerciseName}</p>
                        <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                          <span className="text-slate-400">
                            {new Date(session.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                          </span>
                        </div>
                      </div>
                      {session.formScore ? (
                        <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${formColor(session.formScore)}`}>
                          {Math.round(session.formScore)}%
                        </span>
                      ) : null}
                      <ChevronRight size={16} className="shrink-0 text-slate-300 group-hover:text-teal-500 transition-colors" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: ASSIGNMENTS ── */}
          <div className="lg:col-span-4 space-y-6">

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Dumbbell size={18} className="text-teal-600" />
                Current Plan
                <span className="text-xs font-normal bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">
                  {activeAssignments.length}
                </span>
              </h2>
              {activeAssignments.length === 0 ? (
                <div className="bg-white rounded-2xl border p-6 text-center">
                  <p className="text-sm text-slate-400">No active assignments</p>
                  <button
                    onClick={() => navigate(`/doctor/assign?patientId=${patientId}`)}
                    className="mt-3 text-sm text-teal-600 font-semibold hover:underline"
                  >
                    + Assign exercises
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeAssignments.map((a: any) => (
                    <AssignmentCard key={a.id} assignment={a} fmtDate={fmtDate} toleranceColor={toleranceColor} />
                  ))}
                </div>
              )}
            </section>

            {completedAssignments.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-green-500" />
                  Completed Plans
                </h2>
                <div className="space-y-3">
                  {completedAssignments.map((a: any) => (
                    <AssignmentCard key={a.id} assignment={a} fmtDate={fmtDate} toleranceColor={toleranceColor} dimmed />
                  ))}
                </div>
              </section>
            )}

            <button
              onClick={() => navigate(`/doctor/assign?patientId=${patientId}`)}
              className="w-full py-3 border-2 border-dashed border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 text-slate-500 hover:text-teal-700 rounded-2xl text-sm font-semibold transition-all"
            >
              + Assign New Exercise
            </button>
          </div>

        </div>
      </main>
    </div>
  );
};

/* ─── Sub-components ─── */

const StatCard = ({ icon, bg, label, value }: any) => (
  <div className="bg-white rounded-2xl border p-5 flex items-center gap-4 shadow-sm">
    <div className={`p-3 rounded-xl ${bg}`}>{icon}</div>
    <div>
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  </div>
);

const FilterChip = ({ active, label, onClick }: any) => (
  <button
    onClick={onClick}
    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
      active
        ? 'bg-teal-600 text-white border-teal-600'
        : 'bg-white text-slate-600 border-slate-200 hover:border-teal-400 hover:text-teal-700'
    }`}
  >
    {label}
  </button>
);

const AssignmentCard = ({ assignment: a, fmtDate, toleranceColor, dimmed = false }: any) => {
  const prescription = a.prescription ?? {};
  const tol = prescription.tolerance ?? 0;
  return (
    <div className={`bg-white rounded-2xl border p-4 transition-all ${
      dimmed ? 'opacity-60' : 'hover:border-teal-300 hover:shadow-sm'}`}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-bold text-sm text-slate-900">{a.exerciseName}</h3>
        {a.completed && (
          <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">Done</span>
        )}
      </div>
      {a.description && <p className="text-xs text-slate-500 mb-3">{a.description}</p>}
      <div className="flex flex-wrap gap-2 mb-3">
        {prescription.sets && prescription.repsPerSet && (
          <span className="text-[11px] font-semibold bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">
            {prescription.sets}×{prescription.repsPerSet} reps
          </span>
        )}
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${toleranceColor(tol)}`}>
          {tol === 0 ? 'Strict' : `±${tol}° tolerance`}
        </span>
      </div>
      <div className="flex justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
        <span className="flex items-center gap-1">
          <Target size={12} />{a.totalSessions} sessions done
        </span>
        {a.remainingSessions != null && !a.completed && (
          <span className={`flex items-center gap-1 font-semibold ${a.remainingSessions === 0 ? 'text-green-600' : 'text-amber-600'}`}>
            <Clock size={12} />
            {a.remainingSessions === 0 ? 'All done!' : `${a.remainingSessions} remaining`}
          </span>
        )}
        {a.lastSession && <span className="text-slate-400">Last: {fmtDate(a.lastSession)}</span>}
      </div>
      {a.totalPrescribed != null && a.totalPrescribed > 0 && (
        <div className="mt-2">
          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
            <span>Progress</span>
            <span>{Math.min(100, Math.round((a.totalSessions / a.totalPrescribed) * 100))}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${a.completed ? 'bg-green-500' : 'bg-teal-500'}`}
              style={{ width: `${Math.min(100, Math.round((a.totalSessions / a.totalPrescribed) * 100))}%` }}
            />
          </div>
        </div>
      )}
      {a.averagePerformance?.avgFormScore > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between text-xs text-slate-500">
          <span>Avg form</span>
          <span className={`font-bold ${a.averagePerformance.avgFormScore >= 80 ? 'text-green-600' : 'text-orange-500'}`}>
            {Math.round(a.averagePerformance.avgFormScore)}%
          </span>
        </div>
      )}
    </div>
  );
};

export default DoctorPatientMonitoring;