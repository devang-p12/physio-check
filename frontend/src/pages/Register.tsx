import React, { useState } from 'react';
import { Activity, Mail, Lock, User, Stethoscope, ArrowRight, CheckCircle2 } from 'lucide-react';

const RegisterPage = () => {
  const [role, setRole] = useState('patient'); // Default to patient
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    // MAIN CONTAINER: Same environment as Login page for seamless transition
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* DECORATIVE ELEMENTS: Keeping the same brand atmosphere */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-teal-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-cyan-200/30 rounded-full blur-3xl pointer-events-none" />

      {/* REGISTER CARD */}
      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        
        {/* Header */}
        <div className="px-8 pt-8 pb-4 text-center">
          <div className="mx-auto w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center mb-3 text-teal-600">
            <Activity size={24} strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Join PhysioCheck</h1>
          <p className="text-slate-500 text-sm mt-1">Start your recovery or practice today.</p>
        </div>

        <div className="px-8 pb-10">
          <form className="space-y-5">

            {/* ROLE SELECTOR */}
            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider ml-1 mb-2 block">
                I am a...
              </label>
              <div className="grid grid-cols-2 gap-3">
                {/* Patient Button */}
                <button
                  type="button"
                  onClick={() => setRole('patient')}
                  className={`relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 ${
                    role === 'patient'
                      ? 'border-teal-500 bg-teal-50/50 text-teal-700 shadow-sm'
                      : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {role === 'patient' && (
                    <div className="absolute top-2 right-2 text-teal-500">
                      <CheckCircle2 size={16} fill="currentColor" className="text-white" />
                    </div>
                  )}
                  <User size={24} className="mb-2" />
                  <span className="text-sm font-semibold">Patient</span>
                </button>

                {/* Doctor Button */}
                <button
                  type="button"
                  onClick={() => setRole('doctor')}
                  className={`relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 ${
                    role === 'doctor'
                      ? 'border-teal-500 bg-teal-50/50 text-teal-700 shadow-sm'
                      : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {role === 'doctor' && (
                    <div className="absolute top-2 right-2 text-teal-500">
                      <CheckCircle2 size={16} fill="currentColor" className="text-white" />
                    </div>
                  )}
                  <Stethoscope size={24} className="mb-2" />
                  <span className="text-sm font-semibold">Physio</span>
                </button>
              </div>
            </div>

            {/* Full Name Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider ml-1">
                Full Name
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-teal-500 transition-colors">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  name="name"
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-sm"
                  placeholder="John Doe"
                />
              </div>
            </div>

            {/* Email Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider ml-1">
                Email Address
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-teal-500 transition-colors">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  name="email"
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-sm"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider ml-1">
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-teal-500 transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  name="password"
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-sm"
                  placeholder="Create a strong password"
                />
              </div>
            </div>

            {/* Register Button */}
            <button
              type="button"
              className="w-full mt-2 bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 rounded-lg shadow-md hover:shadow-lg transform transition-all duration-200 flex items-center justify-center group"
            >
              Create Account
              <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          {/* Footer Link */}
          <div className="mt-6 text-center">
            <p className="text-slate-500 text-sm">
              Already have an account?{' '}
              <a href="#" className="text-teal-600 font-semibold hover:underline">
                Log in
              </a>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default RegisterPage;