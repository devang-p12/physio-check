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

  const PatientFloatingIcons = () => (
    <div aria-hidden="true" className="absolute inset-0 z-0">
      {[
        { top: '12%', left: '7%', size: 42, dur: '4.2s', delay: '0.2s', icon: 'dumbbell' },
        { top: '18%', right: '10%', size: 34, dur: '5.4s', delay: '1.1s', icon: 'heartbeat' },
        { top: '40%', left: '10%', size: 38, dur: '3.8s', delay: '2.2s', icon: 'walk' },
        { top: '48%', right: '8%', size: 44, dur: '6.1s', delay: '0.8s', icon: 'bike' },
        { bottom: '18%', left: '8%', size: 30, dur: '4.6s', delay: '1.9s', icon: 'clock' },
        { bottom: '12%', right: '12%', size: 36, dur: '5.8s', delay: '2.6s', icon: 'stretch' },
        { top: '70%', left: '28%', size: 28, dur: '4.9s', delay: '0.6s', icon: 'leg' },
        { top: '30%', left: '55%', size: 32, dur: '5.2s', delay: '2.9s', icon: 'yoga' },
      ].map((p, i) => (
        <div
          key={i}
          className="float-icon"
          style={{
            top: p.top,
            left: (p as any).left,
            right: (p as any).right,
            bottom: (p as any).bottom,
            width: p.size,
            height: p.size,
            animationDuration: p.dur,
            animationDelay: p.delay,
          }}
        >
          <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            {p.icon === 'dumbbell' && (
              <>
                <path d="M3 10v4" /><path d="M7 9v6" /><path d="M17 9v6" /><path d="M21 10v4" />
                <path d="M7 12h10" />
              </>
            )}
            {p.icon === 'heartbeat' && (
              <>
                <path d="M4 12h3l2-4 3 8 2-4h6" />
              </>
            )}
            {p.icon === 'walk' && (
              <>
                <circle cx="14" cy="5" r="1.6" />
                <path d="M13 7l-2 4 3 2-1 4" />
                <path d="M11 11l-3 2" />
                <path d="M13 17l3 2" />
              </>
            )}
            {p.icon === 'bike' && (
              <>
                <circle cx="6" cy="17" r="2.8" /><circle cx="18" cy="17" r="2.8" />
                <path d="M9 17l3-7h3l2 4" />
                <path d="M11 10l-2-2" />
              </>
            )}
            {p.icon === 'clock' && (
              <>
                <circle cx="12" cy="12" r="8" />
                <path d="M12 7v6l4 2" />
              </>
            )}
            {p.icon === 'stretch' && (
              <>
                <circle cx="8" cy="6" r="1.5" />
                <path d="M8 8l2 3 4-1" />
                <path d="M10 11l-4 6" />
                <path d="M12 13l6 3" />
              </>
            )}
            {p.icon === 'leg' && (
              <>
                <path d="M9 6l3 4 3 1" />
                <path d="M12 10l-2 7" />
                <path d="M14 11l2 6" />
              </>
            )}
            {p.icon === 'yoga' && (
              <>
                <circle cx="12" cy="5" r="1.6" />
                <path d="M12 7v4" />
                <path d="M8 15c2-2 6-2 8 0" />
                <path d="M10 11l-3 3" />
                <path d="M14 11l3 3" />
              </>
            )}
          </svg>
        </div>
      ))}
    </div>
  );

  return (
    <div className="page-content">
      <section className="patient-hero">
        <PatientFloatingIcons />

        <div className="hero-center">
          <div className="hero-greeting">
            <h1>Good {greeting().replace('Good ', '')}, {patientName}!</h1>
            <p className="hero-sub">Ready for your recovery session today?</p>
          </div>

          <div className="hero-quote-card p-card">
            <blockquote style={{ opacity: quoteVisible ? 1 : 0 }}>
              “{quotes[quoteIdx].text}”
            </blockquote>
            <cite>— {quotes[quoteIdx].author}</cite>
          </div>

          <button
            onClick={() => navigate('/patient/todays-plan')}
            disabled={totalCount === 0}
            className="hero-open-plan-btn"
          >
            <Play size={18} />
            Open Today&apos;s Plan
          </button>

          <div
            className="p-card"
            style={{
              background: 'rgba(255,255,255,0.8)',
              border: '1px solid var(--p-border)',
              borderRadius: 16,
              padding: 18,
              width: '100%',
              maxWidth: 520,
              backdropFilter: 'blur(8px)',
            }}
          >
            <div className="flex items-center gap-4">
              <div className="w-[140px] h-[140px] relative shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={66}
                      dataKey="val"
                      stroke="none"
                      startAngle={90}
                      endAngle={-270}
                      isAnimationActive={true}
                      animationBegin={0}
                      animationDuration={700}
                      animationEasing="ease-out"
                    >
                      {donutData.map((_, i) => <Cell key={i} fill={donutColors[i]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-[28px] font-semibold" style={{ color: 'var(--p-text-primary)' }}>
                    {adherenceRate}%
                  </div>
                </div>
              </div>

              <div className="flex-1">
                <div className="text-[13px] uppercase tracking-widest font-semibold" style={{ color: 'var(--p-text-muted)' }}>
                  Today&apos;s progress
                </div>
                <div className="mt-2 text-[14px]" style={{ color: 'var(--p-text-secondary)' }}>
                  <span className="font-semibold" style={{ color: 'var(--p-text-primary)' }}>
                    {completedCount}/{totalCount}
                  </span>{' '}
                  exercises done
                </div>
                <div className="mt-1 text-[14px]" style={{ color: 'var(--p-text-secondary)' }}>
                  <span className="font-semibold" style={{ color: 'var(--p-text-primary)' }}>
                    {streak}
                  </span>{' '}
                  day streak{' '}
                  <span style={{ color: 'var(--p-red)' }}>🔥</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="stats-section">
        <h2>Statistics</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { icon: <Repeat size={20} color="var(--p-blue)" />, label: 'Total Reps', value: String(totalReps) },
            { icon: <Timer size={20} color="var(--p-navy)" />, label: 'Active Time', value: totalActiveTime },
            { icon: <CheckCircle2 size={20} color="var(--p-blue)" />, label: 'Sessions Done', value: String(sessionsCompleted) },
            {
              icon: <TrendingUp size={20} color={adherenceRate < 70 ? 'var(--p-red)' : 'var(--p-blue)'} />,
              label: 'Adherence Rate',
              value: `${adherenceRate}%`,
            },
          ].map((c, idx) => (
            <div
              key={c.label}
              ref={(el) => { revealRefs.current[idx] = el; }}
              className="reveal-card p-stat-card p-card"
              style={{
                background: 'var(--p-bg-surface)',
                border: '1px solid var(--p-border)',
                borderRadius: 12,
                padding: 20,
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--p-bg-active)' }}
                >
                  {c.icon}
                </div>
                <div>
                  <div className="text-[28px] font-semibold leading-none" style={{ color: 'var(--p-text-primary)' }}>
                    {c.value}
                  </div>
                  <div className="text-[12px] uppercase tracking-widest font-semibold" style={{ color: 'var(--p-text-muted)' }}>
                    {c.label}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
          <div
            ref={(el) => { revealRefs.current[4] = el; }}
            className="reveal-card p-card"
            style={{ background: 'var(--p-bg-surface)', border: '1px solid var(--p-border)', borderRadius: 12, padding: 20 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={16} color="var(--p-blue)" />
              <div className="font-semibold" style={{ color: 'var(--p-text-primary)' }}>Activity Trend</div>
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={activityTrend}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar
                    yAxisId="left"
                    dataKey="sessions"
                    fill="var(--p-mint)"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={true}
                    animationBegin={0}
                    animationDuration={700}
                    animationEasing="ease-out"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="adherence"
                    stroke="var(--p-navy)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={true}
                    animationBegin={0}
                    animationDuration={700}
                    animationEasing="ease-out"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div
            ref={(el) => { revealRefs.current[5] = el; }}
            className="reveal-card p-card"
            style={{ background: 'var(--p-bg-surface)', border: '1px solid var(--p-border)', borderRadius: 12, padding: 20 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <PieIcon size={16} color="var(--p-blue)" />
              <div className="font-semibold" style={{ color: 'var(--p-text-primary)' }}>Exercise Breakdown</div>
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={breakdown}
                    dataKey="count"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={85}
                    stroke="none"
                    isAnimationActive={true}
                    animationBegin={0}
                    animationDuration={700}
                    animationEasing="ease-out"
                  >
                    {breakdown.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11 }} />
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
