import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Search, 
  Filter, 
  Plus, 
  X, 
  Clock, 
  RotateCw, 
  Dumbbell, 
  Save, 
  MessageSquare,
  PlayCircle
} from 'lucide-react';

const AssignExercise = () => {
  // Mock Data
  const patient = {
    name: "Sarah Jenkins",
    condition: "ACL Reconstruction",
    phase: "Phase 2: Strengthening",
    lastSession: "2 days ago"
  };

  const exerciseLibrary = [
    { id: 1, name: "Leg Press", type: "Strength", focus: "Quads", difficulty: "Medium" },
    { id: 2, name: "Heel Slides", type: "Mobility", focus: "Knee Flexion", difficulty: "Easy" },
    { id: 3, name: "Wall Squats", type: "Endurance", focus: "Quads/Glutes", difficulty: "Medium" },
    { id: 4, name: "Calf Raises", type: "Strength", focus: "Calves", difficulty: "Easy" },
    { id: 5, name: "Single Leg Balance", type: "Proprioception", focus: "Stability", difficulty: "Hard" },
  ];

  const [selectedExercises, setSelectedExercises] = useState([]);

  // Add exercise to the "Prescription" list
  const addExercise = (exercise) => {
    if (!selectedExercises.find(e => e.id === exercise.id)) {
      setSelectedExercises([...selectedExercises, { ...exercise, sets: 3, reps: 10, notes: '' }]);
    }
  };

  // Remove exercise
  const removeExercise = (id) => {
    setSelectedExercises(selectedExercises.filter(e => e.id !== id));
  };

  // Update specific field (sets, reps, notes)
  const updateField = (id, field, value) => {
    setSelectedExercises(selectedExercises.map(e => 
      e.id === id ? { ...e, [field]: value } : e
    ));
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-6">
      
      {/* HEADER: Navigation */}
      <div className="max-w-6xl mx-auto mb-8 flex items-center gap-4">
        <button className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Assign Exercises</h1>
          <p className="text-slate-500 text-sm">Select and configure the recovery plan.</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* --- LEFT COLUMN: Exercise Library --- */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-4">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search exercise library..." 
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-teal-500/20 text-slate-900"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium">
              <Filter size={18} />
              <span>Filters</span>
            </button>
          </div>

          {/* Exercise Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exerciseLibrary.map((ex) => (
              <div key={ex.id} className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm hover:border-teal-200 hover:shadow-md transition-all group relative">
                <div className="flex justify-between items-start mb-3">
                  <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-lg flex items-center justify-center">
                    <Dumbbell size={20} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 px-2 py-1 rounded-full">
                    {ex.type}
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-lg">{ex.name}</h3>
                <p className="text-slate-500 text-sm mb-4">Focus: {ex.focus}</p>
                
                <button 
                  onClick={() => addExercise(ex)}
                  className="w-full py-2 rounded-lg border border-slate-200 text-slate-600 font-medium group-hover:bg-teal-500 group-hover:text-white group-hover:border-teal-500 transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  Add to Plan
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* --- RIGHT COLUMN: The Prescription Builder (Sticky) --- */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-6">
            
            {/* Patient Context Card */}
            <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
               {/* Decorative bg blobs */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/20 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
              
              <div className="relative z-10">
                <h2 className="text-lg font-bold mb-1">{patient.name}</h2>
                <div className="text-slate-400 text-sm mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-400"></span>
                  {patient.condition}
                </div>
                
                <div className="pt-4 border-t border-slate-700/50 flex justify-between items-center text-xs text-slate-300">
                  <span>{patient.phase}</span>
                  <span>Active: {patient.lastSession}</span>
                </div>
              </div>
            </div>

            {/* The "Cart" / Plan Builder */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-slate-900">Current Plan</h3>
                <span className="text-xs font-semibold bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">
                  {selectedExercises.length} Exercises
                </span>
              </div>

              <div className="max-h-[400px] overflow-y-auto p-4 space-y-4">
                {selectedExercises.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <PlayCircle size={24} className="opacity-50"/>
                    </div>
                    <p className="text-sm">No exercises selected.</p>
                  </div>
                ) : (
                  selectedExercises.map((item) => (
                    <div key={item.id} className="border border-slate-100 rounded-xl p-3 relative bg-slate-50/30">
                      <button 
                        onClick={() => removeExercise(item.id)}
                        className="absolute top-2 right-2 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <X size={16} />
                      </button>
                      
                      <h4 className="font-bold text-slate-800 text-sm mb-3">{item.name}</h4>
                      
                      <div className="flex gap-2 mb-3">
                        {/* Sets Input */}
                        <div className="flex-1">
                          <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Sets</label>
                          <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 py-1">
                            <RotateCw size={12} className="text-slate-400 mr-2"/>
                            <input 
                              type="number" 
                              value={item.sets}
                              onChange={(e) => updateField(item.id, 'sets', e.target.value)}
                              className="w-full text-sm font-bold text-slate-900 focus:outline-none"
                            />
                          </div>
                        </div>
                         {/* Reps Input */}
                         <div className="flex-1">
                          <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Reps</label>
                          <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 py-1">
                            <Clock size={12} className="text-slate-400 mr-2"/>
                            <input 
                              type="number" 
                              value={item.reps}
                              onChange={(e) => updateField(item.id, 'reps', e.target.value)}
                              className="w-full text-sm font-bold text-slate-900 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Notes */}
                      <div className="relative">
                        <MessageSquare size={12} className="absolute top-2.5 left-2.5 text-slate-400"/>
                        <input 
                          type="text" 
                          placeholder="Add instructions..." 
                          className="w-full pl-7 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-teal-400"
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer Action */}
              <div className="p-4 border-t border-slate-100 bg-slate-50">
                <button className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 transition-transform active:scale-95">
                  <Save size={18} />
                  Assign & Send
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default AssignExercise;