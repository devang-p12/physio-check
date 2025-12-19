import React from "react";
import {
  Activity,
  Users,
  Calendar,
  LogOut,
  Search,
  Bell,
  Plus,
  ChevronRight,
  TrendingUp,
  AlertCircle,
} from "lucide-react";

const DoctorDashboard = () => {
  // Mock Data for the UI
  const stats = [
    {
      label: "Total Patients",
      value: "24",
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
      trend: "+4 this week",
    },
    {
      label: "Active Plans",
      value: "18",
      icon: Activity,
      color: "text-teal-600",
      bg: "bg-teal-50",
      trend: "92% adherence",
    },
    {
      label: "Today's Sessions",
      value: "06",
      icon: Calendar,
      color: "text-purple-600",
      bg: "bg-purple-50",
      trend: "2 remaining",
    },
  ];

  const patients = [
    {
      id: 1,
      name: "Sarah Jenkins",
      condition: "ACL Reconstruction",
      progress: 75,
      status: "On Track",
      lastSeen: "2 days ago",
    },
    {
      id: 2,
      name: "Michael Chen",
      condition: "Rotator Cuff Tear",
      progress: 45,
      status: "Needs Attention",
      lastSeen: "1 day ago",
    },
    {
      id: 3,
      name: "Emma Wilson",
      condition: "Lower Back Pain",
      progress: 90,
      status: "Recovery Phase",
      lastSeen: "4 hours ago",
    },
    {
      id: 4,
      name: "James Rodri",
      condition: "Ankle Sprain",
      progress: 20,
      status: "New Patient",
      lastSeen: "Just now",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* --- TOP NAVIGATION BAR --- */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo Section */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center text-teal-600">
                <Activity size={20} strokeWidth={2.5} />
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">
                PhysioCheck
              </span>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-6">
              {/* Notifications */}
              <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
                <Bell size={20} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
              </button>

              {/* Divider */}
              <div className="h-6 w-px bg-slate-200"></div>

              {/* Profile */}
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-slate-900">
                    Dr. Alex P.
                  </p>
                  <p className="text-xs text-slate-500">Orthopedic Physio</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm">
                  {/* Placeholder Avatar */}
                  <img
                    src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
                    alt="Doctor"
                  />
                </div>
              </div>

              {/* Logout */}
              <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* --- MAIN DASHBOARD CONTENT --- */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Doctor Dashboard
            </h1>
            <p className="text-slate-500">
              Welcome back, here is your daily overview.
            </p>
          </div>
          <button className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-slate-200">
            <Plus size={18} />
            <span>New Patient</span>
          </button>
        </div>

        {/* Summary Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                  <stat.icon size={24} />
                </div>
                <span className="flex items-center text-xs font-semibold text-teal-600 bg-teal-50 px-2 py-1 rounded-full">
                  {stat.trend}
                </span>
              </div>
              <div>
                <h3 className="text-3xl font-bold text-slate-900 mb-1">
                  {stat.value}
                </h3>
                <p className="text-slate-500 font-medium">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Patient List Section */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Recent Patients</h2>

          {/* Search Bar */}
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search patients..."
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 w-64"
            />
          </div>
        </div>

        {/* Patients Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {patients.map((patient) => (
            <div
              key={patient.id}
              className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden"
            >
              {/* Card Header */}
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">
                      {patient.name}
                    </h3>
                    <p className="text-slate-500 text-sm">
                      {patient.condition}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                      patient.status === "Needs Attention"
                        ? "bg-red-50 text-red-600"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {patient.status}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="font-semibold text-slate-700">
                      Recovery Progress
                    </span>
                    <span className="text-teal-600 font-bold">
                      {patient.progress}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        patient.progress < 50 ? "bg-amber-400" : "bg-teal-500"
                      }`}
                      style={{ width: `${patient.progress}%` }}
                    ></div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center gap-3">
                  <button className="flex-1 bg-teal-50 hover:bg-teal-100 text-teal-700 text-sm font-semibold py-2.5 rounded-lg transition-colors border border-teal-100">
                    Assign Exercise
                  </button>
                  <button className="p-2.5 border border-slate-200 rounded-lg text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-colors">
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                <span className="text-xs text-slate-400 font-medium">
                  Last active: {patient.lastSeen}
                </span>
              </div>
            </div>
          ))}

          {/* Add New Patient Placeholder Card */}
          <button className="border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-6 text-slate-400 hover:text-teal-600 hover:border-teal-300 hover:bg-teal-50/30 transition-all group min-h-[240px]">
            <div className="w-12 h-12 rounded-full bg-slate-50 group-hover:bg-teal-100 flex items-center justify-center mb-3 transition-colors">
              <Plus size={24} className="group-hover:text-teal-600" />
            </div>
            <span className="font-semibold">Add New Patient</span>
          </button>
        </div>
      </main>
    </div>
  );
};

export default DoctorDashboard;
