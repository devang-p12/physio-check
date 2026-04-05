import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../api";
import { ChevronLeft, UserPlus, Clipboard, CheckCircle, Mail, Phone, Calendar, Activity, User, AlertCircle, Check } from "lucide-react";

export default function AddPatient() {
  const navigate = useNavigate();
  
  // Wizard State
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Form State
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    patientEmail: "",
    phone: "",
    condition: "",
    injuryDate: "",
    affectedArea: ""
  });

  const updateForm = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError(""); // Clear error on change
  };

  const handleNext = () => {
    if (step === 1) {
      if (!form.patientEmail) return setError("Email is required for inviting the patient.");
      if (!form.patientEmail.includes("@")) return setError("Please enter a valid email address.");
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleAddPatient = async () => {
    setError("");
    setLoading(true);

    try {
      // Backend hook expects only patientEmail
      await apiFetch("/doctor/add-patient", {
        method: "POST",
        body: JSON.stringify({ patientEmail: form.patientEmail }),
      });

      // Dummy timeout for UI smoothness to show off loading state
      setTimeout(() => {
        navigate("/doctor/patients");
      }, 800);
      
    } catch (err: any) {
      setError(err.message || "Failed to add patient");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-16">
      
      {/* ── TOP NAV ── */}
      <nav className="bg-white border-b sticky top-0 z-30 h-16 flex items-center px-6">
        <div className="max-w-4xl mx-auto w-full flex items-center gap-4 text-sm font-medium">
          <Link to="/doctor/patients" className="flex items-center gap-1.5 text-slate-500 hover:text-teal-600 transition-colors">
            <ChevronLeft size={16} /> Back to Directory
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Add New Patient</h1>
          <p className="text-slate-500 mt-2">Invite a new patient and set up their initial medical profile.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          
          {/* LEFT: STEPPER */}
          <div className="w-full lg:w-64 shrink-0 bg-white border border-slate-200 rounded-[12px] p-6 shadow-sm">
            <div className="flex flex-col gap-6">
              {[
                { num: 1, title: "Personal Details", icon: UserPlus },
                { num: 2, title: "Medical History", icon: Clipboard },
                { num: 3, title: "Review & Invite", icon: CheckCircle }
              ].map(s => {
                const isActive = step === s.num;
                const isPast = step > s.num;
                return (
                  <div key={s.num} className="flex items-start gap-4 cursor-default">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
                      isActive ? 'border-teal-600 bg-teal-50 text-teal-600' :
                      isPast ? 'border-teal-500 bg-teal-500 text-white' : 'border-slate-200 bg-slate-50 text-slate-400'
                    }`}>
                      {isPast ? <Check size={14} strokeWidth={3} /> : <s.icon size={14} />}
                    </div>
                    <div>
                      <h3 className={`text-sm font-semibold ${isActive || isPast ? 'text-slate-900' : 'text-slate-400'}`}>
                        {s.title}
                      </h3>
                      <p className={`text-xs ${isActive ? 'text-teal-600 font-medium' : 'text-slate-400'}`}>
                        Step {s.num} of 3
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: FORMS */}
          <div className="flex-1 w-full relative">
            <div className="bg-white border border-slate-200 rounded-[12px] shadow-sm p-8 min-h-[400px] flex flex-col">
              
              {/* Error Banner */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-[8px] flex items-center gap-3 text-sm">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {/* STEP 1 */}
              {step === 1 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <h2 className="text-xl font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4">Personal Details</h2>
                  
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">First Name</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input
                            type="text"
                            placeholder="John"
                            value={form.firstName}
                            onChange={(e) => updateForm('firstName', e.target.value)}
                            className="w-full pl-9 pr-4 h-11 bg-slate-50 border border-slate-200 rounded-[8px] text-sm focus:bg-white focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Last Name</label>
                        <input
                          type="text"
                          placeholder="Doe"
                          value={form.lastName}
                          onChange={(e) => updateForm('lastName', e.target.value)}
                          className="w-full px-4 h-11 bg-slate-50 border border-slate-200 rounded-[8px] text-sm focus:bg-white focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          type="email"
                          placeholder="patient@example.com"
                          required
                          value={form.patientEmail}
                          onChange={(e) => updateForm('patientEmail', e.target.value)}
                          className="w-full pl-9 pr-4 h-11 bg-slate-50 border border-slate-200 rounded-[8px] text-sm focus:bg-white focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1.5">An invitation link will be sent to this email address.</p>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Phone Number</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          type="tel"
                          placeholder="+1 (555) 000-0000"
                          value={form.phone}
                          onChange={(e) => updateForm('phone', e.target.value)}
                          className="w-full pl-9 pr-4 h-11 bg-slate-50 border border-slate-200 rounded-[8px] text-sm focus:bg-white focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <h2 className="text-xl font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4">Medical History</h2>
                  
                  <div className="space-y-5">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Primary Condition / Diagnosis</label>
                      <div className="relative">
                        <Activity className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          type="text"
                          placeholder="e.g. Post-operative ACL reconstruction"
                          value={form.condition}
                          onChange={(e) => updateForm('condition', e.target.value)}
                          className="w-full pl-9 pr-4 h-11 bg-slate-50 border border-slate-200 rounded-[8px] text-sm focus:bg-white focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Date of Injury / Surgery</label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input
                            type="date"
                            value={form.injuryDate}
                            onChange={(e) => updateForm('injuryDate', e.target.value)}
                            className="w-full pl-9 pr-4 h-11 bg-slate-50 border border-slate-200 rounded-[8px] text-sm focus:bg-white focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-slate-600"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Affected Area</label>
                        <select
                          value={form.affectedArea}
                          onChange={(e) => updateForm('affectedArea', e.target.value)}
                          className="w-full px-4 h-11 bg-slate-50 border border-slate-200 rounded-[8px] text-sm focus:bg-white focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-slate-600"
                        >
                          <option value="">Select an area...</option>
                          <option value="Knee">Knee</option>
                          <option value="Shoulder">Shoulder</option>
                          <option value="Hip">Hip</option>
                          <option value="Ankle">Ankle</option>
                          <option value="Back">Back</option>
                          <option value="Neck">Neck</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <h2 className="text-xl font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4">Review & Invite</h2>
                  
                  <div className="bg-slate-50 border border-slate-200 rounded-[12px] p-6 space-y-6">
                    <div className="flex items-center gap-4 border-b border-slate-200 pb-6">
                      <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-700 font-bold flex items-center justify-center text-lg border border-teal-200">
                        {(form.firstName || form.patientEmail).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">
                          {form.firstName || form.lastName ? `${form.firstName} ${form.lastName}` : 'Unspecified Name'}
                        </h3>
                        <p className="text-slate-500 font-medium text-sm">{form.patientEmail}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-y-4">
                      <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Phone Number</p>
                        <p className="text-sm font-medium text-slate-800 mt-1">{form.phone || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Condition</p>
                        <p className="text-sm font-medium text-slate-800 mt-1">{form.condition || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Injury Date</p>
                        <p className="text-sm font-medium text-slate-800 mt-1">{form.injuryDate || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Affected Area</p>
                        <p className="text-sm font-medium text-slate-800 mt-1">{form.affectedArea || '—'}</p>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-slate-500 mt-6 bg-blue-50 text-blue-700 p-4 rounded-[8px] border border-blue-100">
                    Clicking <strong>Send Invite</strong> will create a new patient record and send them an email with instructions on how to access PhysioCheck and securely log in.
                  </p>
                </div>
              )}

              {/* NAVIGATION BUTTONS */}
              <div className="mt-auto pt-8 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  disabled={step === 1 || loading}
                  className={`px-6 h-11 border border-slate-200 rounded-[8px] font-medium text-sm transition-colors ${
                    step === 1 || loading ? 'opacity-0 cursor-default' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Back
                </button>
                
                {step < 3 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-8 h-11 bg-slate-900 text-white rounded-[8px] font-medium text-sm hover:bg-slate-800 transition-colors shadow-sm"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleAddPatient}
                    disabled={loading}
                    className="px-8 h-11 bg-teal-600 text-white rounded-[8px] font-medium text-sm hover:bg-teal-700 transition-all flex items-center gap-2 shadow-sm shadow-teal-600/30 disabled:opacity-70"
                  >
                    {loading ? (
                       <>
                         <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                         Inviting...
                       </>
                    ) : (
                      <>
                        <Mail size={16} /> Send Invite
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
