import React, { useState } from "react";
import { Activity, Mail, Lock, ArrowRight, UserCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = () => {
    //logic will go here
    navigate("/doctor");
  };

  return (
    // MAIN CONTAINER: Off-white background with consistent global theme
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* DECORATIVE ELEMENTS: Subtle gradients to give it that "Modern Tech" feel */}
      {/* Top Left Blob (Teal) */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-teal-200/30 rounded-full blur-3xl pointer-events-none" />
      {/* Bottom Right Blob (Cyan) */}
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-cyan-200/30 rounded-full blur-3xl pointer-events-none" />

      {/* LOGIN CARD */}
      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Card Header */}
        <div className="px-8 pt-10 pb-6 text-center">
          {/* Logo */}
          <div className="mx-auto w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center mb-4 text-teal-600">
            <Activity size={28} strokeWidth={2.5} />
          </div>

          {/* Brand Name */}
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
            PhysioCheck
          </h1>

          {/* Tagline */}
          <p className="text-slate-500 text-sm font-medium">
            Smarter Physiotherapy Tracking
          </p>
        </div>

        {/* Form Section */}
        <div className="px-8 pb-10">
          <form className="space-y-5">
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-sm"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center ml-1">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                <a
                  href="#"
                  className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                >
                  Forgot?
                </a>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-teal-500 transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Login Button */}
            <button
              type="button"
              className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 rounded-lg shadow-md hover:shadow-lg transform transition-all duration-200 flex items-center justify-center group"
              onClick={handleLogin}
            >
              Sign In
              <ArrowRight
                size={18}
                className="ml-2 group-hover:translate-x-1 transition-transform"
              />
            </button>
          </form>

          {/* Footer / Role Hint */}
          <div className="mt-8 text-center border-t border-slate-100 pt-6">
            <p className="text-slate-500 text-sm mb-4">
              Don't have an account?{" "}
              <a
                href="#"
                className="text-teal-600 font-semibold hover:underline"
              >
                Register
              </a>
            </p>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
              <UserCheck size={14} className="text-slate-500" />
              <span className="text-xs font-medium text-slate-500">
                Portal for Physiotherapists & Patients
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
