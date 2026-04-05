import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, Mail, Lock, User, UserCircle } from "lucide-react";
import { apiFetch } from "../api";

export default function Login() {
  const navigate = useNavigate();
  const [role, setRole] = useState<"patient" | "doctor">("patient");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    try {
      const endpoint = "/auth/login";
      const data = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem("token", data.token);
      localStorage.setItem("name", data.name || "User");
      localStorage.setItem("role", role);
      if (data.id) localStorage.setItem("id", data.id);

      navigate(role === "doctor" ? "/doctor" : "/patient");
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex font-sans">
      
      {/* ── LEFT PANEL: BRANDING & 3D MODEL (55%) ── */}
      <div className="hidden lg:flex lg:w-[55%] bg-gradient-to-br from-[#0F172A] to-[#1E293B] flex-col p-12 relative overflow-hidden">
        
        {/* Decorative Grid */}
        <div className="absolute inset-0 z-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-teal-500/30">
            <Activity size={24} strokeWidth={2.5} />
          </div>
          <span className="text-2xl font-black text-white tracking-tight">PhysioCheck</span>
        </div>

        <div className="relative z-10 mt-16 flex-1 flex flex-col justify-center">
          <h1 className="text-4xl lg:text-5xl font-black text-white leading-[1.1] tracking-tight mb-6">
            Accelerate <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-300">Recovery</span> through <br/>
            Intelligent Tracking.
          </h1>
          <p className="text-slate-400 text-lg max-w-lg mb-12 font-medium">
            Next-generation physiotherapy platform combining clinical insights with real-time AI motion analysis.
          </p>
          
          <div className="relative w-full max-w-md h-[380px] rounded-3xl overflow-hidden shadow-2xl shadow-teal-500/20 bg-slate-900 border border-slate-700 mx-auto lg:mx-0">
             <div className="absolute top-4 left-4 z-10 bg-slate-900/60 backdrop-blur-md border border-slate-700 px-3 py-1.5 rounded-lg text-white text-[10px] uppercase font-black tracking-widest shadow-sm">
                Interactive Model
             </div>
             {React.createElement("model-viewer", {
               src: "/model.glb",
               "auto-rotate": true,
               "camera-controls": true,
               "disable-zoom": true,
               "shadow-intensity": "1.5",
               style: { width: "100%", height: "100%", backgroundColor: "transparent", outline: "none" }
             })}
          </div>
        </div>

        <div className="relative z-10 mt-12 text-slate-500 text-sm font-medium">
          &copy; {new Date().getFullYear()} PhysioCheck, Inc. All rights reserved.
        </div>
      </div>

      {/* ── RIGHT PANEL: LOGIN FORM (45%) ── */}
      <div className="flex-1 flex flex-col justify-center bg-white p-8 sm:p-12 lg:p-20 relative">
        <div className="max-w-[420px] w-full mx-auto">
          
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center text-white shadow-sm">
              <Activity size={24} strokeWidth={2.5} />
            </div>
            <span className="text-2xl font-black text-slate-900 tracking-tight">PhysioCheck</span>
          </div>

          <h2 className="text-3xl font-black text-slate-900 mb-2">Welcome back</h2>
          <p className="text-slate-500 mb-8 font-medium">Please enter your credentials to access your account.</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Role Toggles */}
            <div className="flex p-1 bg-slate-50 border border-slate-200 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => setRole("patient")}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  role === "patient" 
                    ? "bg-white text-teal-700 shadow-sm border border-slate-200/60" 
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <User size={16} /> Patient
              </button>
              <button
                type="button"
                onClick={() => setRole("doctor")}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  role === "doctor" 
                    ? "bg-white text-teal-700 shadow-sm border border-slate-200/60" 
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <UserCircle size={16} /> Clinician
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="name@example.com"
                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex justify-between mb-2">
                  <span>Password</span>
                  <Link to="#" className="text-teal-600 hover:underline normal-case tracking-normal text-xs font-semibold">Forgot password?</Link>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-lg text-sm font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-teal-600/20 disabled:opacity-70 flex justify-center items-center h-12"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {role === "patient" && (
            <p className="mt-8 text-center text-sm font-medium text-slate-500">
              New patient? {" "}
              <Link to="/register" className="text-teal-600 hover:underline">
                Create an account
              </Link>
            </p>
          )}

        </div>
      </div>

    </div>
  );
}
