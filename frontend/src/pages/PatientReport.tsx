import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  ArrowLeft, Download, Activity, Heart, Flame, Clock,
  Target, TrendingUp, TrendingDown, Minus, CheckCircle2,
  AlertTriangle, BarChart2, Filter, Dumbbell, User, Calendar,
  ChevronDown, ChevronUp, RefreshCw, Zap
} from 'lucide-react';

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmtDuration = (sec?: number | null) => {
  if (!sec) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const formColor = (score?: number | null) => {
  if (score == null) return 'bg-slate-100 text-slate-500';
  if (score >= 85) return 'bg-emerald-100 text-emerald-700';
  if (score >= 70) return 'bg-teal-100 text-teal-700';
  if (score >= 50) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
};

const formBorderColor = (score?: number | null) => {
  if (score == null) return '#94a3b8';
  if (score >= 85) return '#10b981';
  if (score >= 70) return '#14b8a6';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
};

const ZONE_COLORS = ['#38bdf8', '#34d399', '#fb923c', '#f43f5e'];
const CHART_COLORS = ['#14b8a6', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6'];

// ─── Filter Panel ──────────────────────────────────────────────────────────────

interface FilterProps {
  availableExercises: { id: string; name: string }[];
  onApply: (filters: ReportFilters) => void;
  loading: boolean;
}

interface ReportFilters {
  startDate: string;
  endDate: string;
  exerciseIds: string[];
}

const PRESET_RANGES = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last 6 months', days: 180 },
  { label: 'All time', days: 0 },
];

const FilterPanel: React.FC<FilterProps> = ({ availableExercises, onApply, loading }) => {
  const today = new Date().toISOString().split('T')[0];
  const [preset, setPreset] = useState<number | null>(30);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState(today);
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  const [showExercises, setShowExercises] = useState(false);

  const buildFilters = (): ReportFilters => {
    let start = '';
    let end = '';
    if (preset === 0) {
      start = '';
      end = '';
    } else if (preset !== null) {
      const d = new Date();
      d.setDate(d.getDate() - preset);
      start = d.toISOString().split('T')[0];
      end = today;
    } else {
      start = customStart;
      end = customEnd;
    }
    return { startDate: start, endDate: end, exerciseIds: selectedExercises };
  };

  const toggleExercise = (id: string) => {
    setSelectedExercises(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
      <div className="flex items-center gap-2 text-slate-700 font-bold">
        <Filter size={18} className="text-teal-600" />
        Configure Report
      </div>

      {/* Date Range */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Session Period</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {PRESET_RANGES.map(r => (
            <button
              key={r.days}
              onClick={() => setPreset(r.days)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                preset === r.days
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {r.label}
            </button>
          ))}
          <button
            onClick={() => setPreset(null)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              preset === null
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Custom
          </button>
        </div>

        {preset === null && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">From</label>
              <input
                type="date"
                value={customStart}
                max={customEnd}
                onChange={e => setCustomStart(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/30"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">To</label>
              <input
                type="date"
                value={customEnd}
                min={customStart}
                max={today}
                onChange={e => setCustomEnd(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/30"
              />
            </div>
          </div>
        )}
      </div>

      {/* Exercise Filter */}
      {availableExercises.length > 0 && (
        <div>
          <button
            onClick={() => setShowExercises(p => !p)}
            className="flex items-center justify-between w-full text-xs font-bold text-slate-400 uppercase tracking-wider mb-2"
          >
            <span>Filter by Exercise</span>
            {showExercises ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showExercises && (
            <div className="flex flex-wrap gap-2 mt-2">
              {availableExercises.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => toggleExercise(ex.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                    selectedExercises.includes(ex.id)
                      ? 'bg-teal-50 border-teal-400 text-teal-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Dumbbell size={12} />
                  {ex.name}
                </button>
              ))}
              <p className="w-full text-[11px] text-slate-400 mt-1">
                {selectedExercises.length === 0 ? 'Showing all exercises' : `${selectedExercises.length} exercise(s) selected`}
              </p>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => onApply(buildFilters())}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-all"
      >
        {loading ? <RefreshCw size={16} className="animate-spin" /> : <BarChart2 size={16} />}
        {loading ? 'Generating...' : 'Generate Report'}
      </button>
    </div>
  );
};

// ─── Stat Card ──────────────────────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, sub, color = 'teal', trend }: any) => {
  const colors: Record<string, string> = {
    teal: 'bg-teal-50 text-teal-600',
    violet: 'bg-violet-50 text-violet-600',
    rose: 'bg-rose-50 text-rose-600',
    orange: 'bg-orange-50 text-orange-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    yellow: 'bg-yellow-50 text-yellow-700',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${colors[color] || colors.teal}`}>
          <Icon size={20} />
        </div>
        {trend != null && (
          <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${
            trend > 0 ? 'bg-emerald-50 text-emerald-600' : trend < 0 ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-500'
          }`}>
            {trend > 0 ? <TrendingUp size={11} /> : trend < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
            {trend > 0 ? `+${trend}` : trend}
          </span>
        )}
      </div>
      <p className="text-2xl font-black tracking-tight text-slate-900">{value}</p>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────

const PatientReport = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const reportRef = useRef<HTMLDivElement>(null);

  const [reportData, setReportData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters | null>(null);

  // Load available exercises immediately (no filter needed)
  const [availableExercises, setAvailableExercises] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    // Pre-load available exercises by fetching with no filters
    fetchReport({ startDate: '', endDate: '', exerciseIds: [] }, true);
  }, [patientId]);

  const fetchReport = async (filters: ReportFilters, preloadOnly = false) => {
    if (!preloadOnly) {
      setLoading(true);
      setError('');
      setAppliedFilters(filters);
    }

    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      if (filters.exerciseIds.length > 0) params.set('exerciseIds', filters.exerciseIds.join(','));

      const res = await fetch(
        `http://localhost:5000/doctor/patient/${patientId}/report?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to load report');
      }

      const data = await res.json();

      if (preloadOnly) {
        setAvailableExercises(data.availableExercises || []);
      } else {
        setReportData(data);
        if (data.availableExercises?.length > availableExercises.length) {
          setAvailableExercises(data.availableExercises);
        }
      }
    } catch (e: any) {
      if (!preloadOnly) setError(e.message || 'Unknown error');
    } finally {
      if (!preloadOnly) setLoading(false);
    }
  };

  const exportPDF = () => {
    if (!reportRef.current || !reportData) return;
    setExporting(true);

    // Collect the report HTML + all styles (including Tailwind/inline)
    const reportHtml = reportRef.current.outerHTML;

    // Copy all <style> and <link rel="stylesheet"> from the current document
    const styleNodes = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'));
    const styleHtml = styleNodes.map(n => n.outerHTML).join('\n');

    const patientName = reportData.patient?.name || 'Patient';
    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
      alert('Pop-up blocked. Please allow pop-ups for this site and try again.');
      setExporting(false);
      return;
    }

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Report – ${patientName} – ${dateStr}</title>
  ${styleHtml}
  <style>
    @page { size: A4; margin: 12mm; }
    body { background: #f8fafc; font-family: sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    nav, button, .no-print { display: none !important; }
    * { box-sizing: border-box; }
    .recharts-wrapper, .recharts-responsive-container { break-inside: avoid; }
  </style>
</head>
<body>
  <div style="max-width:900px;margin:0 auto;padding:8px;">
    ${reportHtml}
  </div>
  <script>
    // Wait for recharts SVGs to fully render before printing
    setTimeout(() => {
      window.print();
      setTimeout(() => window.close(), 1000);
    }, 800);
  </script>
</body>
</html>`);
    printWindow.document.close();

    setTimeout(() => setExporting(false), 2000);
  };

  const s = reportData?.summary;
  const adherenceColor = s?.adherenceRate == null ? '' : s.adherenceRate >= 80 ? 'text-emerald-600' : s.adherenceRate >= 50 ? 'text-yellow-600' : 'text-red-500';

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-900">
      {/* Navbar */}
      <nav className="bg-white/90 backdrop-blur-md border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16 gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-teal-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-teal-200">
                <BarChart2 size={16} strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="font-extrabold text-base tracking-tight leading-none">
                  Patient Report
                </h1>
                {reportData?.patient && (
                  <p className="text-[11px] text-slate-400 font-medium leading-none mt-0.5">
                    {reportData.patient.name}
                  </p>
                )}
              </div>
            </div>
          </div>

          {reportData && (
            <button
              onClick={exportPDF}
              disabled={exporting}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-slate-200"
            >
              {exporting ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
              {exporting ? 'Opening...' : 'Print / Save PDF'}
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8 items-start">
        {/* LEFT: Filter Panel */}
        <div className="lg:sticky lg:top-24">
          <FilterPanel
            availableExercises={availableExercises}
            onApply={f => fetchReport(f)}
            loading={loading}
          />
        </div>

        {/* RIGHT: Report */}
        <div>
          {!reportData && !loading && !error && (
            <div className="flex flex-col items-center justify-center py-28 text-slate-400 space-y-3">
              <BarChart2 size={48} strokeWidth={1} />
              <p className="text-lg font-bold text-slate-500">Configure and generate your report</p>
              <p className="text-sm">Select a date range and press Generate Report</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-700 rounded-2xl px-6 py-4 font-semibold flex items-center gap-3">
              <AlertTriangle size={18} />
              {error}
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-28 space-y-4">
              <div className="w-12 h-12 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
              <p className="text-slate-400 font-medium">Generating report…</p>
            </div>
          )}

          {reportData && !loading && (
            <div ref={reportRef} className="space-y-8">
              {/* Report Header */}
              <div className="bg-gradient-to-br from-teal-600 to-emerald-600 text-white rounded-3xl p-8 shadow-xl shadow-teal-200/60">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-teal-100 text-xs font-bold uppercase tracking-widest mb-1">
                      Physiotherapy Report
                    </p>
                    <h2 className="text-3xl font-black tracking-tight">{reportData.patient.name}</h2>
                    <p className="text-teal-100 mt-1 text-sm">{reportData.patient.email}</p>
                  </div>
                  <div className="text-right text-teal-100 text-sm">
                    <p className="font-semibold">Generated</p>
                    <p>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    {appliedFilters?.startDate && (
                      <p className="mt-1 text-xs">
                        {appliedFilters.startDate} → {appliedFilters.endDate || 'now'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Adherence badge */}
                <div className="mt-6 flex items-center gap-4 flex-wrap">
                  <div className="bg-white/20 rounded-2xl px-5 py-3 text-center">
                    <p className="text-2xl font-black">
                      {s.adherenceRate != null ? `${s.adherenceRate}%` : '—'}
                    </p>
                    <p className="text-xs font-bold text-teal-100 uppercase tracking-wide">Adherence</p>
                  </div>
                  <div className="bg-white/20 rounded-2xl px-5 py-3 text-center">
                    <p className="text-2xl font-black">{s.totalSessions}</p>
                    <p className="text-xs font-bold text-teal-100 uppercase tracking-wide">Sessions Done</p>
                  </div>
                  {s.totalPrescribed > 0 && (
                    <div className="bg-white/20 rounded-2xl px-5 py-3 text-center">
                      <p className="text-2xl font-black">{s.totalPrescribed}</p>
                      <p className="text-xs font-bold text-teal-100 uppercase tracking-wide">Prescribed</p>
                    </div>
                  )}
                  {s.streak > 0 && (
                    <div className="bg-orange-400/40 rounded-2xl px-5 py-3 text-center">
                      <p className="text-2xl font-black">🔥 {s.streak}</p>
                      <p className="text-xs font-bold text-teal-100 uppercase tracking-wide">Day Streak</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Overview Stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatCard
                  icon={Heart}
                  label="Avg Heart Rate"
                  value={s.avgHeartRate ? `${s.avgHeartRate} bpm` : '—'}
                  color="rose"
                />
                <StatCard
                  icon={Flame}
                  label="Total Calories"
                  value={s.totalCalories ? `${s.totalCalories} kcal` : '—'}
                  color="orange"
                />
                <StatCard
                  icon={Activity}
                  label="Total Reps"
                  value={s.totalReps > 0 ? s.totalReps : '—'}
                  color="violet"
                />
                <StatCard
                  icon={Clock}
                  label="Total Active Time"
                  value={fmtDuration(s.totalDurationSec)}
                  color="blue"
                />
                <StatCard
                  icon={Calendar}
                  label="Sessions Completed"
                  value={s.totalSessions}
                  color="emerald"
                  sub={s.adherenceRate != null ? `${s.adherenceRate}% adherence rate` : undefined}
                />
              </div>

              {/* Charts Row */}
              {reportData.timeline.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Reps Per Session */}
                  {reportData.timeline.some((t: any) => t.reps > 0) && (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                      <h3 className="font-bold text-slate-700 mb-1 flex items-center gap-2">
                        <Activity size={16} className="text-violet-600" />
                        Reps Per Session
                      </h3>
                      <p className="text-xs text-slate-400 mb-4">Repetitions completed each session</p>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={reportData.timeline} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
                          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                          <Tooltip
                            formatter={(v: any) => [v, 'Reps']}
                            contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}
                          />
                          <Bar dataKey="reps" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Active Time Per Session */}
                  {reportData.timeline.some((t: any) => t.durationMin > 0) && (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                      <h3 className="font-bold text-slate-700 mb-1 flex items-center gap-2">
                        <Clock size={16} className="text-blue-500" />
                        Active Time Per Session
                      </h3>
                      <p className="text-xs text-slate-400 mb-4">Minutes spent active each session</p>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={reportData.timeline} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
                          <YAxis tick={{ fontSize: 10 }} unit="m" />
                          <Tooltip
                            formatter={(v: any) => [`${v} min`, 'Duration']}
                            contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}
                          />
                          <Bar dataKey="durationMin" name="Active Time" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}

              {/* Sessions Per Day */}
              {reportData.sessionsPerDay?.length > 1 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                  <h3 className="font-bold text-slate-700 mb-1 flex items-center gap-2">
                    <Calendar size={16} className="text-emerald-600" />
                    Session Activity
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">Sessions completed and active time per day</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={reportData.sessionsPerDay} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} allowDecimals={false} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit="m" />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}
                        formatter={(v: any, name: string) => name === 'Sessions' ? [v, name] : [`${v} min`, name]}
                      />
                      <Legend iconType="circle" iconSize={8} />
                      <Bar yAxisId="left" dataKey="sessions" name="Sessions" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="right" dataKey="totalDurationMin" name="Active Time" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Weekly Breakdown + Intensity Zones */}
              {(reportData.weeklyBreakdown.length > 1 || Object.values(s.intensityZones).some(v => (v as number) > 0)) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Weekly Sessions & Form */}
                  {reportData.weeklyBreakdown.length > 1 && (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                      <h3 className="font-bold text-slate-700 mb-1 flex items-center gap-2">
                        <Calendar size={16} className="text-violet-600" />
                        Weekly Progress
                      </h3>
                      <p className="text-xs text-slate-400 mb-4">Sessions and avg form score by week</p>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={reportData.weeklyBreakdown} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="week" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                          <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} />
                          <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }} />
                          <Legend iconType="circle" iconSize={8} />
                          <Bar yAxisId="left" dataKey="sessions" name="Sessions" fill="#6366f1" radius={[4, 4, 0, 0]} />
                          <Line yAxisId="right" type="monotone" dataKey="avgFormScore" name="Form %" stroke="#14b8a6" strokeWidth={2} dot={{ r: 3 }} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Intensity Zones */}
                  {Object.values(s.intensityZones).some(v => (v as number) > 0) && (() => {
                    const zones = [
                      { name: 'Low', value: Math.round(s.intensityZones.low / 60), color: ZONE_COLORS[0] },
                      { name: 'Moderate', value: Math.round(s.intensityZones.moderate / 60), color: ZONE_COLORS[1] },
                      { name: 'High', value: Math.round(s.intensityZones.high / 60), color: ZONE_COLORS[2] },
                      { name: 'Peak', value: Math.round(s.intensityZones.peak / 60), color: ZONE_COLORS[3] },
                    ].filter(z => z.value > 0);
                    return (
                      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                        <h3 className="font-bold text-slate-700 mb-1 flex items-center gap-2">
                          <Zap size={16} className="text-orange-500" />
                          Intensity Zones
                        </h3>
                        <p className="text-xs text-slate-400 mb-4">Time (minutes) spent per heart rate zone</p>
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie data={zones} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                              {zones.map((z, i) => <Cell key={i} fill={z.color} />)}
                            </Pie>
                            <Tooltip
                              formatter={(v: any) => [`${v} min`, 'Duration']}
                              contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}
                            />
                            <Legend iconType="circle" iconSize={8} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Exercise Breakdown */}
              {reportData.exerciseBreakdown.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                  <h3 className="font-bold text-slate-700 mb-1 flex items-center gap-2">
                    <Dumbbell size={16} className="text-teal-600" />
                    Exercise Breakdown
                  </h3>
                  <p className="text-xs text-slate-400 mb-5">Per-exercise performance summary</p>
                  <div className="space-y-4">
                    {reportData.exerciseBreakdown.map((ex: any, i: number) => (
                      <div
                        key={i}
                        className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                        style={{ borderLeft: `4px solid ${CHART_COLORS[i % CHART_COLORS.length]}` }}
                      >
                        <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                              style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                            >
                              {i + 1}
                            </div>
                            <span className="font-bold text-slate-800">{ex.name}</span>
                          </div>
                          {ex.avgFormScore != null && (
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${formColor(ex.avgFormScore)}`}>
                              {ex.avgFormScore}% form
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                          <div>
                            <p className="text-xs text-slate-400 font-medium">Sessions</p>
                            <p className="font-bold">{ex.sessions}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 font-medium">Total Reps</p>
                            <p className="font-bold">{ex.totalReps || '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 font-medium">Active Time</p>
                            <p className="font-bold">{fmtDuration(ex.totalDurationSec)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 font-medium">Avg HR</p>
                            <p className="font-bold">{ex.avgHeartRate ? `${ex.avgHeartRate} bpm` : '—'}</p>
                          </div>
                        </div>

                        {ex.topIssues.length > 0 && (
                          <div>
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wide mb-1.5">Common Issues</p>
                            <div className="flex flex-wrap gap-2">
                              {ex.topIssues.map((issue: any, j: number) => (
                                <span key={j} className="flex items-center gap-1 text-xs bg-red-50 text-red-600 border border-red-100 px-2.5 py-1 rounded-lg font-semibold">
                                  <AlertTriangle size={10} />
                                  {issue.issue} ({issue.count}×)
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Issues + Recommendations */}
              {reportData.topIssues.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                  <h3 className="font-bold text-slate-700 mb-1 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-500" />
                    Top Form Issues & Recommendations
                  </h3>
                  <p className="text-xs text-slate-400 mb-5">Most frequently occurring posture problems</p>

                  <div className="space-y-3">
                    {reportData.topIssues.map((issue: any, i: number) => {
                      const maxCount = reportData.topIssues[0].count;
                      const pct = Math.round((issue.count / maxCount) * 100);
                      return (
                        <div key={i} className="flex items-center gap-4">
                          <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 text-[10px] font-black flex items-center justify-center shrink-0">
                            {i + 1}
                          </span>
                          <div className="flex-1">
                            <div className="flex justify-between mb-1">
                              <span className="text-sm font-semibold text-slate-700 capitalize">{issue.issue}</span>
                              <span className="text-xs font-bold text-slate-400">{issue.count} sessions</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Auto recommendations */}
                  <div className="mt-6 space-y-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Suggested Focus Areas</p>
                    {reportData.topIssues.slice(0, 3).map((issue: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-slate-600">
                        <CheckCircle2 size={15} className="text-teal-500 mt-0.5 shrink-0" />
                        <span>
                          Focus on correcting <span className="font-bold text-slate-800">"{issue.issue}"</span> —
                          appeared in {issue.count} sessions.
                        </span>
                      </div>
                    ))}
                    {s.improvementTrend != null && s.improvementTrend < 0 && (
                      <div className="flex items-start gap-2 text-sm text-slate-600">
                        <TrendingDown size={15} className="text-red-400 mt-0.5 shrink-0" />
                        <span>
                          Form score has <span className="font-bold text-red-500">declined by {Math.abs(s.improvementTrend)} pts</span> recently. Consider reducing exercise intensity or reviewing technique.
                        </span>
                      </div>
                    )}
                    {s.adherenceRate != null && s.adherenceRate < 70 && (
                      <div className="flex items-start gap-2 text-sm text-slate-600">
                        <Calendar size={15} className="text-amber-500 mt-0.5 shrink-0" />
                        <span>
                          Adherence is at <span className="font-bold text-amber-600">{s.adherenceRate}%</span>. Follow up with patient on scheduling consistency.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {reportData.summary.totalSessions === 0 && (
                <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
                  <User size={32} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500 font-semibold">No completed sessions found for this filter</p>
                  <p className="text-slate-400 text-sm mt-1">Try expanding the date range or removing exercise filters</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default PatientReport;
