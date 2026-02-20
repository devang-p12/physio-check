import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Monitor, MapPin, Calendar, Clock, ChevronLeft, RefreshCw, AlertCircle, CheckCircle2, Video, MessageCircle } from 'lucide-react';

const PatientBooking = () => {
  const { doctorId } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('book');
  const [slots, setSlots] = useState([]);
  const [myAppointments, setMyAppointments] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reason, setReason] = useState("");
  const [sessionMode, setSessionMode] = useState("online");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

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

  // Returns true if appointment is within 10 min before start and before end
  const isLiveNow = (apt) => {
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
        setSelectedSlot(null);
        setReason("");
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

  const handleRequestModeSwitch = async (appointmentId, currentMode) => {
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

  const groupedSlots = (slots || []).reduce((acc, slot) => {
    const date = slot.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(slot);
    return acc;
  }, {});

  const getStatusColor = (status) => {
    if (status === 'approved') return 'bg-green-100 text-green-700';
    if (status === 'pending') return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
  };

  if (fetching && activeTab === 'book') return (
    <div className="flex justify-center items-center h-screen bg-white">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-gray-50 min-h-screen font-sans">
      <header className="mb-8">
        <button onClick={() => navigate('/patient/doctors')} className="flex items-center text-indigo-600 font-semibold text-sm mb-4 hover:underline">
          <ChevronLeft size={16} /> View All Doctors
        </button>

        <div className="flex gap-2 p-1 bg-white rounded-2xl border border-gray-200 shadow-sm w-fit">
          <button
            onClick={() => setActiveTab('book')}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'book' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:text-indigo-500'}`}
          >
            Book Appointment
          </button>
          <button
            onClick={() => { setActiveTab('myAppointments'); fetchMyAppointments(); }}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'myAppointments' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:text-indigo-500'}`}
          >
            My Appointments
            {myAppointments.length > 0 && (
              <span className="ml-2 bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 text-[10px] font-black">
                {myAppointments.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ─── TAB: BOOK ─── */}
      {activeTab === 'book' && (
        <>
          <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Weekly Schedule</h2>
              <p className="text-gray-500">Choose a time and session type for your consultation.</p>
            </div>
            <div className="flex gap-4 p-3 bg-white rounded-xl border border-gray-200 shadow-sm text-[10px] font-bold tracking-wider">
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-green-500 rounded-sm"></span> FREE</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-yellow-400 rounded-sm"></span> PENDING</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-red-400 rounded-sm"></span> BOOKED</div>
            </div>
          </div>

          <div className="overflow-x-auto pb-4">
            <div className="inline-flex md:grid md:grid-cols-7 gap-4 min-w-[1000px] md:min-w-full">
              {Object.entries(groupedSlots).map(([date, daySlots]) => {
                const dateObj = new Date(date);
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                const dayNum = dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });

                return (
                  <div key={date} className="flex-1 flex flex-col gap-3 min-w-[140px]">
                    <div className="text-center p-3 bg-indigo-600 text-white rounded-2xl shadow-md">
                      <div className="text-xs uppercase font-bold opacity-80">{dayName}</div>
                      <div className="text-lg font-black">{dayNum}</div>
                    </div>
                    <div className="flex flex-col gap-2 p-2 bg-gray-100/50 rounded-2xl min-h-[400px]">
                      {daySlots.map((slot, index) => {
                        const time = new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const isSelected = selectedSlot === slot;
                        let style, disabled = false;

                        if (slot.status === "approved") {
                          style = "bg-red-50 border-red-100 text-red-300 cursor-not-allowed"; disabled = true;
                        } else if (slot.status === "pending") {
                          style = "bg-yellow-50 border-yellow-100 text-yellow-600 cursor-not-allowed"; disabled = true;
                        } else if (isSelected) {
                          style = "bg-indigo-600 border-indigo-600 text-white shadow-lg ring-2 ring-indigo-200 ring-offset-1";
                        } else {
                          style = "bg-green-50 border-green-100 text-green-700 hover:bg-green-100 hover:scale-[1.02]";
                        }

                        return (
                          <button
                            key={index}
                            disabled={disabled}
                            onClick={() => setSelectedSlot(slot)}
                            className={`py-3 px-2 rounded-xl border text-[11px] font-bold transition-all duration-150 flex flex-col items-center gap-0.5 ${style}`}
                          >
                            {time}
                            <span className="text-[8px] opacity-60 uppercase">{slot.status === 'available' ? 'Free' : slot.status}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ─── TAB: MY APPOINTMENTS ─── */}
      {activeTab === 'myAppointments' && (
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">My Appointments</h2>
            <button onClick={fetchMyAppointments} className="flex items-center gap-2 text-indigo-600 text-sm font-bold hover:underline">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {myAppointments.length === 0 ? (
            <div className="text-center py-20">
              <Clock className="mx-auto text-gray-200 mb-2" size={48} />
              <p className="text-gray-400 italic">No appointments yet. Book one above!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {myAppointments.map((apt) => {
                const switchPending = apt.modeSwitchRequest?.status === 'pending';
                const switchApproved = apt.modeSwitchRequest?.status === 'approved';
                const canRequestSwitch = apt.status === 'approved' && !switchPending;
                const live = isLiveNow(apt);
                // Chat & video only for online + approved + live time window
                const canJoin = apt.status === 'approved' && apt.sessionMode === 'online' && live;

                return (
                  <div key={apt._id} className={`border rounded-[1.5rem] p-5 hover:shadow-md transition-all ${canJoin ? 'border-indigo-200 bg-indigo-50/30' : 'border-gray-100'}`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                      {/* Left: Info */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-black text-gray-900">{apt.doctorId?.name || "Doctor"}</p>
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${getStatusColor(apt.status)}`}>
                            {apt.status}
                          </span>
                          {/* LIVE pill — only shows during the time window */}
                          {canJoin && (
                            <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-red-100 text-red-600 animate-pulse">
                              ● LIVE NOW
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-blue-600 font-medium">"{apt.reason || "General Checkup"}"</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Calendar size={12} />
                            {new Date(apt.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock size={12} />
                            {new Date(apt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      {/* Right: Mode + Actions */}
                      <div className="flex flex-col items-end gap-3">

                        {/* Mode Badge */}
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase ${apt.sessionMode === 'online' ? 'bg-indigo-50 text-indigo-600' : 'bg-orange-50 text-orange-600'}`}>
                          {apt.sessionMode === 'online' ? <Monitor size={12} /> : <MapPin size={12} />}
                          {apt.sessionMode}
                        </div>

                        {/* ── CHAT + VIDEO CALL BUTTONS (only when live) ── */}
                        {canJoin && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => navigate(`/session/${apt._id}`)}
                              title="Open Chat"
                              className="flex items-center gap-1.5 bg-white border-2 border-indigo-200 text-indigo-600 px-3 py-2 rounded-xl text-[10px] font-black hover:bg-indigo-50 transition-all"
                            >
                              <MessageCircle size={14} /> Chat
                            </button>
                            <button
                              onClick={() => navigate(`/session/${apt._id}`)}
                              title="Join Video Call"
                              className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-2 rounded-xl text-[10px] font-black hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all animate-pulse"
                            >
                              <Video size={14} /> Join Call
                            </button>
                          </div>
                        )}

                        {/* Mode switch pending status */}
                        {switchPending && (
                          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-xl text-[9px] font-black text-amber-700 uppercase">
                            <AlertCircle size={11} />
                            Switch to {apt.modeSwitchRequest.requestedMode} — Awaiting Doctor
                          </div>
                        )}

                        {/* Mode switch approved status */}
                        {switchApproved && (
                          <div className="flex items-center gap-1.5 bg-green-50 border border-green-100 px-3 py-1.5 rounded-xl text-[9px] font-black text-green-700 uppercase">
                            <CheckCircle2 size={11} />
                            Mode switched to {apt.sessionMode}
                          </div>
                        )}

                        {/* Request Mode Switch Button */}
                        {canRequestSwitch && (
                          <button
                            onClick={() => handleRequestModeSwitch(apt._id, apt.sessionMode)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-indigo-200 text-indigo-600 text-[10px] font-black hover:bg-indigo-50 transition-all"
                          >
                            <RefreshCw size={11} />
                            Switch to {apt.sessionMode === 'online' ? 'Offline' : 'Online'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Booking Confirmation Modal ─── */}
      {selectedSlot && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl w-full max-w-md border border-gray-100">
            <h4 className="text-2xl font-black text-gray-900 mb-6">Confirm Session</h4>

            <div className="mb-6">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 block">Initial Session Mode</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-2xl">
                <button
                  onClick={() => setSessionMode("online")}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${sessionMode === 'online' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-indigo-400'}`}
                >
                  <Monitor size={16} /> Online
                </button>
                <button
                  onClick={() => setSessionMode("offline")}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${sessionMode === 'offline' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-indigo-400'}`}
                >
                  <MapPin size={16} /> Offline
                </button>
              </div>
              <p className="text-[9px] text-gray-400 mt-2 italic">* You can request a mode switch later if needed.</p>
            </div>

            <div className="bg-indigo-50 p-5 rounded-[2rem] mb-6 border border-indigo-100">
              <p className="text-indigo-800 text-sm font-bold flex items-center gap-2">
                <Calendar size={14} /> {new Date(selectedSlot.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <p className="text-indigo-600 text-xl font-black mt-1 flex items-center gap-2">
                <Clock size={18} /> {new Date(selectedSlot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            <textarea
              className="w-full border-2 border-gray-50 bg-gray-50 rounded-2xl p-4 text-sm focus:border-indigo-500 focus:bg-white outline-none transition-all mb-6"
              placeholder="What would you like to discuss?..."
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />

            <div className="flex gap-3">
              <button onClick={() => setSelectedSlot(null)} className="flex-1 py-4 rounded-2xl font-bold text-gray-400 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button
                onClick={handleBook}
                disabled={loading}
                className="flex-[2] bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-200 disabled:bg-gray-300 transition-all"
              >
                {loading ? "Processing..." : "Confirm Booking"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientBooking;