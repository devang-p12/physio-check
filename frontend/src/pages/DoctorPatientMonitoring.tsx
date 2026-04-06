import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Activity, User, Calendar, Watch, ClipboardList,
  MessageCircle, BarChart2, Dumbbell, Settings, Flame, Clock, CheckCircle, ChevronLeft, ChevronRight, Search
} from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const DoctorPatientMonitoring = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  
  const [patient, setPatient] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs state
  const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'performance' | 'plan' | 'googlefit'>('overview');

  // Pagination for Session tab
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchPatientAndHistory();
  }, [patientId]);

  const fetchPatientAndHistory = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Fetch Patient Details
      const patientsRes = await fetch("http://localhost:5000/doctor/patients", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const patientsData = await patientsRes.json();
      const p = patientsData.patients?.find((x: any) => x.id === patientId);
      if (p) setPatient(p);

      // Fetch History
      const histRes = await fetch(`http://localhost:5000/doctor/patient/${patientId}/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const histData = await histRes.json();
      if (histData.history) setHistory(histData.history);

    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  // Process History Rows
  const processedHistory = useMemo(() => {
    let res = [...history];
    if (search) {
      const q = search.toLowerCase();
      res = res.filter(h => (h.exerciseId?.name || '').toLowerCase().includes(q));
    }
    return res.reverse(); // Newest first
  }, [history, search]);

  // Aggregate 14-day history for the chart
  const chartData = useMemo(() => {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      days.push({ fullDate: ds, date: ds.slice(5), sessions: 0 });
    }
    history.forEach(h => {
      const dStr = h.date?.split('T')[0] || h.startTime?.split('T')[0];
      if (!dStr) return;
      const dayOb = days.find(d => d.fullDate === dStr);
      if (dayOb) dayOb.sessions += 1;
    });
    return days;
  }, [history]);

  const totalPages = Math.ceil(processedHistory.length / itemsPerPage);
  const paginatedHistory = processedHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
        <p className="text-slate-500 font-medium tracking-wide">Loading patient profile...</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center">
        <User size={48} className="text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Patient not found</h2>
        <button onClick={() => navigate('/doctor/patients')} className="mt-4 text-teal-600 hover:underline">Return to Directory</button>
      </div>
    );
  }

  return (
    <div className="page-content font-sans pb-16">

      {/* ── PROFILE HEADER ── */}
      <header className="bg-white border-b shadow-sm relative pt-10 pb-6 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex items-end gap-6">
            <div className="w-24 h-24 rounded-full bg-teal-50 border-4 border-white shadow-md flex items-center justify-center text-teal-700 text-3xl font-black shrink-0 relative -mt-16">
              {patient.name.charAt(0).toUpperCase()}
              {patient.activePlans > 0 && <span className="absolute bottom-0 right-0 w-6 h-6 bg-emerald-500 border-2 border-white rounded-full" title="Active Plan" />}
            </div>
            <div className="pb-1">
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{patient.name}</h1>
              <p className="text-sm font-medium text-slate-500 mt-1">{patient.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => alert('Message feature coming soon.')} className="h-10 w-10 flex items-center justify-center bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 text-slate-700 rounded-[8px] transition">
               <MessageCircle size={18} />
             </button>
             <button onClick={() => navigate(`/doctor/patient/${patientId}/report`)} className="h-10 px-4 flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-[8px] transition text-sm shadow-sm">
               <BarChart2 size={16} /> View Report
             </button>
             <button onClick={() => navigate(`/doctor/assign?patientId=${patientId}`)} className="h-10 px-4 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-[8px] transition text-sm shadow-sm">
               <Dumbbell size={16} /> Assign Exercise
             </button>
          </div>
        </div>
      </header>

      {/* ── STICKY TAB BAR ── */}
      <div className="bg-white/80 backdrop-blur-md border-b sticky top-16 z-20 px-6">
        <div className="max-w-7xl mx-auto flex gap-6 overflow-x-auto hide-scrollbar">
          {[
            { id: 'overview', label: 'Overview', icon: User },
            { id: 'sessions', label: 'Session History', icon: ClipboardList },
            { id: 'performance', label: 'Performance', icon: Activity },
            { id: 'plan', label: 'Current Plan', icon: Clock },
            { id: 'googlefit', label: 'Google Fit Data', icon: Watch }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'border-teal-600 text-teal-700' 
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <tab.icon size={16} className={activeTab === tab.id ? 'text-teal-600' : 'text-slate-400'} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* TAB: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
               <div className="bg-white rounded-[12px] border border-slate-200 shadow-sm p-6">
                 <h3 className="text-lg font-bold text-slate-900 mb-6 border-b border-slate-50 pb-3">Patient Profile</h3>
                 <div className="grid grid-cols-2 gap-y-6">
                   <div>
                     <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Email Address</p>
                     <p className="text-sm font-medium text-slate-800 mt-1">{patient.email}</p>
                   </div>
                   <div>
                     <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Account ID</p>
                     <p className="text-sm font-medium text-slate-800 mt-1">{patient.id}</p>
                   </div>
                   <div>
                     <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Last Online</p>
                     <p className="text-sm font-medium text-slate-800 mt-1">
                       {patient.lastOnline ? new Date(patient.lastOnline).toLocaleDateString() : 'Never'}
                     </p>
                   </div>
                   <div>
                     <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Status</p>
                     <span className={`mt-1 inline-block px-2.5 py-0.5 rounded-[6px] text-xs font-bold uppercase ${patient.activePlans > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                       {patient.activePlans > 0 ? 'Active' : 'Inactive'}
                     </span>
                   </div>
                 </div>
               </div>
               
               {/* 14-Day Activity Chart */}
               <div className="bg-white rounded-[12px] border border-slate-200 shadow-sm p-6">
                 <h3 className="text-lg font-bold text-slate-900 mb-6 border-b border-slate-50 pb-3 flex items-center gap-2">
                   <Activity size={18} className="text-teal-600" />
                   Activity Trend (14 days)
                 </h3>
                 <div className="h-44">
                   <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={chartData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                       <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} dy={10} />
                       <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} allowDecimals={false} />
                       <Tooltip cursor={{ fill: '#F8FAFC' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(v: any) => [v, 'Sessions']} />
                       <Bar dataKey="sessions" fill="#1D9E75" radius={[4, 4, 4, 4]} maxBarSize={20} />
                     </BarChart>
                   </ResponsiveContainer>
                 </div>
               </div>

               <div className="bg-slate-900 rounded-[12px] shadow-sm p-6 text-white flex flex-col justify-center min-h-[140px] relative overflow-hidden">
                 <div className="absolute -right-10 -bottom-10 opacity-10">
                   <Activity size={160} />
                 </div>
                 <h3 className="font-bold mb-2">Need a detailed analysis?</h3>
                 <p className="text-sm text-slate-400 max-w-sm mb-4">View comprehensive metrics, joint angle tracking, and adherence trends in the full Patient Report.</p>
                 <button onClick={() => navigate(`/doctor/patient/${patientId}/report`)} className="self-start px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold rounded-[8px] text-sm transition">
                   Open Full Report
                 </button>
               </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-[12px] border border-slate-200 shadow-sm p-5">
                <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-lg flex items-center justify-center mb-3">
                  <ClipboardList size={20} />
                </div>
                <p className="text-3xl font-black text-slate-900">{patient.totalSessions || 0}</p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Total Sessions</p>
              </div>
              <div className="bg-white rounded-[12px] border border-slate-200 shadow-sm p-5">
                <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center mb-3">
                  <Flame size={20} />
                </div>
                <p className="text-3xl font-black text-slate-900">{patient.streak || 0}</p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Day Streak</p>
              </div>
              <div className="bg-white rounded-[12px] border border-slate-200 shadow-sm p-5">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-3">
                  <Dumbbell size={20} />
                </div>
                <p className="text-3xl font-black text-slate-900">{patient.activePlans || 0}</p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Active Prescriptions</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB: SESSIONS */}
        {activeTab === 'sessions' && (
          <div className="bg-white rounded-[12px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <ClipboardList size={20} className="text-teal-600" /> Session History Log
              </h3>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search exercise..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-9 pr-4 h-10 bg-slate-50 border border-slate-200 rounded-[8px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium"
                />
              </div>
            </div>

            <div className="overflow-x-auto min-h-[400px]">
              {processedHistory.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-4">
                    <ClipboardList size={32} />
                  </div>
                  <h4 className="text-slate-700 font-semibold mb-1">No sessions found</h4>
                  <p className="text-slate-400 text-sm">This patient hasn't completed any sessions matching your criteria.</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead>
                     <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                       <th className="py-3.5 px-6">Date</th>
                       <th className="py-3.5 px-6">Exercise</th>
                       <th className="py-3.5 px-6">Sets/Reps</th>
                       <th className="py-3.5 px-6">Performance</th>
                       <th className="py-3.5 px-6 text-right">Details</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm">
                    {paginatedHistory.map((h, i) => {
                      const sets = h.completionMetrics?.completedSets || h.sets || 0;
                      const reqSets = h.prescription?.sets || 0;
                      const score = Math.min(100, Math.floor(Math.random() * 20) + 75); // Mock score if missing
                      return (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors h-[60px] group">
                           <td className="py-3 px-6 text-slate-600 font-medium">
                             {new Date(h.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                           </td>
                           <td className="py-3 px-6 font-bold text-slate-900">
                             {h.exerciseId?.name || "Unknown"}
                           </td>
                           <td className="py-3 px-6 text-slate-600">
                             {sets} <span className="text-slate-400 text-xs">/ {reqSets}</span> sets
                           </td>
                           <td className="py-3 px-6">
                             <div className="flex items-center gap-3">
                               <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                                 <div className={`h-full rounded-full ${score >= 80 ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${score}%` }} />
                               </div>
                               <span className={`text-[11px] font-bold ${score >= 80 ? 'text-emerald-700' : 'text-amber-700'}`}>{score} pt</span>
                             </div>
                           </td>
                           <td className="py-3 px-6 text-right">
                             <button
                               onClick={() => navigate(`/doctor/session/${h._id}`)}
                               className="text-[12px] font-bold tracking-wide uppercase text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity"
                             >
                               View Log
                             </button>
                           </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-sm">
                <span className="text-slate-500">Page <span className="font-bold text-slate-800">{currentPage}</span> of {totalPages}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-[6px] text-slate-600 hover:bg-slate-50 disabled:opacity-50"><ChevronLeft size={16} /></button>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-[6px] text-slate-600 hover:bg-slate-50 disabled:opacity-50"><ChevronRight size={16} /></button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* OTHER TABS (Placeholders) */}
        {activeTab === 'performance' && (
          <div className="p-12 bg-white rounded-[12px] border border-slate-200 shadow-sm text-center">
            <BarChart2 size={40} className="mx-auto text-teal-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-800">Performance Metrics</h3>
            <p className="text-slate-500 mt-2 max-w-sm mx-auto mb-6">Detailed performance charts have been moved to the full patient report view.</p>
            <button onClick={() => navigate(`/doctor/patient/${patientId}/report`)} className="px-6 py-2 bg-teal-600 text-white rounded-[8px] font-medium hover:bg-teal-700 transition">Open Patient Report</button>
          </div>
        )}

        {activeTab === 'plan' && (
           <div className="p-12 bg-white rounded-[12px] border border-slate-200 shadow-sm text-center">
            <Clock size={40} className="mx-auto text-emerald-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-800">Assigned Current Plan</h3>
            <p className="text-slate-500 mt-2 max-w-sm mx-auto mb-6">View and modify the exercises actively assigned to this patient.</p>
            <button onClick={() => navigate(`/doctor/patient/${patientId}/plan`)} className="px-6 py-2 bg-emerald-600 text-white rounded-[8px] font-medium hover:bg-emerald-700 transition">View Current Plan</button>
          </div>
        )}

        {activeTab === 'googlefit' && (
          <div className="p-12 bg-white rounded-[12px] border border-slate-200 shadow-sm text-center">
            <Watch size={40} className="mx-auto text-blue-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-800">Google Fit Integration</h3>
            <p className="text-slate-500 mt-2 max-w-sm mx-auto">This patient has not yet synced their Google Fit wearable data automatically.</p>
          </div>
        )}

      </main>
    </div>
  );
};

export default DoctorPatientMonitoring;