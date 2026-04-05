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
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row md:justify-between md:items-end mb-10 gap-4">
          <div>
            <button 
              onClick={() => navigate('/patient')} 
              className="flex items-center text-teal-600 font-bold text-sm mb-4 hover:underline group"
            >
              <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
            </button>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Find a Doctor</h1>
            <p className="text-slate-500 mt-1">Browse our network of specialists and book your session.</p>
          </div>

          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search by name or email..." 
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent shadow-sm w-full md:w-64"
              />
            </div>
            <button className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 transition shadow-sm">
              <Filter size={18} /> <span className="hidden sm:inline">Filter</span>
            </button>
          </div>
        </header>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 mb-6 font-semibold">
            {error}
          </div>
        )}

        <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="py-4 px-6 text-[11px] font-black uppercase tracking-widest text-slate-500">Doctor Info</th>
                  <th className="py-4 px-6 text-[11px] font-black uppercase tracking-widest text-slate-500">Specialization</th>
                  <th className="py-4 px-6 text-[11px] font-black uppercase tracking-widest text-slate-500 hidden md:table-cell">Contact</th>
                  <th className="py-4 px-6 text-[11px] font-black uppercase tracking-widest text-slate-500 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {currentDoctors.map((doctor: any) => (
                  <tr key={doctor._id} className="hover:bg-slate-50/50 transition duration-150">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center text-teal-700 font-black shrink-0">
                          {doctor.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">Dr. {doctor.name}</p>
                          <p className="text-xs text-slate-500 md:hidden">{doctor.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-teal-600 bg-teal-50 px-3 py-1 w-fit rounded-lg">
                        <Award size={14} /> Physiotherapy
                      </div>
                    </td>
                    <td className="py-4 px-6 hidden md:table-cell">
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-2 text-xs text-slate-600"><Mail size={12} className="text-slate-400" /> {doctor.email}</span>
                        <span className="flex items-center gap-2 text-xs text-slate-600"><Phone size={12} className="text-slate-400" /> +1 (555) 000-0000</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => navigate(`/patient/book/${doctor._id}`)}
                        className="bg-slate-900 border border-slate-800 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg shadow-slate-200 hover:bg-slate-800 transition active:scale-95"
                      >
                        Book
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredDoctors.length === 0 && !error && (
              <div className="text-center py-20">
                <p className="text-slate-400 font-medium">No doctors found matching your criteria.</p>
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <span className="text-sm text-slate-500 font-medium">
                Showing <span className="font-bold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-slate-900">{Math.min(currentPage * itemsPerPage, filteredDoctors.length)}</span> of <span className="font-bold text-slate-900">{filteredDoctors.length}</span> doctors
              </span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-slate-200 rounded-lg bg-white disabled:opacity-50 hover:bg-slate-50 transition"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`w-8 h-8 rounded-lg text-sm font-bold transition ${currentPage === i + 1 ? 'bg-teal-600 text-white' : 'bg-transparent text-slate-600 hover:bg-slate-200'}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-slate-200 rounded-lg bg-white disabled:opacity-50 hover:bg-slate-50 transition"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DoctorList;