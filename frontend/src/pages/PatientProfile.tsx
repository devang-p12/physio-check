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
    <div className="page-content">
      <main className="max-w-4xl mx-auto py-6">
        <div className="p-card flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg transition"
            style={{ color: 'var(--p-text-secondary)', background: 'var(--p-bg-surface)', border: '1px solid var(--p-border)' }}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--p-text-primary)' }}>My Medical Profile</h1>
        </div>
         {/* ID Card */}
         <div className="p-card rounded-3xl p-8 shadow-sm relative overflow-hidden"
           style={{ background: 'var(--p-bg-surface)', border: '1px solid var(--p-border)' }}>
            <div className="absolute top-0 left-0 w-full h-32"
              style={{ background: 'linear-gradient(90deg, var(--p-navy) 0%, var(--p-blue) 55%, var(--p-mint) 100%)' }} />
            
            <div className="relative pt-12 sm:pt-4 flex flex-col sm:flex-row items-center sm:items-end gap-6 sm:gap-8">
               <div className="w-32 h-32 rounded-full border-4 border-white bg-slate-100 shadow-lg overflow-hidden shrink-0 bg-teal-50 flex items-center justify-center">
                 <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${patientData.name}`} alt="Avatar" className="w-full h-full object-cover" />
               </div>
               
               <div className="text-center sm:text-left flex-1 pb-2">
                 <h2 className="text-3xl font-black tracking-tight" style={{ color: 'var(--p-text-primary)' }}>{patientData.name}</h2>
                 <p className="font-medium text-lg mt-1 flex items-center justify-center sm:justify-start gap-2" style={{ color: 'var(--p-text-secondary)' }}>
                   <Mail size={16} /> {patientData.email}
                 </p>
               </div>

               <div className="hidden sm:block pb-2">
                 <span className="px-4 py-2 text-sm font-bold uppercase tracking-widest rounded-xl"
                   style={{ background: 'var(--p-bg-active)', color: 'var(--p-text-primary)', border: '1px solid var(--p-border)' }}>
                   Active Patient
                 </span>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12 p-6 rounded-2xl"
              style={{ background: 'var(--p-bg-surface2)', border: '1px solid var(--p-border)' }}>
               <div>
                  <h3 className="text-[11px] font-black uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: 'var(--p-text-muted)' }}>
                    <User size={14} /> Personal Details
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-medium" style={{ color: 'var(--p-text-muted)' }}>Date of Birth</p>
                      <p className="font-semibold" style={{ color: 'var(--p-text-primary)' }}>{patientData.dob}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium" style={{ color: 'var(--p-text-muted)' }}>Physical Metrics</p>
                      <p className="font-semibold" style={{ color: 'var(--p-text-primary)' }}>{patientData.height} • {patientData.weight} • Blood {patientData.bloodType}</p>
                    </div>
                  </div>
               </div>

               <div>
                  <h3 className="text-[11px] font-black uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: 'var(--p-text-muted)' }}>
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
