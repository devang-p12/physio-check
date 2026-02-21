import React, { useState, useEffect } from 'react';
import {
  Monitor,
  MapPin,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Video,
  MessageCircle
} from 'lucide-react';

const DoctorCalendar = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    dayOfWeek: 1,
    startTime: "10:00",
    endTime: "10:30"
  });

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

  const handleSetAvailability = async (e) => {
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

  const handleAppointmentUpdate = async (appointmentId, status, switchAction, patientEmail) => {
    try {
      const payload = { appointmentId };
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

  const autoAddPatientToDirectory = async (email) => {
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

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT: AVAILABILITY FORM */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
          <h2 className="text-xl font-black mb-6 text-gray-900 tracking-tight">Weekly Hours</h2>
          <form onSubmit={handleSetAvailability} className="space-y-5">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Repeat on Day</label>
              <select
                className="w-full mt-2 p-3 bg-gray-50 border-2 border-gray-50 rounded-2xl focus:border-blue-500 focus:bg-white outline-none transition-all"
                value={form.dayOfWeek}
                onChange={(e) => setForm({ ...form, dayOfWeek: parseInt(e.target.value) })}
              >
                <option value={1}>Monday</option>
                <option value={2}>Tuesday</option>
                <option value={3}>Wednesday</option>
                <option value={4}>Thursday</option>
                <option value={5}>Friday</option>
                <option value={6}>Saturday</option>
                <option value={0}>Sunday</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Start Time</label>
                <input
                  type="time"
                  className="w-full mt-2 p-3 bg-gray-50 border-2 border-gray-50 rounded-2xl focus:border-blue-500 outline-none"
                  value={form.startTime}
                  onChange={e => setForm({ ...form, startTime: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">End Time</label>
                <input
                  type="time"
                  className="w-full mt-2 p-3 bg-gray-50 border-2 border-gray-50 rounded-2xl focus:border-blue-500 outline-none"
                  value={form.endTime}
                  onChange={e => setForm({ ...form, endTime: e.target.value })}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition shadow-xl shadow-blue-100 disabled:bg-gray-200"
            >
              {loading ? 'Saving...' : 'Set Availability'}
            </button>
          </form>
        </div>

        {/* RIGHT: APPOINTMENT MANAGEMENT */}
        <div className="lg:col-span-2 bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
          <h2 className="text-xl font-black mb-6 text-gray-900 tracking-tight">Patient Requests</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">
                  <th className="pb-4 px-2">Patient</th>
                  <th className="pb-4 px-2">Mode & Status</th>
                  <th className="pb-4 px-2">Date & Time</th>
                  <th className="pb-4 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {appointments.map((apt) => {
                  const hasModeSwitchRequest = apt.modeSwitchRequest?.status === 'pending';
                  // Show chat/video only for online + approved + isLiveNow (set by backend)
                  const canJoin = apt.status === 'approved' && apt.sessionMode === 'online' && apt.isLiveNow;

                  return (
                    <tr key={apt._id} className={`transition-colors group ${canJoin ? 'bg-indigo-50/40' : 'hover:bg-gray-50/50'}`}>
                      <td className="py-5 px-2">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="font-bold text-gray-900">{apt.patientId?.name || "Unknown"}</p>
                          {/* LIVE pill for doctor view */}
                          {canJoin && (
                            <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-red-100 text-red-600 animate-pulse">
                              ● LIVE
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400">{apt.patientId?.email}</p>
                        <p className="text-xs text-blue-600 font-medium mt-1">"{apt.reason || "General Checkup"}"</p>
                      </td>

                      <td className="py-5 px-2">
                        <div className="flex flex-col gap-2">
                          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg w-fit text-[10px] font-black uppercase ${apt.sessionMode === 'online' ? 'bg-indigo-50 text-indigo-600' : 'bg-orange-50 text-orange-600'}`}>
                            {apt.sessionMode === 'online' ? <Monitor size={12} /> : <MapPin size={12} />}
                            {apt.sessionMode}
                          </div>
                          <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase w-fit ${
                            apt.status === 'approved' ? 'bg-green-100 text-green-700' :
                            apt.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {apt.status}
                          </span>
                        </div>
                      </td>

                      <td className="py-5 px-2 text-xs font-bold text-gray-600">
                        <p>{new Date(apt.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                        <p className="text-gray-400 font-medium">{new Date(apt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </td>

                      <td className="py-5 px-2 text-right">
                        <div className="flex flex-col items-end gap-3">

                          {/* 1. INITIAL APPROVAL ACTIONS */}
                          {apt.status === 'pending' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAppointmentUpdate(apt._id, 'approved', undefined, apt.patientId?.email)}
                                className="bg-green-500 text-white p-2.5 rounded-xl hover:bg-green-600 transition shadow-md shadow-green-100"
                                title="Approve"
                              >
                                <CheckCircle2 size={16} />
                              </button>
                              <button
                                onClick={() => handleAppointmentUpdate(apt._id, 'rejected')}
                                className="bg-red-500 text-white p-2.5 rounded-xl hover:bg-red-600 transition shadow-md shadow-red-100"
                                title="Reject"
                              >
                                <XCircle size={16} />
                              </button>
                            </div>
                          )}

                          {/* 2. MODE SWITCH REQUEST — only visible when patient has sent one */}
                          {hasModeSwitchRequest && (
                            <div className="bg-blue-50 border-2 border-blue-100 p-3 rounded-2xl flex flex-col items-center gap-2">
                              <div className="flex items-center gap-1 text-[9px] font-black text-blue-700 uppercase">
                                <AlertCircle size={12} /> Patient wants {apt.modeSwitchRequest.requestedMode}
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleAppointmentUpdate(apt._id, undefined, 'approve')}
                                  className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-blue-700 transition"
                                >
                                  Accept Change
                                </button>
                                <button
                                  onClick={() => handleAppointmentUpdate(apt._id, undefined, 'reject')}
                                  className="bg-white text-gray-400 px-3 py-1.5 rounded-lg text-[10px] font-bold border border-gray-200 hover:bg-gray-50"
                                >
                                  Decline
                                </button>
                              </div>
                            </div>
                          )}

                          {/* 3. CHAT + VIDEO CALL — only when online + approved + live */}
                          {canJoin && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => window.open(`/session/${apt._id}`, '_blank')}
                                title="Open Chat"
                                className="flex items-center gap-1.5 bg-white border-2 border-indigo-200 text-indigo-600 px-3 py-2 rounded-xl text-[10px] font-black hover:bg-indigo-50 transition-all"
                              >
                                <MessageCircle size={14} /> Chat
                              </button>
                              <button
                                onClick={() => window.open(`/session/${apt._id}`, '_blank')}
                                title="Join Video Call"
                                className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-2 rounded-xl text-[10px] font-black hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all animate-pulse"
                              >
                                <Video size={14} /> Join Call
                              </button>
                            </div>
                          )}

                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {appointments.length === 0 && (
              <div className="text-center py-20">
                <Clock className="mx-auto text-gray-200 mb-2" size={48} />
                <p className="text-gray-400 italic">No appointment history available.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorCalendar;