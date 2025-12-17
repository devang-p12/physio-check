import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Activity, ArrowRight, ShieldCheck, User } from 'lucide-react';

// --- IMPORT YOUR COMPONENTS HERE ---
// Adjust the paths based on where you saved the files
import LoginPage from './pages/Login';
import RegisterPage from './pages/Register';
import DoctorDashboard from './pages/DoctorDashboard';
import AssignExercise from './pages/DoctorAssignExercise';
import PatientDashboard from './pages/PatientDashboard';
import ExerciseSession from './pages/PatientExercise-Id';

// --- A TEMPORARY HOME PAGE TO NAVIGATE YOUR PROTOTYPE ---
const DemoHome = () => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
    <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
      <div className="p-8 bg-slate-900 text-white text-center">
        <div className="mx-auto w-16 h-16 bg-teal-500 rounded-2xl flex items-center justify-center mb-4 text-white shadow-lg shadow-teal-500/30">
          <Activity size={32} strokeWidth={3} />
        </div>
        <h1 className="text-3xl font-bold mb-2">PhysioCheck Prototype</h1>
        <p className="text-slate-400">Select a view to test the UI</p>
      </div>

      <div className="p-8 grid gap-4">
        
        {/* Auth Section */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Authentication</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link to="/login" className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-teal-500 hover:shadow-md transition-all group">
              <span className="font-semibold text-slate-700">Login Page</span>
              <ArrowRight size={16} className="text-slate-300 group-hover:text-teal-500" />
            </Link>
            <Link to="/register" className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-teal-500 hover:shadow-md transition-all group">
              <span className="font-semibold text-slate-700">Register Page</span>
              <ArrowRight size={16} className="text-slate-300 group-hover:text-teal-500" />
            </Link>
          </div>
        </div>

        {/* Doctor Flow */}
        <div className="space-y-3 mt-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck size={14} /> Doctor Views
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link to="/doctor" className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200 hover:bg-white hover:border-blue-500 hover:shadow-md transition-all group">
              <span className="font-semibold text-slate-700">Doctor Dashboard</span>
              <ArrowRight size={16} className="text-slate-300 group-hover:text-blue-500" />
            </Link>
            <Link to="/doctor/assign" className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200 hover:bg-white hover:border-blue-500 hover:shadow-md transition-all group">
              <span className="font-semibold text-slate-700">Assign Exercise</span>
              <ArrowRight size={16} className="text-slate-300 group-hover:text-blue-500" />
            </Link>
          </div>
        </div>

        {/* Patient Flow */}
        <div className="space-y-3 mt-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <User size={14} /> Patient Views
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link to="/patient" className="flex items-center justify-between p-4 rounded-xl bg-teal-50/50 border border-teal-100 hover:bg-white hover:border-teal-500 hover:shadow-md transition-all group">
              <span className="font-semibold text-slate-700">Patient Dashboard</span>
              <ArrowRight size={16} className="text-teal-300 group-hover:text-teal-500" />
            </Link>
            <Link to="/patient/session" className="flex items-center justify-between p-4 rounded-xl bg-teal-50/50 border border-teal-100 hover:bg-white hover:border-teal-500 hover:shadow-md transition-all group">
              <span className="font-semibold text-slate-700">Active Session (Cam)</span>
              <ArrowRight size={16} className="text-teal-300 group-hover:text-teal-500" />
            </Link>
          </div>
        </div>

      </div>
    </div>
  </div>
);

// --- MAIN APP COMPONENT ---
function App() {
  return (
    <Router>
      <Routes>
        {/* The Landing Hub */}
        <Route path="/" element={<DemoHome />} />
        
        {/* Auth Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
        {/* Doctor Routes */}
        <Route path="/doctor" element={<DoctorDashboard />} />
        <Route path="/doctor/assign" element={<AssignExercise />} />
        
        {/* Patient Routes */}
        <Route path="/patient" element={<PatientDashboard />} />
        <Route path="/patient/session" element={<ExerciseSession />} />
      </Routes>
    </Router>
  );
}

export default App;