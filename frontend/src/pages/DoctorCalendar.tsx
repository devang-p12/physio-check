import React, { useState, useEffect } from 'react';

const DoctorCalendar = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ 
    dayOfWeek: 1, 
    startTime: "10:00", 
    endTime: "10:30" 
  });
  
  const token = localStorage.getItem('token');
  const BASE_URL = "http://localhost:5000"; // Explicitly targeting your backend port

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
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify(form) // Matches: { dayOfWeek: 1, startTime: "10:00", endTime: "10:30" }
      });

      const data = await response.json();

      if (response.ok) {
        alert("Availability set successfully!");
      } else {
        alert(data.message || "Failed to set availability");
      }
    } catch (err) {
      alert("Server error. Make sure backend is running on port 5000.");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (appointmentId: string, status: string) => {
    try {
      const res = await fetch(`${BASE_URL}/appointment/update`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ appointmentId, status })
      });
      if (res.ok) fetchAppointments();
    } catch (err) {
      alert("Update failed");
    }
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT: AVAILABILITY FORM */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold mb-6 text-gray-800">Set Weekly Hours</h2>
          <form onSubmit={handleSetAvailability} className="space-y-5">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Repeat on Day</label>
              <select 
                className="w-full mt-2 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.dayOfWeek}
                onChange={(e) => setForm({...form, dayOfWeek: parseInt(e.target.value)})}
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
                <label className="text-xs font-bold text-gray-500 uppercase">Start Time</label>
                <input 
                  type="time" 
                  className="w-full mt-2 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  value={form.startTime} 
                  onChange={e => setForm({...form, startTime: e.target.value})} 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">End Time</label>
                <input 
                  type="time" 
                  className="w-full mt-2 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  value={form.endTime} 
                  onChange={e => setForm({...form, endTime: e.target.value})} 
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition disabled:bg-gray-300 shadow-lg shadow-blue-200"
            >
              {loading ? 'Saving...' : 'Set Availability'}
            </button>
          </form>
        </div>

        {/* RIGHT: APPOINTMENT MANAGEMENT */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold mb-6 text-gray-800">Upcoming Requests</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                  <th className="pb-4 px-2">Patient</th>
                  <th className="pb-4 px-2">Date & Time</th>
                  <th className="pb-4 px-2">Status</th>
                  <th className="pb-4 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {appointments.map((apt: any) => (
                  <tr key={apt._id} className="hover:bg-gray-50 transition">
                    <td className="py-4 px-2">
                      <p className="font-bold text-gray-800">{apt.patientId?.name || "Unknown"}</p>
                      <p className="text-xs text-gray-500">{apt.reason || "General Checkup"}</p>
                    </td>
                    <td className="py-4 px-2 text-sm">
                      {new Date(apt.startTime).toLocaleString('en-US', { 
                        weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                      })}
                    </td>
                    <td className="py-4 px-2">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                        apt.status === 'approved' ? 'bg-green-100 text-green-700' : 
                        apt.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {apt.status}
                      </span>
                    </td>
                    <td className="py-4 px-2 text-right">
                      {apt.status === 'pending' && (
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => updateStatus(apt._id, 'approved')}
                            className="bg-green-500 text-white p-1.5 rounded-lg hover:bg-green-600 transition"
                            title="Approve"
                          >
                            ✓
                          </button>
                          <button 
                            onClick={() => updateStatus(apt._id, 'rejected')}
                            className="bg-red-500 text-white p-1.5 rounded-lg hover:bg-red-600 transition"
                            title="Reject"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {appointments.length === 0 && (
              <p className="text-center py-10 text-gray-400 italic">No appointments found.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default DoctorCalendar;