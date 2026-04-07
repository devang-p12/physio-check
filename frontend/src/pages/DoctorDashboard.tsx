import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  Activity,
  Users,
  Clock,
  ClipboardList,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Plus,
  TrendingUp,
  Stethoscope,
  LayoutDashboard,
  Calendar,
  MessageSquare
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../api";
import PageLoader from "../components/PageLoader";
import { SkeletonStatCard, SkeletonTableRow } from "../components/Skeleton";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  PieChart,
  Pie
} from "recharts";

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

const DoctorDashboard = () => {
  const navigate = useNavigate();
  const doctorName = localStorage.getItem("name") || "Doctor";
  const token = localStorage.getItem('token');

  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<any[]>([]);
  
  // Pagination State
  const [activityPage, setActivityPage] = useState(0);
  const [apptPage, setApptPage] = useState(0);
  const itemsPerPage = 5;

  useEffect(() => {
    fetchPatients();
    fetchAppointments();
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

  // ── Metrics Computation ──
  const totalPatients = patients.length;
  const activePlansTotal = patients.reduce((sum, p) => sum + (p.activePlans ?? 0), 0);
  const todaySessionsTotal = patients.reduce((sum, p) => sum + (p.todaySessionCount ?? 0), 0);
  const pendingRequestsCount = appointments.filter(a => a.status === 'pending').length;

  const mockActivityFeed = useMemo(() => patients.map((p, i) => ({
    id: i,
    name: p.name || 'Unknown',
    action: i % 2 === 0 ? "completed a session" : i % 3 === 0 ? "booked an appointment" : "viewed an assigned plan",
    time: formatLastOnline(p.lastOnline),
    type: i % 2 === 0 ? 'success' : i % 3 === 0 ? 'info' : 'neutral'
  })), [patients]);

  const upcomingAppointments = useMemo(() => [...appointments]
    .filter(a => new Date(a.startTime) > new Date())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()), [appointments]);

  // Pagination Logic
  const activityCount = mockActivityFeed.length;
  const apptCount = upcomingAppointments.length;

  const paginatedActivity = mockActivityFeed.slice(activityPage * itemsPerPage, (activityPage + 1) * itemsPerPage);
  const paginatedAppts = upcomingAppointments.slice(apptPage * itemsPerPage, (apptPage + 1) * itemsPerPage);

  // Mock Practice Activity Chart Data (Synthesized from patients & appointments)
  const chartData = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return days.map((day, i) => ({
      name: day,
      sessions: Math.floor(Math.random() * 15) + 5 + i,
      plans: Math.floor(Math.random() * 8) + 2,
    }));
  }, []);

  const revealRefs = useRef<Array<HTMLDivElement | null>>([]);
  useEffect(() => {
    const els = revealRefs.current.filter(Boolean) as HTMLDivElement[];
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add('visible');
      });
    }, { threshold: 0.1 });
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [loading]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/90 backdrop-blur-md border border-[#A8DADC]/40 p-3 rounded-xl shadow-xl">
          <p className="text-[12px] font-black tracking-wider text-[#1D3557] mb-1 uppercase">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={`item-${index}`} className="text-[13px] font-bold" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <PageLoader visible={loading} />
      <div className="min-h-screen font-sans bg-[#F1FAEE] overflow-x-hidden">
        
        {/* ── HERO SECTION: DEEP OCEAN ── */}
        <section className="relative w-full bg-gradient-to-br from-[#1D3557] via-[#1D3557] to-[#457B9D] px-6 py-4 md:px-12 md:py-6 lg:px-24 lg:py-8 overflow-hidden rounded-b-[4rem] shadow-2xl shadow-[#1D3557]/20">
          
          {/* Decorative Grid & Glow */}
          <div className="absolute top-[-20%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#A8DADC]/10 via-transparent to-transparent z-0 opacity-80" />
          <div className="absolute inset-0 z-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(168,218,220,1) 1px, transparent 1px), linear-gradient(90deg, rgba(168,218,220,1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

          {/* AI/Medical Nodes Background */}
          <svg className="absolute inset-0 w-full h-full z-0 opacity-20 mix-blend-color-dodge" xmlns="http://www.w3.org/2000/svg">
            <g stroke="#A8DADC" strokeWidth="1.5" fill="#F1FAEE">
               <line x1="10%" y1="20%" x2="40%" y2="50%" strokeDasharray="4 4">
                  <animate attributeName="y1" values="20%; 22%; 20%" dur="3s" repeatCount="indefinite" />
               </line>
               <circle cx="10%" cy="20%" r="5" />
               <line x1="40%" y1="50%" x2="70%" y2="30%" strokeDasharray="4 4" />
               <circle cx="40%" cy="50%" r="6" fill="#457B9D" />
               <circle cx="70%" cy="30%" r="5" />
               <line x1="70%" y1="30%" x2="90%" y2="80%" strokeDasharray="4 4" />
               <circle cx="90%" cy="80%" r="4" />
            </g>
          </svg>

          <div className="relative z-10 max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-8">
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-4 bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-xl w-fit">
                <Stethoscope size={16} className="text-[#A8DADC]" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A8DADC]">Medical Dashboard</span>
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-[#F1FAEE] leading-[1.1] tracking-tight mb-2">
                {greeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#A8DADC] to-[#F1FAEE]">Dr. {doctorName}</span>
              </h1>
              <p className="text-[#A8DADC] text-base lg:text-lg font-medium mb-6 max-w-lg">
                Your practice is thriving. You have {pendingRequestsCount} pending requests and {todaySessionsTotal} sessions today.
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => navigate('/doctor/patients')}
                  className="group px-6 py-3 bg-[#E63946] hover:bg-[#D62828] text-white rounded-xl text-[13px] uppercase tracking-widest font-black transition-all shadow-xl shadow-[#E63946]/40 hover:-translate-y-[2px] active:translate-y-[1px] flex items-center gap-2"
                >
                  <Users size={16} />
                  Patients
                </button>
                <button
                  onClick={() => navigate('/doctor/calendar')}
                  className="px-6 py-3 bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 rounded-xl text-[13px] uppercase tracking-widest font-black transition-all shadow-xl hover:-translate-y-[2px] flex items-center gap-2"
                >
                  <Calendar size={16} />
                  Schedule
                </button>
              </div>
            </div>

            {/* Quick Chart Widget */}
            <div className="w-full lg:w-[400px] bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2rem] p-6 shadow-2xl shadow-[#1D3557]/40">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-[#F1FAEE] font-black text-base">Weekly Overview</h3>
                  <p className="text-[#A8DADC] text-[10px] font-bold uppercase tracking-widest mt-1">Practice Performance</p>
                </div>
                <div className="p-1.5 bg-[#A8DADC]/20 rounded-lg">
                   <TrendingUp size={16} className="text-[#A8DADC]" />
                </div>
              </div>
              <div className="h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#A8DADC" strokeOpacity={0.1} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#A8DADC', fontWeight: 700 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#A8DADC', fontWeight: 700 }} dx={-10} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'white', opacity: 0.05 }} />
                    <Bar dataKey="sessions" fill="#A8DADC" radius={[4, 4, 0, 0]} barSize={20} />
                    <Line type="monotone" dataKey="plans" stroke="#E63946" strokeWidth={3} dot={{ r: 4, fill: '#E63946', strokeWidth: 0 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        {/* ── STATS & CONTENT SECTION ── */}
        <section className="px-6 py-10 md:px-12 lg:px-24 max-w-7xl mx-auto -mt-6 relative z-20">
          
          {/* Stat Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-12">
            {[
              { icon: <Users size={22} />, label: 'Total Patients', value: totalPatients, color: 'indigo' },
              { icon: <Activity size={22} />, label: "Today's Sessions", value: todaySessionsTotal, color: 'blue' },
              { icon: <Clock size={22} />, label: 'Pending Requests', value: pendingRequestsCount, color: 'red', alert: pendingRequestsCount > 0 },
              { icon: <ClipboardList size={22} />, label: 'Active Plans', value: activePlansTotal, color: 'teal' },
            ].map((stat, idx) => (
              <div
                key={stat.label}
                ref={(el) => { revealRefs.current[idx] = el; }}
                className="bg-white rounded-3xl p-6 shadow-xl shadow-[#1D3557]/[0.05] border border-[#1D3557]/5 flex items-center gap-5 transition-all duration-500 hover:-translate-y-1 group"
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner transition-transform group-hover:scale-110 ${
                  stat.color === 'indigo' ? 'bg-[#1D3557]/10 text-[#1D3557]' :
                  stat.color === 'blue' ? 'bg-[#457B9D]/10 text-[#457B9D]' :
                  stat.color === 'red' ? 'bg-[#E63946]/10 text-[#E63946]' :
                  'bg-[#A8DADC]/20 text-[#2E7D32]'
                }`}>
                  {stat.icon}
                </div>
                <div>
                  <div className="text-3xl font-black text-[#1D3557] tracking-tight">{stat.value}</div>
                  <div className="text-[11px] uppercase tracking-[0.15em] font-black text-[#457B9D]/70 mt-1 flex items-center gap-2">
                    {stat.label}
                    {stat.alert && <span className="w-2 h-2 rounded-full bg-[#E63946] animate-pulse" />}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            
            {/* COLUMN 1: Live Patient Activity */}
            <div className="xl:col-span-2 bg-white rounded-[2.5rem] p-8 shadow-xl shadow-[#1D3557]/[0.03] border border-[#1D3557]/5 min-h-[450px] flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#A8DADC]/20 rounded-2xl">
                     <LayoutDashboard size={20} className="text-[#457B9D]" />
                  </div>
                  <h3 className="text-xl font-black text-[#1D3557]">Live Practice Monitor</h3>
                </div>
                <div className="text-[11px] font-black text-[#457B9D] uppercase tracking-widest bg-[#F1FAEE] px-4 py-1.5 rounded-full border border-[#A8DADC]/30">
                  Real-time Updates
                </div>
              </div>

              <div className="flex-1 space-y-4">
                {paginatedActivity.map((feed) => (
                  <div key={feed.id} className="group p-4 rounded-2xl border border-transparent hover:border-[#A8DADC]/30 hover:bg-[#F1FAEE]/50 transition-all flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shrink-0 ${
                      feed.type === 'success' ? 'bg-[#A8DADC]/30 text-[#1D3557]' :
                      feed.type === 'info' ? 'bg-[#457B9D]/10 text-[#457B9D]' :
                      'bg-[#1D3557]/5 text-[#1D3557]'
                    }`}>
                      {feed.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-[15px] font-bold text-[#1D3557] truncate">
                          {feed.name}
                        </p>
                        <span className="text-[11px] font-bold text-[#457B9D]/60 uppercase tracking-widest shrink-0">{feed.time}</span>
                      </div>
                      <p className="text-sm font-medium text-[#457B9D] mt-0.5">
                        <span className={feed.type === 'success' ? 'text-[#1D3557] font-black' : ''}>{feed.action}</span>
                      </p>
                    </div>
                    <button className="opacity-0 group-hover:opacity-100 p-2 text-[#457B9D] hover:text-[#1D3557] transition-all">
                      <ChevronRight size={18} />
                    </button>
                  </div>
                ))}

                {paginatedActivity.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                    <Activity size={48} className="mb-4" />
                    <p className="p-4 text-lg font-bold">No recent activity detected.</p>
                  </div>
                )}
              </div>

              {/* Pagination Activity */}
              <div className="mt-8 pt-6 border-t border-[#A8DADC]/20 flex items-center justify-between">
                <span className="text-xs font-black text-[#457B9D] uppercase tracking-widest">
                  Showing {activityPage * itemsPerPage + 1}–{Math.min((activityPage + 1) * itemsPerPage, activityCount)} of {activityCount}
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setActivityPage(Math.max(0, activityPage - 1))} disabled={activityPage === 0} className="w-10 h-10 rounded-xl flex items-center justify-center text-[#457B9D] hover:bg-[#F1FAEE] disabled:opacity-30 transition-all">
                    <ChevronLeft size={20} />
                  </button>
                  <button onClick={() => setActivityPage((activityPage + 1) * itemsPerPage < activityCount ? activityPage + 1 : activityPage)} disabled={(activityPage + 1) * itemsPerPage >= activityCount} className="w-10 h-10 rounded-xl flex items-center justify-center text-[#457B9D] hover:bg-[#F1FAEE] disabled:opacity-30 transition-all">
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            </div>

            {/* COLUMN 2: Upcoming Appointments */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-[#1D3557]/[0.03] border border-[#1D3557]/5 flex flex-col">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2.5 bg-[#E63946]/10 rounded-2xl">
                  <CalendarClock size={20} className="text-[#E63946]" />
                </div>
                <h3 className="text-xl font-black text-[#1D3557]">Upcoming Sessions</h3>
              </div>

              <div className="flex-1 space-y-4">
                {paginatedAppts.map((a) => (
                  <div key={a._id} className="p-5 rounded-3xl bg-[#F1FAEE] hover:bg-white border-2 border-transparent hover:border-[#A8DADC]/30 transition-all shadow-sm hover:shadow-md flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1D3557] to-[#457B9D] flex flex-col items-center justify-center shrink-0 shadow-lg text-white">
                      <span className="text-[16px] font-black leading-none">{new Date(a.startTime).toLocaleTimeString([], { hour: '2-digit', hour12: true }).replace(/ AM| PM/i, '')}</span>
                      <span className="text-[9px] uppercase font-black tracking-widest">{new Date(a.startTime).toLocaleTimeString([], { hour12: true }).slice(-2)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-black text-[#1D3557] truncate">{a.patientId?.name || "Unknown Patient"}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          a.sessionMode === 'online' ? 'bg-[#A8DADC] text-[#1D3557]' : 'bg-[#1D3557]/10 text-[#1D3557]'
                        }`}>
                          {a.sessionMode}
                        </span>
                        <span className="text-[11px] font-bold text-[#457B9D]">{new Date(a.startTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button className="p-2.5 text-[#457B9D] hover:bg-white rounded-xl transition-all">
                        <MessageSquare size={18} />
                      </button>
                      <button className="p-2.5 text-[#1D3557] hover:bg-white rounded-xl transition-all">
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                ))}

                {paginatedAppts.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
                    <Calendar size={48} className="mb-4" />
                    <p className="p-4 text-lg font-bold">No sessions scheduled.</p>
                  </div>
                )}
              </div>

              {/* Pagination Appts */}
              <div className="mt-8 pt-6 border-t border-[#A8DADC]/20 flex items-center justify-between">
                <span className="text-xs font-black text-[#457B9D] uppercase tracking-widest text-right w-full flex justify-end gap-2 items-center">
                  <button onClick={() => setApptPage(Math.max(0, apptPage - 1))} disabled={apptPage === 0} className="w-10 h-10 rounded-xl flex items-center justify-center text-[#457B9D] hover:bg-[#F1FAEE] disabled:opacity-30 transition-all">
                    <ChevronLeft size={20} />
                  </button>
                  <button onClick={() => setApptPage((apptPage + 1) * itemsPerPage < apptCount ? apptPage + 1 : apptPage)} disabled={(apptPage + 1) * itemsPerPage >= apptCount} className="w-10 h-10 rounded-xl flex items-center justify-center text-[#457B9D] hover:bg-[#F1FAEE] disabled:opacity-30 transition-all">
                    <ChevronRight size={20} />
                  </button>
                </span>
              </div>
            </div>

          </div>
        </section>

        {/* Floating Action Button: Rapid Add (Optional Polish) */}
        <button className="fixed bottom-8 right-8 w-16 h-16 bg-[#1D3557] text-[#F1FAEE] rounded-full shadow-2xl shadow-[#1D3557]/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all group z-50">
          <Plus size={32} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>

      </div>
    </>
  );
};

export default DoctorDashboard;
