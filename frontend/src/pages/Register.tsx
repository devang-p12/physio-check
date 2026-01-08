import React, { useState } from "react";
import {
  Activity,
  Mail,
  Lock,
  User,
  Stethoscope,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";

const RegisterPage = () => {
  const [role, setRole] = useState("patient");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async () => {
    setError("");

    try {
      const res = await fetch("http://localhost:5000/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Registration failed");
        return;
      }

      // After successful registration → go to login
      navigate("/login");
    } catch (err) {
      setError("Server error. Try again.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-teal-200/30 rounded-full blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-cyan-200/30 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="px-8 pt-8 pb-4 text-center">
          <div className="mx-auto w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center mb-3 text-teal-600">
            <Activity size={24} strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Join PhysioCheck
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Start your recovery or practice today.
          </p>
        </div>

        <div className="px-8 pb-10 space-y-5">
          {/* ROLE SELECT */}
          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase">
              I am a...
            </label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                type="button"
                onClick={() => setRole("patient")}
                className={`p-4 rounded-xl border-2 ${
                  role === "patient"
                    ? "border-teal-500 bg-teal-50"
                    : "border-slate-100"
                }`}
              >
                <User className="mx-auto mb-2" />
                Patient
              </button>

              <button
                type="button"
                onClick={() => setRole("doctor")}
                className={`p-4 rounded-xl border-2 ${
                  role === "doctor"
                    ? "border-teal-500 bg-teal-50"
                    : "border-slate-100"
                }`}
              >
                <Stethoscope className="mx-auto mb-2" />
                Physio
              </button>
            </div>
          </div>

          {/* NAME */}
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            onChange={handleInputChange}
            className="w-full px-4 py-3 border rounded-lg"
          />

          {/* EMAIL */}
          <input
            type="email"
            name="email"
            placeholder="Email Address"
            onChange={handleInputChange}
            className="w-full px-4 py-3 border rounded-lg"
          />

          {/* PASSWORD */}
          <input
            type="password"
            name="password"
            placeholder="Password"
            onChange={handleInputChange}
            className="w-full px-4 py-3 border rounded-lg"
          />

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          {/* REGISTER */}
          <button
            onClick={handleRegister}
            className="w-full bg-teal-500 hover:bg-teal-600 text-white py-3 rounded-lg flex items-center justify-center"
          >
            Create Account
            <ArrowRight className="ml-2" size={18} />
          </button>

          {/* LOGIN LINK */}
          <p className="text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-teal-600 font-semibold hover:underline"
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
