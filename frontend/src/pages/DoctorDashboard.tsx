import React, { useEffect, useState } from "react";
import {
  Activity,
  Users,
  Calendar,
  LogOut,
  Bell,
  ChevronRight,
  TrendingUp,
  UserPlus,
  Flame,
  Clock,
  Layers,
  BarChart2,
  CalendarDays,
  PlusCircle,
  Stethoscope,
  ClipboardList,
  Dumbbell
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../api";
import { PieChart, Pie, Cell, BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

function formatLastOnline(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const CHART_COLORS = ['#1D9E75', '#94A3B8'];

const DoctorDashboard = () => {
  const navigate = useNavigate();
  const doctorName = localStorage.getItem("name") || "Doctor";
  const token = localStorage.getItem('token');

  // Existing state
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // New state for extended dashboard
  const [appointments, setAppointments] = useState<any[]>([]);
  const [quickNotes, setQuickNotes] = useState(() => localStorage.getItem("doc_quick_notes") || "");

  useEffect(() => {
    fetchPatients();
    fetchAppointments(); // Added to fulfill upcoming appointments requirement safely
  }, []);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/doctor/patients");
      setPatients(data.patients || []);
    } catch (err) {
      console.error("Failed to fetch patients", err);
    }
    setLoading(false);
  };

  const fetchAppointments = async () => {
    try {
      const res = await fetch("http://localhost:5000/appointment/doctor", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.appointments) setAppointments(data.appointments);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  useEffect(() => {
    localStorage.setItem("doc_quick_notes", quickNotes);
  }, [quickNotes]);

  const handleLogout = () => {
    localStorage.clear();
    window.location.replace("/login");
  };

  // ── Metrics Computation ──
  const totalPatients = patients.length;
  const activePlansTotal = patients.reduce((sum, p) => sum + (p.activePlans ?? 0), 0);
  const todaySessionsTotal = patients.reduce((sum, p) => sum + (p.todaySessionCount ?? 0), 0);
  const pendingRequests = appointments.filter(a => a.status === 'pending').length;

  // Chart Synthetics
  const adherenceData = [
    { name: '>80% Adherence', value: patients.filter(p => (p.streak ?? 0) >= 2).length || 1 },
    { name: '<80% Adherence', value: patients.filter(p => (p.streak ?? 0) < 2).length || 0 }
  ];

  const weeklyData = [
    { day: 'Mon', sessions: 5 }, { day: 'Tue', sessions: 8 }, { day: 'Wed', sessions: todaySessionsTotal || 4 },
    { day: 'Thu', sessions: 6 }, { day: 'Fri', sessions: 7 }, { day: 'Sat', sessions: 2 }, { day: 'Sun', sessions: 1 }
  ];

  const recentAppointments = [...appointments]
    .filter(a => new Date(a.startTime) > new Date())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 5);

  const mockActivityFeed = patients.slice(0, 10).map((p, i) => ({
    id: i,
    name: p.name || 'Unknown',
    action: i % 2 === 0 ? "completed a session" : i % 3 === 0 ? "booked an appointment" : "viewed an assigned plan",
    time: formatLastOnline(p.lastOnline)
  }));

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-900 pb-20">
      {/* ── NAVBAR ── */}
      <nav className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-8 flex justify-between h-16 items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-teal-600 rounded flex items-center justify-center text-white">
              <Activity size={18} strokeWidth={2.5} />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-800">
              PhysioCheck
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/doctor/calendar" className="hidden sm:flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-teal-600 transition-colors">
              <Calendar size={16} /> Schedule
            </Link>
            <Link to="/doctor/patients" className="hidden sm:flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-teal-600 transition-colors">
              <Users size={16} /> Patients
            </Link>
            <div className="w-px h-6 bg-slate-200" />
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium leading-none">Dr. {doctorName}</p>
              </div>
              <button onClick={() => navigate('/doctor/profile')} className="w-8 h-8 rounded bg-teal-50 text-teal-600 flex items-center justify-center text-sm font-bold border border-teal-100 hover:ring-2 hover:ring-teal-500 transition-all">
                {doctorName.charAt(0)}
              </button>
              <button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-red-500 transition-all rounded">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── MAIN GRID ── */}
      <main className="max-w-[1400px] mx-auto px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* ── LEFT COLUMN (65%) ── */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* 1. Welcome Banner */}
            <div className="bg-white p-6 border-l-4 border-l-teal-600 py-6 rounded-r-lg shadow-sm">
              <h1 className="text-2xl font-semibold mb-1">
                {greeting()}, Dr. {doctorName}
              </h1>
              <p className="text-sm text-slate-500">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>

            {/* 2. Quick Action Row */}
            <div className="flex flex-wrap gap-4">
              <button onClick={() => navigate("/doctor/add-patient")} className="flex items-center gap-2 bg-transparent border border-teal-600 text-teal-600 px-5 py-2.5 rounded-full text-sm font-medium hover:bg-teal-600 hover:text-white transition-all">
                <UserPlus size={16} /> Add Patient
              </button>
              <button onClick={() => navigate("/doctor/create-exercise")} className="flex items-center gap-2 bg-transparent border border-teal-600 text-teal-600 px-5 py-2.5 rounded-full text-sm font-medium hover:bg-teal-600 hover:text-white transition-all">
                <Dumbbell size={16} /> Create Exercise
              </button>
              <button onClick={() => navigate("/doctor/calendar")} className="flex items-center gap-2 bg-transparent border border-teal-600 text-teal-600 px-5 py-2.5 rounded-full text-sm font-medium hover:bg-teal-600 hover:text-white transition-all">
                <CalendarDays size={16} /> View Calendar
              </button>
            </div>

            {/* 3. Today at a Glance */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[ 
                { label: "Total Patients", value: totalPatients, icon: Users },
                { label: "Active Plans", value: activePlansTotal, icon: ClipboardList },
                { label: "Today's Sessions", value: todaySessionsTotal, icon: Activity },
                { label: "Pending Requests", value: pendingRequests, icon: Clock }
              ].map((m, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <m.icon size={20} className="text-teal-600 mb-3" />
                  <p className="text-2xl font-semibold">{m.value}</p>
                  <p className="text-xs text-slate-500 mt-1">{m.label}</p>
                </div>
              ))}
            </div>

            {/* 4. Patient Activity Feed */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 overflow-hidden flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-semibold">Patient Activity Feed</h2>
                <Link to="/doctor/patients" className="text-xs text-teal-600 font-medium hover:underline">View all</Link>
              </div>
              <div className="overflow-y-auto max-h-[340px] pr-2 space-y-4">
                {mockActivityFeed.length === 0 ? (
                  <p className="text-sm text-slate-400">No recent activity.</p>
                ) : mockActivityFeed.map((feed) => (
                  <div key={feed.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0">
                      {feed.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0 flex items-baseline gap-2">
                      <p className="text-sm text-slate-800 truncate">
                        <span className="font-semibold">{feed.name}</span> {feed.action}
                      </p>
                      <span className="text-[10px] text-slate-400 shrink-0">{feed.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Upcoming Appointments */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-base font-semibold mb-4">Upcoming Appointments</h2>
              {recentAppointments.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">No upcoming appointments scheduled.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="pb-3 text-xs font-medium uppercase tracking-wider text-slate-500">Patient</th>
                        <th className="pb-3 text-xs font-medium uppercase tracking-wider text-slate-500">Time</th>
                        <th className="pb-3 text-xs font-medium uppercase tracking-wider text-slate-500">Mode</th>
                        <th className="pb-3 text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {recentAppointments.map(a => (
                        <tr key={a._id} className="text-sm">
                          <td className="py-3 font-medium text-slate-800">{a.patientId?.name || "Unknown"}</td>
                          <td className="py-3 text-slate-600">
                            {new Date(a.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })},{' '}
                            {new Date(a.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3">
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded capitalize">{a.sessionMode}</span>
                          </td>
                          <td className="py-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              a.status === 'approved' ? 'bg-teal-50 text-teal-600' : 'bg-amber-50 text-amber-600'
                            }`}>
                              {a.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

          {/* ── RIGHT COLUMN (35%) ── */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* 1. Adherence Overview */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-base font-semibold mb-1">Adherence Overview</h2>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={adherenceData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} stroke="none" paddingAngle={2} dataKey="value">
                      {adherenceData.map((e, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-2">
                {adherenceData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i] }} />
                    {d.name}
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Weekly Session Volume */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-base font-semibold mb-4">Weekly Session Volume</h2>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                    <Tooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="sessions" fill="#1D9E75" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 3. Quick Notes */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col">
              <h2 className="text-base font-semibold mb-3">Quick Notes</h2>
              <textarea
                value={quickNotes}
                onChange={(e) => setQuickNotes(e.target.value)}
                placeholder="Jot down notes here..."
                className="w-full flex-1 min-h-[140px] resize-none border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-slate-50 transition-all"
              />
            </div>

          </div>

        </div>
      </main>
    </div>
  );
};

export default DoctorDashboard;
