import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, Mail, Lock, User, UserCircle, Eye, EyeOff, Zap, Target, BarChart2 } from "lucide-react";
import { apiFetch } from "../api";

export default function Login() {
  const navigate = useNavigate();
  const [role, setRole] = useState<"patient" | "doctor">("patient");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const squatVideos = [
    "/Bulgarian Split Squat Exercise for Legs.mp4",
    "/Woman Doing Air Squat Exercise.mp4",
    "/Assisted Pistol Squat Exercise for Legs.mp4"
  ];
  const [currentVideoIdx, setCurrentVideoIdx] = useState(0);

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
    <div className="min-h-screen flex font-sans bg-[#F1FAEE]">
      
      {/* ── LEFT PANEL: BRANDING & HIGH-TECH SHOWCASE (50%) ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#1D3557] via-[#1D3557] to-[#457B9D] flex-col p-16 relative overflow-hidden">
        
        {/* Decorative Modern Mesh/Grid */}
        <div className="absolute top-[-20%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#A8DADC]/10 via-transparent to-transparent z-0 opacity-80" />
        <div className="absolute inset-0 z-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(168,218,220,1) 1px, transparent 1px), linear-gradient(90deg, rgba(168,218,220,1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        {/* Branding Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 bg-[#457B9D] rounded-2xl flex items-center justify-center text-[#F1FAEE] shadow-xl shadow-[#1D3557]/50 border border-[#A8DADC]/20">
            <Activity size={28} strokeWidth={2.5} />
          </div>
          <span className="text-3xl font-black text-[#F1FAEE] tracking-tight">PhysioCheck</span>
        </div>

        <div className="relative z-10 mt-20 flex-1 flex flex-col justify-center max-w-xl">
          <h1 className="text-5xl font-black text-[#F1FAEE] leading-[1.15] tracking-tight mb-8">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#A8DADC] to-[#F1FAEE]">Accelerate</span> Recovery <br/>
            through Intelligent Tracking.
          </h1>
          <p className="text-[#A8DADC] opacity-90 text-xl mb-8 font-medium leading-relaxed">
            Next-generation physiotherapy platform combining clinical insights with real-time AI motion analysis.
          </p>

          {/* Feature Highlight Chips */}
          <div className="flex flex-wrap gap-2 mb-8">
            {[
              { icon: <Zap size={13} />, label: "Real-time AI Analysis" },
              { icon: <Target size={13} />, label: "Joint Tracking" },
              { icon: <BarChart2 size={13} />, label: "Progress Reports" },
            ].map((chip) => (
              <span
                key={chip.label}
                className="flex items-center gap-1.5 bg-[#A8DADC]/10 border border-[#A8DADC]/20 text-[#A8DADC] text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full"
              >
                {chip.icon}
                {chip.label}
              </span>
            ))}
          </div>


          
          {/* Exercise Preview Card with AI Tracking Wireframe Overlay */}
          <div className="relative w-full max-w-lg h-[360px] rounded-3xl overflow-hidden shadow-2xl shadow-[#1D3557]/60 border-2 border-[#A8DADC]/15 group">
             
             <div className="absolute top-5 left-5 z-20 bg-[#1D3557]/80 backdrop-blur-md border border-[#A8DADC]/20 px-4 py-2 rounded-xl text-[#F1FAEE] text-[10px] uppercase font-black tracking-widest shadow-md flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E63946] animate-pulse"></span>
                AI Vision Active
             </div>

             {/* Computer Vision Nodes Overlay */}
             <svg className="absolute inset-0 w-full h-full z-10 opacity-60 mix-blend-color-dodge transition-opacity duration-500 group-hover:opacity-100" xmlns="http://www.w3.org/2000/svg">
               <g stroke="#A8DADC" strokeWidth="1.5" fill="#F1FAEE">
                  <line x1="150" y1="80" x2="160" y2="120" strokeDasharray="4 4">
                     <animate attributeName="x1" values="150; 155; 150" dur="2s" repeatCount="indefinite" />
                     <animate attributeName="y1" values="80; 85; 80" dur="2s" repeatCount="indefinite" />
                  </line>
                  <circle cx="150" cy="80" r="4">
                     <animate attributeName="cx" values="150; 155; 150" dur="2s" repeatCount="indefinite" />
                     <animate attributeName="cy" values="80; 85; 80" dur="2s" repeatCount="indefinite" />
                  </circle>
                  
                  <line x1="160" y1="120" x2="140" y2="200" strokeDasharray="4 4" />
                  <circle cx="160" cy="120" r="5" fill="#457B9D" />

                  <line x1="140" y1="200" x2="120" y2="280" strokeDasharray="4 4" />
                  <circle cx="140" cy="200" r="4" />

                  <line x1="160" y1="120" x2="200" y2="150" strokeDasharray="4 4" />
                  <circle cx="200" cy="150" r="4" />
               </g>
               {/* Facial Tracking Box */}
               <rect x="135" y="45" width="30" height="30" fill="none" stroke="#E63946" strokeWidth="2" strokeDasharray="3 3">
                  <animate attributeName="x" values="135; 140; 135" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="y" values="45; 50; 45" dur="2s" repeatCount="indefinite" />
               </rect>
             </svg>

             {/* Video Background */}
             <div className="absolute inset-0 bg-[#1D3557]">
               <video 
                 key={currentVideoIdx}
                 src={squatVideos[currentVideoIdx]}
                 autoPlay
                 muted
                 playsInline
                 onEnded={() => setCurrentVideoIdx((prev) => (prev + 1) % squatVideos.length)}
                 className="w-full h-full object-cover opacity-80"
               />
               <div className="absolute inset-0 bg-gradient-to-t from-[#1D3557]/80 to-transparent absolute mix-blend-overlay"></div>
             </div>
          </div>
        </div>

        <div className="relative z-10 mt-auto text-[#A8DADC]/60 text-xs font-semibold uppercase tracking-widest pt-8">
          &copy; {new Date().getFullYear()} PhysioCheck Platform
        </div>
      </div>

      {/* ── RIGHT PANEL: CLINICAL FORM (50%) ── */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center bg-[#F1FAEE] p-6 sm:p-12 lg:p-24 relative overflow-hidden">
        
        {/* Soft background glow circles */}
        <div className="absolute top-1/4 right-[-10%] w-96 h-96 bg-[#457B9D]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-10%] left-1/4 w-72 h-72 bg-[#A8DADC]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-[440px] w-full mx-auto relative z-10">
          
          {/* Mobile Header */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-12">
            <div className="w-12 h-12 bg-[#1D3557] rounded-xl flex items-center justify-center text-[#F1FAEE] shadow-lg">
              <Activity size={24} strokeWidth={2.5} />
            </div>
            <span className="text-3xl font-black text-[#1D3557] tracking-tight">PhysioCheck</span>
          </div>

          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-4xl font-black text-[#1D3557] mb-3 tracking-tight">Welcome back</h2>
            <p className="text-[#457B9D] text-lg font-medium">Please enter your credentials to securely access your account.</p>
          </div>

          {/* Frosted Glass Form Container */}
          <div className="bg-white/60 backdrop-blur-xl border border-white p-8 rounded-3xl shadow-xl shadow-[#1D3557]/5">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Sliding Segmented Toggle */}
              <div className="relative flex p-1.5 bg-[#F1FAEE] border border-[#A8DADC]/30 rounded-full shadow-inner mb-8 overflow-hidden">
                <div 
                  className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-[#457B9D] rounded-full shadow-md transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${role === "patient" ? "translate-x-0" : "translate-x-[calc(100%+6px)]"}`}
                ></div>
                <button
                  type="button"
                  onClick={() => setRole("patient")}
                  className={`relative z-10 flex-1 py-3 rounded-full text-[13px] uppercase tracking-widest font-black transition-colors flex items-center justify-center gap-2 ${role === "patient" ? "text-[#F1FAEE]" : "text-[#457B9D] hover:text-[#A8DADC]"}`}
                >
                  <User size={16} strokeWidth={3} /> Patient
                </button>
                <button
                  type="button"
                  onClick={() => setRole("doctor")}
                  className={`relative z-10 flex-1 py-3 rounded-full text-[13px] uppercase tracking-widest font-black transition-colors flex items-center justify-center gap-2 ${role === "doctor" ? "text-[#F1FAEE]" : "text-[#457B9D] hover:text-[#1D3557]"}`}
                >
                  <UserCircle size={16} strokeWidth={3} /> Physio
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#1D3557] block mb-2 px-1">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#457B9D]/60 transition-colors group-focus-within:text-[#457B9D]" size={20} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="name@clinic.com"
                      className="w-full pl-12 pr-4 py-3.5 bg-white border-2 border-[#F1FAEE] rounded-2xl text-[15px] focus:outline-none focus:ring-4 focus:ring-[#A8DADC]/20 focus:border-[#457B9D] transition-all font-semibold text-[#1D3557] shadow-sm"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#1D3557] flex justify-between items-center mb-2 px-1">
                    <span>Password</span>
                    <Link to="#" className="text-[#457B9D] hover:text-[#1D3557] hover:underline normal-case tracking-normal text-xs font-semibold transition-colors">Forgot password?</Link>
                  </label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#457B9D]/60 transition-colors group-focus-within:text-[#457B9D]" size={20} />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full pl-12 pr-12 py-3.5 bg-white border-2 border-[#F1FAEE] rounded-2xl text-[15px] focus:outline-none focus:ring-4 focus:ring-[#A8DADC]/20 focus:border-[#457B9D] transition-all font-semibold text-[#1D3557] shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#457B9D]/50 hover:text-[#457B9D] transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-[#E63946]/10 text-[#E63946] border border-[#E63946]/20 rounded-2xl text-sm font-bold shadow-inner">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-4 px-4 bg-[#457B9D] hover:bg-[#A8DADC] hover:text-[#1D3557] text-[#F1FAEE] rounded-2xl text-[15px] uppercase tracking-widest font-black transition-all shadow-xl shadow-[#457B9D]/30 hover:shadow-[#A8DADC]/30 hover:-translate-y-[2px] active:translate-y-[1px] disabled:opacity-70 disabled:hover:translate-y-0 disabled:active:translate-y-0 flex justify-center items-center h-[56px]"
              >
                {loading ? (
                  <div className="w-6 h-6 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  "Sign In"
                )}
              </button>
            </form>
          </div>

          {role === "patient" && (
            <p className="mt-10 text-center text-[15px] font-semibold text-[#457B9D]">
              New to PhysioCheck? {" "}
              <Link to="/register" className="text-[#E63946] hover:text-[#D62828] underline underline-offset-4 decoration-2 decoration-[#E63946]/30 transition-colors">
                Create your account
              </Link>
            </p>
          )}

        </div>
      </div>
    </div>
  );
}
