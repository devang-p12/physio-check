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
    <div className="bg-white dark:bg-[#FFFFFF] rounded-xl border p-4 shadow-sm transition-all duration-180 chart-card" style={{ borderColor: 'var(--border-default)', borderRadius: '10px' }}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: '#A8DADC', color: '#1D3557' }}>
        <Icon size={20} />
      </div>
      <p className="text-2xl inline-block" style={{ color: '#1D3557', fontWeight: 700 }}>{value}</p>
      <p className="text-[12px] uppercase tracking-widest mt-1" style={{ color: '#7AAFC2' }}>{label}</p>
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
              className="p-6 shadow-sm"
              style={{ 
                background: 'linear-gradient(135deg, #1D3557 0%, #457B9D 100%)',
                border: 'none',
                borderRadius: '12px'
              }}
            >
              <h1 className="text-2xl font-semibold mb-1" style={{ color: '#F1FAEE' }}>
                {greeting()}, Dr. {doctorName}
              </h1>
              <p className="text-sm" style={{ color: '#A8DADC' }}>
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
              <div className="bg-white border p-4 shadow-sm flex flex-col chart-card max-h-[340px]" style={{ background: '#FFFFFF', borderColor: '#C8DFE8', borderRadius: '10px' }}>
                <div className="flex items-center gap-1.5 mb-4 px-1">
                  <Activity size={16} color="#A8DADC" />
                  <h2 className="text-[13px]" style={{ color: '#1D3557', fontWeight: 600 }}>Patient Activity</h2>
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
                      <div key={feed.id} className="flex items-center gap-3 py-3 border-b last:border-0" style={{ borderColor: '#C8DFE8' }}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" 
                             style={{ background: '#A8DADC', color: '#1D3557' }}>
                          {feed.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0 flex justify-between items-center gap-2 text-[13px]">
                           <div>
                             <span className="font-medium" style={{ color: '#1D3557', fontWeight: 600 }}>{feed.name}</span>
                             {' '}
                             <span className="text-[12px]" style={{ color: '#457B9D' }}>{feed.action}</span>
                           </div>
                           <span className="text-[11px] shrink-0 text-right" style={{ color: '#7AAFC2' }}>{feed.time}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-3 flex justify-between items-center pt-3 border-t" style={{ borderColor: '#C8DFE8' }}>
                   <span className="text-[11px]" style={{ color: '#7AAFC2' }}>Showing {Math.min(activityPage * itemsPerPage + 1, activityCount)}–{Math.min((activityPage + 1) * itemsPerPage, activityCount)} of {activityCount}</span>
                   <div className="flex items-center gap-1">
                      <button onClick={() => setActivityPage(Math.max(0, activityPage - 1))} disabled={activityPage === 0} className="p-1 rounded disabled:opacity-50" style={{ color: '#457B9D' }}><ChevronLeft size={16} /></button>
                      <button onClick={() => setActivityPage((activityPage + 1) * itemsPerPage < activityCount ? activityPage + 1 : activityPage)} disabled={(activityPage + 1) * itemsPerPage >= activityCount} className="p-1 rounded disabled:opacity-50" style={{ color: '#457B9D' }}><ChevronRight size={16} /></button>
                   </div>
                </div>
              </div>

              {/* COLUMN B: Upcoming Appointments */}
              <div className="bg-white border p-4 shadow-sm flex flex-col chart-card max-h-[340px]" style={{ background: '#FFFFFF', borderColor: '#C8DFE8', borderRadius: '10px' }}>
                <div className="flex items-center gap-1.5 mb-4 px-1">
                  <CalendarClock size={16} color="#A8DADC" />
                  <h2 className="text-[13px]" style={{ color: '#1D3557', fontWeight: 600 }}>Upcoming Appointments</h2>
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
                      <div key={a._id} className="flex items-center gap-3 py-3 border-b last:border-0" style={{ borderColor: '#C8DFE8' }}>
                         {/* Time block */}
                         <div className="w-12 h-12 rounded-lg flex flex-col items-center justify-center shrink-0" style={{ background: '#A8DADC', color: '#1D3557' }}>
                            <span className="text-[14px] font-bold leading-none">{new Date(a.startTime).toLocaleTimeString([], { hour: '2-digit', hour12: true }).replace(/ AM| PM/i, '')}</span>
                            <span className="text-[10px] uppercase font-medium">{new Date(a.startTime).toLocaleTimeString([], { hour12: true }).slice(-2)}</span>
                         </div>
                         <div className="flex-1 min-w-0">
                           <p className="text-[13px] font-medium truncate" style={{ color: '#1D3557', fontWeight: 600 }}>{a.patientId?.name || "Unknown Patient"}</p>
                           <p className="text-[12px] truncate capitalize" style={{ color: '#457B9D' }}>{a.sessionMode} Session</p>
                         </div>
                         <div className="shrink-0">
                            {a.sessionMode === 'online' ? (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium capitalize" style={{ background: '#A8DADC', color: '#1D3557' }}>Online</span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium capitalize" style={{ background: 'transparent', color: '#457B9D', border: '1px solid #457B9D' }}>In-Person</span>
                            )}
                         </div>
                       </div>
                     ))
                   )}
                </div>
                <div className="mt-3 flex justify-between items-center pt-3 border-t" style={{ borderColor: '#C8DFE8' }}>
                   <span className="text-[11px]" style={{ color: '#7AAFC2' }}>Showing {Math.min(apptPage * itemsPerPage + 1, apptCount)}–{Math.min((apptPage + 1) * itemsPerPage, apptCount)} of {apptCount}</span>
                   <div className="flex items-center gap-1">
                      <button onClick={() => setApptPage(Math.max(0, apptPage - 1))} disabled={apptPage === 0} className="p-1 rounded disabled:opacity-50" style={{ color: '#457B9D' }}><ChevronLeft size={16} /></button>
                      <button onClick={() => setApptPage((apptPage + 1) * itemsPerPage < apptCount ? apptPage + 1 : apptPage)} disabled={(apptPage + 1) * itemsPerPage >= apptCount} className="p-1 rounded disabled:opacity-50" style={{ color: '#457B9D' }}><ChevronRight size={16} /></button>
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
