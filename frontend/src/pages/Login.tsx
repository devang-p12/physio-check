import React, { useState } from "react";
import { Activity, Mail, Lock, ArrowRight, UserCheck } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError("");

    try {
      const res = await fetch("http://localhost:5000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Login failed");
        return;
      }

      // ✅ Save auth info
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.user.role);
      localStorage.setItem("name", data.user.name);
      localStorage.setItem("userId", data.user.id);

      // ✅ Redirect based on role
      if (data.user.role === "doctor") {
        navigate("/doctor");
      } else {
        navigate("/patient");
      }
    } catch (err) {
      setError("Server error. Try again.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-teal-200/30 rounded-full blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-cyan-200/30 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="px-8 pt-10 pb-6 text-center">
          <div className="mx-auto w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center mb-4 text-teal-600">
            <Activity size={28} strokeWidth={2.5} />
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            PhysioCheck
          </h1>
          <p className="text-slate-500 text-sm">
            Smarter Physiotherapy Tracking
          </p>
        </div>

        <div className="px-8 pb-10">
          <div className="space-y-5">
            {/* Email */}
            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border rounded-lg"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border rounded-lg"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}

            <button
              onClick={handleLogin}
              className="w-full bg-teal-500 text-white py-3 rounded-lg flex items-center justify-center"
            >
              Sign In
              <ArrowRight className="ml-2" size={18} />
            </button>
          </div>

          {/* Register */}
          <div className="mt-8 text-center">
            <p className="text-slate-500 text-sm">
              Don&apos;t have an account?{" "}
              <Link
                to="/register"
                className="text-teal-600 font-semibold hover:underline"
              >
                Register
              </Link>
            </p>

            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full">
              <UserCheck size={14} />
              <span className="text-xs text-slate-500">
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
