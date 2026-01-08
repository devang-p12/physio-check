import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Plus,
  X,
  Dumbbell,
  Save,
  Calendar,
  ClipboardList,
  Target,
  CheckCircle2,
  Trash2
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "../api";

const AssignExercise = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const patientId = Number(params.get("patientId"));

  const [patient, setPatient] = useState(null);
  const [selectedExercises, setSelectedExercises] = useState([]);
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]
  );

  const exerciseLibrary = [
    { id: 1, name: "Leg Press", type: "Strength", focus: "Quads", color: "blue" },
    { id: 2, name: "Heel Slides", type: "Mobility", focus: "Knee Flexion", color: "emerald" },
    { id: 3, name: "Wall Squats", type: "Endurance", focus: "Quads/Glutes", color: "purple" },
    { id: 4, name: "Calf Raises", type: "Strength", focus: "Calves", color: "blue" },
    { id: 5, name: "Single Leg Balance", type: "Stability", focus: "Balance", color: "amber" },
  ];

  useEffect(() => {
    if (!patientId) {
      navigate("/doctor");
      return;
    }

    const fetchPatient = async () => {
      try {
        const data = await apiFetch("/doctor/patients");
        const p = data.patients.find((x) => x.id === patientId);
        if (!p) {
          alert("Patient not found");
          navigate("/doctor");
          return;
        }
        setPatient(p);
      } catch {
        navigate("/doctor");
      }
    };

    fetchPatient();
  }, [patientId, navigate]);

  const addExercise = (exercise) => {
    if (!selectedExercises.find((e) => e.id === exercise.id)) {
      setSelectedExercises([
        ...selectedExercises,
        { ...exercise, sets: 3, reps: 10 },
      ]);
    }
  };

  const removeExercise = (id) => {
    setSelectedExercises(selectedExercises.filter((e) => e.id !== id));
  };

  const updateField = (id, field, value) => {
    setSelectedExercises(
      selectedExercises.map((e) =>
        e.id === id ? { ...e, [field]: Number(value) } : e
      )
    );
  };

  const handleAssign = async () => {
    if (selectedExercises.length === 0) return;
    if (new Date(startDate) > new Date(endDate)) {
      alert("End date must be after start date");
      return;
    }

    setLoading(true);
    try {
      for (const ex of selectedExercises) {
        await apiFetch("/doctor/create-plan", {
          method: "POST",
          body: JSON.stringify({
            patientId,
            exerciseId: ex.id,
            prescription: { sets: ex.sets, repsPerSet: ex.reps },
            startDate,
            endDate,
          }),
        });
      }
      navigate("/doctor");
    } catch (err) {
      alert("Failed to assign exercises");
    } finally {
      setLoading(false);
    }
  };

  if (!patient) return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
      {/* HEADER SECTION */}
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <button
              onClick={() => navigate(-1)}
              className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors border border-transparent hover:border-slate-200"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black">Assign Treatment</h1>
                <span className="bg-teal-100 text-teal-700 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                  New Plan
                </span>
              </div>
              <p className="text-slate-500 text-sm font-medium">
                For patient: <span className="text-slate-900 font-bold">{patient.name}</span>
              </p>
            </div>
          </div>
          
          <button
            disabled={loading || selectedExercises.length === 0}
            onClick={handleAssign}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg ${
              selectedExercises.length > 0 
                ? "bg-teal-600 text-white shadow-teal-100 hover:bg-teal-700 active:scale-95" 
                : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
            }`}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save size={18} />
                Assign & Send Plan
              </>
            )}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT: Exercise Library */}
        <div className="lg:col-span-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Dumbbell className="text-slate-400" size={20} />
              Exercise Library
            </h2>
            <div className="text-xs font-bold text-slate-400 bg-white border px-3 py-1.5 rounded-lg shadow-sm">
              {exerciseLibrary.length} EXERCISES AVAILABLE
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exerciseLibrary.map((ex) => {
              const isAdded = selectedExercises.find((se) => se.id === ex.id);
              return (
                <div
                  key={ex.id}
                  className={`group bg-white p-5 rounded-2xl border transition-all duration-300 ${
                    isAdded 
                      ? "border-teal-500 ring-4 ring-teal-500/5 shadow-md" 
                      : "border-slate-100 hover:border-teal-200 hover:shadow-md"
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-2.5 rounded-xl bg-slate-50 text-slate-400 group-hover:text-teal-600 group-hover:bg-teal-50 transition-colors`}>
                      <Dumbbell size={22} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 px-2.5 py-1 rounded-lg">
                      {ex.type}
                    </span>
                  </div>
                  
                  <h3 className="font-bold text-lg mb-1">{ex.name}</h3>
                  <p className="text-sm text-slate-400 font-medium flex items-center gap-1.5 mb-5">
                    <Target size={14} className="text-slate-300" />
                    Focus: {ex.focus}
                  </p>

                  <button
                    onClick={() => addExercise(ex)}
                    disabled={isAdded}
                    className={`w-full py-2.5 rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-all ${
                      isAdded 
                        ? "bg-teal-50 text-teal-600" 
                        : "bg-slate-900 text-white hover:bg-slate-800"
                    }`}
                  >
                    {isAdded ? (
                      <><CheckCircle2 size={16} /> Added to Plan</>
                    ) : (
                      <><Plus size={16} /> Add to Plan</>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Plan Summary */}
        <div className="lg:col-span-4 space-y-6">
          {/* DATES */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-5 flex items-center gap-2">
              <Calendar size={18} className="text-teal-600" />
              Plan Timeline
            </h3>
            <div className="space-y-4">
              <div className="relative">
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block ml-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  min={today}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                />
              </div>
              <div className="relative">
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block ml-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* CURRENT LIST */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col max-h-[600px]">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <ClipboardList size={18} className="text-teal-600" />
                Plan Details
              </h3>
              <span className="bg-white border text-slate-600 text-xs font-bold px-2 py-0.5 rounded-md">
                {selectedExercises.length}
              </span>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {selectedExercises.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
                    <Plus size={24} />
                  </div>
                  <p className="text-sm font-medium text-slate-400">Select exercises from the library to build the plan</p>
                </div>
              ) : (
                selectedExercises.map((ex) => (
                  <div key={ex.id} className="group relative bg-slate-50 border border-slate-100 rounded-2xl p-4 transition-all hover:border-red-100">
                    <button
                      onClick={() => removeExercise(ex.id)}
                      className="absolute -top-2 -right-2 bg-white border shadow-sm p-1.5 rounded-full text-slate-400 hover:text-red-500 hover:border-red-200 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <X size={14} strokeWidth={3} />
                    </button>

                    <h4 className="font-bold text-sm mb-3 text-slate-800 pr-4">{ex.name}</h4>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Sets</label>
                        <input
                          type="number"
                          value={ex.sets}
                          onChange={(e) => updateField(ex.id, "sets", e.target.value)}
                          className="w-full bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-sm font-bold focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Reps</label>
                        <input
                          type="number"
                          value={ex.reps}
                          onChange={(e) => updateField(ex.id, "reps", e.target.value)}
                          className="w-full bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-sm font-bold focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignExercise;