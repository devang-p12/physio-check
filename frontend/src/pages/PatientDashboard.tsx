import React, { useState } from 'react';
import { 
  Activity, 
  Menu, 
  Bell, 
  Play, 
  CheckCircle2, 
  Flame, 
  Clock, 
  Trophy,
  ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';



const PatientDashboard = () => {
  // Mock Data
  const navigate = useNavigate();
    const handleStart = () => {
        //logic goes here
        navigate('/patient/session')
    }
  const [exercises, setExercises] = useState([
    { id: 1, name: "Squats", reps: "3 sets x 10 reps", duration: "10 min", status: "completed", type: "Strength" },
    { id: 2, name: "Lunges", reps: "3 sets x 8 reps", duration: "8 min", status: "pending", type: "Balance" },
    { id: 3, name: "Plank Hold", reps: "3 sets x 30 sec", duration: "5 min", status: "pending", type: "Core" },
    { id: 4, name: "Hamstring Stretch", reps: "2 sets x 30 sec", duration: "5 min", status: "pending", type: "Flexibility" },
  ]);

  const completedCount = exercises.filter(e => e.status === 'completed').length;
  const totalCount = exercises.length;
  const progressPercentage = (completedCount / totalCount) * 100;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      
      {/* --- MOBILE/TABLET NAVIGATION --- */}
      <nav className="bg-white px-6 py-4 flex justify-between items-center sticky top-0 z-30 border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center text-teal-600">
            <Activity size={20} strokeWidth={2.5} />
          </div>
          <span className="font-bold text-slate-900 tracking-tight">PhysioCheck</span>
        </div>
        <div className="flex items-center gap-4">
          <button className="relative text-slate-400 hover:text-slate-600">
            <Bell size={20} />
            <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
          </button>
          <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-slate-100">
             <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" alt="User" />
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* --- GREETING & MOTIVATION --- */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Good morning, Sarah! ☀️</h1>
          <p className="text-slate-500 text-sm mt-1">Ready to crush your recovery goals today?</p>
        </div>

        {/* --- PROGRESS HERO SECTION --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Main Progress Card */}
          <div className="md:col-span-2 bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg shadow-teal-500/20 relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-6 -mt-6"></div>
            
            <div className="relative z-10 flex justify-between items-end">
              <div>
                <p className="text-teal-100 font-medium text-sm mb-1">Daily Progress</p>
                <h2 className="text-3xl font-bold">{completedCount}/{totalCount} Exercises</h2>
                <p className="text-xs text-teal-100 mt-2 opacity-80">Keep going, you're doing great!</p>
              </div>
              
              {/* Circular Progress Indicator */}
              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-teal-700/30" />
                  <circle 
                    cx="32" cy="32" r="28" stroke="white" strokeWidth="4" fill="transparent" 
                    strokeDasharray={175} 
                    strokeDashoffset={175 - (175 * progressPercentage) / 100} 
                    className="transition-all duration-1000 ease-out"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-xs font-bold">{Math.round(progressPercentage)}%</span>
              </div>
            </div>
          </div>

          {/* Streak Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center">
            <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center text-orange-500 mb-2">
              <Flame size={24} fill="currentColor" className="text-orange-500" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900">12 Days</h3>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Current Streak</p>
          </div>
        </div>

        {/* --- TODAY'S EXERCISES --- */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-900">Today's Plan</h2>
            <span className="text-sm text-teal-600 font-medium bg-teal-50 px-3 py-1 rounded-full">
              {totalCount - completedCount} Remaining
            </span>
          </div>

          <div className="space-y-4">
            {exercises.map((ex) => (
              <div 
                key={ex.id} 
                className={`group relative bg-white rounded-2xl p-4 border transition-all duration-300 flex items-center gap-4 ${
                  ex.status === 'completed' 
                    ? 'border-slate-100 opacity-75' 
                    : 'border-slate-100 shadow-sm hover:shadow-md hover:border-teal-200'
                }`}
              >
                {/* Icon/Thumbnail */}
                <div className={`w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center ${
                  ex.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400 group-hover:bg-teal-50 group-hover:text-teal-600'
                } transition-colors`}>
                  {ex.status === 'completed' ? <CheckCircle2 size={24} /> : <Activity size={24} />}
                </div>

                {/* Text Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`font-bold text-lg ${ex.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                      {ex.name}
                    </h3>
                    {ex.status === 'completed' && (
                      <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">DONE</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Trophy size={12} /> {ex.reps}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {ex.duration}
                    </span>
                  </div>
                </div>

                {/* Action Button */}
                {ex.status !== 'completed' && (
                  <button className="w-10 h-10 rounded-full bg-teal-500 hover:bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-500/30 transition-transform active:scale-95"
                            onClick={handleStart}
                  >
                    <Play size={18} fill="currentColor" className="ml-1" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
};

export default PatientDashboard;