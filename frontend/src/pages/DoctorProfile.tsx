import React, { useEffect, useState } from "react";
import { User, Mail, Calendar, MapPin, Award, ArrowLeft, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const DoctorProfile = () => {
  const navigate = useNavigate();
  const [docData, setDocData] = useState<any>(null);

  useEffect(() => {
    const name = localStorage.getItem("name") || "Specialist";
    const email = localStorage.getItem("email") || "doctor@clinic.com";
    
    setDocData({
      name,
      email,
      specialty: "Orthopedic Physiotherapist",
      license: "MD-PHYS-99201",
      experience: "12+ Years",
      clinic: "Apex Care Center",
      address: "400 Medical Plaza, Suite 2",
      joinDate: "June 2020"
    });
  }, []);

  if (!docData) return null;

  return (
    <div className="page-content font-sans pb-12">

      <main className="max-w-4xl mx-auto px-6 py-12">
         {/* Clinical Card */}
         <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-32 bg-slate-900"></div>
            
            <div className="relative pt-12 sm:pt-4 flex flex-col sm:flex-row items-center sm:items-end gap-6 sm:gap-8">
               <div className="w-32 h-32 rounded-full border-4 border-white bg-slate-100 shadow-lg overflow-hidden shrink-0 flex items-center justify-center">
                 <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${docData.name}`} alt="Avatar" className="w-full h-full object-cover" />
               </div>
               
               <div className="text-center sm:text-left flex-1 pb-2">
                 <h2 className="text-3xl font-black text-slate-900 tracking-tight">Dr. {docData.name}</h2>
                 <p className="text-teal-600 font-bold text-lg mt-1">
                   {docData.specialty}
                 </p>
                 <p className="text-slate-500 font-medium mt-1 flex items-center justify-center sm:justify-start gap-2">
                   <Mail size={16} /> {docData.email}
                 </p>
               </div>

               <div className="hidden sm:block pb-2">
                 <span className="bg-slate-100 text-slate-700 px-4 py-2 text-sm font-bold uppercase tracking-widest rounded-xl border border-slate-200">
                   Verified Provider
                 </span>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12 bg-slate-50 p-6 rounded-2xl border border-slate-100">
               <div>
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Award size={14} /> Professional Credentials
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">License / NPI Number</p>
                      <p className="font-bold text-slate-800">{docData.license}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Clinical Experience</p>
                      <p className="font-bold text-slate-800">{docData.experience}</p>
                    </div>
                  </div>
               </div>

               <div>
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Building2 size={14} /> Facility Details
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Primary Clinic</p>
                      <p className="font-bold text-slate-800">
                        {docData.clinic} <br/>
                        <span className="text-sm text-slate-500 font-normal">{docData.address}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Platform Onboarding</p>
                      <p className="font-bold text-slate-800 flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400" /> {docData.joinDate}
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

export default DoctorProfile;
