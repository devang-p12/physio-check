import React, { useEffect, useState, useMemo } from 'react';
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
  Clock
} from 'lucide-react';

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
  const itemsPerPage = 10;

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

  // Processing Data
  const processedPatients = useMemo(() => {
    let result = [...patients];

    // Filter by search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q));
    }

    // Filter by status
    if (statusFilter === 'active') {
      result = result.filter(p => (p.activePlans || 0) > 0);
    } else if (statusFilter === 'none') {
      result = result.filter(p => (p.activePlans || 0) === 0);
    }

    // Sort
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
    if (sortField !== field) return <ChevronDown size={14} className="text-slate-300 ml-1 inline-block opacity-0 group-hover:opacity-100 transition-opacity" />;
    return sortOrder === 'asc' ? <ChevronUp size={14} className="text-teal-600 ml-1 inline-block" /> : <ChevronDown size={14} className="text-teal-600 ml-1 inline-block" />;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-16">
      
      {/* ── HEADER ROW ── */}
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Patient Directory</h1>
            <span className="bg-teal-50 text-teal-700 text-xs font-bold px-3 py-1 rounded-full">
              {patients.length} Total
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
              />
            </div>
            <button
              onClick={() => navigate('/doctor/add-patient')}
              className="w-full sm:w-auto mt-2 sm:mt-0 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shadow-sm shadow-teal-100"
            >
              <UserPlus size={16} /> Add New Patient
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* ── FILTER BAR ── */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setCurrentPage(1); }}
              className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-teal-500 min-w-[120px]"
            >
              <option value="all">All Patients</option>
              <option value="active">Active Plan</option>
              <option value="none">No Plan</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Sort by:</label>
            <select
              value={`${sortField}-${sortOrder}`}
              onChange={(e) => {
                const [f, o] = e.target.value.split('-');
                setSortField(f as SortField);
                setSortOrder(o as SortOrder);
              }}
              className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-teal-500 min-w-[140px]"
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="lastActive-desc">Last Active</option>
              <option value="sessions-desc">Highest Sessions</option>
            </select>
          </div>
        </div>

        {/* ── TABLE VIEW ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          
          {loading ? (
             <div className="flex flex-col items-center justify-center py-20 space-y-4">
               <div className="w-8 h-8 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
               <p className="text-slate-400 font-medium">Loading directory...</p>
             </div>
          ) : processedPatients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center px-4">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mb-4">
                <Users size={32} />
              </div>
              <p className="text-lg font-semibold text-slate-900">No patients found.</p>
              <p className="text-slate-500 text-sm mt-1 max-w-sm mb-6">
                Try adjusting your filters or add your first patient to the system.
              </p>
              <button
                onClick={() => navigate('/doctor/add-patient')}
                className="bg-teal-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-teal-700 transition"
              >
                Add New Patient
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th 
                      onClick={() => handleSort('name')}
                      className="py-3 px-5 text-xs font-medium uppercase tracking-[0.05em] text-slate-500 cursor-pointer group hover:bg-slate-100 transition-colors"
                    >
                      Patient <SortIcon field="name" />
                    </th>
                    <th className="py-3 px-5 text-xs font-medium uppercase tracking-[0.05em] text-slate-500">
                      Plans
                    </th>
                    <th 
                      onClick={() => handleSort('sessions')}
                      className="py-3 px-5 text-xs font-medium uppercase tracking-[0.05em] text-slate-500 cursor-pointer group hover:bg-slate-100 transition-colors"
                    >
                      Sessions <SortIcon field="sessions" />
                    </th>
                    <th 
                      onClick={() => handleSort('lastActive')}
                      className="py-3 px-5 text-xs font-medium uppercase tracking-[0.05em] text-slate-500 cursor-pointer group hover:bg-slate-100 transition-colors hidden sm:table-cell"
                    >
                      Last Active <SortIcon field="lastActive" />
                    </th>
                    <th className="py-3 px-5 text-xs font-medium uppercase tracking-[0.05em] text-slate-500 hidden md:table-cell">
                      Adherence
                    </th>
                    <th className="py-3 px-5 text-xs font-medium uppercase tracking-[0.05em] text-slate-500">
                      Status
                    </th>
                    <th className="py-3 px-5 text-xs font-medium uppercase tracking-[0.05em] text-slate-500 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {currentBatch.map(p => {
                    const hasActive = (p.activePlans || 0) > 0;
                    // Synthesize adherence from streak or fallback for demo
                    const adherencePct = typeof p.adherenceRate === 'number' ? p.adherenceRate : Math.min(100, Math.max(0, 40 + (p.streak || 0)*10));

                    return (
                      <tr key={p.id} onClick={(e) => { 
                        // Do not navigate if clicking action buttons
                        if ((e.target as HTMLElement).closest('button')) return;
                        navigate(`/doctor/patient/${p.id}`); 
                      }} className="hover:bg-[#F0FDF9] cursor-pointer transition-colors group h-14">
                        <td className="py-2 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 font-bold shrink-0 shadow-sm">
                              {p.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                              <p className="text-xs text-slate-500 truncate">{p.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-5">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-semibold text-xs ${p.activePlans > 0 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>
                            {p.activePlans || 0}
                          </span>
                        </td>
                        <td className="py-2 px-5 font-medium text-slate-700">
                          {p.totalSessions || 0}
                        </td>
                        <td className="py-2 px-5 hidden sm:table-cell text-slate-500">
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <Clock size={14} />
                            {formatLastActive(p.lastOnline)}
                          </div>
                        </td>
                        <td className="py-2 px-5 hidden md:table-cell w-32">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden shrink-0">
                              <div 
                                className={`h-full rounded-full ${adherencePct >= 80 ? 'bg-emerald-500' : adherencePct >= 50 ? 'bg-amber-400' : 'bg-red-500'}`}
                                style={{ width: `${adherencePct}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-slate-600">{adherencePct}%</span>
                          </div>
                        </td>
                        <td className="py-2 px-5 whitespace-nowrap">
                          {hasActive ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[11px] font-bold uppercase tracking-wider">
                              Active Plan
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                              No Plan
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-5 text-right w-[160px]">
                          <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => navigate(`/doctor/patient/${p.id}`)}
                              title="View Profile" 
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-teal-600 bg-teal-50 hover:bg-teal-600 hover:text-white transition-colors"
                            >
                              <Eye size={16} />
                            </button>
                            <button 
                              onClick={() => navigate(`/doctor/assign?patientId=${p.id}`)}
                              title="Assign Exercise" 
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-teal-600 bg-teal-50 hover:bg-teal-600 hover:text-white transition-colors"
                            >
                              <Dumbbell size={16} />
                            </button>
                            <button 
                              onClick={() => navigate(`/doctor/patient/${p.id}/report`)}
                              title="View Report" 
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-teal-600 bg-teal-50 hover:bg-teal-600 hover:text-white transition-colors"
                            >
                              <BarChart2 size={16} />
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

          {/* ── PAGINATION ── */}
          {processedPatients.length > itemsPerPage && (
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <span className="text-sm text-slate-500">
                Showing <span className="font-medium text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium text-slate-900">{Math.min(currentPage * itemsPerPage, processedPatients.length)}</span> of <span className="font-medium text-slate-900">{processedPatients.length}</span> patients
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50 transition"
                >
                  <ChevronLeft size={16} />
                </button>
                
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => (
                     <button
                     key={i}
                     onClick={() => setCurrentPage(i + 1)}
                     className={`w-7 h-7 rounded-md text-xs font-semibold flex items-center justify-center transition-all ${
                       currentPage === i + 1 
                         ? 'bg-teal-600 text-white' 
                         : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                     }`}
                   >
                     {i + 1}
                   </button>
                  ))}
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50 transition"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default DoctorPatientDirectory;
