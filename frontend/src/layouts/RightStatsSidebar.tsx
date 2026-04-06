import React, { useEffect, useState } from 'react';
import { AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, PieChart as PieChartIcon, BarChart2, CalendarDays } from 'lucide-react';
import { apiFetch } from '../api';

const D_COLORS = {
  navy: '#1D3557',
  blue: '#457B9D',
  mint: '#A8DADC',
  red: '#E63946',
};

export default function RightStatsSidebar() {
  const [patients, setPatients] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await apiFetch("/doctor/patients");
        setPatients(data.patients || []);
      } catch (err) { }
    };

    const fetchAppts = async () => {
      try {
        const res = await fetch("http://localhost:5000/appointment/doctor", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.appointments) setAppointments(data.appointments);
      } catch (err) { }
    };

    fetchStats();
    fetchAppts();
  }, [token]);

  // Synthetic adherence data line chart
  const adherenceDataLine = [
    { day: 'Mon', adherence: 82 },
    { day: 'Tue', adherence: 85 },
    { day: 'Wed', adherence: 84 },
    { day: 'Thu', adherence: 88 },
    { day: 'Fri', adherence: 90 },
    { day: 'Sat', adherence: 91 },
    { day: 'Sun', adherence: 94 },
  ];

  // Adherence Overview calculations (mock client logic)
  const avgAdherence = 88; // Stub placeholder matching static values
  
  // Patient Recovery Status calculations
  let onTrack = 0, needsAttention = 0, critical = 0;
  patients.forEach(p => {
    const rate = typeof p.adherenceRate === 'number' ? p.adherenceRate : Math.min(100, Math.max(0, 40 + (p.streak || 0)*10));
    if (rate >= 80) onTrack++;
    else if (rate >= 50) needsAttention++;
    else critical++;
  });
  if (patients.length === 0) { onTrack = 1; }

  const recoveryData = [
    { name: 'On Track', value: onTrack, color: D_COLORS.mint },
    { name: 'Needs Attention', value: needsAttention, color: D_COLORS.blue },
    { name: 'Critical', value: critical, color: D_COLORS.red }
  ];

  // Weekly Session Volume Bar Chart mapping
  const todaySessionsTotal = patients.reduce((sum, p) => sum + (p.todaySessionCount ?? 0), 0);
  const weeklySessionData = [
    { day: 'Mon', sessions: 5 }, { day: 'Tue', sessions: 8 }, { day: 'Wed', sessions: todaySessionsTotal || 4 },
    { day: 'Thu', sessions: 6 }, { day: 'Fri', sessions: 7 }, { day: 'Sat', sessions: 2 }, { day: 'Sun', sessions: 1 }
  ];

  // Appointments mapping
  const todayApptTotal = appointments.length;
  const pendingRequests = appointments.filter(a => a.status === 'pending').length;
  
  const apptData = [
    { day: 'Mon', count: 3 }, { day: 'Tue', count: 5 }, { day: 'Wed', count: todayApptTotal || 2 },
    { day: 'Thu', count: 4 }, { day: 'Fri', count: 6 }, { day: 'Sat', count: 1 }, { day: 'Sun', count: 0 }
  ];

  return (
    <aside 
      className="fixed right-0 top-[60px] w-[280px] h-[calc(100vh-60px)] overflow-y-auto z-40 p-4 space-y-4"
      style={{
         background: 'var(--d-bg-sidebar)',
         borderLeft: '1px solid #2E5470'
      }}
    >
      
      {/* 1. Adherence Overview */}
      <div
        className="chart-card"
        style={{
          background: 'rgba(255, 255, 255, 0.82)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(168, 218, 220, 0.45)',
          borderRadius: 16,
          boxShadow: 'var(--d-shadow-card)',
          position: 'relative',
          zIndex: 1,
          padding: 14,
        }}
      >
        <h2 className="text-[13px] font-semibold mb-3 flex items-center gap-1.5" style={{ color: 'var(--d-text-primary)' }}>
          <TrendingUp size={14} style={{ color: 'var(--d-accent-blue)' }} /> Adherence
        </h2>
        <div className="h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={adherenceDataLine}>
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} dy={5} />
              <Tooltip />
              <Area 
                type="monotone" 
                dataKey="adherence" 
                stroke={D_COLORS.blue}
                strokeWidth={2.5} 
                fillOpacity={0.4} 
                fill={D_COLORS.mint}
                isAnimationActive={true} 
                animationBegin={0} 
                animationDuration={700} 
                animationEasing="ease-out"
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 text-center">
          <span className="text-xl font-bold text-slate-900 dark:text-[#2D1810]" style={{ color: 'var(--accent)' }}>Avg: {avgAdherence}%</span>
          <span className="text-[11px] text-slate-500 ml-1">this week</span>
        </div>
      </div>

      {/* 2. Patient Recovery Status */}
      <div className="bg-white dark:bg-[#FFFFFF] border border-slate-200 dark:border-[#F4C4B0] rounded-xl p-3.5 shadow-sm chart-card">
        <h2 className="text-[13px] font-medium text-slate-900 dark:text-[#2D1810] mb-3 flex items-center gap-1.5">
          <PieChartIcon size={14} style={{ color: 'var(--accent)' }} /> Recovery Status
        </h2>
        <div className="h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie 
                data={recoveryData} 
                innerRadius={35} 
                outerRadius={58} 
                dataKey="value" 
                stroke="none"
                isAnimationActive={true} 
                animationBegin={0} 
                animationDuration={700} 
                animationEasing="ease-out"
              >
                {recoveryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          {recoveryData.map((d) => (
             <div key={d.name} className="flex justify-between items-center text-[11px]">
               <div className="flex items-center gap-1.5">
                 <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                 <span className="text-slate-600 dark:text-slate-400 font-medium">{d.name}</span>
               </div>
               <span className="font-bold text-slate-700 dark:text-[#2D1810]">{d.value}</span>
             </div>
          ))}
        </div>
      </div>

      {/* 3. Weekly Session Volume */}
      <div className="bg-white dark:bg-[#FFFFFF] border border-slate-200 dark:border-[#F4C4B0] rounded-xl p-3.5 shadow-sm chart-card">
        <h2 className="text-[13px] font-medium text-slate-900 dark:text-[#2D1810] mb-3 flex items-center gap-1.5">
          <BarChart2 size={14} style={{ color: 'var(--accent)' }} /> Weekly Sessions
        </h2>
        <div className="h-[120px]">
           <ResponsiveContainer width="100%" height="100%">
             <BarChart data={weeklySessionData}>
               <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} dy={5} />
               <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
               <Bar 
                 dataKey="sessions" 
                 fill="var(--accent)" 
                 radius={[4, 4, 0, 0]} 
                 barSize={12}
                 isAnimationActive={true} 
                 animationBegin={0} 
                 animationDuration={600} 
                 animationEasing="ease-out"
               />
             </BarChart>
           </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Appointments Overview */}
      <div className="bg-white dark:bg-[#FFFFFF] border border-slate-200 dark:border-[#F4C4B0] rounded-xl p-3.5 shadow-sm chart-card">
        <h2 className="text-[13px] font-medium text-slate-900 dark:text-[#2D1810] mb-3 flex items-center gap-1.5">
          <CalendarDays size={14} style={{ color: 'var(--accent)' }} /> Appointments
        </h2>
        <div className="h-[120px]">
           <ResponsiveContainer width="100%" height="100%">
             <BarChart data={apptData}>
               <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} dy={5} />
               <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
               <Bar 
                 dataKey="count" 
                 fill="var(--pc-300)" 
                 radius={[4, 4, 0, 0]} 
                 barSize={12}
                 isAnimationActive={true} 
                 animationBegin={0} 
                 animationDuration={600} 
                 animationEasing="ease-out"
               />
             </BarChart>
           </ResponsiveContainer>
        </div>
        <div className="mt-2 text-center text-[11px] text-slate-500">
           <span className="font-semibold text-slate-700 dark:text-slate-300">{appointments.length} this week</span> · {pendingRequests} pending
        </div>
      </div>

    </aside>
  );
}
