import React, { useEffect, useState } from "react";
import {
  Activity, Play, Flame, TrendingUp, ChevronRight, Bell,
  UserRoundSearch, MessageCircle, Settings, LogOut, Dumbbell, Calendar as CalIcon, MapPin, Monitor
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";
import { PieChart, Pie, Cell, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

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
  const [appointments, setAppointments] = useState<any[]>([]);

  // Synthesize past 14 days activity
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const name = localStorage.getItem("name");
    if (name) setPatientName(name);
    fetchData();

    const onVisible = () => { if (document.visibilityState === 'visible') fetchData(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/patient/todays-exercises");
      setExercises(data.exercises || []);
      setStreak(data.streak ?? 0);
      setTotalSessions(data.totalSessions ?? 0);
      
      // Parse Calendar object into 14 days BarChart
      if (data.calendar) {
        const sortedDates = Object.keys(data.calendar).sort().reverse().slice(0, 14).reverse();
        const past14 = sortedDates.map(date => ({
          date: date.slice(5), // MM-DD
          sessions: data.calendar[date]
        }));
        setChartData(past14);
      }
    } catch (err) {
      console.error("Failed to fetch exercises");
    }

    try {
      const aptRes = await fetch("http://localhost:5000/appointment/patient", {
        headers: { "Authorization": `Bearer ${localStorage.getItem('token')}` }
      });
      const aptData = await aptRes.json();
      if (aptData.appointments) {
        setAppointments(aptData.appointments.filter((a: any) => new Date(a.startTime) > new Date()).slice(0, 3));
      }
    } catch (e) {
      // Ignore if unavailable
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.replace("/login");
  };

  const completedCount = exercises.filter((e: any) => e.completedToday).length;
  const totalCount = exercises.length;
  const donutData = totalCount === 0 ? [{ name: 'None', val: 1 }] : [
    { name: 'Done', val: completedCount },
    { name: 'Remaining', val: totalCount - completedCount }
  ];
  const donutColors = totalCount === 0 ? ['#E2E8F0'] : ['#10B981', '#F1F5F9'];

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-20">
      {/* ── NAV ── */}
      <nav className="bg-white px-6 md:px-12 py-4 flex flex-col md:flex-row justify-between items-center sticky top-0 z-30 border-b border-slate-100 shadow-sm gap-4 md:gap-0">
        <div className="flex items-center justify-between w-full md:w-auto gap-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center text-white">
              <Activity size={20} strokeWidth={2.5} />
            </div>
            <span className="font-extrabold text-slate-900 tracking-tight">PhysioCheck</span>
          </div>

          {/* Mobile overrides inline */}
          <div className="md:hidden flex gap-2">
            <button onClick={() => navigate("/patient/profile")} className="p-0 border-0 bg-transparent rounded-full hover:ring-2 hover:ring-teal-500 transition-all">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${patientName}`} alt="User" className="w-8 h-8 rounded-full border border-slate-200 bg-slate-50" />
            </button>
            <button onClick={handleLogout} className="text-slate-400 p-1"><LogOut size={18} /></button>
          </div>
        </div>

        <div className="flex items-center justify-between w-full md:w-auto gap-4 md:gap-6 overflow-x-auto hide-scrollbar">
          <button onClick={() => navigate("/patient/doctors")} className="flex items-center gap-1.5 px-2 py-1 text-sm font-medium text-slate-600 hover:text-teal-600 transition whitespace-nowrap">
            <UserRoundSearch size={15} /> Find Doctor
          </button>
          <button onClick={() => navigate("/patient/chatbot")} className="flex items-center gap-1.5 px-2 py-1 text-sm font-medium text-slate-600 hover:text-teal-600 transition whitespace-nowrap">
            <MessageCircle size={15} /> Assistant
          </button>
          <button onClick={() => navigate("/patient/history")} className="flex items-center gap-1.5 px-2 py-1 text-sm font-medium text-slate-600 hover:text-teal-600 transition whitespace-nowrap">
            <TrendingUp size={15} /> History
          </button>
          <div className="hidden md:flex w-px h-5 bg-slate-200 mx-2" />
          <button onClick={() => navigate("/patient/settings")} className="hidden md:block p-1.5 text-slate-400 hover:text-slate-600 transition">
            <Settings size={18} />
          </button>
          <button className="hidden md:block p-1.5 text-slate-400 hover:text-slate-600 transition">
            <Bell size={18} />
          </button>
          <button onClick={() => navigate("/patient/profile")} className="hidden md:block p-0 border-0 bg-transparent rounded-full hover:ring-2 hover:ring-teal-500 transition-all ml-1">
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${patientName}`} alt="User" className="w-9 h-9 rounded-full border border-slate-200 bg-slate-50 shadow-sm" />
          </button>
          <button onClick={handleLogout} className="hidden md:block p-1.5 text-slate-400 hover:text-red-500 transition ml-2">
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      <main className="max-w-[1200px] mx-auto px-6 py-8">
        {/* ── GREETING ── */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            {greeting()}, {patientName}!
          </h1>
          <p className="text-slate-500 font-medium mt-1">Ready for your recovery session today?</p>
        </div>

        {/* ── 60/40 GRID ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[60%_40%] gap-8 items-start">
          
          {/* L: 60% COLUMN */}
          <div className="space-y-6">
            
            {/* Today's Route CTA Card */}
            <div className="bg-gradient-to-br from-teal-600 to-emerald-600 rounded-3xl p-8 text-white shadow-xl shadow-teal-200/50 relative overflow-hidden group">
              <div className="absolute -right-16 -top-16 text-white/10 group-hover:scale-110 transition-transform duration-700 pointer-events-none">
                <Dumbbell size={250} />
              </div>
              <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div>
                  <span className="bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-widest rounded-full mb-4 inline-block backdrop-blur-sm border border-white/20">
                    Daily Routine
                  </span>
                  <h2 className="text-3xl font-black mb-3">Today's Assigned Route</h2>
                  <p className="text-teal-100 text-sm leading-relaxed mb-6 font-medium max-w-sm">
                    {totalCount > 0 
                      ? `You have ${totalCount - completedCount} exercises remaining out of ${totalCount}. Keep pushing!` 
                      : 'You do not have any exercises assigned for today. Take a rest or consult your doctor.'}
                  </p>
                  <button 
                    onClick={() => navigate('/patient/todays-plan')}
                    disabled={totalCount === 0}
                    className="bg-white text-teal-700 hover:bg-slate-50 disabled:opacity-50 px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md shadow-teal-900/10 active:scale-95"
                  >
                    <Play size={18} fill="currentColor" /> Open Plan
                  </button>
                </div>

                {/* Donut Chart nested inside Hero card */}
                <div className="flex flex-col items-center justify-center">
                  <div className="w-40 h-40 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} dataKey="val" stroke="none" startAngle={90} endAngle={-270}>
                          {donutData.map((d, i) => <Cell key={i} fill={donutColors[i]} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-3xl font-black">{totalCount > 0 ? Math.round((completedCount/totalCount)*100) : 0}%</span>
                    </div>
                  </div>
                  <p className="text-teal-100 text-xs font-bold uppercase tracking-wider mt-2">Completion</p>
                </div>
              </div>
            </div>

            {/* Micro Stats Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-[16px] border border-slate-200 shadow-sm p-6 flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mb-4 border border-orange-100">
                  <Flame size={24} />
                </div>
                <p className="text-3xl font-black text-slate-900 leading-none mb-1">{streak}</p>
                <p className="text-xs font-bold text-slate-400 auto-uppercase tracking-widest uppercase">Day Streak</p>
              </div>
              
              <div className="bg-white rounded-[16px] border border-slate-200 shadow-sm p-6 flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4 border border-blue-100">
                  <TrendingUp size={24} />
                </div>
                <p className="text-3xl font-black text-slate-900 leading-none mb-1">{totalSessions}</p>
                <p className="text-xs font-bold text-slate-400 auto-uppercase tracking-widest uppercase">Total Sessions</p>
              </div>
            </div>

          </div>

          {/* R: 40% COLUMN */}
          <div className="space-y-6">
            
            {/* Activity Chart */}
            <div className="bg-white rounded-[16px] border border-slate-200 shadow-sm p-6">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-6">
                <Activity size={18} className="text-teal-600" />
                Activity Trend (14 days)
              </h3>
              
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.length ? chartData : [{ date: 'Today', sessions: 0 }]} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} allowDecimals={false} />
                    <Tooltip cursor={{ fill: '#F8FAFC' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(v: any) => [v, 'Sessions']} />
                    <Bar dataKey="sessions" fill="#1D9E75" radius={[4, 4, 4, 4]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Upcoming Appointments */}
            <div className="bg-white rounded-[16px] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <CalIcon size={18} className="text-blue-500" /> Upcoming
                </h3>
                <button onClick={() => navigate('/patient/booking')} className="text-xs font-bold text-teal-600 hover:underline">Book</button>
              </div>
              <div className="p-4 space-y-3">
                {appointments.length === 0 ? (
                  <div className="py-4 text-center text-slate-400 text-sm">No upcoming appointments.</div>
                ) : appointments.map((apt, i) => (
                  <div key={i} className="p-3 bg-slate-50 border border-slate-100 rounded-[12px] flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{apt.doctorId?.name || 'Doctor Appointment'}</p>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        {new Date(apt.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {new Date(apt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className={`p-2 rounded-[8px] ${apt.sessionMode === 'online' ? 'bg-teal-100 text-teal-700' : 'bg-blue-100 text-blue-700'}`}>
                      {apt.sessionMode === 'online' ? <Monitor size={16} /> : <MapPin size={16} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => navigate("/patient/history")} className="bg-white border border-slate-200 rounded-[12px] p-4 flex items-center justify-between hover:border-teal-400 hover:shadow-md transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-50 text-slate-500 rounded-[8px] group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors">
                    <TrendingUp size={16} />
                  </div>
                  <span className="text-sm font-bold text-slate-700 group-hover:text-teal-700">History</span>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-teal-500 transition-colors" />
              </button>
              
              <button onClick={() => navigate("/patient/settings")} className="bg-white border border-slate-200 rounded-[12px] p-4 flex items-center justify-between hover:border-teal-400 hover:shadow-md transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-50 text-slate-500 rounded-[8px] group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors">
                    <Settings size={16} />
                  </div>
                  <span className="text-sm font-bold text-slate-700 group-hover:text-teal-700">Settings</span>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-teal-500 transition-colors" />
              </button>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

export default PatientDashboard;
