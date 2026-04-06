import React, { useEffect, useState } from "react";
import {
  Activity,
  Users,
  Clock,
  ClipboardList,
  CalendarClock,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api";
import PageLoader from "../components/PageLoader";
import { SkeletonStatCard, SkeletonTableRow } from "../components/Skeleton";

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
  const pendingRequests = appointments.filter(a => a.status === 'pending').length;

  const mockActivityFeed = patients.map((p, i) => ({
    id: i,
    name: p.name || 'Unknown',
    action: i % 2 === 0 ? "completed a session" : i % 3 === 0 ? "booked an appointment" : "viewed an assigned plan",
    time: formatLastOnline(p.lastOnline)
  }));

  const recentAppointments = [...appointments]
    .filter(a => new Date(a.startTime) > new Date())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  // Pagination Logic
  const activityCount = mockActivityFeed.length;
  const apptCount = recentAppointments.length;

  const paginatedActivity = mockActivityFeed.slice(activityPage * itemsPerPage, (activityPage + 1) * itemsPerPage);
  const paginatedAppts = recentAppointments.slice(apptPage * itemsPerPage, (apptPage + 1) * itemsPerPage);

  const StatCard = ({ icon: Icon, value, label, color }: any) => (
    <div className="bg-white dark:bg-[#FFFFFF] rounded-xl border border-slate-200 dark:border-[#F4C4B0] p-4 shadow-sm hover:-translate-y-0.5 hover:border-[#F8AD9D] transition-all duration-180 chart-card">
      <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: `rgba(240, 128, 128, 0.15)` }}>
        <Icon size={20} style={{ color: `var(${color})` }} />
      </div>
      <p className="text-2xl font-semibold inline-block" style={{ color: '#2D1810' }}>{value}</p>
      <p className="text-[12px] uppercase tracking-widest mt-1" style={{ color: '#B08070' }}>{label}</p>
    </div>
  );

  return (
    <>
      <PageLoader visible={loading} />
      <div className="page-content font-sans pb-20">
        <main className="mx-auto w-full max-w-full">
          <div className="flex flex-col gap-6">
            
            {/* ROW 1: Welcome Banner */}
            <div 
              className="p-6 rounded-lg shadow-sm border"
              style={{ 
                background: 'linear-gradient(135deg, #FFDAB9 0%, #FFF8F5 100%)',
                borderColor: '#F4C4B0'
              }}
            >
              <h1 className="text-2xl font-semibold mb-1" style={{ color: '#2D1810' }}>
                {greeting()}, Dr. {doctorName}
              </h1>
              <p className="text-sm" style={{ color: '#B08070' }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>

            {/* ROW 2: Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {loading ? (
                <>
                  <SkeletonStatCard />
                  <SkeletonStatCard />
                  <SkeletonStatCard />
                  <SkeletonStatCard />
                </>
              ) : (
                <>
                  <StatCard label="Total Patients" value={totalPatients} icon={Users} color="--pc-500" />
                  <StatCard label="Today's Sessions" value={todaySessionsTotal} icon={Activity} color="--pc-400" />
                  <StatCard label="Pending Requests" value={pendingRequests} icon={Clock} color="--pc-300" />
                  <StatCard label="Active Plans" value={activePlansTotal} icon={ClipboardList} color="--pc-200" />
                </>
              )}
            </div>

            {/* ROW 3: Two-Column Grid -> Feed & Appointments */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              
              {/* COLUMN A: Patient Activity Feed */}
              <div className="bg-white dark:bg-[#FFFFFF] border border-slate-200 dark:border-[#F4C4B0] rounded-xl p-4 shadow-sm flex flex-col chart-card max-h-[340px]">
                <div className="flex items-center gap-1.5 mb-4 px-1">
                  <Activity size={16} style={{ color: 'var(--accent)' }} />
                  <h2 className="text-[13px] font-medium text-slate-900 dark:text-[#2D1810]">Patient Activity</h2>
                </div>
                <div className="overflow-y-auto flex-1 custom-scrollbar pr-2 space-y-0">
                  {loading ? (
                     <div className="space-y-4">
                        <SkeletonTableRow cols={2} />
                        <SkeletonTableRow cols={2} />
                        <SkeletonTableRow cols={2} />
                     </div>
                  ) : paginatedActivity.length === 0 ? (
                    <p className="text-sm text-slate-400 p-4">No recent activity.</p>
                  ) : (
                    paginatedActivity.map((feed) => (
                      <div key={feed.id} className="flex items-center gap-3 py-3 border-b border-slate-100 dark:border-[#FFF2EC] last:border-0">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" 
                             style={{ background: 'var(--accent-light)', color: 'var(--accent-text)' }}>
                          {feed.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0 flex justify-between items-center gap-2 text-[13px]">
                           <div>
                             <span className="font-medium text-slate-900 dark:text-[#2D1810]">{feed.name}</span>
                             {' '}
                             <span className="text-slate-500 dark:text-[#7A4A3C] text-[12px]">{feed.action}</span>
                           </div>
                           <span className="text-[11px] text-slate-400 dark:text-[#B08070] shrink-0 text-right">{feed.time}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-3 flex justify-between items-center pt-3 border-t border-slate-100 dark:border-[#FFF2EC]">
                   <span className="text-[11px] text-slate-500">Showing {Math.min(activityPage * itemsPerPage + 1, activityCount)}–{Math.min((activityPage + 1) * itemsPerPage, activityCount)} of {activityCount}</span>
                   <div className="flex items-center gap-1">
                      <button onClick={() => setActivityPage(Math.max(0, activityPage - 1))} disabled={activityPage === 0} className="p-1 rounded text-slate-500 hover:bg-slate-50 dark:hover:bg-[#FFF0E8] disabled:opacity-50"><ChevronLeft size={16} /></button>
                      <button onClick={() => setActivityPage((activityPage + 1) * itemsPerPage < activityCount ? activityPage + 1 : activityPage)} disabled={(activityPage + 1) * itemsPerPage >= activityCount} className="p-1 rounded text-slate-500 hover:bg-slate-50 dark:hover:bg-[#FFF0E8] disabled:opacity-50"><ChevronRight size={16} /></button>
                   </div>
                </div>
              </div>

              {/* COLUMN B: Upcoming Appointments */}
              <div className="bg-white dark:bg-[#FFFFFF] border border-slate-200 dark:border-[#F4C4B0] rounded-xl p-4 shadow-sm flex flex-col chart-card max-h-[340px]">
                <div className="flex items-center gap-1.5 mb-4 px-1">
                  <CalendarClock size={16} style={{ color: 'var(--accent)' }} />
                  <h2 className="text-[13px] font-medium text-slate-900 dark:text-[#2D1810]">Upcoming Appointments</h2>
                </div>
                <div className="overflow-y-auto flex-1 custom-scrollbar pr-2 space-y-0">
                   {loading ? (
                     <div className="space-y-4">
                        <SkeletonTableRow cols={3} />
                        <SkeletonTableRow cols={3} />
                        <SkeletonTableRow cols={3} />
                     </div>
                   ) : paginatedAppts.length === 0 ? (
                     <p className="text-sm text-slate-400 p-4">No upcoming appointments scheduled.</p>
                   ) : (
                     paginatedAppts.map(a => (
                      <div key={a._id} className="flex items-center gap-3 py-3 border-b border-slate-100 dark:border-[#FFF2EC] last:border-0">
                         {/* Time block */}
                         <div className="w-12 h-12 rounded-lg flex flex-col items-center justify-center shrink-0" style={{ background: 'var(--accent)', color: 'white' }}>
                            <span className="text-[14px] font-bold leading-none">{new Date(a.startTime).toLocaleTimeString([], { hour: '2-digit', hour12: true }).replace(/ AM| PM/i, '')}</span>
                            <span className="text-[10px] uppercase font-medium">{new Date(a.startTime).toLocaleTimeString([], { hour12: true }).slice(-2)}</span>
                         </div>
                         <div className="flex-1 min-w-0">
                           <p className="text-[13px] font-medium text-slate-900 dark:text-[#2D1810] truncate">{a.patientId?.name || "Unknown Patient"}</p>
                           <p className="text-[12px] text-slate-500 dark:text-[#7A4A3C] truncate capitalize">{a.sessionMode} Session</p>
                         </div>
                         <div className="shrink-0">
                            {a.sessionMode === 'online' ? (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-teal-50 text-teal-600 dark:bg-teal-900 dark:text-teal-300 capitalize" style={{ background: 'var(--accent-light)', color: 'var(--accent-text)' }}>Online</span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium border border-slate-200 dark:border-[#F4C4B0] text-slate-600 dark:text-slate-300 capitalize">In-Person</span>
                            )}
                         </div>
                       </div>
                     ))
                   )}
                </div>
                <div className="mt-3 flex justify-between items-center pt-3 border-t border-slate-100 dark:border-[#FFF2EC]">
                   <span className="text-[11px] text-slate-500">Showing {Math.min(apptPage * itemsPerPage + 1, apptCount)}–{Math.min((apptPage + 1) * itemsPerPage, apptCount)} of {apptCount}</span>
                   <div className="flex items-center gap-1">
                      <button onClick={() => setApptPage(Math.max(0, apptPage - 1))} disabled={apptPage === 0} className="p-1 rounded text-slate-500 hover:bg-slate-50 dark:hover:bg-[#FFF0E8] disabled:opacity-50"><ChevronLeft size={16} /></button>
                      <button onClick={() => setApptPage((apptPage + 1) * itemsPerPage < apptCount ? apptPage + 1 : apptPage)} disabled={(apptPage + 1) * itemsPerPage >= apptCount} className="p-1 rounded text-slate-500 hover:bg-slate-50 dark:hover:bg-[#FFF0E8] disabled:opacity-50"><ChevronRight size={16} /></button>
                   </div>
                </div>
              </div>

            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default DoctorDashboard;
