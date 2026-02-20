import React, { useEffect, useState } from "react";
import { 
  CheckCircle2, 
  Clock, 
  User, 
  Activity, 
  ChevronLeft, 
  ClipboardList,
  Search
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const DoctorTodaysAssignments = () => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  const BASE_URL = "http://localhost:5000";

  useEffect(() => {
    fetchTodaysAssignments();
  }, []);

  const fetchTodaysAssignments = async () => {
    try {
      const res = await fetch(`${BASE_URL}/doctor/today-assignments`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.assignments) setAssignments(data.assignments);
    } catch (err) {
      console.error("Failed to fetch assignments", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredAssignments = assignments.filter(asgn => 
    asgn.patientId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asgn.exerciseId?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-5xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)} 
              className="p-2 bg-white hover:bg-slate-100 rounded-xl shadow-sm border border-slate-200 transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-900">Daily Exercise Tracker</h1>
              <p className="text-slate-500 text-sm font-medium">Monitoring progress for {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Search patient or exercise..."
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 w-full md:w-64 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Assigned</p>
            <p className="text-2xl font-black text-slate-900">{assignments.length}</p>
          </div>
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 shadow-sm">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Completed</p>
            <p className="text-2xl font-black text-emerald-700">{assignments.filter(a => a.completed).length}</p>
          </div>
        </div>

        {/* Assignments List */}
        {filteredAssignments.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] p-16 text-center border border-dashed border-slate-200">
            <ClipboardList className="mx-auto text-slate-200 mb-4" size={48} />
            <h3 className="text-lg font-bold text-slate-400">No exercise assignments found for today</h3>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAssignments.map((asgn: any) => (
              <div 
                key={asgn._id} 
                className={`bg-white rounded-3xl p-5 border transition-all hover:shadow-md flex flex-col md:flex-row md:items-center gap-6 ${
                  asgn.completed ? 'border-emerald-100' : 'border-slate-100'
                }`}
              >
                {/* Patient Info */}
                <div className="flex items-center gap-4 flex-1">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${asgn.completed ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    <User size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{asgn.patientId?.name || "Unknown Patient"}</h4>
                    <p className="text-xs text-slate-500">{asgn.patientId?.email}</p>
                  </div>
                </div>

                {/* Exercise Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity size={16} className="text-indigo-500" />
                    <span className="font-bold text-slate-800 text-sm">{asgn.exerciseId?.name}</span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                    Prescribed: {JSON.parse(asgn.prescription).sets} Sets × {JSON.parse(asgn.prescription).repsPerSet} Reps
                  </p>
                </div>

                {/* Status Badge */}
                <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto">
                  {asgn.completed ? (
                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                      <CheckCircle2 size={14} /> Done
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-100">
                      <Clock size={14} /> Pending
                    </div>
                  )}
                  
                  {/* View Data Button (If completed) */}
                  <button 
                    disabled={!asgn.completed}
                    className={`p-2.5 rounded-xl transition-all ${
                      asgn.completed 
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100' 
                        : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                    }`}
                    title="View Patient Performance"
                  >
                    <ClipboardList size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DoctorTodaysAssignments;