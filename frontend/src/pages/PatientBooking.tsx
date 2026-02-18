import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const PatientBooking = () => {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchSlots = async () => {
      setFetching(true);
      try {
        const res = await fetch(`http://localhost:5000/patient/doctor-availability/${doctorId}`, {
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
    if (doctorId) fetchSlots();
  }, [doctorId, token]);

  const handleBook = async () => {
    if (!selectedSlot || !reason.trim()) return alert("Please select a slot and provide a reason");
    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/appointment/book", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          doctorId,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          reason
        })
      });
      if (res.ok) {
        alert("Booking Request Sent!");
        navigate('/patient');
      }
    } catch (err) { alert("Server error"); } finally { setLoading(false); }
  };

  const groupedSlots = (slots || []).reduce((acc, slot) => {
    const date = slot.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(slot);
    return acc;
  }, {});

  if (fetching) return (
    <div className="flex justify-center items-center h-screen bg-white">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-gray-50 min-h-screen font-sans">
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <button onClick={() => navigate('/patient/doctors')} className="text-indigo-600 font-semibold text-sm mb-2 hover:underline">
            ← View All Doctors
          </button>
          <h2 className="text-3xl font-extrabold text-gray-900">Weekly Schedule</h2>
          <p className="text-gray-500">Pick a time that works best for your recovery.</p>
        </div>

        {/* Legend */}
        <div className="flex gap-4 p-3 bg-white rounded-xl border border-gray-200 shadow-sm text-[10px] font-bold tracking-wider">
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-green-500 rounded-sm"></span> FREE</div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-yellow-400 rounded-sm"></span> PENDING</div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-red-400 rounded-sm"></span> BOOKED</div>
        </div>
      </header>

      {/* Week Grid Container */}
      <div className="overflow-x-auto pb-4">
        <div className="inline-flex md:grid md:grid-cols-7 gap-4 min-w-[1000px] md:min-w-full">
          {Object.entries(groupedSlots).map(([date, daySlots]: [string, any]) => {
            const dateObj = new Date(date);
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNum = dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });

            return (
              <div key={date} className="flex-1 flex flex-col gap-3 min-w-[140px]">
                {/* Date Header */}
                <div className="text-center p-3 bg-indigo-600 text-white rounded-2xl shadow-md">
                  <div className="text-xs uppercase font-bold opacity-80">{dayName}</div>
                  <div className="text-lg font-black">{dayNum}</div>
                </div>

                {/* Slots Area */}
                <div className="flex flex-col gap-2 p-2 bg-gray-100/50 rounded-2xl min-h-[400px]">
                  {daySlots.map((slot: any, index: number) => {
                    const time = new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const isSelected = selectedSlot === slot;
                    
                    let style = "bg-white border-gray-200 text-gray-700 hover:border-indigo-300";
                    let disabled = false;

                    if (slot.status === "approved") {
                      style = "bg-red-50 border-red-100 text-red-300 cursor-not-allowed";
                      disabled = true;
                    } else if (slot.status === "pending") {
                      style = "bg-yellow-50 border-yellow-100 text-yellow-600 cursor-not-allowed";
                      disabled = true;
                    } else if (isSelected) {
                      style = "bg-green-600 border-green-600 text-white shadow-lg ring-2 ring-green-200 ring-offset-1";
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

      {/* Confirmation Modal/Card */}
      {selectedSlot && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 shadow-2xl w-full max-w-md border border-gray-100 animate-in zoom-in-95 duration-200">
            <h4 className="text-xl font-black text-gray-900 mb-2">Confirm Session</h4>
            <div className="bg-indigo-50 p-4 rounded-2xl mb-4 border border-indigo-100">
                <p className="text-indigo-800 text-sm font-semibold">
                  📅 {new Date(selectedSlot.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
                <p className="text-indigo-600 text-lg font-black">
                  ⏰ {new Date(selectedSlot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
            </div>
            
            <textarea 
              className="w-full border-2 border-gray-100 rounded-2xl p-4 text-sm focus:border-indigo-500 focus:ring-0 outline-none transition-colors mb-6"
              placeholder="What would you like to discuss? (Symptoms, follow-up, etc.)"
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
                {loading ? "Confirming..." : "Book Session"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientBooking;