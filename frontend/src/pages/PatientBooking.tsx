import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Monitor, MapPin, Calendar, Clock, ChevronLeft, ChevronRight, RefreshCw, AlertCircle, CheckCircle2, Video, MessageCircle, CalendarX, Loader2, Search, ArrowRight } from 'lucide-react';

const PatientBooking = () => {
  const { doctorId } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('book');
  const [slots, setSlots] = useState([]);
  const [myAppointments, setMyAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Wizard state
  const [bookingStep, setBookingStep] = useState(1);
  const [sessionMode, setSessionMode] = useState("online");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [reason, setReason] = useState("");

  // Appointments table state
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const token = localStorage.getItem('token');
  const BASE_URL = "http://localhost:5000";

  useEffect(() => {
    if (doctorId) fetchSlots();
    fetchMyAppointments();
  }, [doctorId]);

  const fetchSlots = async () => {
    setFetching(true);
    try {
      const res = await fetch(`${BASE_URL}/patient/doctor-availability/${doctorId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      setSlots(data.slots || []);
    } catch (err) {
      console.error("Error loading slots", err);
    } finally {
      setFetching(false);
    }
  };

  const fetchMyAppointments = async () => {
    try {
      const res = await fetch(`${BASE_URL}/appointment/patient`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      setMyAppointments(data.appointments || []);
    } catch (err) {
      console.error("Error fetching appointments", err);
    }
  };

  const isLiveNow = (apt: any) => {
    const now = new Date();
    const start = new Date(apt.startTime);
    const end = new Date(apt.endTime);
    const buffer = 10 * 60 * 1000;
    return now >= (start.getTime() - buffer) && now <= end;
  };

  const handleBook = async () => {
    if (!selectedSlot || !reason.trim()) return alert("Please select a slot and provide a reason");
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/appointment/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ doctorId, startTime: selectedSlot.startTime, endTime: selectedSlot.endTime, reason, sessionMode })
      });
      if (res.ok) {
        alert("Booking Request Sent!");
        // Reset wizard
        setBookingStep(1);
        setSelectedSlot(null);
        setSelectedDate(null);
        setReason("");
        setSessionMode("online");
        fetchMyAppointments();
        setActiveTab('myAppointments');
      } else {
        const data = await res.json();
        alert(data.message || "Booking failed");
      }
    } catch (err) {
      alert("Server error");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestModeSwitch = async (appointmentId: string, currentMode: string) => {
    const requestedMode = currentMode === 'online' ? 'offline' : 'online';
    try {
      const res = await fetch(`${BASE_URL}/appointment/switch-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ appointmentId, requestedMode })
      });
      if (res.ok) {
        alert(`Request to switch to ${requestedMode} sent to doctor!`);
        fetchMyAppointments();
      } else {
        const data = await res.json();
        alert(data.message || "Failed to send request");
      }
    } catch (err) {
      alert("Server error");
    }
  };

  const groupedSlots = (slots || []).reduce((acc: any, slot: any) => {
    const date = slot.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(slot);
    return acc;
  }, {});

  const availableDates = Object.keys(groupedSlots).sort();

  const getStatusColor = (status: string) => {
    if (status === 'approved') return 'bg-emerald-100 text-emerald-700';
    if (status === 'pending') return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
  };

  // Filter & Pagination for Appointments
  const filteredAppointments = myAppointments.filter((apt: any) => {
    const docName = (apt.doctorId?.name || "").toLowerCase();
    const txt = searchQuery.toLowerCase();
    return docName.includes(txt) || apt.status.includes(txt) || apt.sessionMode.includes(txt);
  });

  const totalPages = Math.ceil(filteredAppointments.length / itemsPerPage);
  const currentAppointments = filteredAppointments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-slate-50 min-h-screen font-sans">
      <header className="mb-8">
        <button onClick={() => navigate('/patient/doctors')} className="flex items-center text-teal-600 font-bold text-sm mb-6 hover:underline group">
          <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> View All Doctors
        </button>

        <div className="flex gap-2 p-1.5 bg-white rounded-xl border border-slate-200 shadow-sm w-fit">
          <button
            onClick={() => setActiveTab('book')}
            className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${activeTab === 'book' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-500 hover:text-teal-600 hover:bg-teal-50'}`}
          >
            Book Appointment
          </button>
          <button
            onClick={() => { setActiveTab('myAppointments'); fetchMyAppointments(); }}
            className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'myAppointments' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-500 hover:text-teal-600 hover:bg-teal-50'}`}
          >
            My Appointments
            {myAppointments.length > 0 && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${activeTab === 'myAppointments' ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-700'}`}>
                {myAppointments.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ─── TAB: BOOK ─── */}
      {activeTab === 'book' && (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 md:p-10">
          <div className="mb-8">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Schedule Session</h2>
            <p className="text-slate-500 mt-1">Complete the steps below to request a consultation.</p>
          </div>

          {fetching ? (
             <div className="flex flex-col items-center justify-center py-24 gap-4 text-teal-500">
               <Loader2 size={36} className="animate-spin" />
               <p className="text-sm font-bold tracking-widest text-slate-400 uppercase">Loading calendar...</p>
             </div>
          ) : availableDates.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-24 gap-4">
               <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300">
                 <CalendarX size={36} />
               </div>
               <div className="text-center">
                 <p className="font-black text-slate-800 text-xl">No availability set</p>
                 <p className="text-slate-500 mt-2 max-w-sm mx-auto">This doctor hasn't added any available slots yet. Please try another doctor.</p>
               </div>
               <button onClick={fetchSlots} className="mt-4 flex items-center gap-2 bg-teal-50 text-teal-600 px-6 py-3 rounded-xl font-bold hover:bg-teal-100 transition">
                 <RefreshCw size={16} /> Refresh Calendar
               </button>
             </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-10">
              {/* Stepper Wizard */}
              <div className="flex-1 space-y-8">
                
                {/* STEP 1: MODE */}
                <div className={`transition-opacity ${bookingStep >= 1 ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Step 1: Consultation Mode</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => { setSessionMode("online"); setBookingStep(Math.max(bookingStep, 2)); }}
                      className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all ${sessionMode === 'online' && bookingStep >= 2 ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-100 hover:border-teal-200 text-slate-600'}`}
                    >
                      <Monitor size={32} className={sessionMode === 'online' && bookingStep >= 2 ? 'text-teal-500' : 'text-slate-400'} />
                      <span className="font-bold">Online Video</span>
                    </button>
                    <button
                      onClick={() => { setSessionMode("offline"); setBookingStep(Math.max(bookingStep, 2)); }}
                      className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all ${sessionMode === 'offline' && bookingStep >= 2 ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-100 hover:border-teal-200 text-slate-600'}`}
                    >
                      <MapPin size={32} className={sessionMode === 'offline' && bookingStep >= 2 ? 'text-teal-500' : 'text-slate-400'} />
                      <span className="font-bold">In-Clinic</span>
                    </button>
                  </div>
                </div>

                {/* STEP 2: DATE */}
                <div className={`transition-opacity ${bookingStep >= 2 ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Step 2: Choose Date</h3>
                  <div className="flex gap-3 overflow-x-auto pb-4 snap-x">
                    {availableDates.map(date => {
                      const d = new Date(date);
                      const isSelected = selectedDate === date;
                      return (
                        <button
                          key={date}
                          onClick={() => { setSelectedDate(date); setSelectedSlot(null); setBookingStep(Math.max(bookingStep, 3)); }}
                          className={`snap-start shrink-0 w-24 p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${isSelected ? 'border-teal-500 bg-teal-500 text-white shadow-lg shadow-teal-200' : 'border-slate-100 bg-white hover:border-teal-300 text-slate-600'}`}
                        >
                           <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
                             {d.toLocaleDateString('en-US', { weekday: 'short' })}
                           </span>
                           <span className="text-2xl font-black">{d.getDate()}</span>
                           <span className={`text-xs font-semibold ${isSelected ? 'text-teal-100' : 'text-slate-500'}`}>
                             {d.toLocaleDateString('en-US', { month: 'short' })}
                           </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* STEP 3: TIME */}
                {selectedDate && (
                  <div className={`transition-opacity ${bookingStep >= 3 ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Step 3: Choose Time</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {groupedSlots[selectedDate].map((slot: any, idx: number) => {
                        const time = new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const isSelected = selectedSlot === slot;
                        const isUnavailable = slot.status !== 'available';

                        return (
                          <button
                            key={idx}
                            disabled={isUnavailable}
                            onClick={() => { setSelectedSlot(slot); setBookingStep(4); }}
                            className={`py-3 px-2 rounded-xl border-2 text-sm font-bold transition-all flex flex-col items-center justify-center gap-1
                              ${isUnavailable ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed' : 
                                isSelected ? 'border-teal-600 bg-teal-600 text-white shadow-md' : 'border-slate-200 bg-white hover:border-teal-400 text-slate-700'
                              }`}
                          >
                            {time}
                            {isUnavailable && <span className="text-[9px] uppercase tracking-wider opacity-60">{slot.status}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 4: CONFIRMATION PANEL */}
              <div className="lg:w-96 shrink-0">
                <div className={`bg-slate-50 rounded-[2rem] p-6 border-2 border-slate-100 transition-all ${bookingStep === 4 ? 'ring-4 ring-teal-500/20 border-teal-200' : ''}`}>
                  <h3 className="text-lg font-black text-slate-900 mb-6">Booking Summary</h3>
                  
                  {bookingStep < 4 ? (
                    <div className="text-center py-12 text-slate-400 flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center">
                        <CheckCircle2 size={24} className="text-slate-300" />
                      </div>
                      <p className="text-sm font-medium px-4">Complete steps 1-3 to review and confirm your booking here.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex items-center gap-4 p-4 bg-white rounded-xl shadow-sm border border-slate-100">
                        <div className="w-10 h-10 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center">
                          {sessionMode === 'online' ? <Monitor size={18} /> : <MapPin size={18} />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Mode</p>
                          <p className="font-bold text-slate-800 capitalize">{sessionMode} Consultation</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 p-4 bg-white rounded-xl shadow-sm border border-slate-100">
                        <div className="w-10 h-10 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center">
                           <Calendar size={18} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Date & Time</p>
                          <p className="font-bold text-slate-800">
                            {new Date(selectedSlot.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })},{' '}
                            {new Date(selectedSlot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Reason / Notes</label>
                        <textarea
                          placeholder="What would you like to discuss today?"
                          className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none h-24"
                          value={reason}
                          onChange={e => setReason(e.target.value)}
                        />
                      </div>

                      <button
                        onClick={handleBook}
                        disabled={loading}
                        className="w-full bg-teal-600 text-white font-black py-4 rounded-xl shadow-lg shadow-teal-200 hover:bg-teal-700 active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                      >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : <><CheckCircle2 size={20} /> Confirm Booking</>}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: MY APPOINTMENTS ─── */}
      {activeTab === 'myAppointments' && (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">My Appointments</h2>
              <p className="text-slate-500 mt-1 text-sm">Manage your upcoming and past sessions.</p>
            </div>
            
            <div className="flex gap-3">
               <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Search appointments..." 
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm w-full md:w-60"
                />
              </div>
              <button onClick={fetchMyAppointments} className="p-2 border border-slate-200 rounded-xl text-slate-500 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-600 transition">
                <RefreshCw size={18} />
              </button>
            </div>
          </div>

          {currentAppointments.length === 0 ? (
             <div className="text-center py-20 bg-slate-50/50">
               <Clock className="mx-auto text-slate-300 mb-4" size={48} />
               <p className="text-slate-800 font-bold text-lg">No appointments found</p>
               <p className="text-slate-500 text-sm mt-1">Book a new appointment through the booking tab.</p>
             </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Doctor</th>
                    <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Schedule & Mode</th>
                    <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500 hidden md:table-cell">Status & Notes</th>
                    <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentAppointments.map((apt: any) => {
                    const switchPending = apt.modeSwitchRequest?.status === 'pending';
                    const switchApproved = apt.modeSwitchRequest?.status === 'approved';
                    const canRequestSwitch = apt.status === 'approved' && !switchPending;
                    const live = isLiveNow(apt);
                    const canJoin = apt.status === 'approved' && apt.sessionMode === 'online' && live;

                    return (
                      <tr key={apt._id} className={`hover:bg-slate-50 transition-colors ${canJoin ? 'bg-teal-50/30' : ''}`}>
                        <td className="py-5 px-6 align-top">
                          <p className="font-bold text-slate-900">Dr. {apt.doctorId?.name || "Doctor"}</p>
                          <span className={`inline-block mt-1 px-2.5 py-1 rounded-md text-[9px] font-black uppercase ${getStatusColor(apt.status)}`}>
                            {apt.status}
                          </span>
                        </td>
                        
                        <td className="py-5 px-6 align-top">
                          <div className="flex flex-col gap-1.5">
                            <span className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                              <Calendar size={14} className="text-slate-400" />
                              {new Date(apt.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span className="flex items-center gap-1.5 text-sm text-slate-600">
                              <Clock size={14} className="text-slate-400" />
                              {new Date(apt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <div className="mt-1 flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-slate-100 text-slate-600">
                              {apt.sessionMode === 'online' ? <Monitor size={12} /> : <MapPin size={12} />}
                              {apt.sessionMode}
                            </div>
                          </div>
                        </td>

                        <td className="py-5 px-6 align-top hidden md:table-cell">
                          <p className="text-sm text-slate-600 max-w-[200px] truncate" title={apt.reason}>"{apt.reason || "General Checkup"}"</p>
                          
                          {switchPending && (
                            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-amber-600">
                              <AlertCircle size={12} /> Pending switch to {apt.modeSwitchRequest.requestedMode}
                            </div>
                          )}
                          {switchApproved && (
                            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
                              <CheckCircle2 size={12} /> Switched to {apt.sessionMode}
                            </div>
                          )}
                          {canJoin && (
                            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-black uppercase bg-red-100 text-red-600 px-2 py-0.5 rounded-md w-fit animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-600" /> LIVE NOW
                            </div>
                          )}
                        </td>

                        <td className="py-5 px-6 align-top">
                          <div className="flex flex-col items-end gap-2">
                             {canJoin ? (
                               <div className="flex gap-2">
                                 <button onClick={() => navigate(`/session/${apt._id}`)} className="p-2 border border-teal-200 rounded-lg text-teal-600 hover:bg-teal-50 transition" title="Chat">
                                   <MessageCircle size={16} />
                                 </button>
                                 <button onClick={() => navigate(`/session/${apt._id}`)} className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md shadow-red-200 transition-all animate-pulse">
                                   <Video size={14} /> Join Call
                                 </button>
                               </div>
                             ) : canRequestSwitch ? (
                               <button onClick={() => handleRequestModeSwitch(apt._id, apt.sessionMode)} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:border-teal-300 hover:text-teal-700 transition">
                                 <RefreshCw size={12} /> Switch to {apt.sessionMode === 'online' ? 'Offline' : 'Online'}
                               </button>
                             ) : (
                               <span className="text-xs text-slate-400 italic">No actions available</span>
                             )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <span className="text-sm text-slate-500 font-medium">
                Page <span className="font-bold text-slate-900">{currentPage}</span> of <span className="font-bold text-slate-900">{totalPages}</span>
              </span>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-slate-200 rounded-lg bg-white disabled:opacity-50 hover:bg-slate-50 transition"
                >
                  <ChevronLeft size={16} />
                </button>
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
      )}

    </div>
  );
};

export default PatientBooking;