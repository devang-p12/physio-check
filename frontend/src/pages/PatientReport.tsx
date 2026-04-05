import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  ArrowLeft, Download, Activity, Heart, Flame, Clock,
  TrendingDown, TrendingUp, Minus, CheckCircle2,
  AlertTriangle, BarChart2, Filter, Dumbbell, Calendar,
  ChevronDown, ChevronUp, RefreshCw, Zap, Table2
} from 'lucide-react';

const fmtDuration = (sec?: number | null) => {
  if (!sec) return '0s';
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

const ZONE_COLORS = ['#38bdf8', '#34d399', '#fb923c', '#f43f5e'];
const CHART_COLORS = ['#1D9E75', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6'];

interface ReportFilters {
  startDate: string;
  endDate: string;
  exerciseIds: string[];
}

const PRESET_RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: 'All', days: 0 },
];

export default function PatientReport() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const reportRef = useRef<HTMLDivElement>(null);

  const [reportData, setReportData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const [preset, setPreset] = useState<number>(30);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().split('T')[0]);
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  const [availableExercises, setAvailableExercises] = useState<{ id: string; name: string }[]>([]);
  const [showExercises, setShowExercises] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    fetchReport(true);
  }, [patientId]);

  const fetchReport = async (preloadOnly = false) => {
    if (!preloadOnly) { setLoading(true); setError(''); }
    
    let start = '';
    let end = '';
    if (!preloadOnly) {
      if (preset === 0) { start = ''; end = ''; }
      else if (preset !== 0) {
        const d = new Date(); d.setDate(d.getDate() - preset);
        start = d.toISOString().split('T')[0];
        end = new Date().toISOString().split('T')[0];
      } else { start = customStart; end = customEnd; }
    }

    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (start) params.set('startDate', start);
      if (end) params.set('endDate', end);
      if (selectedExercises.length > 0 && !preloadOnly) params.set('exerciseIds', selectedExercises.join(','));

      const res = await fetch(`http://localhost:5000/doctor/patient/${patientId}/report?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load report');
      
      const data = await res.json();
      if (preloadOnly) {
        setAvailableExercises(data.availableExercises || []);
        // Also fetch the 30-day default report after preload
        fetchReport(false);
      } else {
        setReportData(data);
        if (data.availableExercises?.length > availableExercises.length) {
          setAvailableExercises(data.availableExercises);
        }
      }
    } catch (e: any) {
      if (!preloadOnly) setError(e.message || 'Error fetching report');
    } finally {
      if (!preloadOnly) setLoading(false);
    }
  };

  const toggleEx = (id: string) => {
    setSelectedExercises(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const s = reportData?.summary;

  // Synthesize table rows from weekly breakdown or timeline
  const tableRows = reportData?.timeline ? [...reportData.timeline].reverse() : [];
  const totalPages = Math.ceil(tableRows.length / itemsPerPage);
  const paginatedRows = tableRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const exportPDF = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-16">
      
      {/* ── TOP NAV ── */}
      <nav className="bg-white border-b sticky top-0 z-50">
        <div className="px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-none">Patient Report</h1>
              <span className="text-xs text-slate-500">{reportData?.patient?.name || 'Loading...'}</span>
            </div>
          </div>
          <button onClick={exportPDF} disabled={exporting || !reportData} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-800 transition shadow-sm">
            <Download size={16} /> Print Report
          </button>
        </div>

        {/* STICKY TOP CONFIG BAR */}
        <div className="bg-white/80 backdrop-blur-md border-b px-6 py-3 flex flex-col md:flex-row md:items-center gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Filter size={16} className="text-slate-400" />
            <div className="flex gap-1.5 p-1 bg-slate-100 rounded-lg">
              {PRESET_RANGES.map(r => (
                <button
                  key={r.days}
                  onClick={() => setPreset(r.days)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${preset === r.days ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200 hidden md:block" />

          <div className="relative group">
            <button onClick={() => setShowExercises(!showExercises)} className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              <Dumbbell size={14} /> 
              {selectedExercises.length === 0 ? 'All Exercises' : `${selectedExercises.length} Selected`}
              <ChevronDown size={14} className="ml-1" />
            </button>
            {showExercises && (
              <div className="absolute top-full mt-2 left-0 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-50">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Filter specifically</p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {availableExercises.map(ex => (
                    <label key={ex.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                      <input type="checkbox" checked={selectedExercises.includes(ex.id)} onChange={() => toggleEx(ex.id)} className="rounded text-teal-600 focus:ring-teal-500" />
                      <span className="text-xs font-medium text-slate-700 truncate">{ex.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button onClick={() => fetchReport(false)} disabled={loading} className="ml-auto flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg text-sm font-semibold transition shadow-sm disabled:opacity-50">
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <BarChart2 size={14} />} 
            Generate
          </button>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto px-6 py-8 space-y-8">
        {loading && !reportData && (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-12 h-12 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
            <p className="text-slate-400 font-medium">Analyzing performance...</p>
          </div>
        )}

        {reportData && !loading && (
          <>
            {/* HERO STATS GRID */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border rounded-[12px] p-5 shadow-sm">
                <Activity size={20} className="text-violet-600 mb-3" />
                <p className="text-3xl font-bold text-slate-900">{s?.totalReps || 0}</p>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Total Reps</p>
              </div>
              <div className="bg-white border rounded-[12px] p-5 shadow-sm">
                <Clock size={20} className="text-blue-500 mb-3" />
                <p className="text-3xl font-bold text-slate-900">{fmtDuration(s?.totalDurationSec)}</p>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Active Time</p>
              </div>
              <div className="bg-white border rounded-[12px] p-5 shadow-sm">
                <Calendar size={20} className="text-teal-600 mb-3" />
                <p className="text-3xl font-bold text-slate-900">{s?.totalSessions || 0}</p>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Sessions Done</p>
              </div>
              <div className="bg-white border rounded-[12px] p-5 shadow-sm relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-2 h-full ${s?.adherenceRate >= 80 ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <Flame size={20} className="text-orange-500 mb-3" />
                <p className="text-3xl font-bold text-slate-900">{s?.adherenceRate || 0}%</p>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Adherence Rate</p>
              </div>
            </div>

            {/* CHART GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Reps Per Session (Bar) */}
              <div className="bg-white border rounded-[12px] shadow-sm p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Activity size={18} className="text-violet-600" /> Reps Progression</h3>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.timeline} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(d: string) => d.slice(5)} axisLine={false} tickLine={false} dy={10} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: '#F8FAFC' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="reps" fill="#8B5CF6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Active Time (Line) */}
              <div className="bg-white border rounded-[12px] shadow-sm p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Clock size={18} className="text-blue-500" /> Active Time Trend</h3>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={reportData.timeline} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(d: string) => d.slice(5)} axisLine={false} tickLine={false} dy={10} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748B' }} unit="m" axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Line type="monotone" dataKey="durationMin" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Exercise Breakdown Pie (if multiple exercises) */}
              {reportData.exerciseBreakdown?.length > 0 && (
                <div className="bg-white border rounded-[12px] shadow-sm p-6 lg:col-span-2">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Dumbbell size={18} className="text-teal-600" /> Exercise Volume Breakdown</h3>
                  <div className="flex flex-col md:flex-row items-center gap-8 h-[250px]">
                    <div className="flex-1 w-full h-full min-w-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={reportData.exerciseBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="totalReps">
                            {reportData.exerciseBreakdown.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 w-full overflow-y-auto max-h-[220px] space-y-2 pr-2">
                      {reportData.exerciseBreakdown.map((ex: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-[8px]">
                          <div className="flex items-center gap-3">
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                            <div>
                              <p className="text-sm font-bold text-slate-800">{ex.name}</p>
                              <p className="text-[10px] text-slate-500">{ex.sessions} sessions</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-slate-800">{ex.totalReps} <span className="text-[10px] font-normal text-slate-400">reps</span></p>
                            <p className="text-[10px] text-slate-500">{fmtDuration(ex.totalDurationSec)} active</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* TABULAR LOG */}
            <div className="bg-white border rounded-[12px] shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><Table2 size={18} className="text-slate-400" /> Detailed Session Log</h3>
              </div>
              
              <div className="overflow-x-auto min-h-[300px]">
                {tableRows.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">No session data available in this timeframe.</div>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-6">Date</th>
                        <th className="py-3 px-6">Reps</th>
                        <th className="py-3 px-6">Duration (min)</th>
                        <th className="py-3 px-6">Intensity Proxy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm">
                      {paginatedRows.map((row: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-3 px-6 font-medium text-slate-700">{row.date}</td>
                          <td className="py-3 px-6 font-bold text-slate-900">{row.reps}</td>
                          <td className="py-3 px-6 text-slate-600">{row.durationMin}m</td>
                          <td className="py-3 px-6">
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-teal-500 rounded-full" style={{ width: `${Math.min(100, row.reps * 2)}%` }} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Internal Pagination */}
              {totalPages > 1 && (
                <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-sm">
                  <span className="text-slate-500">Page <span className="font-bold text-slate-800">{currentPage}</span> of {totalPages}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-50">Prev</button>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-50">Next</button>
                  </div>
                </div>
              )}
            </div>

          </>
        )}
      </main>
    </div>
  );
}
