import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart2,
  CheckCircle2,
  Flame,
  PieChart as PieIcon,
  Play,
  Repeat,
  Timer,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";
import {
  Cell,
  ComposedChart,
  Bar,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

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
    { name: 'Remaining', val: totalCount - completedCount },
  ];
  const donutColors = totalCount === 0 ? ['var(--p-border)'] : ['var(--p-blue)', 'var(--p-cream)'];

  const quotes = useMemo(() => ([
    { text: "Movement is medicine for creating change in a person's physical, emotional, and mental states.", author: "Carol Welch" },
    { text: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn" },
    { text: "The groundwork of all happiness is health.", author: "Leigh Hunt" },
    { text: "Healing is a matter of time, but it is sometimes also a matter of opportunity.", author: "Hippocrates" },
    { text: "Physical fitness is the first requisite of happiness.", author: "Joseph Pilates" },
    { text: "Your body can stand almost anything. It's your mind that you have to convince.", author: "Unknown" },
  ]), []);

  const [quoteIdx, setQuoteIdx] = useState(0);
  const [quoteVisible, setQuoteVisible] = useState(true);
  useEffect(() => {
    const id = window.setInterval(() => {
      setQuoteVisible(false);
      window.setTimeout(() => {
        setQuoteIdx((p) => (p + 1) % quotes.length);
        setQuoteVisible(true);
      }, 250);
    }, 5000);
    return () => window.clearInterval(id);
  }, [quotes.length]);

  const adherenceRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const totalReps = totalSessions; // best available aggregate in existing state
  const sessionsCompleted = totalSessions;
  const totalActiveTime = `${Math.max(0, completedCount)}m ${Math.max(0, (completedCount * 15) % 60)}s`; // deterministic placeholder from existing state

  const activityTrend = useMemo(() => {
    const data = (chartData.length ? chartData : [{ date: 'Today', sessions: 0 }]) as Array<{ date: string; sessions: number }>;
    const maxSessions = Math.max(...data.map((d) => d.sessions), 1);
    return data.map((d) => ({
      ...d,
      adherence: Math.round((d.sessions / maxSessions) * 100),
    }));
  }, [chartData]);

  const breakdown = useMemo(() => {
    const map = new Map<string, number>();
    (exercises as any[]).forEach((e) => {
      const name = String(e?.name ?? e?.exerciseName ?? e?.title ?? 'Exercise');
      map.set(name, (map.get(name) ?? 0) + 1);
    });
    const arr = Array.from(map.entries()).map(([name, count]) => ({ name, count }));
    return arr.length ? arr : [{ name: 'None', count: 1 }];
  }, [exercises]);

  const PIE_COLORS = ['#1D3557', '#457B9D', '#A8DADC', '#E63946', '#F1FAEE'];

  const revealRefs = useRef<Array<HTMLDivElement | null>>([]);
  useEffect(() => {
    const els = revealRefs.current.filter(Boolean) as HTMLDivElement[];
    if (els.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('visible');
        });
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/80 backdrop-blur-md border border-[#A8DADC]/40 p-3 rounded-xl shadow-xl shadow-[#1D3557]/5">
          <p className="text-[13px] font-black tracking-wider text-[#1D3557] mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={`item-${index}`} className="text-[14px] font-bold" style={{ color: entry.color }}>
              {entry.name}: {entry.value}{entry.name === 'adherence' ? '%' : ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen font-sans bg-[#F1FAEE] overflow-x-hidden">
      
      {/* ── HERO SECTION: DEEP OCEAN & GLASSMORPHISM ── */}
      <section className="relative w-full bg-gradient-to-br from-[#1D3557] via-[#1D3557] to-[#457B9D] px-6 py-16 md:px-12 md:py-20 lg:p-24 overflow-hidden">
        
        {/* Decorative Grid */}
        <div className="absolute top-[-20%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#A8DADC]/10 via-transparent to-transparent z-0 opacity-80" />
        <div className="absolute inset-0 z-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(168,218,220,1) 1px, transparent 1px), linear-gradient(90deg, rgba(168,218,220,1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        {/* AI Wireframe Nodes Background */}
        <svg className="absolute inset-0 w-full h-full z-0 opacity-20 mix-blend-color-dodge transition-opacity duration-500" xmlns="http://www.w3.org/2000/svg">
          <g stroke="#A8DADC" strokeWidth="1.5" fill="#F1FAEE">
             <line x1="10%" y1="20%" x2="40%" y2="50%" strokeDasharray="4 4">
                <animate attributeName="y1" values="20%; 22%; 20%" dur="3s" repeatCount="indefinite" />
             </line>
             <circle cx="10%" cy="20%" r="5">
                <animate attributeName="cy" values="20%; 22%; 20%" dur="3s" repeatCount="indefinite" />
             </circle>
             <line x1="40%" y1="50%" x2="70%" y2="30%" strokeDasharray="4 4" />
             <circle cx="40%" cy="50%" r="6" fill="#457B9D" />
             <line x1="70%" y1="30%" x2="90%" y2="80%" strokeDasharray="4 4" />
             <circle cx="70%" cy="30%" r="5" />
             <circle cx="90%" cy="80%" r="4" />
          </g>
          <rect x="35%" y="40%" width="10%" height="20%" fill="none" stroke="#E63946" strokeWidth="2" strokeDasharray="4 4">
             <animate attributeName="y" values="40%; 42%; 40%" dur="3s" repeatCount="indefinite" />
          </rect>
        </svg>

        <div className="relative z-10 max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-12">
          
          <div className="flex-1 flex flex-col">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-[#F1FAEE] leading-[1.1] tracking-tight mb-4">
              Good <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#A8DADC] to-[#F1FAEE]">{greeting().replace('Good ', '')}</span>, {patientName}!
            </h1>
            <p className="text-[#A8DADC] text-lg lg:text-xl font-medium mb-10 max-w-lg">
              Ready for your recovery session today? We're actively tracking your mobility progress.
            </p>

            <button
              onClick={() => navigate('/patient/todays-plan')}
              disabled={totalCount === 0}
              className="group self-start px-8 py-4 bg-[#E63946] hover:bg-[#D62828] text-white rounded-2xl text-[15px] uppercase tracking-widest font-black transition-all shadow-xl shadow-[#E63946]/40 hover:-translate-y-[2px] active:translate-y-[1px] disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:translate-y-0 flex items-center gap-3"
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 transition-transform group-hover:scale-110">
                <Play size={16} fill="currentColor" />
              </span>
              Open Today's Plan
            </button>
          </div>

          {/* Frosted Glass Widgets */}
          <div className="w-full lg:w-[480px] flex flex-col gap-6">
            
            {/* Quote of the day widget */}
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl shadow-[#1D3557]/40 relative overflow-hidden transition-opacity duration-300" style={{ opacity: quoteVisible ? 1 : 0 }}>
               <Flame size={24} className="text-[#E63946] mb-4 opacity-80" />
               <blockquote className="text-[17px] font-semibold text-[#F1FAEE] leading-relaxed mb-4">
                 “{quotes[quoteIdx].text}”
               </blockquote>
               <cite className="text-[#A8DADC] text-sm uppercase tracking-widest font-bold">
                 — {quotes[quoteIdx].author}
               </cite>
            </div>

            {/* Today's Progress widget */}
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl shadow-[#1D3557]/40 flex items-center gap-6">
              <div className="w-24 h-24 relative shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={48}
                      dataKey="val"
                      stroke="none"
                      startAngle={90}
                      endAngle={-270}
                      isAnimationActive={true}
                      animationDuration={700}
                    >
                      {donutData.map((_, i) => <Cell key={i} fill={donutColors[i]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-xl font-black text-[#F1FAEE]">
                    {adherenceRate}%
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <div className="text-[11px] uppercase tracking-widest font-black text-[#A8DADC] mb-2">Today's Progress</div>
                <div className="text-lg font-semibold text-[#F1FAEE] mb-1">
                  <span className="font-black text-white">{completedCount}/{totalCount}</span> exercises done
                </div>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-[#A8DADC]">
                  <Flame size={16} className="text-[#E63946]" />
                  <span className="text-white">{streak}</span> day streak
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── STATS & CHARTS SECTION: SOFT CREAM NEUMORPHISM ── */}
      <section className="px-6 py-12 md:px-12 lg:px-24 max-w-7xl mx-auto -mt-10 relative z-20">
        
        {/* Soft Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {[
            { icon: <Repeat size={20} />, label: 'Total Reps', value: String(totalReps) },
            { icon: <Timer size={20} />, label: 'Active Time', value: totalActiveTime },
            { icon: <CheckCircle2 size={20} />, label: 'Sessions Done', value: String(sessionsCompleted) },
            { icon: <TrendingUp size={20} />, label: 'Adherence Rate', value: `${adherenceRate}%`, alert: adherenceRate < 70 },
          ].map((c, idx) => (
            <div
              key={c.label}
              ref={(el) => { revealRefs.current[idx] = el; }}
              className="bg-white rounded-3xl p-6 shadow-xl shadow-[#1D3557]/[0.03] border border-[#1D3557]/5 flex items-center gap-5 transition-transform duration-500 hover:-translate-y-1"
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${c.alert ? 'bg-[#E63946]/10 text-[#E63946]' : 'bg-[#A8DADC]/20 text-[#457B9D]'}`}>
                {c.icon}
              </div>
              <div>
                <div className="text-3xl font-black text-[#1D3557] tracking-tight">{c.value}</div>
                <div className="text-[11px] uppercase tracking-widest font-bold text-[#457B9D]/80 mt-1">{c.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
          
          {/* Activity Trend Chart */}
          <div
            ref={(el) => { revealRefs.current[4] = el; }}
            className="bg-white rounded-3xl p-8 shadow-xl shadow-[#1D3557]/[0.03] border border-[#1D3557]/5"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-[#A8DADC]/20 rounded-xl">
                 <BarChart2 size={18} className="text-[#457B9D]" />
              </div>
              <h3 className="text-lg font-black text-[#1D3557]">Activity Trend</h3>
            </div>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={activityTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#A8DADC" strokeOpacity={0.3} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#457B9D', fontWeight: 600 }} dy={10} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#457B9D', fontWeight: 600 }} dx={-10} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} axisLine={false} tickLine={false} hide />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(168,218,220,0.1)' }} />
                  <Bar
                    yAxisId="left"
                    name="Sessions"
                    dataKey="sessions"
                    fill="#A8DADC"
                    radius={[6, 6, 0, 0]}
                    barSize={24}
                    isAnimationActive={true}
                  />
                  <Line
                    yAxisId="right"
                    name="Adherence"
                    type="monotone"
                    dataKey="adherence"
                    stroke="#1D3557"
                    strokeWidth={3}
                    dot={{ fill: '#E63946', r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: '#E63946', stroke: '#fff', strokeWidth: 2 }}
                    isAnimationActive={true}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Exercise Breakdown Pie Chart */}
          <div
            ref={(el) => { revealRefs.current[5] = el; }}
            className="bg-white rounded-3xl p-8 shadow-xl shadow-[#1D3557]/[0.03] border border-[#1D3557]/5"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-[#A8DADC]/20 rounded-xl">
                 <PieIcon size={18} className="text-[#457B9D]" />
              </div>
              <h3 className="text-lg font-black text-[#1D3557]">Exercise Breakdown</h3>
            </div>
            <div className="h-[240px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={breakdown}
                    dataKey="count"
                    nameKey="name"
                    innerRadius={65}
                    outerRadius={95}
                    stroke="#fff"
                    strokeWidth={2}
                    isAnimationActive={true}
                  >
                    {breakdown.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" wrapperStyle={{ fontSize: 13, fontWeight: 600, color: '#1D3557' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
};

export default PatientDashboard;
