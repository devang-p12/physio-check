import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Plus,
  X,
  Dumbbell,
  Save,
  Search,
  Calendar,
  Target,
  ChevronRight,
  Cpu,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "../api";

const AssignExercise = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const patientId = params.get("patientId");

  const [patient, setPatient] = useState(null);
  const [selectedExercises, setSelectedExercises] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [exerciseLibrary, setExerciseLibrary] = useState([]);
  const [customTemplates, setCustomTemplates] = useState([]);

  // 🔹 Date handling
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]
  );

  const filteredLibrary = exerciseLibrary.filter((ex) =>
    ex.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredCustom = customTemplates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 🔹 Fetch patient info and exercises
  useEffect(() => {
    if (!patientId) {
      navigate("/doctor");
      return;
    }
    const fetchData = async () => {
      try {
        // Fetch patient
        const patientData = await apiFetch("/doctor/patients");
        const p = patientData.patients.find((x) => x.id === patientId);
        if (!p) {
          alert("Patient not found");
          navigate("/doctor");
          return;
        }
        setPatient(p);

        // Fetch exercises
        const exerciseData = await apiFetch("/doctor/exercises");
        if (exerciseData.exercises && exerciseData.exercises.length > 0) {
          setExerciseLibrary(exerciseData.exercises);
        } else {
          const seededData = await apiFetch("/doctor/seed-exercises", { method: "POST" });
          setExerciseLibrary(seededData.exercises);
        }

        // Fetch doctor's custom exercise templates
        try {
          const customData = await apiFetch("/doctor/custom-templates");
          setCustomTemplates(customData.templates || []);
        } catch (_) {
          // custom templates are optional — fail silently
        }
      } catch (err) {
        console.error(err);
        navigate("/doctor");
      }
    };
    fetchData();
  }, [patientId, navigate]);

  const addExercise = (exercise) => {
    if (!selectedExercises.find((e) => e._id === exercise._id && !e.isCustom)) {
      setSelectedExercises([
        ...selectedExercises,
        { ...exercise, sets: 3, reps: exercise.reps || 10, tolerance: 0, isCustom: false },
      ]);
    }
  };

  const addCustomTemplate = (tmpl) => {
    if (!selectedExercises.find((e) => e._id === tmpl.id && e.isCustom)) {
      setSelectedExercises([
        ...selectedExercises,
        { _id: tmpl.id, name: tmpl.name, description: tmpl.description, sets: 3, reps: 10, tolerance: 0, isCustom: true },
      ]);
    }
  };

  const removeExercise = (id) => {
    setSelectedExercises(selectedExercises.filter((e) => e._id !== id));
  };

  const updateField = (id, field, value) => {
    setSelectedExercises(
      selectedExercises.map((e) =>
        e._id === id ? { ...e, [field]: Number(value) } : e
      )
    );
  };

  const handleAssign = async () => {
    if (selectedExercises.length === 0) {
      alert("Select at least one exercise");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      alert("End date must be after start date");
      return;
    }
    setLoading(true);
    try {
      for (const ex of selectedExercises) {
        if (ex.isCustom) {
          // custom exercise template
          await apiFetch("/doctor/assign-custom-exercise", {
            method: "POST",
            body: JSON.stringify({
              patientId,
              customTemplateId: ex._id,
              sets: ex.sets,
              repsPerSet: ex.reps,
              date: startDate,
              endDate: endDate,
            }),
          });
        } else {
          // standard exercise
          await apiFetch("/doctor/assign-exercise", {
            method: "POST",
            body: JSON.stringify({
              patientId,
              exerciseId: ex._id,
              prescription: { sets: ex.sets, repsPerSet: ex.reps, tolerance: ex.tolerance },
              date: startDate,
              endDate: endDate,
            }),
          });
        }
      }
      alert("Exercise plan assigned successfully");
      navigate("/doctor");
    } catch (err) {
      alert("Failed to assign exercises");
    } finally {
      setLoading(false);
    }
  };

  if (!patient) return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-12">
      {/* TOP NAV/HEADER */}
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2.5 hover:bg-slate-50 border rounded-xl transition-colors text-slate-600"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Assign Exercises</h1>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded text-xs font-medium">Patient</span>
                {patient.name}
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3 text-slate-400">
            <Calendar size={18} />
            <span className="text-sm font-medium">New Plan Creation</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT: Exercise Library */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                Exercise Library 
                <span className="text-xs font-normal bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                  {exerciseLibrary.length}
                </span>
              </h2>
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500 transition-colors" size={18} />
                <input
                  type="text"
                  placeholder="Search exercises..."
                  className="pl-10 pr-4 py-2.5 bg-white border rounded-xl text-sm w-full md:w-64 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all shadow-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredLibrary.map((ex) => (
                <div
                  key={ex._id}
                  className="group bg-white p-5 rounded-2xl border border-slate-200 hover:border-teal-500 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className={`p-2.5 rounded-xl transition-colors ${ex.name === 'Reaction Exercise' ? 'bg-purple-50 text-purple-600 group-hover:bg-purple-500 group-hover:text-white' : 'bg-teal-50 text-teal-600 group-hover:bg-teal-500 group-hover:text-white'}`}>
                        {ex.name === 'Reaction Exercise' ? <span className="text-xl">🎯</span> : <Dumbbell size={22} />}
                      </div>
                      {ex.name === 'Reaction Exercise' && (
                        <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Camera</span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-900 group-hover:text-teal-700 transition-colors">{ex.name}</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {ex.description}
                    </p>
                  </div>
                  <button
                    onClick={() => addExercise(ex)}
                    className="mt-5 w-full py-2.5 bg-slate-50 hover:bg-teal-600 hover:text-white text-slate-700 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all"
                  >
                    <Plus size={18} /> Add to Plan
                  </button>
                </div>
              ))}
            </div>

            {/* Custom exercise templates */}
            {filteredCustom.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                  <Cpu size={18} className="text-emerald-600" />
                  Custom Recorded Exercises
                  <span className="text-xs font-normal bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{filteredCustom.length}</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredCustom.map((tmpl) => (
                    <div
                      key={tmpl.id}
                      className="group bg-white p-5 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                            <Cpu size={22} />
                          </div>
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Custom</span>
                        </div>
                        <h3 className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">{tmpl.name}</h3>
                        <p className="text-sm text-slate-500 mt-1">{tmpl.description || tmpl.category}</p>
                        <p className="text-xs text-slate-400 mt-1">{tmpl.frameCount} frames · {tmpl.durationSeconds}s</p>
                      </div>
                      <button
                        onClick={() => addCustomTemplate(tmpl)}
                        className="mt-5 w-full py-2.5 bg-slate-50 hover:bg-emerald-600 hover:text-white text-slate-700 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all"
                      >
                        <Plus size={18} /> Add to Plan
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Plan Builder */}
          <div className="lg:col-span-4">
            <div className="sticky top-28 space-y-6">
              
              {/* DATE SELECTOR */}
              <div className="bg-white rounded-2xl p-5 border shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Calendar size={18} className="text-teal-600" />
                  Duration
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-tight mb-1.5 block">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      min={today}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full border-slate-200 px-3 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-teal-500/20 outline-none border"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-tight mb-1.5 block">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full border-slate-200 px-3 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-teal-500/20 outline-none border"
                    />
                  </div>
                </div>
              </div>

              {/* CURRENT PLAN */}
              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                  <h3 className="font-bold text-slate-800">Current Plan</h3>
                  <span className="bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded-full">
                    {selectedExercises.length} Selected
                  </span>
                </div>

                <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
                  {selectedExercises.length === 0 ? (
                    <div className="py-12 text-center">
                      <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Plus className="text-slate-300" />
                      </div>
                      <p className="text-sm text-slate-400 px-8">
                        Select exercises from the library to start building the plan.
                      </p>
                    </div>
                  ) : (
                    selectedExercises.map((ex) => (
                      <div key={ex._id} className="group border border-slate-100 bg-slate-50/50 rounded-xl p-4 relative hover:border-teal-200 transition-colors">
                        <button
                          onClick={() => removeExercise(ex._id)}
                          className="absolute top-3 right-3 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <X size={14} />
                        </button>

                        <h4 className="font-bold text-sm text-slate-800 mb-3 pr-6">{ex.name}</h4>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-1">SETS</label>
                            <input
                              type="number"
                              value={ex.sets}
                              onChange={(e) => updateField(ex._id, "sets", e.target.value)}
                              className="w-full border-transparent bg-white px-3 py-1.5 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 border outline-none font-medium"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-1">REPS</label>
                            <input
                              type="number"
                              value={ex.reps}
                              onChange={(e) => updateField(ex._id, "reps", e.target.value)}
                              className="w-full border-transparent bg-white px-3 py-1.5 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 border outline-none font-medium"
                            />
                          </div>
                        </div>

                        {/* TOLERANCE SLIDER */}
                        <div className="mt-3">
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Angle Tolerance</label>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              ex.tolerance === 0
                                ? "bg-slate-100 text-slate-500"
                                : ex.tolerance <= 10
                                ? "bg-yellow-50 text-yellow-600"
                                : "bg-orange-50 text-orange-600"
                            }`}>{ex.tolerance}°</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={30}
                            step={5}
                            value={ex.tolerance}
                            onChange={(e) => updateField(ex._id, "tolerance", e.target.value)}
                            className="w-full h-1.5 rounded-full appearance-none bg-slate-200 accent-teal-500 cursor-pointer"
                          />
                          <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                            <span>Strict</span>
                            <span>Lenient</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-4 bg-white border-t mt-auto">
                  <button
                    disabled={loading || selectedExercises.length === 0}
                    onClick={handleAssign}
                    className="w-full bg-slate-900 hover:bg-teal-600 disabled:bg-slate-200 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-slate-200"
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
                  <p className="text-[10px] text-center text-slate-400 mt-3 px-4">
                    Patient will be notified via email once the plan is assigned.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AssignExercise;