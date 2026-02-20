import { useEffect, useState } from "react";
import {
  Activity,
  Users,
  Calendar,
  LogOut,
  Search,
  Bell,
  ChevronRight,
  TrendingUp,
  UserPlus,
  Flame,
  Clock,
  Layers,
  BarChart2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";

// ─── helpers ───────────────────────────────────────────────
function formatLastOnline(date: string | null | undefined): string {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

// ─── component ─────────────────────────────────────────────
const DoctorDashboard = () => {
  const navigate = useNavigate();
  const doctorName = localStorage.getItem("name") || "Doctor";

  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchPatients();
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

  const handleLogout = () => {
    localStorage.clear();
    window.location.replace("/login");
  };

  const filteredPatients = patients.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  // ── real computed stats ──
  const totalPatients = patients.length;
  const activePlansTotal = patients.reduce((sum, p) => sum + (p.activePlans ?? 0), 0);
  const todaySessionsTotal = patients.reduce((sum, p) => sum + (p.todaySessionCount ?? 0), 0);

  const stats = [
    {
      label: "Total Patients",
      value: totalPatients,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-100/50",
      sub: `${activePlansTotal} active plans`,
    },
    {
      label: "Active Plans",
      value: activePlansTotal,
      icon: Activity,
      color: "text-emerald-600",
      bg: "bg-emerald-100/50",
      sub: "across all patients",
    },
    {
      label: "Today's Sessions",
      value: todaySessionsTotal,
      icon: Calendar,
      color: "text-violet-600",
      bg: "bg-violet-100/50",
      sub: "completed today",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-900">
      {/* ── NAVBAR ── */}
      <nav className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 flex justify-between h-16 items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-teal-200">
              <Activity size={20} strokeWidth={2.5} />
            </div>
            <span className="text-xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-emerald-600">
              PhysioCheck
            </span>
          </div>

          <div className="flex items-center gap-6">
            <button className="relative p-2 text-slate-400 hover:bg-slate-50 rounded-full transition-colors">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>

            <div className="flex items-center gap-3 pl-6 border-l">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold leading-none">Dr. {doctorName}</p>
                <p className="text-[11px] font-medium text-slate-400 mt-1 uppercase tracking-wider">
                  Physiotherapist
                </p>
              </div>
              <img
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${doctorName}`}
                alt="Doctor"
                className="w-10 h-10 rounded-xl border-2 border-white shadow-sm"
              />
              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── MAIN ── */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Doctor Dashboard</h1>
            <p className="text-slate-500 font-medium">
              Monitoring {totalPatients} active recovery track{totalPatients !== 1 ? "s" : ""}
            </p>
          </div>

          <button
            onClick={() => navigate("/doctor/add-patient")}
            className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-xl shadow-slate-200 active:scale-95"
          >
            <UserPlus size={18} />
            Add New Patient
          </button>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="group bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} transition-transform group-hover:scale-110`}>
                  <stat.icon size={24} />
                </div>
                <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                  <TrendingUp size={12} />
                  {stat.sub}
                </div>
              </div>
              <h3 className="text-3xl font-black tracking-tight">{stat.value}</h3>
              <p className="text-slate-400 text-sm font-medium uppercase tracking-wide">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* PATIENT LIST HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">Patient Directory</h2>
            <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">
              {filteredPatients.length}
            </span>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              placeholder="Search by name..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* PATIENT GRID */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-10 h-10 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
            <p className="text-slate-400 font-medium tracking-wide">Fetching patient records...</p>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
            <div className="inline-flex p-4 bg-slate-50 rounded-2xl text-slate-300 mb-4">
              <Users size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No patients found</h3>
            <p className="text-slate-500 max-w-xs mx-auto mt-1">
              Try adjusting your search or add a new patient to your list.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPatients.map((patient) => {
              const streak = patient.streak ?? 0;
              const activePlans = patient.activePlans ?? 0;
              const totalSessions = patient.totalSessions ?? 0;
              const todayCount = patient.todaySessionCount ?? 0;
              const lastOnlineFmt = formatLastOnline(patient.lastOnline);

              return (
                <div
                  key={patient.id}
                  className="group bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 overflow-hidden"
                >
                  <div className="p-6">
                    {/* Avatar + name row */}
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-500 font-bold text-xl group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors shrink-0">
                        {patient.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-base leading-tight truncate group-hover:text-teal-700 transition-colors">
                          {patient.name}
                        </h3>
                        <p className="text-xs text-slate-400 truncate">{patient.email}</p>
                      </div>
                      {streak > 0 && (
                        <div className={`ml-auto shrink-0 flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${streak >= 3 ? "bg-orange-50 text-orange-600" : "bg-slate-100 text-slate-500"}`}>
                          <Flame size={12} />
                          {streak}
                        </div>
                      )}
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      <div className="bg-slate-50 rounded-xl p-3 text-center">
                        <Layers size={14} className="mx-auto text-teal-500 mb-1" />
                        <p className="text-base font-black text-slate-800">{activePlans}</p>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Plans</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 text-center">
                        <Activity size={14} className="mx-auto text-violet-500 mb-1" />
                        <p className="text-base font-black text-slate-800">{totalSessions}</p>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Sessions</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 text-center">
                        <Calendar size={14} className="mx-auto text-emerald-500 mb-1" />
                        <p className="text-base font-black text-slate-800">{todayCount}</p>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Today</p>
                      </div>
                    </div>

                    {/* Last online */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-5">
                      <Clock size={11} />
                      <span>Last online: {lastOnlineFmt}</span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <button
                        className="flex-[3] bg-teal-50 hover:bg-teal-100 text-teal-700 py-3 rounded-xl text-xs font-bold transition-colors"
                        onClick={() => navigate(`/doctor/assign?patientId=${patient.id}`)}
                      >
                        Assign Exercise
                      </button>
                      <button
                        onClick={() => navigate(`/doctor/patient/${patient.id}/report`)}
                        title="Generate Report"
                        className="flex items-center justify-center gap-1 px-3 border border-teal-200 hover:bg-teal-50 text-teal-600 rounded-xl transition-all text-xs font-bold"
                      >
                        <BarChart2 size={15} />
                      </button>
                      <button
                        onClick={() => navigate(`/doctor/patient/${patient.id}`)}
                        className="flex items-center justify-center border border-slate-100 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-xl px-3 transition-all"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-6 py-3 bg-slate-50/60 border-t border-slate-100 flex justify-between items-center">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400 tracking-tight">
                      <div className={`w-1.5 h-1.5 rounded-full ${activePlans > 0 ? "bg-emerald-500" : "bg-slate-300"}`} />
                      {activePlans > 0 ? "Active Plan" : "No Plan"}
                    </span>
                    {streak >= 3 && (
                      <span className="text-[10px] font-bold text-orange-500">🔥 {streak}-day streak</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default DoctorDashboard;
