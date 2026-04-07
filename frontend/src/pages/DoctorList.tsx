import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, ChevronLeft, ChevronRight, Mail, Phone, Award } from 'lucide-react';

const DoctorList = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  
  // Search, Filter & Pagination states
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const res = await fetch("http://localhost:5000/patient", {
          headers: { 
            "Authorization": `Bearer ${token}` 
          }
        });
        
        const data = await res.json();
        
        if (data.success) {
          setDoctors(data.doctors);
        } else {
          setError(data.message || "Failed to load doctors");
        }
      } catch (err) {
        setError("Connection error. Is the backend running?");
      } finally {
        setLoading(false);
      }
    };

    fetchDoctors();
  }, [token]);

  // Filtering Logic
  const filteredDoctors = doctors.filter((doc: any) => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination Logic
  const totalPages = Math.ceil(filteredDoctors.length / itemsPerPage);
  const currentDoctors = filteredDoctors.slice(
    (currentPage - 1) * itemsPerPage, 
    currentPage * itemsPerPage
  );

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500"></div>
    </div>
  );

  return (
    <div className="min-h-screen font-sans bg-[#F1FAEE] pb-24">
      
      {/* ── DEEP OCEAN HEADER BANNER ── */}
      <section className="relative w-full bg-gradient-to-br from-[#1D3557] via-[#1D3557] to-[#457B9D] px-6 py-12 md:px-12 md:py-16 overflow-hidden rounded-b-[3rem] shadow-2xl shadow-[#1D3557]/20 mb-12">
        
        {/* SVG Nodes Grid Background */}
        <div className="absolute top-[-20%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#A8DADC]/10 via-transparent to-transparent z-0 opacity-80" />
        <svg className="absolute inset-0 w-full h-full z-0 opacity-20 mix-blend-color-dodge transition-opacity duration-500" xmlns="http://www.w3.org/2000/svg">
          <g stroke="#A8DADC" strokeWidth="1.5" fill="#F1FAEE">
             <line x1="20%" y1="10%" x2="50%" y2="80%" strokeDasharray="4 4" />
             <circle cx="20%" cy="10%" r="5" />
             <line x1="50%" y1="80%" x2="80%" y2="40%" strokeDasharray="4 4" />
             <circle cx="50%" cy="80%" r="6" fill="#457B9D" />
             <circle cx="80%" cy="40%" r="5" />
          </g>
        </svg>

        <div className="max-w-6xl mx-auto relative z-10">
          <button 
            onClick={() => navigate('/patient')} 
            className="flex items-center text-[#A8DADC] font-bold text-sm mb-6 hover:text-white transition-colors group"
          >
            <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
          </button>
          
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-[#F1FAEE] tracking-tight mb-2">Find a Specialist</h1>
              <p className="text-[#A8DADC] text-lg max-w-md">Browse our elite network of clinicians and secure your session immediately.</p>
            </div>

            {/* Glassmorphism Search Bar */}
            <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#457B9D]/60 transition-colors group-focus-within:text-[#457B9D]" size={18} />
                <input 
                  type="text" 
                  placeholder="Search by name or email..." 
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full sm:w-72 pl-12 pr-4 py-3.5 bg-white border-2 border-transparent rounded-2xl text-[15px] focus:outline-none focus:ring-4 focus:ring-[#A8DADC]/40 focus:border-[#457B9D] transition-all font-semibold text-[#1D3557] shadow-xl shadow-[#1D3557]/10"
                />
              </div>
              <button className="flex items-center justify-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-6 py-3.5 rounded-2xl font-bold text-white hover:bg-white/20 transition-all shadow-xl shadow-[#1D3557]/10 active:scale-95">
                <Filter size={18} /> <span className="hidden sm:inline">Filter</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 md:px-12">
        {error && (
          <div className="bg-[#E63946]/10 text-[#E63946] border border-[#E63946]/20 p-4 rounded-2xl mb-8 font-bold flex items-center justify-center">
            {error}
          </div>
        )}

        {/* ── DOCTORS GRID ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentDoctors.map((doctor: any) => (
            <div key={doctor._id} className="bg-white rounded-[2rem] p-6 shadow-xl shadow-[#1D3557]/[0.04] border border-[#1D3557]/5 flex flex-col hover:-translate-y-1.5 transition-transform duration-300 relative overflow-hidden group">
              
              {/* Subtle accent hover glow */}
              <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-[#457B9D] to-[#A8DADC] opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 bg-[#457B9D]/10 rounded-2xl flex items-center justify-center text-[#457B9D] text-xl font-black shrink-0 border border-[#457B9D]/20">
                  {doctor.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-black text-[#1D3557] text-xl line-clamp-1">Dr. {doctor.name}</h3>
                  <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#A8DADC] mt-1">
                    <Award size={14} className="text-[#457B9D]" /> Physiotherapist
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 mb-8">
                <div className="flex items-center gap-3 px-4 py-2.5 bg-[#F1FAEE] rounded-xl border border-[#A8DADC]/30">
                  <Mail size={16} className="text-[#457B9D]" />
                  <span className="text-sm font-semibold text-[#1D3557] line-clamp-1">{doctor.email}</span>
                </div>
                <div className="flex items-center gap-3 px-4 py-2.5 bg-[#F1FAEE] rounded-xl border border-[#A8DADC]/30">
                   <Phone size={16} className="text-[#457B9D]" />
                   <span className="text-sm font-semibold text-[#1D3557]">+1 (555) 000-0000</span>
                </div>
              </div>

              <div className="mt-auto">
                <button
                  onClick={() => navigate(`/patient/book/${doctor._id}`)}
                  className="w-full bg-[#457B9D] hover:bg-[#A8DADC] hover:text-[#1D3557] text-[#F1FAEE] py-3.5 rounded-xl text-[14px] uppercase tracking-widest font-black shadow-lg shadow-[#457B9D]/30 hover:shadow-[#A8DADC]/40 transition-all hover:-translate-y-0.5 active:translate-y-0 text-center flex justify-center items-center gap-2"
                >
                  Book Session
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredDoctors.length === 0 && !error && (
          <div className="text-center py-20 bg-white rounded-[2rem] border border-[#1D3557]/5 shadow-xl shadow-[#1D3557]/[0.02]">
            <Search className="mx-auto text-[#A8DADC] mb-4" size={48} />
            <p className="text-[#457B9D] font-bold text-lg">No clinicians found matching your criteria.</p>
            <p className="text-[#1D3557]/50 mt-1">Try adjusting your search terms or filters.</p>
          </div>
        )}

        {/* ── PAGINATION CONTROLS ── */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-12 bg-white px-6 py-5 rounded-[2rem] shadow-lg shadow-[#1D3557]/[0.02] border border-[#1D3557]/5">
            <span className="text-sm text-[#457B9D] font-bold">
              Showing <span className="text-[#1D3557]">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-[#1D3557]">{Math.min(currentPage * itemsPerPage, filteredDoctors.length)}</span> of <span className="text-[#1D3557]">{filteredDoctors.length}</span> doctors
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-10 h-10 flex items-center justify-center border-2 border-[#F1FAEE] rounded-xl bg-white text-[#457B9D] disabled:opacity-40 hover:border-[#A8DADC] hover:text-[#1D3557] transition-all font-bold"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-10 h-10 rounded-xl text-[14px] font-black transition-all ${currentPage === i + 1 ? 'bg-[#1D3557] text-white shadow-md shadow-[#1D3557]/30' : 'bg-transparent text-[#457B9D] hover:bg-[#F1FAEE]'}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-10 h-10 flex items-center justify-center border-2 border-[#F1FAEE] rounded-xl bg-white text-[#457B9D] disabled:opacity-40 hover:border-[#A8DADC] hover:text-[#1D3557] transition-all font-bold"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default DoctorList;