import React, { useEffect, useState } from "react";
import {
  Activity,
  Bell,
  Play,
  CheckCircle2,
  Flame,
  Trophy,
  Clock,
  LogOut,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";

const PatientDashboard = () => {
  const navigate = useNavigate();

  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [patientName, setPatientName] = useState("Patient");

  // 🔐 Load name + fetch exercises
  useEffect(() => {
    const name = localStorage.getItem("name");
    if (name) setPatientName(name);
    fetchTodayExercises();
  }, []);

  // 🚪 Logout
  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  // 📡 Fetch today’s exercises
  const fetchTodayExercises = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/patient/todays-exercises");
      setExercises(data.exercises || []);
    } catch (err) {
      console.error("Failed to fetch exercises");
    }
    setLoading(false);
  };

  const completedCount = exercises.filter((e) => e.completed).length;
  const totalCount = exercises.length;
  const progressPercentage =
    totalCount === 0 ? 0 : (completedCount / totalCount) * 100;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      {/* ===== NAVBAR ===== */}
      <nav className="bg-white px-6 py-4 flex justify-between items-center sticky top-0 z-30 border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center text-teal-600">
            <Activity size={20} strokeWidth={2.5} />
          </div>
          <span className="font-bold text-slate-900">PhysioCheck</span>
        </div>

        <div className="flex items-center gap-4">
          <Bell size={20} className="text-slate-400" />

          <img
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${patientName}`}
            alt="User"
            className="w-8 h-8 rounded-full border"
          />

          {/* LOGOUT */}
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      {/* ===== MAIN ===== */}
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* GREETING */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Good morning, {patientName}! ☀️
          </h1>
          <p className="text-slate-500 text-sm">
            Ready to continue your recovery?
          </p>
        </div>

        {/* PROGRESS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
            <p className="text-teal-100 text-sm">Daily Progress</p>
            <h2 className="text-3xl font-bold">
              {completedCount}/{totalCount} Exercises
            </h2>

            <div className="relative w-16 h-16 mt-4">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="transparent"
                  className="text-teal-700/30"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="white"
                  strokeWidth="4"
                  fill="transparent"
                  strokeDasharray={175}
                  strokeDashoffset={
                    175 - (175 * progressPercentage) / 100
                  }
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                {Math.round(progressPercentage)}%
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border shadow-sm text-center">
            <Flame className="mx-auto text-orange-500" />
            <h3 className="text-2xl font-bold mt-2">12 Days</h3>
            <p className="text-xs text-slate-500">Current Streak</p>
          </div>
        </div>

        {/* TODAY’S EXERCISES */}
        <div>
          <h2 className="text-lg font-bold mb-3">Today's Plan</h2>

          {loading && (
            <p className="text-slate-500 text-sm">Loading exercises...</p>
          )}

          {!loading && exercises.length === 0 && (
            <p className="text-slate-500 text-sm">
              🎉 No exercises assigned for today
            </p>
          )}

          <div className="space-y-4">
            {exercises.map((ex) => {
              const repsText = `${ex.prescription.sets} sets × ${ex.prescription.repsPerSet} reps`;

              return (
                <div
                  key={ex.id}
                  className="bg-white rounded-2xl p-4 border shadow-sm flex items-center gap-4"
                >
                  <div className="w-14 h-14 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                    {ex.completed ? (
                      <CheckCircle2 size={24} />
                    ) : (
                      <Activity size={24} />
                    )}
                  </div>

                  <div className="flex-1">
                    <h3 className="font-bold text-lg">
                      Exercise #{ex.exerciseId}
                    </h3>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Trophy size={12} /> {repsText}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> ~10 min
                      </span>
                    </div>
                  </div>

                  {!ex.completed && (
                    <button
                      className="w-10 h-10 rounded-full bg-teal-500 text-white flex items-center justify-center"
                      onClick={() =>
                        navigate(`/patient/session?id=${ex.id}`)
                      }
                    >
                      <Play size={18} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
};

export default PatientDashboard;
