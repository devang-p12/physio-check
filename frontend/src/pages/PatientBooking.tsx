import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Monitor, MapPin, Calendar, Clock, ChevronLeft, ChevronRight,
  RefreshCw, AlertCircle, CheckCircle2, Video, MessageCircle,
  CalendarX, Loader2, Search, ArrowRight, Stethoscope, Zap
} from 'lucide-react';

const PatientBooking = () => {
  const { doctorId } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('book');
  const [slots, setSlots] = useState([]);
  const [myAppointments, setMyAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const [bookingStep, setBookingStep] = useState(1);
  const [sessionMode, setSessionMode] = useState("online");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [reason, setReason] = useState("");

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

  const getStatusBadge = (status: string) => {
    if (status === 'approved') return 'bg-[#A8DADC]/20 text-[#1D3557] border border-[#A8DADC]/60';
    if (status === 'pending') return 'bg-amber-100 text-amber-700 border border-amber-200';
    return 'bg-[#E63946]/10 text-[#E63946] border border-[#E63946]/30';
  };

  const filteredAppointments = myAppointments.filter((apt: any) => {
    const docName = (apt.doctorId?.name || "").toLowerCase();
    const txt = searchQuery.toLowerCase();
    return docName.includes(txt) || apt.status.includes(txt) || apt.sessionMode.includes(txt);
  });

  const totalPages = Math.ceil(filteredAppointments.length / itemsPerPage);
  const currentAppointments = filteredAppointments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const stepLabels = ["Mode", "Date", "Time", "Confirm"];
  const completedStep = bookingStep - 1;

  return (
    <div className="min-h-screen font-sans bg-[#F1FAEE] pb-24">

      {/* ── DEEP OCEAN HERO HEADER ── */}
      <section className="relative w-full bg-gradient-to-br from-[#1D3557] via-[#1D3557] to-[#457B9D] px-6 py-12 md:px-12 md:py-16 overflow-hidden rounded-b-[3rem] shadow-2xl shadow-[#1D3557]/20 mb-10">

        {/* Decorative radial glow */}
        <div className="absolute top-[-20%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#A8DADC]/10 via-transparent to-transparent z-0 opacity-80" />
        <div className="absolute inset-0 z-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(168,218,220,1) 1px, transparent 1px), linear-gradient(90deg, rgba(168,218,220,1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        {/* SVG circuit nodes */}
        <svg className="absolute inset-0 w-full h-full z-0 opacity-20 mix-blend-color-dodge" xmlns="http://www.w3.org/2000/svg">
          <g stroke="#A8DADC" strokeWidth="1.5" fill="#F1FAEE">
            <line x1="15%" y1="15%" x2="45%" y2="60%" strokeDasharray="4 4" />
            <circle cx="15%" cy="15%" r="5" />
            <line x1="45%" y1="60%" x2="75%" y2="35%" strokeDasharray="4 4" />
            <circle cx="45%" cy="60%" r="6" fill="#457B9D" />
            <circle cx="75%" cy="35%" r="5" />
            <line x1="75%" y1="35%" x2="90%" y2="75%" strokeDasharray="4 4" />
            <circle cx="90%" cy="75%" r="4" />
          </g>
        </svg>

        <div className="max-w-6xl mx-auto relative z-10">
          <button
            onClick={() => navigate('/patient/doctors')}
            className="flex items-center text-[#A8DADC] font-bold text-sm mb-6 hover:text-white transition-colors group"
          >
            <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Back to Specialists
          </button>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl flex items-center justify-center text-[#A8DADC]">
                  <Stethoscope size={24} />
                </div>
                <h1 className="text-4xl md:text-5xl font-black text-[#F1FAEE] tracking-tight">Book a Session</h1>
              </div>
              <p className="text-[#A8DADC] text-lg max-w-md">Choose your preferred time and consultation type to book with your specialist.</p>
            </div>

            {/* Tab switcher */}
            <div className="flex p-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl gap-1 shadow-xl w-fit">
              <button
                onClick={() => setActiveTab('book')}
                className={`px-6 py-2.5 rounded-xl font-black text-[13px] uppercase tracking-widest transition-all ${
                  activeTab === 'book'
                    ? 'bg-[#F1FAEE] text-[#1D3557] shadow-lg'
                    : 'text-[#A8DADC] hover:text-white'
                }`}
              >
                Book
              </button>
              <button
                onClick={() => { setActiveTab('myAppointments'); fetchMyAppointments(); }}
                className={`px-6 py-2.5 rounded-xl font-black text-[13px] uppercase tracking-widest transition-all flex items-center gap-2 ${
                  activeTab === 'myAppointments'
                    ? 'bg-[#F1FAEE] text-[#1D3557] shadow-lg'
                    : 'text-[#A8DADC] hover:text-white'
                }`}
              >
                My Appointments
                {myAppointments.length > 0 && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                    activeTab === 'myAppointments' ? 'bg-[#1D3557]/10 text-[#1D3557]' : 'bg-white/20 text-white'
                  }`}>
                    {myAppointments.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 md:px-12">

        {/* ─── TAB: BOOK ─── */}
        {activeTab === 'book' && (
          <div>
            {/* Step Progress Indicator */}
            <div className="flex items-center justify-center mb-10">
              {stepLabels.map((label, i) => {
                const stepNum = i + 1;
                const isCompleted = bookingStep > stepNum;
                const isActive = bookingStep === stepNum;
                return (
                  <React.Fragment key={label}>
                    <div className="flex flex-col items-center gap-1.5">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-all duration-300 border-2 ${
                        isCompleted
                          ? 'bg-[#1D3557] border-[#1D3557] text-white'
                          : isActive
                          ? 'bg-[#457B9D] border-[#457B9D] text-white shadow-lg shadow-[#457B9D]/30'
                          : 'bg-white border-[#A8DADC]/40 text-[#A8DADC]'
                      }`}>
                        {isCompleted ? <CheckCircle2 size={18} /> : stepNum}
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${
                        isActive ? 'text-[#1D3557]' : isCompleted ? 'text-[#457B9D]' : 'text-[#A8DADC]'
                      }`}>{label}</span>
                    </div>
                    {i < stepLabels.length - 1 && (
                      <div className={`h-0.5 w-16 md:w-24 mx-2 mb-5 rounded-full transition-all duration-500 ${
                        bookingStep > stepNum ? 'bg-[#1D3557]' : 'bg-[#A8DADC]/30'
                      }`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {fetching ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4">
                <div className="w-20 h-20 rounded-3xl bg-[#1D3557]/5 flex items-center justify-center">
                  <Loader2 size={36} className="animate-spin text-[#457B9D]" />
                </div>
                <p className="text-sm font-black tracking-widest text-[#457B9D]/60 uppercase">Loading calendar...</p>
              </div>
            ) : availableDates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 gap-6 bg-white rounded-[2rem] border border-[#1D3557]/5 shadow-xl shadow-[#1D3557]/[0.03]">
                <div className="w-24 h-24 rounded-3xl bg-[#1D3557]/5 flex items-center justify-center text-[#A8DADC]">
                  <CalendarX size={40} />
                </div>
                <div className="text-center">
                  <p className="font-black text-[#1D3557] text-2xl">No availability set</p>
                  <p className="text-[#457B9D] mt-2 max-w-sm mx-auto">This doctor hasn't added available slots yet. Please try another specialist.</p>
                </div>
                <button
                  onClick={fetchSlots}
                  className="flex items-center gap-2 bg-[#1D3557]/5 hover:bg-[#1D3557]/10 text-[#1D3557] px-6 py-3 rounded-xl font-bold transition"
                >
                  <RefreshCw size={16} /> Refresh Calendar
                </button>
              </div>
            ) : (
              <div className="flex flex-col lg:flex-row gap-8">
                {/* Wizard Steps */}
                <div className="flex-1 space-y-6">

                  {/* STEP 1: MODE */}
                  <div className={`bg-white rounded-[2rem] border border-[#1D3557]/5 shadow-xl shadow-[#1D3557]/[0.03] p-8 transition-all duration-300 ${bookingStep >= 1 ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    <div className="flex items-center gap-3 mb-6">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${bookingStep >= 2 ? 'bg-[#1D3557] text-white' : 'bg-[#457B9D] text-white'}`}>
                        {bookingStep >= 2 ? <CheckCircle2 size={16} /> : '1'}
                      </div>
                      <h3 className="text-[11px] font-black text-[#457B9D] uppercase tracking-widest">Consultation Mode</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { mode: 'online', label: 'Online Video', icon: <Monitor size={36} />, desc: 'Consult from anywhere via secure video call' },
                        { mode: 'offline', label: 'In-Clinic', icon: <MapPin size={36} />, desc: 'Visit the clinic for an in-person session' },
                      ].map(({ mode, label, icon, desc }) => {
                        const isSelected = sessionMode === mode && bookingStep >= 2;
                        return (
                          <button
                            key={mode}
                            onClick={() => { setSessionMode(mode); setBookingStep(Math.max(bookingStep, 2)); }}
                            className={`relative flex flex-col items-center justify-center gap-3 p-7 rounded-2xl border-2 transition-all duration-200 text-center group overflow-hidden ${
                              isSelected
                                ? 'border-[#457B9D] bg-gradient-to-br from-[#1D3557] to-[#457B9D] text-white shadow-xl shadow-[#457B9D]/30'
                                : 'border-[#A8DADC]/30 bg-[#F1FAEE]/50 text-[#457B9D] hover:border-[#457B9D]/60 hover:bg-[#F1FAEE]'
                            }`}
                          >
                            <div className={`transition-transform group-hover:scale-110 ${isSelected ? 'text-[#A8DADC]' : 'text-[#457B9D]'}`}>{icon}</div>
                            <span className={`font-black text-lg ${isSelected ? 'text-white' : 'text-[#1D3557]'}`}>{label}</span>
                            <span className={`text-xs leading-snug ${isSelected ? 'text-[#A8DADC]' : 'text-[#457B9D]/70'}`}>{desc}</span>
                            {isSelected && (
                              <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                                <CheckCircle2 size={14} className="text-white" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* STEP 2: DATE */}
                  <div className={`bg-white rounded-[2rem] border border-[#1D3557]/5 shadow-xl shadow-[#1D3557]/[0.03] p-8 transition-all duration-300 ${bookingStep >= 2 ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    <div className="flex items-center gap-3 mb-6">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${bookingStep >= 3 ? 'bg-[#1D3557] text-white' : 'bg-[#457B9D] text-white'}`}>
                        {bookingStep >= 3 ? <CheckCircle2 size={16} /> : '2'}
                      </div>
                      <h3 className="text-[11px] font-black text-[#457B9D] uppercase tracking-widest">Choose a Date</h3>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-3 snap-x scrollbar-hide">
                      {availableDates.map(date => {
                        const d = new Date(date);
                        const isSelected = selectedDate === date;
                        return (
                          <button
                            key={date}
                            onClick={() => {
                              setSelectedDate(date);
                              setSelectedSlot(null);
                              setBookingStep(Math.max(bookingStep, 3));
                            }}
                            className={`snap-start shrink-0 w-[88px] py-5 px-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all duration-200 border-2 ${
                              isSelected
                                ? 'border-[#1D3557] bg-gradient-to-br from-[#1D3557] to-[#457B9D] text-white shadow-xl shadow-[#1D3557]/20'
                                : 'border-[#A8DADC]/30 bg-[#F1FAEE]/50 text-[#457B9D] hover:border-[#457B9D]/50'
                            }`}
                          >
                            <span className={`text-[10px] font-black uppercase tracking-widest ${isSelected ? 'text-[#A8DADC]' : 'text-[#A8DADC]'}`}>
                              {d.toLocaleDateString('en-US', { weekday: 'short' })}
                            </span>
                            <span className={`text-3xl font-black leading-none ${isSelected ? 'text-white' : 'text-[#1D3557]'}`}>{d.getDate()}</span>
                            <span className={`text-[11px] font-semibold ${isSelected ? 'text-[#A8DADC]' : 'text-[#457B9D]'}`}>
                              {d.toLocaleDateString('en-US', { month: 'short' })}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* STEP 3: TIME */}
                  <div className={`bg-white rounded-[2rem] border border-[#1D3557]/5 shadow-xl shadow-[#1D3557]/[0.03] p-8 transition-all duration-300 ${bookingStep >= 3 ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    <div className="flex items-center gap-3 mb-6">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${bookingStep >= 4 ? 'bg-[#1D3557] text-white' : 'bg-[#457B9D] text-white'}`}>
                        {bookingStep >= 4 ? <CheckCircle2 size={16} /> : '3'}
                      </div>
                      <h3 className="text-[11px] font-black text-[#457B9D] uppercase tracking-widest">Choose a Time Slot</h3>
                    </div>
                    {selectedDate ? (
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
                              className={`py-3.5 px-2 rounded-xl border-2 text-sm font-bold transition-all flex flex-col items-center gap-1 ${
                                isUnavailable
                                  ? 'border-[#A8DADC]/20 bg-[#F1FAEE]/50 text-[#A8DADC]/40 cursor-not-allowed'
                                  : isSelected
                                  ? 'border-[#1D3557] bg-gradient-to-br from-[#1D3557] to-[#457B9D] text-white shadow-lg shadow-[#1D3557]/20'
                                  : 'border-[#A8DADC]/30 bg-[#F1FAEE]/50 text-[#1D3557] hover:border-[#457B9D] hover:bg-[#F1FAEE]'
                              }`}
                            >
                              <Clock size={14} className={isUnavailable ? 'opacity-30' : isSelected ? 'text-[#A8DADC]' : 'text-[#457B9D]'} />
                              {time}
                              {isUnavailable && <span className="text-[9px] uppercase tracking-wider opacity-60">{slot.status}</span>}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-12 text-[#A8DADC]/60">
                        <div className="text-center">
                          <Calendar size={32} className="mx-auto mb-2 opacity-40" />
                          <p className="text-sm font-semibold">Select a date first to view available times</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* STEP 4: BOOKING SUMMARY PANEL */}
                <div className="lg:w-[380px] shrink-0">
                  <div className={`sticky top-8 rounded-[2rem] overflow-hidden border-2 transition-all duration-500 shadow-2xl ${
                    bookingStep === 4
                      ? 'border-[#457B9D]/40 shadow-[#457B9D]/10'
                      : 'border-[#A8DADC]/20 shadow-[#1D3557]/5'
                  }`}>
                    {/* Panel Header */}
                    <div className="bg-gradient-to-br from-[#1D3557] to-[#457B9D] p-6 relative overflow-hidden">
                      <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-white/5 rounded-full blur-2xl" />
                      <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-1">
                          <div className="w-8 h-8 bg-white/15 rounded-xl flex items-center justify-center">
                            <CheckCircle2 size={18} className="text-[#A8DADC]" />
                          </div>
                          <h3 className="text-lg font-black text-[#F1FAEE]">Booking Summary</h3>
                        </div>
                        <p className="text-[#A8DADC] text-sm ml-11">Review your session before confirming</p>
                      </div>
                    </div>

                    {/* Panel Body */}
                    <div className="bg-white p-6">
                      {bookingStep < 4 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                          <div className="w-20 h-20 rounded-full border-2 border-dashed border-[#A8DADC]/40 flex items-center justify-center">
                            <Zap size={28} className="text-[#A8DADC]/40" />
                          </div>
                          <div>
                            <p className="font-black text-[#1D3557] text-lg">Almost there!</p>
                            <p className="text-[#457B9D]/70 text-sm mt-1 max-w-[220px] mx-auto">Complete all 3 steps to review and confirm your booking.</p>
                          </div>
                          <div className="flex flex-col gap-1.5 w-full mt-2">
                            {['Consultation Mode', 'Select Date', 'Pick Time Slot'].map((step, i) => (
                              <div key={step} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                bookingStep > i + 1
                                  ? 'bg-[#1D3557]/5 text-[#1D3557]'
                                  : bookingStep === i + 1
                                  ? 'bg-[#457B9D]/10 text-[#457B9D] border border-[#457B9D]/20'
                                  : 'bg-[#F1FAEE] text-[#A8DADC]'
                              }`}>
                                {bookingStep > i + 1
                                  ? <CheckCircle2 size={16} className="text-[#457B9D] shrink-0" />
                                  : <div className={`w-4 h-4 rounded-full border-2 shrink-0 ${bookingStep === i + 1 ? 'border-[#457B9D]' : 'border-[#A8DADC]/40'}`} />
                                }
                                {step}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Mode chip */}
                          <div className="flex items-center gap-4 p-4 bg-[#F1FAEE] rounded-2xl border border-[#A8DADC]/20">
                            <div className="w-11 h-11 bg-gradient-to-br from-[#1D3557] to-[#457B9D] text-white rounded-xl flex items-center justify-center shrink-0">
                              {sessionMode === 'online' ? <Monitor size={20} /> : <MapPin size={20} />}
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-[#A8DADC] uppercase tracking-widest">Mode</p>
                              <p className="font-bold text-[#1D3557] capitalize">{sessionMode} Consultation</p>
                            </div>
                          </div>

                          {/* Date & Time chip */}
                          <div className="flex items-center gap-4 p-4 bg-[#F1FAEE] rounded-2xl border border-[#A8DADC]/20">
                            <div className="w-11 h-11 bg-gradient-to-br from-[#1D3557] to-[#457B9D] text-white rounded-xl flex items-center justify-center shrink-0">
                              <Calendar size={20} />
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-[#A8DADC] uppercase tracking-widest">Date & Time</p>
                              <p className="font-bold text-[#1D3557]">
                                {new Date(selectedSlot.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                              </p>
                              <p className="text-sm font-semibold text-[#457B9D]">
                                {new Date(selectedSlot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {' – '}
                                {new Date(selectedSlot.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>

                          {/* Reason textarea */}
                          <div>
                            <label className="text-[10px] font-black text-[#457B9D] uppercase tracking-widest block mb-2">Reason / Notes</label>
                            <textarea
                              placeholder="Describe your symptoms or what you'd like to discuss..."
                              className="w-full bg-[#F1FAEE] border-2 border-[#A8DADC]/30 rounded-2xl p-4 text-sm focus:outline-none focus:ring-4 focus:ring-[#A8DADC]/20 focus:border-[#457B9D] resize-none h-28 font-medium text-[#1D3557] transition-all"
                              value={reason}
                              onChange={e => setReason(e.target.value)}
                            />
                          </div>

                          {/* Confirm button */}
                          <button
                            onClick={handleBook}
                            disabled={loading || !reason.trim()}
                            className="w-full bg-gradient-to-r from-[#1D3557] to-[#457B9D] text-white font-black py-4 rounded-2xl shadow-xl shadow-[#1D3557]/20 hover:shadow-[#457B9D]/30 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:hover:translate-y-0 flex items-center justify-center gap-3 text-[15px] uppercase tracking-widest"
                          >
                            {loading
                              ? <><Loader2 className="animate-spin" size={20} /> Booking...</>
                              : <><CheckCircle2 size={20} /> Confirm Booking</>
                            }
                          </button>

                          <button
                            onClick={() => { setBookingStep(3); setSelectedSlot(null); }}
                            className="w-full text-[#457B9D] font-bold text-sm py-2 hover:text-[#1D3557] transition-colors"
                          >
                            ← Change time slot
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB: MY APPOINTMENTS ─── */}
        {activeTab === 'myAppointments' && (
          <div>
            {/* Header Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-black text-[#1D3557] tracking-tight">My Appointments</h2>
                <p className="text-[#457B9D] text-sm mt-0.5">Manage your upcoming and past sessions</p>
              </div>
              <div className="flex gap-3">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#457B9D]/50" size={16} />
                  <input
                    type="text"
                    placeholder="Search appointments..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="pl-10 pr-4 py-3 bg-white border-2 border-[#A8DADC]/30 rounded-2xl focus:outline-none focus:ring-4 focus:ring-[#A8DADC]/20 focus:border-[#457B9D] text-sm font-semibold text-[#1D3557] w-full md:w-64 transition-all shadow-sm"
                  />
                </div>
                <button
                  onClick={fetchMyAppointments}
                  className="p-3 border-2 border-[#A8DADC]/30 bg-white rounded-2xl text-[#457B9D] hover:bg-[#F1FAEE] hover:border-[#457B9D]/50 transition-all shadow-sm"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            </div>

            {currentAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 gap-6 bg-white rounded-[2rem] border border-[#1D3557]/5 shadow-xl shadow-[#1D3557]/[0.03]">
                <div className="w-24 h-24 rounded-3xl bg-[#1D3557]/5 flex items-center justify-center text-[#A8DADC]">
                  <Clock size={40} />
                </div>
                <div className="text-center">
                  <p className="font-black text-[#1D3557] text-2xl">No appointments yet</p>
                  <p className="text-[#457B9D] mt-2">Book your first session using the Book tab above.</p>
                </div>
                <button
                  onClick={() => setActiveTab('book')}
                  className="flex items-center gap-2 bg-gradient-to-r from-[#1D3557] to-[#457B9D] text-white px-8 py-3.5 rounded-2xl font-black shadow-xl shadow-[#1D3557]/20 transition-all hover:-translate-y-0.5 uppercase tracking-widest text-sm"
                >
                  Book a Session <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {currentAppointments.map((apt: any) => {
                  const switchPending = apt.modeSwitchRequest?.status === 'pending';
                  const switchApproved = apt.modeSwitchRequest?.status === 'approved';
                  const canRequestSwitch = apt.status === 'approved' && !switchPending;
                  const live = isLiveNow(apt);
                  const canJoin = apt.status === 'approved' && apt.sessionMode === 'online' && live;

                  return (
                    <div
                      key={apt._id}
                      className={`bg-white rounded-[2rem] border-2 transition-all duration-300 shadow-lg hover:-translate-y-0.5 relative overflow-hidden ${
                        canJoin
                          ? 'border-[#E63946]/30 shadow-[#E63946]/10'
                          : 'border-[#A8DADC]/20 shadow-[#1D3557]/[0.03]'
                      }`}
                    >
                      {/* Live indicator strip */}
                      {canJoin && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#E63946] to-[#457B9D] animate-pulse" />
                      )}

                      <div className="p-6 flex flex-col md:flex-row md:items-center gap-5">
                        {/* Doctor avatar */}
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black shrink-0 border-2 ${
                          canJoin
                            ? 'bg-gradient-to-br from-[#E63946] to-[#457B9D] text-white border-transparent'
                            : 'bg-[#1D3557]/5 text-[#1D3557] border-[#A8DADC]/20'
                        }`}>
                          {(apt.doctorId?.name || 'D').charAt(0)}
                        </div>

                        {/* Main info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h3 className="font-black text-[#1D3557] text-lg">Dr. {apt.doctorId?.name || 'Doctor'}</h3>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusBadge(apt.status)}`}>
                              {apt.status}
                            </span>
                            {canJoin && (
                              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-[#E63946]/10 text-[#E63946] border border-[#E63946]/30 animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#E63946]" /> Live Now
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-3 text-sm text-[#457B9D]">
                            <span className="flex items-center gap-1.5 font-semibold">
                              <Calendar size={14} className="text-[#A8DADC]" />
                              {new Date(apt.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                            <span className="flex items-center gap-1.5 font-semibold">
                              <Clock size={14} className="text-[#A8DADC]" />
                              {new Date(apt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                              apt.sessionMode === 'online'
                                ? 'bg-[#1D3557]/5 text-[#1D3557]'
                                : 'bg-[#457B9D]/10 text-[#457B9D]'
                            }`}>
                              {apt.sessionMode === 'online' ? <Monitor size={11} /> : <MapPin size={11} />}
                              {apt.sessionMode}
                            </span>
                          </div>

                          {apt.reason && (
                            <p className="text-sm text-[#457B9D]/70 mt-1.5 truncate max-w-md">"{apt.reason}"</p>
                          )}

                          {switchPending && (
                            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-amber-600">
                              <AlertCircle size={13} /> Switch to {apt.modeSwitchRequest.requestedMode} — pending doctor approval
                            </div>
                          )}
                          {switchApproved && (
                            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-[#457B9D]">
                              <CheckCircle2 size={13} /> Mode switched to {apt.sessionMode}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {canJoin ? (
                            <>
                              <button
                                onClick={() => navigate(`/session/${apt._id}`)}
                                className="w-10 h-10 flex items-center justify-center rounded-xl border-2 border-[#A8DADC]/30 text-[#457B9D] hover:bg-[#F1FAEE] transition"
                                title="Chat"
                              >
                                <MessageCircle size={16} />
                              </button>
                              <button
                                onClick={() => navigate(`/session/${apt._id}`)}
                                className="flex items-center gap-2 bg-gradient-to-r from-[#E63946] to-[#c62229] text-white px-5 py-2.5 rounded-xl text-sm font-black shadow-lg shadow-[#E63946]/30 transition-all hover:-translate-y-0.5 animate-pulse"
                              >
                                <Video size={16} /> Join Call
                              </button>
                            </>
                          ) : canRequestSwitch ? (
                            <button
                              onClick={() => handleRequestModeSwitch(apt._id, apt.sessionMode)}
                              className="flex items-center gap-1.5 border-2 border-[#A8DADC]/30 text-[#457B9D] px-4 py-2.5 rounded-xl text-xs font-bold hover:border-[#457B9D] hover:bg-[#F1FAEE] transition-all"
                            >
                              <RefreshCw size={13} /> Switch to {apt.sessionMode === 'online' ? 'Offline' : 'Online'}
                            </button>
                          ) : (
                            <span className="text-xs text-[#A8DADC] italic px-2">No actions</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 bg-white px-6 py-5 rounded-[2rem] shadow-lg shadow-[#1D3557]/[0.02] border border-[#1D3557]/5">
                <span className="text-sm text-[#457B9D] font-bold">
                  Page <span className="text-[#1D3557]">{currentPage}</span> of <span className="text-[#1D3557]">{totalPages}</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="w-10 h-10 flex items-center justify-center border-2 border-[#A8DADC]/30 rounded-xl bg-white text-[#457B9D] disabled:opacity-40 hover:border-[#457B9D] hover:text-[#1D3557] transition-all"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`w-10 h-10 rounded-xl text-[14px] font-black transition-all ${
                        currentPage === i + 1
                          ? 'bg-gradient-to-br from-[#1D3557] to-[#457B9D] text-white shadow-md'
                          : 'text-[#457B9D] hover:bg-[#F1FAEE]'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="w-10 h-10 flex items-center justify-center border-2 border-[#A8DADC]/30 rounded-xl bg-white text-[#457B9D] disabled:opacity-40 hover:border-[#457B9D] hover:text-[#1D3557] transition-all"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientBooking;