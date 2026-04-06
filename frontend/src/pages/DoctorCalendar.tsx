import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Monitor,
  MapPin,
  Check,
  X,
  Clock,
  AlertCircle,
  Video,
  MessageCircle,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp,
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  Plus
} from 'lucide-react';

type SortField = 'name' | 'time' | 'status';
type SortOrder = 'asc' | 'desc';
type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

const DoctorCalendar = () => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    dayOfWeek: 1,
    startTime: "10:00",
    endTime: "10:30"
  });

  // UI state
  const [isAvailabilityOpen, setIsAvailabilityOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const token = localStorage.getItem('token');
  const BASE_URL = "http://localhost:5000";

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      const res = await fetch(`${BASE_URL}/appointment/doctor`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.appointments) setAppointments(data.appointments);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  const handleSetAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/appointment/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      if (response.ok) {
        alert("Availability set successfully!");
      } else {
        const data = await response.json();
        alert(data.message || "Failed to set availability");
      }
    } catch (err) {
      alert("Server error. Make sure backend is running on port 5000.");
    } finally {
      setLoading(false);
    }
  };

  const handleAppointmentUpdate = async (appointmentId: string, status?: string, switchAction?: string, patientEmail?: string) => {
    try {
      const payload: any = { appointmentId };
      if (status) payload.status = status;
      if (switchAction) payload.switchAction = switchAction;

      const res = await fetch(`${BASE_URL}/appointment/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        if (status === 'approved' && patientEmail) await autoAddPatientToDirectory(patientEmail);
        fetchAppointments();
      } else {
        alert(data.message || "Update failed");
      }
    } catch (err) {
      alert("Network error: Could not update appointment.");
    }
  };

  const autoAddPatientToDirectory = async (email: string) => {
    try {
      const res = await fetch(`${BASE_URL}/doctor/add-patient`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ patientEmail: email })
      });
      if (res.ok) console.log(`Patient ${email} successfully added.`);
    } catch (err) {
      console.error("Patient addition failed", err);
    }
  };

  // Processing Data
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const processedAppointments = useMemo(() => {
    let result = [...appointments];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(a => 
        (a.patientId?.name || "").toLowerCase().includes(q) || 
        (a.patientId?.email || "").toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(a => a.status === statusFilter);
    }

    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = (a.patientId?.name || "").localeCompare(b.patientId?.name || "");
      } else if (sortField === 'time') {
        comparison = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      } else if (sortField === 'status') {
        comparison = a.status.localeCompare(b.status);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [appointments, search, statusFilter, sortField, sortOrder]);

  const totalPages = Math.ceil(processedAppointments.length / itemsPerPage);
  const currentBatch = processedAppointments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown size={14} className="text-slate-300 ml-1 inline-block opacity-0 group-hover:opacity-100 transition-opacity" />;
    return sortOrder === 'asc' ? <ChevronUp size={14} className="text-teal-600 ml-1 inline-block" /> : <ChevronDown size={14} className="text-teal-600 ml-1 inline-block" />;
  };

  const DAYS = [
    { label: 'Mon', value: 1 },
    { label: 'Tue', value: 2 },
    { label: 'Wed', value: 3 },
    { label: 'Thu', value: 4 },
    { label: 'Fri', value: 5 },
    { label: 'Sat', value: 6 },
    { label: 'Sun', value: 0 },
  ];

  return (
    <div className="page-content font-sans pb-16">
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── SECTION 1: SET AVAILABILITY ── */}
        <section className="bg-white rounded-[12px] border border-slate-200 shadow-sm overflow-hidden">
          <div 
            onClick={() => setIsAvailabilityOpen(!isAvailabilityOpen)}
            className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
                <CalendarIcon size={18} />
              </div>
              <h2 className="text-[16px] font-medium text-slate-900">Set Availability</h2>
            </div>
            {isAvailabilityOpen ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
          </div>

          <div className={`transition-all duration-300 ${isAvailabilityOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
            <form onSubmit={handleSetAvailability} className="p-6">
              <div className="flex flex-col lg:flex-row items-end gap-6 w-full">
                
                {/* Day Selection */}
                <div className="flex-1 w-full">
                  <label className="text-[12px] font-medium text-slate-500 uppercase tracking-wider block mb-2">Repeat on Days</label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map(day => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => setForm({ ...form, dayOfWeek: day.value })}
                        className={`px-4 py-2 rounded-[8px] text-sm font-medium border transition-all ${
                          form.dayOfWeek === day.value 
                            ? 'bg-teal-50 border-teal-500 text-teal-700' 
                            : 'bg-white border-slate-200 text-slate-600 hover:border-teal-300'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-end gap-4 w-full lg:w-auto">
                  <div className="flex-1 lg:w-32">
                    <label className="text-[12px] font-medium text-slate-500 uppercase tracking-wider block mb-2">Start Time</label>
                    <input
                      type="time"
                      required
                      value={form.startTime}
                      onChange={e => setForm({ ...form, startTime: e.target.value })}
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-[8px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                    />
                  </div>
                  <div className="flex-1 lg:w-32">
                    <label className="text-[12px] font-medium text-slate-500 uppercase tracking-wider block mb-2">End Time</label>
                    <input
                      type="time"
                      required
                      value={form.endTime}
                      onChange={e => setForm({ ...form, endTime: e.target.value })}
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-[8px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto mt-4 lg:mt-0">
                  <button type="button" className="flex-1 lg:flex-none h-10 px-4 flex items-center justify-center gap-2 border border-teal-600 text-teal-600 rounded-[8px] text-sm font-medium hover:bg-teal-50 transition-colors">
                    <Plus size={16} /> Add Slot
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="flex-1 lg:flex-none h-10 px-6 bg-[#1D9E75] text-white rounded-[8px] text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save Availability'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </section>

        {/* ── SECTION 2: PATIENT REQUESTS ── */}
        <section className="bg-white rounded-[12px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-[20px] font-medium text-slate-900">Patient Requests</h2>
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-[8px]">
                {appointments.filter(a => a.status === 'pending').length} Unread
              </span>
            </div>

            <div className="flex items-center gap-3">
               <select
                 value={statusFilter}
                 onChange={e => { setStatusFilter(e.target.value as StatusFilter); setCurrentPage(1); }}
                 className="h-10 px-3 bg-white border border-slate-200 text-slate-700 text-sm rounded-[8px] focus:outline-none focus:border-teal-500 min-w-[120px]"
               >
                 <option value="all">All Status</option>
                 <option value="pending">Pending</option>
                 <option value="approved">Approved</option>
                 <option value="rejected">Rejected</option>
               </select>

               <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search requests..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="w-full h-10 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-[8px] text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto min-h-[400px]">
             <table className="w-full text-left">
               <thead>
                 <tr className="bg-slate-50 border-b border-slate-100">
                   <th onClick={() => handleSort('name')} className="py-3 px-6 text-[12px] font-medium uppercase tracking-[0.05em] text-slate-500 cursor-pointer group hover:bg-slate-100 transition-colors">
                     Patient <SortIcon field="name" />
                   </th>
                   <th onClick={() => handleSort('time')} className="py-3 px-6 text-[12px] font-medium uppercase tracking-[0.05em] text-slate-500 cursor-pointer group hover:bg-slate-100 transition-colors">
                     Requested Slot <SortIcon field="time" />
                   </th>
                   <th className="py-3 px-6 text-[12px] font-medium uppercase tracking-[0.05em] text-slate-500">
                     Mode
                   </th>
                   <th className="py-3 px-6 text-[12px] font-medium uppercase tracking-[0.05em] text-slate-500 max-w-[200px]">
                     Reason
                   </th>
                   <th onClick={() => handleSort('status')} className="py-3 px-6 text-[12px] font-medium uppercase tracking-[0.05em] text-slate-500 cursor-pointer group hover:bg-slate-100 transition-colors">
                     Status <SortIcon field="status" />
                   </th>
                   <th className="py-3 px-6 text-[12px] font-medium uppercase tracking-[0.05em] text-slate-500 text-right">
                     Actions
                   </th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 text-[14px]">
                 {currentBatch.map(apt => {
                    const hasSwitchReq = apt.modeSwitchRequest?.status === 'pending';
                    const canJoin = apt.status === 'approved' && apt.sessionMode === 'online' && apt.isLiveNow;

                    return (
                      <tr key={apt._id} className={`hover:bg-[#F0FDF9] transition-colors group h-[52px] ${canJoin ? 'bg-teal-50/30' : ''}`}>
                         <td className="py-2.5 px-6">
                           <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 font-bold shrink-0 shadow-sm text-sm">
                               {(apt.patientId?.name || "U").charAt(0).toUpperCase()}
                             </div>
                             <div className="min-w-0">
                               <p className="font-medium text-slate-900 truncate">
                                 {apt.patientId?.name || "Unknown"}
                                 {canJoin && <span className="ml-2 inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse" title="Live Now" />}
                               </p>
                               <p className="text-[12px] text-slate-500 truncate">{apt.patientId?.email}</p>
                             </div>
                           </div>
                         </td>

                         <td className="py-2.5 px-6 whitespace-nowrap text-slate-700">
                           <span className="font-medium">
                             {new Date(apt.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                           </span>
                           <span className="mx-1.5 text-slate-300">·</span>
                           <span>{new Date(apt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                         </td>

                         <td className="py-2.5 px-6">
                           <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[11px] text-[11px] font-medium ${
                             apt.sessionMode === 'online' ? 'bg-teal-50 text-teal-700' : 'bg-blue-50 text-blue-700'
                           }`}>
                             {apt.sessionMode === 'online' ? <Monitor size={12} /> : <MapPin size={12} />}
                             <span className="capitalize">{apt.sessionMode}</span>
                           </span>
                         </td>

                         <td className="py-2.5 px-6">
                           <div className="max-w-[150px] truncate group/tooltip relative text-slate-600">
                             {apt.reason || "—"}
                             {apt.reason && (
                               <div className="invisible group-hover/tooltip:visible absolute z-10 bg-slate-900 text-white text-xs rounded-[8px] p-2 mt-1 left-0 whitespace-normal min-w-[200px] shadow-xl">
                                 {apt.reason}
                               </div>
                             )}
                           </div>
                         </td>

                         <td className="py-2.5 px-6 whitespace-nowrap">
                           <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-[11px] text-[11px] font-medium uppercase tracking-wider ${
                             apt.status === 'approved' ? 'bg-teal-50 text-teal-700' :
                             apt.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                           }`}>
                             {apt.status}
                           </span>

                           {hasSwitchReq && (
                             <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-600 font-medium">
                               <AlertCircle size={10} /> Req: {apt.modeSwitchRequest.requestedMode}
                             </div>
                           )}
                         </td>

                         <td className="py-2.5 px-6 text-right">
                           <div className="flex items-center justify-end gap-2">
                             
                             {apt.status === 'pending' && (
                               <>
                                 <button onClick={() => handleAppointmentUpdate(apt._id, 'approved', undefined, apt.patientId?.email)} className="w-8 h-8 flex items-center justify-center rounded-[8px] bg-[#1D9E75] text-white hover:bg-teal-700 transition" title="Approve">
                                   <Check size={16} />
                                 </button>
                                 <button onClick={() => handleAppointmentUpdate(apt._id, 'rejected')} className="w-8 h-8 flex items-center justify-center rounded-[8px] bg-red-500 text-white hover:bg-red-600 transition" title="Reject">
                                   <X size={16} />
                                 </button>
                               </>
                             )}

                             {hasSwitchReq && (
                               <div className="flex bg-amber-50 border border-amber-200 rounded-[8px] ml-2">
                                 <button onClick={() => handleAppointmentUpdate(apt._id, undefined, 'approve')} className="px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100 border-r border-amber-200 transition">Accept</button>
                                 <button onClick={() => handleAppointmentUpdate(apt._id, undefined, 'reject')} className="px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 transition">Deny</button>
                               </div>
                             )}

                             {canJoin && (
                               <>
                                 <button onClick={() => window.open(`/session/${apt._id}`, '_blank')} className="w-8 h-8 flex items-center justify-center rounded-[8px] border border-teal-200 text-teal-600 hover:bg-teal-50 transition" title="Chat">
                                   <MessageCircle size={16} />
                                 </button>
                                 <button onClick={() => window.open(`/session/${apt._id}`, '_blank')} className="px-3 py-1 bg-teal-600 text-white rounded-[8px] flex items-center gap-1.5 text-xs font-semibold hover:bg-teal-700 transition animate-pulse">
                                   <Video size={14} /> Join
                                 </button>
                               </>
                             )}

                             <button className="w-8 h-8 flex items-center justify-center rounded-[8px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" title="View Details">
                               <Eye size={16} />
                             </button>

                           </div>
                         </td>
                      </tr>
                    );
                 })}
               </tbody>
             </table>

             {processedAppointments.length === 0 && (
               <div className="flex flex-col items-center justify-center py-20 text-center">
                 <CalendarIcon size={32} className="text-slate-300 mb-3" />
                 <p className="text-[14px] font-medium text-slate-500">No appointment requests found.</p>
               </div>
             )}
          </div>

          {/* ── PAGINATION ── */}
          {processedAppointments.length > itemsPerPage && (
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <span className="text-[14px] text-slate-500">
                Showing <span className="font-medium text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium text-slate-900">{Math.min(currentPage * itemsPerPage, processedAppointments.length)}</span> of <span className="font-medium text-slate-900">{processedAppointments.length}</span> requests
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-[8px] border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition"
                >
                  <ChevronLeft size={16} />
                </button>
                
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => (
                     <button
                     key={i}
                     onClick={() => setCurrentPage(i + 1)}
                     className={`w-7 h-7 rounded-[8px] text-[12px] font-medium flex items-center justify-center transition-all ${
                       currentPage === i + 1 
                         ? 'bg-teal-600 text-white border border-teal-600' 
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
                  className="p-1.5 rounded-[8px] border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

        </section>

      </main>
    </div>
  );
};

export default DoctorCalendar;