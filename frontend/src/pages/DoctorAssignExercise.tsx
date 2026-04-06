import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Plus,
  X,
  Dumbbell,
  Save,
  Search,
  Calendar,
  Filter,
  Cpu,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "../api";

const AssignExercise = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const patientId = params.get("patientId");

  const [patient, setPatient] = useState(null);
  const [selectedExercises, setSelectedExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState('all'); // 'all', 'library', 'custom'
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;
  
  const [exerciseLibrary, setExerciseLibrary] = useState<any[]>([]);
  const [customTemplates, setCustomTemplates] = useState<any[]>([]);

  // Date handling
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]
  );

  // Pagination Reset
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType]);

  // Combine Library + Custom for Tabular Data
  const combinedExercises = [
    ...exerciseLibrary.map(ex => ({ ...ex, isCustomFlag: false })),
    ...customTemplates.map(tmpl => ({
      _id: tmpl.id,
      name: tmpl.name,
      description: tmpl.description || tmpl.category,
      isCustomFlag: true,
      originalTmpl: tmpl
    }))
  ];

  const filteredCombined = combinedExercises.filter(ex => {
    const matchesSearch = ex.name?.toLowerCase().includes(searchQuery.toLowerCase()) || ex.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' 
      || (filterType === 'library' && !ex.isCustomFlag) 
      || (filterType === 'custom' && ex.isCustomFlag);
    return matchesSearch && matchesType;
  });

  const totalPages = Math.ceil(filteredCombined.length / ITEMS_PER_PAGE) || 1;
  const currentChunk = filteredCombined.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Actions
  const handleAdd = (ex: any) => {
    if (ex.isCustomFlag) {
      addCustomTemplate(ex.originalTmpl);
    } else {
      addExercise(ex);
    }
  };

  // Fetch Logic
  useEffect(() => {
    if (!patientId) {
      navigate("/doctor");
      return;
    }
    const fetchData = async () => {
      try {
        const patientData = await apiFetch("/doctor/patients");
        const p = patientData.patients.find((x: any) => x.id === patientId);
        if (!p) { alert("Patient not found"); navigate("/doctor"); return; }
        setPatient(p);

        const exerciseData = await apiFetch("/doctor/exercises");
        if (exerciseData.exercises && exerciseData.exercises.length > 0) {
          setExerciseLibrary(exerciseData.exercises);
        } else {
          const seededData = await apiFetch("/doctor/seed-exercises", { method: "POST" });
          setExerciseLibrary(seededData.exercises);
        }

        try {
          const customData = await apiFetch("/doctor/custom-templates");
          setCustomTemplates(customData.templates || []);
        } catch (_) {}
      } catch (err) {
        console.error(err);
        navigate("/doctor");
      }
    };
    fetchData();
  }, [patientId, navigate]);

  const addExercise = (exercise: any) => {
    if (!selectedExercises.find((e) => e._id === exercise._id && !e.isCustom)) {
      setSelectedExercises([
        ...selectedExercises,
        {
          ...exercise,
          sets: 3,
          reps: exercise.reps || 10,
          tolerances: [
            { joint: "Knee", tolerance: 15 },
            { joint: "Hip", tolerance: 15 },
            { joint: "Shoulder", tolerance: 15 },
            { joint: "Elbow", tolerance: 15 }
          ],
          isCustom: false
        },
      ]);
    }
  };

  const addCustomTemplate = (tmpl: any) => {
    if (!selectedExercises.find((e) => e._id === tmpl.id && e.isCustom)) {
      setSelectedExercises([
        ...selectedExercises,
        {
          _id: tmpl.id,
          name: tmpl.name,
          description: tmpl.description,
          sets: 3,
          reps: 10,
          tolerances: [
            { joint: "Knee", tolerance: 15 },
            { joint: "Hip", tolerance: 15 },
            { joint: "Shoulder", tolerance: 15 },
            { joint: "Elbow", tolerance: 15 }
          ],
          isCustom: true
        },
      ]);
    }
  };

  const removeExercise = (id: string) => {
    setSelectedExercises(selectedExercises.filter((e) => e._id !== id));
  };

  const updateField = (id: string, field: string, value: string) => {
    setSelectedExercises(
      selectedExercises.map((e) =>
        e._id === id ? { ...e, [field]: Number(value) } : e
      )
    );
  };

  const updateTolerance = (id: string, joint: string, value: string) => {
    setSelectedExercises(
      selectedExercises.map((e) =>
        e._id === id
          ? {
            ...e,
            tolerances: e.tolerances.map((t: any) =>
              t.joint === joint ? { ...t, tolerance: Number(value) } : t
            ),
          }
          : e
      )
    );
  };

  const handleAssign = async () => {
    if (selectedExercises.length === 0) { alert("Select at least one exercise"); return; }
    if (new Date(startDate) > new Date(endDate)) { alert("End date must be after start date"); return; }
    setLoading(true);
    try {
      for (const ex of selectedExercises) {
        if (ex.isCustom) {
          await apiFetch("/doctor/assign-custom-exercise", {
            method: "POST",
            body: JSON.stringify({
              patientId, customTemplateId: ex._id, sets: ex.sets, repsPerSet: ex.reps, tolerances: ex.tolerances, date: startDate, endDate: endDate,
            }),
          });
        } else {
          await apiFetch("/doctor/assign-exercise", {
            method: "POST",
            body: JSON.stringify({
              patientId, exerciseId: ex._id, prescription: { sets: ex.sets, repsPerSet: ex.reps, tolerances: ex.tolerances }, date: startDate, endDate: endDate,
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
    <div className="page-content font-sans pb-12">
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
                {(patient as any).name}
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

          {/* LEFT: Exercise Library Table */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
             <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    Exercise Library
                    <span className="text-xs font-normal bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                      {filteredCombined.length}
                    </span>
                  </h2>

                  <div className="flex gap-3 text-sm">
                    {/* Filter Type Dropdown */}
                    <div className="relative flex items-center group">
                      <Filter className="absolute left-3 text-slate-400 group-focus-within:text-teal-500 transition-colors pointer-events-none" size={16} />
                      <select 
                        className="pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all shadow-sm appearance-none min-w-[140px] text-slate-700 font-medium cursor-pointer"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                      >
                         <option value="all">All Types</option>
                         <option value="library">Library Models</option>
                         <option value="custom">Custom Recorded</option>
                      </select>
                    </div>

                    {/* Search Input */}
                    <div className="relative group flex-1 md:flex-none">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500 transition-colors" size={16} />
                      <input
                        type="text"
                        placeholder="Search exercises..."
                        className="pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl w-full md:w-56 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all shadow-sm text-slate-700"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Table Layout */}
                <div className="overflow-x-auto min-h-[500px]">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-[#F8FAFC] border-b text-slate-500 text-xs uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-6 py-4 rounded-tl-xl w-3/5">Exercise Listing</th>
                        <th className="px-6 py-4 w-1/5">Type</th>
                        <th className="px-6 py-4 rounded-tr-xl w-1/5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentChunk.length === 0 ? (
                        <tr>
                           <td colSpan={3} className="px-6 py-16 text-center text-slate-400">
                              <Search className="w-12 h-12 mx-auto text-slate-200 mb-4" />
                              <p className="text-base font-medium text-slate-500">No exercises found matching your criteria</p>
                              <p className="text-sm mt-1">Try clearing your filters or search terms</p>
                           </td>
                        </tr>
                      ) : currentChunk.map((ex) => (
                        <tr key={ex._id} className="hover:bg-slate-50/80 transition-colors group">
                          <td className="px-6 py-4 whitespace-normal">
                            <div className="flex items-start gap-4">
                              <div className={`mt-0.5 p-2 rounded-lg flex-shrink-0 transition-colors ${
                                ex.isCustomFlag 
                                  ? 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white' 
                                  : (ex.name === 'Reaction Exercise' ? 'bg-purple-50 text-purple-600 group-hover:bg-purple-500 group-hover:text-white' : 'bg-teal-50 text-teal-600 group-hover:bg-teal-500 group-hover:text-white')
                              }`}>
                                {ex.isCustomFlag ? <Cpu size={20} /> : (ex.name === 'Reaction Exercise' ? <span className="text-lg">🎯</span> : <Dumbbell size={20} />)}
                              </div>
                              <div>
                                <h3 className="font-bold text-slate-900 group-hover:text-teal-700 transition-colors text-[15px]">{ex.name}</h3>
                                <p className="text-[13px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{ex.description || 'No detailed description available.'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                             {ex.isCustomFlag ? (
                               <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                                 <Cpu size={12} /> Custom
                               </span>
                             ) : (
                               <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                 <Dumbbell size={12} /> Library
                               </span>
                             )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleAdd(ex)}
                              className="px-4 py-2 bg-white border border-slate-200 hover:border-teal-500 hover:bg-teal-50 hover:text-teal-700 text-slate-600 font-bold rounded-lg flex items-center justify-center gap-2 transition-all ml-auto text-sm shadow-sm"
                            >
                              <Plus size={16} /> Add 
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                     <span className="text-sm font-medium text-slate-500 ml-2">
                       Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredCombined.length)} of {filteredCombined.length}
                     </span>
                     <div className="flex gap-2">
                        <button 
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(p => p - 1)}
                          className="p-2 border rounded-lg bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <button 
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(p => p + 1)}
                          className="p-2 border rounded-lg bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronRight size={18} />
                        </button>
                     </div>
                  </div>
                )}
             </div>
          </div>

          {/* RIGHT: Plan Builder */}
          <div className="lg:col-span-5 xl:col-span-4">
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
                  <span className="bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                    {selectedExercises.length} Selected
                  </span>
                </div>

                <div className="p-4 space-y-4 max-h-[50vh] overflow-y-auto">
                  {selectedExercises.length === 0 ? (
                    <div className="py-12 text-center">
                      <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-dashed border-slate-200">
                        <Plus className="text-slate-300" />
                      </div>
                      <p className="text-sm text-slate-400 px-8">
                        Select exercises from the library to start building the plan.
                      </p>
                    </div>
                  ) : (
                    selectedExercises.map((ex) => (
                      <div key={ex._id} className="group border border-slate-200 bg-slate-50/50 rounded-xl p-4 relative hover:border-teal-300 transition-colors shadow-sm">
                        <button
                          onClick={() => removeExercise(ex._id)}
                          className="absolute top-3 right-3 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <X size={14} />
                        </button>

                        <h4 className="font-bold text-sm text-slate-800 mb-3 pr-6 leading-tight">{ex.name}</h4>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">Sets</label>
                            <input
                              type="number"
                              value={ex.sets}
                              onChange={(e) => updateField(ex._id, "sets", e.target.value)}
                              className="w-full border-transparent bg-white px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 shadow-sm border outline-none font-bold text-slate-700"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">Reps</label>
                            <input
                              type="number"
                              value={ex.reps}
                              onChange={(e) => updateField(ex._id, "reps", e.target.value)}
                              className="w-full border-transparent bg-white px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 shadow-sm border outline-none font-bold text-slate-700"
                            />
                          </div>
                        </div>

                        {/* TOLERANCE SLIDERS */}
                        <div className="mt-5 space-y-4 pt-4 border-t border-slate-200">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight block">Joint Tolerances</label>
                          {ex.tolerances?.map((t: any) => (
                            <div key={t.joint}>
                              <div className="flex justify-between items-center mb-1.5">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">{t.joint}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${t.tolerance === 0
                                    ? "bg-slate-100 text-slate-500"
                                    : t.tolerance <= 15
                                      ? "bg-teal-50 text-teal-700"
                                      : "bg-orange-50 text-orange-600"
                                  }`}>{t.tolerance}°</span>
                              </div>
                              <input
                                type="range"
                                min={0}
                                max={45}
                                step={5}
                                value={t.tolerance}
                                onChange={(e) => updateTolerance(ex._id, t.joint, e.target.value)}
                                className="w-full h-1.5 rounded-full appearance-none bg-slate-200 accent-teal-500 cursor-pointer"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-4 bg-white border-t mt-auto shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.02)]">
                  <button
                    disabled={loading || selectedExercises.length === 0}
                    onClick={handleAssign}
                    className="w-full bg-slate-900 hover:bg-teal-600 disabled:bg-slate-200 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-slate-200/50 active:scale-[0.98]"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Save size={18} />
                        Assign Plan
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-center text-slate-400 mt-3 px-4 font-medium">
                    Patient will automatically receive their new plan.
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