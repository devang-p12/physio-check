import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';
import { 
  Users, 
  Search, 
  UserPlus, 
  Eye, 
  Dumbbell, 
  BarChart2, 
  ChevronDown, 
  ChevronUp, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  Filter,
  ArrowRight,
  LayoutGrid,
  List as ListIcon,
  Activity,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import PageLoader from '../components/PageLoader';

function formatLastActive(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

type SortField = 'name' | 'lastActive' | 'sessions';
type SortOrder = 'asc' | 'desc';
type StatusFilter = 'all' | 'active' | 'none';

const DoctorPatientDirectory = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search, Filter, Sort, Pagination states
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/doctor/patients");
      setPatients(data.patients || []);
    } catch (err) {
      console.error("Failed to fetch patients", err);
    }
    setLoading(false);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const processedPatients = useMemo(() => {
    let result = [...patients];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q));
    }

    if (statusFilter === 'active') {
      result = result.filter(p => (p.activePlans || 0) > 0);
    } else if (statusFilter === 'none') {
      result = result.filter(p => (p.activePlans || 0) === 0);
    }

    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'sessions') {
        comparison = (a.totalSessions || 0) - (b.totalSessions || 0);
      } else if (sortField === 'lastActive') {
        const timeA = a.lastOnline ? new Date(a.lastOnline).getTime() : 0;
        const timeB = b.lastOnline ? new Date(b.lastOnline).getTime() : 0;
        comparison = timeA - timeB;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [patients, search, statusFilter, sortField, sortOrder]);

  const totalPages = Math.ceil(processedPatients.length / itemsPerPage);
  const currentBatch = processedPatients.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown size={14} className="text-[#A8DADC] opacity-0 group-hover:opacity-100 transition-opacity" />;
    return sortOrder === 'asc' ? <ChevronUp size={14} className="text-[#1D3557]" /> : <ChevronDown size={14} className="text-[#1D3557]" />;
  };

  const revealRefs = useRef<Array<HTMLDivElement | HTMLTableRowElement | null>>([]);
  useEffect(() => {
    const els = revealRefs.current.filter(Boolean) as (HTMLDivElement | HTMLTableRowElement)[];
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add('visible');
      });
    }, { threshold: 0.1 });
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [loading, currentPage, processedPatients.length]);

  return (
    <div className="min-h-screen font-sans bg-[#F1FAEE] overflow-x-hidden pb-16">
      <PageLoader visible={loading} />
      
      {/* ── HERO BANNER: DEEP OCEAN ── */}
      <section className="relative w-full bg-gradient-to-br from-[#1D3557] via-[#1D3557] to-[#457B9D] px-6 py-6 md:px-12 md:py-8 lg:px-24 rounded-b-[4rem] shadow-2xl shadow-[#1D3557]/20">
        
        {/* Medical Nodes Background */}
        <div className="absolute top-[-20%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#A8DADC]/10 via-transparent to-transparent z-0 opacity-80" />
        <div className="absolute inset-0 z-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(168,218,220,1) 1px, transparent 1px), linear-gradient(90deg, rgba(168,218,220,1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <svg className="absolute inset-0 w-full h-full z-0 opacity-20 mix-blend-color-dodge" xmlns="http://www.w3.org/2000/svg">
          <g stroke="#A8DADC" strokeWidth="1.5" fill="#F1FAEE">
             <line x1="20%" y1="20%" x2="50%" y2="50%" strokeDasharray="4 4" />
             <circle cx="20%" cy="20%" r="4" />
             <line x1="50%" y1="50%" x2="80%" y2="30%" strokeDasharray="4 4" />
             <circle cx="50%" cy="50%" r="5" fill="#457B9D" />
             <circle cx="80%" cy="30%" r="4" />
          </g>
        </svg>

        <div className="relative z-10 max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2 bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-xl w-fit">
              <Users size={16} className="text-[#A8DADC]" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A8DADC]">Clinical Database</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-[#F1FAEE] tracking-tight">Patient Directory</h1>
            <p className="text-[#A8DADC] text-base font-medium mt-1 max-w-md">Manage records, track adherence, and assign recovery protocols.</p>
          </div>

          {/* Quick Stats Floating Chips */}
          <div className="flex flex-wrap gap-3">
             <div className="bg-white/10 backdrop-blur-xl border border-white/20 px-5 py-3 rounded-2xl shadow-xl shadow-[#1D3557]/30 group transition-all hover:bg-white/15">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#A8DADC] mb-0.5">Total Patients</p>
                <p className="text-2xl font-black text-[#F1FAEE] group-hover:scale-110 transition-transform origin-left">{patients.length}</p>
             </div>
             <button
                onClick={() => navigate('/doctor/add-patient')}
                className="bg-[#E63946] hover:bg-[#D62828] text-white px-6 py-3 rounded-2xl text-[12px] uppercase tracking-widest font-black transition-all shadow-xl shadow-[#E63946]/40 hover:-translate-y-[2px] active:translate-y-[1px] flex items-center gap-2 self-center"
              >
                <UserPlus size={16} /> Add Patient
             </button>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-6 md:px-12 lg:px-24 -mt-6 relative z-20">
        
        {/* ── FLOATING FILTER TOOLBAR ── */}
        <div className="bg-white/80 backdrop-blur-xl border border-white/40 p-2.5 rounded-[2rem] shadow-2xl flex flex-col xl:flex-row items-center justify-between gap-4 mb-8 ring-8 ring-[#1D3557]/[0.02]">
           
           <div className="flex flex-col sm:flex-row items-center gap-2 w-full xl:w-auto">
             <div className="relative w-full sm:w-72 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#457B9D]/60 transition-colors group-focus-within:text-[#1D3557]" size={16} />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-11 pr-4 py-2.5 bg-[#F1FAEE]/50 border-2 border-[#A8DADC]/30 rounded-2xl text-sm font-semibold text-[#1D3557] focus:outline-none focus:border-[#457B9D] transition-all placeholder:text-[#457B9D]/40"
                />
             </div>
             
             <div className="flex items-center gap-2 bg-[#F1FAEE]/50 px-4 py-2 rounded-2xl border-2 border-[#A8DADC]/30">
               <Filter size={14} className="text-[#457B9D]" />
               <select
                 value={statusFilter}
                 onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setCurrentPage(1); }}
                 className="bg-transparent text-[#1D3557] text-[11px] font-black uppercase tracking-widest focus:outline-none min-w-[110px] cursor-pointer"
               >
                 <option value="all">All Records</option>
                 <option value="active">Active Plans</option>
                 <option value="none">No Records</option>
               </select>
             </div>
           </div>

           <div className="flex items-center gap-2.5">
             <div className="flex p-1 bg-[#F1FAEE] rounded-xl border-2 border-[#A8DADC]/20">
                <button 
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-[#457B9D]' : 'text-[#A8DADC] hover:text-[#457B9D]'}`}
                >
                  <ListIcon size={16} />
                </button>
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-[#457B9D]' : 'text-[#A8DADC] hover:text-[#457B9D]'}`}
                >
                  <LayoutGrid size={16} />
                </button>
             </div>
             <div className="h-6 w-[2px] bg-[#A8DADC]/30 mx-1 hidden sm:block" />
             <select
               value={`${sortField}-${sortOrder}`}
               onChange={(e) => {
                 const [f, o] = e.target.value.split('-');
                 setSortField(f as SortField);
                 setSortOrder(o as SortOrder);
               }}
               className="bg-white border-2 border-[#A8DADC]/30 text-[#1D3557] text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl focus:outline-none focus:border-[#1D3557] transition-all cursor-pointer"
             >
               <option value="name-asc">A-Z Name</option>
               <option value="lastActive-desc">Last Active</option>
               <option value="sessions-desc">High Sessions</option>
             </select>
           </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div className="bg-white rounded-[2.5rem] border border-[#1D3557]/5 shadow-2xl shadow-[#1D3557]/[0.03] overflow-hidden min-h-[500px] flex flex-col transition-all duration-500">
          
          {loading ? (
             <div className="flex flex-col items-center justify-center py-40 gap-4">
                <div className="w-10 h-10 border-4 border-[#A8DADC]/20 border-t-[#457B9D] rounded-full animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A8DADC]">Loading Clinical Data</p>
             </div>
          ) : currentBatch.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-40 text-center px-4 gap-6">
              <div className="w-20 h-20 bg-[#F1FAEE] rounded-3xl flex items-center justify-center text-[#A8DADC]">
                <Users size={40} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-xl font-black text-[#1D3557]">No Clinical Records Found</p>
                <p className="text-[#457B9D] mt-1.5 max-w-sm mx-auto font-medium text-sm">Try adjusting your filters or add a new patient.</p>
              </div>
              <button
                onClick={() => navigate('/doctor/add-patient')}
                className="bg-[#1D3557] text-white px-6 py-3 rounded-2xl text-[12px] font-black uppercase tracking-widest hover:bg-[#457B9D] transition shadow-lg"
              >
                Add New Patient
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            /* ── GRID VIEW ── */
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 flex-1 bg-[#F1FAEE]/20">
               {currentBatch.map((p, idx) => {
                  const hasActive = (p.activePlans || 0) > 0;
                  const adherencePct = typeof p.adherenceRate === 'number' ? p.adherenceRate : Math.min(100, Math.max(0, 42 + (p.streak || 0)*8));
                  return (
                    <div 
                      key={p.id}
                      ref={(el) => { revealRefs.current[idx] = el; }}
                      className="group bg-white rounded-[2rem] p-5 border border-[#1D3557]/5 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative"
                    >
                       <div className="flex items-center gap-3 mb-4">
                          <div className="relative">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#1D3557] to-[#457B9D] flex items-center justify-center text-[#A8DADC] text-base font-black">
                              {p.name.charAt(0).toUpperCase()}
                            </div>
                            <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${adherencePct > 70 ? 'bg-emerald-500' : adherencePct > 40 ? 'bg-amber-400' : 'bg-[#E63946]'}`} />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-black text-[#1D3557] truncate">{p.name}</h4>
                            <p className="text-[9px] font-bold text-[#457B9D] truncate uppercase tracking-widest">{p.email.split('@')[0]}</p>
                          </div>
                       </div>

                       <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="bg-[#F1FAEE] p-2 rounded-xl">
                             <p className="text-[8px] font-black text-[#A8DADC] uppercase tracking-widest">Plans</p>
                             <p className="text-xs font-black text-[#1D3557]">{p.activePlans || 0} Active</p>
                          </div>
                          <div className="bg-[#F1FAEE] p-2 rounded-xl">
                             <p className="text-[8px] font-black text-[#A8DADC] uppercase tracking-widest">Sessions</p>
                             <p className="text-xs font-black text-[#1D3557]">{p.totalSessions || 0} Total</p>
                          </div>
                       </div>

                       <div className="mb-4">
                         <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] font-black text-[#457B9D] uppercase tracking-widest">Recovery Rate</span>
                            <span className="text-[9px] font-black text-[#1D3557]">{adherencePct}%</span>
                         </div>
                         <div className="h-1.5 w-full bg-[#F1FAEE] rounded-full overflow-hidden border border-[#A8DADC]/10">
                            <div 
                              className={`h-full rounded-full transition-all duration-1000 ${adherencePct >= 80 ? 'bg-emerald-500' : adherencePct >= 50 ? 'bg-amber-400' : 'bg-[#E63946]'}`}
                              style={{ width: `${adherencePct}%` }}
                            />
                         </div>
                       </div>

                       <div className="flex items-center gap-2">
                          <button 
                            onClick={() => navigate(`/doctor/patient/${p.id}`)}
                            className="flex-1 bg-[#1D3557] text-[#F1FAEE] py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[#457B9D] transition-all"
                          >
                             Profile
                          </button>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => navigate(`/doctor/assign?patientId=${p.id}`)}
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#457B9D]/10 text-[#457B9D] hover:bg-[#457B9D] hover:text-[#F1FAEE] transition-all"
                            >
                               <Dumbbell size={15} />
                            </button>
                            <button 
                              onClick={() => navigate(`/doctor/patient/${p.id}/report`)}
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#A8DADC]/20 text-[#1D3557] hover:bg-[#1D3557] hover:text-[#F1FAEE] transition-all"
                            >
                               <BarChart2 size={15} />
                            </button>
                          </div>
                       </div>
                    </div>
                  );
               })}
            </div>
          ) : (
            /* ── TABLE VIEW ── */
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#F1FAEE]/50 border-b border-[#A8DADC]/20">
                    <th 
                      onClick={() => handleSort('name')}
                      className="py-4 px-8 text-[10px] font-black uppercase tracking-[0.15em] text-[#457B9D] cursor-pointer group hover:bg-[#F1FAEE] transition-colors"
                    >
                      Patient <SortIcon field="name" />
                    </th>
                    <th className="py-4 px-6 text-[10px] font-black uppercase tracking-[0.15em] text-[#457B9D]">
                      Protocols
                    </th>
                    <th 
                      onClick={() => handleSort('sessions')}
                      className="py-4 px-6 text-[10px] font-black uppercase tracking-[0.15em] text-[#457B9D] cursor-pointer group hover:bg-[#F1FAEE] transition-colors"
                    >
                      Sessions <SortIcon field="sessions" />
                    </th>
                    <th 
                      onClick={() => handleSort('lastActive')}
                      className="py-4 px-6 text-[10px] font-black uppercase tracking-[0.15em] text-[#457B9D] cursor-pointer group hover:bg-[#F1FAEE] transition-colors hidden lg:table-cell"
                    >
                      Activity <SortIcon field="lastActive" />
                    </th>
                    <th className="py-4 px-6 text-[10px] font-black uppercase tracking-[0.15em] text-[#457B9D] hidden xl:table-cell">
                      Recovery Rate
                    </th>
                    <th className="py-4 px-8 text-[10px] font-black uppercase tracking-[0.15em] text-[#457B9D] text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#A8DADC]/10">
                  {currentBatch.map((p, idx) => {
                    const hasActive = (p.activePlans || 0) > 0;
                    const adherencePct = typeof p.adherenceRate === 'number' ? p.adherenceRate : Math.min(100, Math.max(0, 42 + (p.streak || 0)*8));

                    return (
                      <tr key={p.id} 
                        ref={(el) => { revealRefs.current[idx] = el; }}
                        onClick={(e) => { 
                          if ((e.target as HTMLElement).closest('button')) return;
                          navigate(`/doctor/patient/${p.id}`); 
                        }} 
                        className="hover:bg-[#F1FAEE]/50 cursor-pointer transition-all duration-300 group h-14 motion-reveal"
                      >
                        <td className="py-2.5 px-8">
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                               <div className={`w-9 h-9 rounded-lg bg-gradient-to-br from-[#1D3557] to-[#457B9D] flex items-center justify-center text-[#A8DADC] text-[13px] font-black shadow-sm group-hover:scale-105 transition-transform`}>
                                 {p.name.charAt(0).toUpperCase()}
                               </div>
                               <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${adherencePct > 70 ? 'bg-emerald-500' : adherencePct > 40 ? 'bg-amber-400' : 'bg-[#E63946]'}`} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-black text-[#1D3557] text-sm truncate">{p.name}</p>
                              <p className="text-[9px] font-bold text-[#457B9D] truncate uppercase tracking-widest">{p.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-6">
                             <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg font-black text-[9px] transition-all ${hasActive ? 'bg-[#1D3557] text-white shadow-sm' : 'bg-[#F1FAEE] text-[#A8DADC]'}`}>
                               {p.activePlans || 0}
                             </span>
                        </td>
                        <td className="py-2.5 px-6 font-black text-[#1D3557] text-xs">
                          {p.totalSessions || 0}
                        </td>
                        <td className="py-2.5 px-6 hidden lg:table-cell">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#457B9D]">
                            <Clock size={11} className="text-[#A8DADC]" />
                            {formatLastActive(p.lastOnline)}
                          </div>
                        </td>
                        <td className="py-2.5 px-6 hidden xl:table-cell w-32">
                          <div className="flex items-center gap-2">
                            <div className="h-1 w-12 bg-[#F1FAEE] rounded-full overflow-hidden shrink-0 border border-[#A8DADC]/10">
                              <div 
                                className={`h-full rounded-full transition-all duration-1000 ${adherencePct >= 80 ? 'bg-emerald-500' : adherencePct >= 50 ? 'bg-amber-400' : 'bg-[#E63946]'}`}
                                style={{ width: `${adherencePct}%` }}
                              />
                            </div>
                            <span className="text-[9px] font-black text-[#1D3557]">{adherencePct}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-8 text-right w-[180px]">
                          <div className="flex items-center justify-end gap-1.5 transition-all duration-300">
                            <button 
                              onClick={() => navigate(`/doctor/patient/${p.id}`)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#F1FAEE] bg-[#1D3557] hover:bg-[#457B9D] transition-all shadow-sm active:scale-95"
                            >
                              <Eye size={15} />
                            </button>
                            <button 
                              onClick={() => navigate(`/doctor/assign?patientId=${p.id}`)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#F1FAEE] bg-[#457B9D] hover:bg-[#1D3557] transition-all shadow-sm active:scale-95"
                            >
                              <Dumbbell size={15} />
                            </button>
                            <button 
                              onClick={() => navigate(`/doctor/patient/${p.id}/report`)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#1D3557] bg-[#A8DADC] hover:bg-[#1D3557] hover:text-[#F1FAEE] transition-all shadow-sm active:scale-95"
                            >
                              <BarChart2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── PAGINATION BAR ── */}
        {processedPatients.length > itemsPerPage && (
          <div className="px-8 py-4 border-t border-[#A8DADC]/20 bg-[#F1FAEE]/30 rounded-b-[2.5rem] flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#457B9D]">
              Index <span className="text-[#1D3557]">{(currentPage - 1) * itemsPerPage + 1} – {Math.min(currentPage * itemsPerPage, processedPatients.length)}</span> of {processedPatients.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-9 h-9 rounded-xl border-2 border-[#A8DADC]/30 bg-white text-[#457B9D] hover:bg-[#F1FAEE] disabled:opacity-30 transition-all flex items-center justify-center"
              >
                <ChevronLeft size={18} />
              </button>
              
              <div className="flex gap-1">
                {Array.from({ length: totalPages }, (_, i) => (
                   <button
                     key={i}
                     onClick={() => setCurrentPage(i + 1)}
                     className={`w-9 h-9 rounded-xl text-[10px] font-black flex items-center justify-center transition-all ${
                       currentPage === i + 1 
                         ? 'bg-[#1D3557] text-white shadow-lg' 
                         : 'bg-white border-2 border-[#A8DADC]/20 text-[#457B9D] hover:bg-[#F1FAEE]'
                     }`}
                   >
                     {i + 1}
                   </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-9 h-9 rounded-xl border-2 border-[#A8DADC]/30 bg-white text-[#457B9D] hover:bg-[#F1FAEE] disabled:opacity-30 transition-all flex items-center justify-center"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ── BOTTOM CALL TO ACTION ── */}
        <div className="mt-10 flex flex-col md:flex-row items-center justify-between p-6 bg-gradient-to-r from-[#1D3557] to-[#457B9D] rounded-[2.5rem] shadow-2xl shadow-[#1D3557]/20 border border-white/10 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none" />
           <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center text-[#A8DADC]">
                 <CheckCircle2 size={24} />
              </div>
              <div>
                 <h4 className="text-[#F1FAEE] text-lg font-black italic leading-tight">Patient Monitoring Ready</h4>
                 <p className="text-[#A8DADC] text-[11px] font-medium">Verify protocols or initiate sessions instantly.</p>
              </div>
           </div>
           <button 
             onClick={() => navigate('/doctor/calendar')}
             className="relative z-10 mt-4 md:mt-0 flex items-center gap-2 bg-[#F1FAEE] text-[#1D3557] px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[11px] hover:scale-105 active:scale-95 transition-all shadow-xl"
           >
              Launch Scheduler <ArrowRight size={14} />
           </button>
        </div>
      </main>
    </div>
  );
};

export default DoctorPatientDirectory;
