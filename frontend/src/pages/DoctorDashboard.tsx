import React, { useEffect, useState } from "react";
import {
  Activity,
  Users,
  Calendar,
  LogOut,
  Search,
  Bell,
  ChevronRight,
  TrendingUp,
  MoreHorizontal,
  CalendarDays,
  PlusCircle, // ← new
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";

const DoctorDashboard = () => {
  const navigate = useNavigate();
  const doctorName = localStorage.getItem("name") || "Doctor";

  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/doctor/patients");
      const enrichedPatients = (data.patients || []).map((p) => ({
        ...p,
        progress: Math.floor(Math.random() * 100),
        lastSeen: "2 hours ago",
        status: Math.random() > 0.3 ? "On Track" : "Delayed",
      }));
      setPatients(enrichedPatients);
    } catch (err) {
      console.error("Failed to fetch patients", err);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const filteredPatients = patients.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const stats = [
    {
      label: "Total Patients",
      value: patients.length,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-100/50",
      trend: "+4 this week",
    },
    {
      label: "Active Plans",
      value: patients.length,
      icon: Activity,
      color: "text-emerald-600",
      bg: "bg-emerald-100/50",
      trend: "85% completion",
    },
    {
      label: "Today's Sessions",
      value: "12",
      icon: Calendar,
      color: "text-violet-600",
      bg: "bg-violet-100/50",
      trend: "3 remaining",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-900">
      {/* NAVBAR */}
      <nav className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 flex justify-between h-16 items-center">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate("/doctor")}>
            <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-teal-200">
              <Activity size={20} strokeWidth={2.5} />
            </div>
            <span className="text-xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-emerald-600">
              PhysioCheck
            </span>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate("/doctor/calendar")}
              className="hidden sm:flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-teal-600 transition-colors"
            >
              <Calendar size={18} />
              Schedule
            </button>

            {/* ── Create Exercise navbar link ── */}
            <button
              onClick={() => navigate("/doctor/create-exercise")}
              className="hidden sm:flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-teal-600 transition-colors"
            >
              <PlusCircle size={18} />
              Create Exercise
            </button>

            <button className="relative p-2 text-slate-400 hover:bg-slate-50 rounded-full transition-colors">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>

            <div className="flex items-center gap-3 pl-6 border-l">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold leading-none">Dr. {doctorName}</p>
                <p className="text-[11px] font-medium text-slate-400 mt-1 uppercase tracking-wider">Physiotherapist</p>
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

      {/* MAIN */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Doctor Dashboard</h1>
            <p className="text-slate-500 font-medium">Monitoring {patients.length} active recovery tracks</p>
          </div>

          {/* ── Header action buttons ── */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/doctor/create-exercise")}
              className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-5 py-3 rounded-xl font-bold transition-all shadow-sm active:scale-95"
            >
              <PlusCircle size={18} className="text-teal-500" />
              Create Exercise
            </button>
            <button
              onClick={() => navigate("/doctor/calendar")}
              className="flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-xl shadow-teal-100 active:scale-95"
            >
              <CalendarDays size={18} />
              View Calendar
            </button>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {stats.map((stat, i) => (
            <div key={i} className="group bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} transition-transform group-hover:scale-110`}>
                  <stat.icon size={24} />
                </div>
                <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                  <TrendingUp size={12} />
                  {stat.trend}
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
            <div className="w-10 h-10 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin"></div>
            <p className="text-slate-400 font-medium tracking-wide">Fetching patient records...</p>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
            <div className="inline-flex p-4 bg-slate-50 rounded-2xl text-slate-300 mb-4">
              <Users size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No patients found</h3>
            <p className="text-slate-500 max-w-xs mx-auto mt-1">Accept a request in the calendar to see patients here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPatients.map((patient) => (
              <div
                key={patient.id}
                className="group bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 font-bold text-xl group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors">
                      {patient.name.charAt(0)}
                    </div>
                    <button className="text-slate-300 hover:text-slate-600 transition-colors">
                      <MoreHorizontal size={20} />
                    </button>
                  </div>

                  <h3 className="font-bold text-lg group-hover:text-teal-700 transition-colors">{patient.name}</h3>
                  <p className="text-xs font-medium text-slate-400 mb-6">{patient.email}</p>

                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Recovery Progress</span>
                      <span className="text-sm font-black text-slate-700">{patient.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full transition-all duration-1000"
                        style={{ width: `${patient.progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 mt-8">
                    <button
                      className="flex-[3] bg-teal-50 hover:bg-teal-100 text-teal-700 py-3 rounded-xl text-xs font-bold transition-colors"
                      onClick={() => navigate(`/doctor/assign?patientId=${patient.id}`)}
                    >
                      Assign Exercise
                    </button>
                    <button
                      onClick={() => navigate(`/doctor/patient/${patient.id}`)}
                      className="flex-1 flex items-center justify-center border border-slate-100 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>

                <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-50 flex justify-between items-center">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400 tracking-tight">
                    <div className={`w-1.5 h-1.5 rounded-full ${patient.status === "On Track" ? "bg-emerald-500" : "bg-amber-500"}`}></div>
                    {patient.status}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                    Seen {patient.lastSeen}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default DoctorDashboard;