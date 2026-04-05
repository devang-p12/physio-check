import React, { useEffect, useState } from "react";
import { User, Mail, Calendar, MapPin, Activity, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PatientProfile = () => {
  const navigate = useNavigate();
  const [patientData, setPatientData] = useState<any>(null);

  useEffect(() => {
    // In a real app, this would fetch from /patient/profile
    const name = localStorage.getItem("name") || "Patient";
    const email = localStorage.getItem("email") || "patient@example.com";
    
    setPatientData({
      name,
      email,
      dob: "January 15, 1985",
      bloodType: "O+",
      height: "175 cm",
      weight: "70 kg",
      address: "123 Recovery Lane, Medical District",
      joinDate: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    });
  }, []);

  if (!patientData) return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-12">
      <nav className="bg-white px-6 h-16 flex items-center border-b border-slate-100 sticky top-0 z-30 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-500 hover:text-teal-600 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-slate-900 ml-4">My Medical Profile</h1>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
         {/* ID Card */}
         <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-teal-500 to-emerald-400"></div>
            
            <div className="relative pt-12 sm:pt-4 flex flex-col sm:flex-row items-center sm:items-end gap-6 sm:gap-8">
               <div className="w-32 h-32 rounded-full border-4 border-white bg-slate-100 shadow-lg overflow-hidden shrink-0 bg-teal-50 flex items-center justify-center">
                 <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${patientData.name}`} alt="Avatar" className="w-full h-full object-cover" />
               </div>
               
               <div className="text-center sm:text-left flex-1 pb-2">
                 <h2 className="text-3xl font-black text-slate-900 tracking-tight">{patientData.name}</h2>
                 <p className="text-slate-500 font-medium text-lg mt-1 flex items-center justify-center sm:justify-start gap-2">
                   <Mail size={16} /> {patientData.email}
                 </p>
               </div>

               <div className="hidden sm:block pb-2">
                 <span className="bg-teal-50 text-teal-700 px-4 py-2 text-sm font-bold uppercase tracking-widest rounded-xl border border-teal-100">
                   Active Patient
                 </span>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12 bg-slate-50 p-6 rounded-2xl border border-slate-100">
               <div>
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <User size={14} /> Personal Details
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Date of Birth</p>
                      <p className="font-bold text-slate-800">{patientData.dob}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Physical Metrics</p>
                      <p className="font-bold text-slate-800">{patientData.height} • {patientData.weight} • Blood {patientData.bloodType}</p>
                    </div>
                  </div>
               </div>

               <div>
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <MapPin size={14} /> Contact Details
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Address</p>
                      <p className="font-bold text-slate-800">{patientData.address}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Member Since</p>
                      <p className="font-bold text-slate-800 flex items-center gap-2 border border-slate-200 inline-flex px-3 py-1 rounded-lg mt-1 bg-white">
                        <Calendar size={14} className="text-teal-500" /> {patientData.joinDate}
                      </p>
                    </div>
                  </div>
               </div>
            </div>
         </div>
      </main>
    </div>
  );
};

export default PatientProfile;
