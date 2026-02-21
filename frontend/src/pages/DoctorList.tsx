import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const DoctorList = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  
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

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Find a Doctor</h1>
            <p className="text-gray-600 mt-1">Select a specialist to book your session.</p>
          </div>
          <button 
            onClick={() => navigate('/patient')} 
            className="text-sm font-medium text-green-600 hover:underline"
          >
            Back to Dashboard
          </button>
        </header>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {doctors.map((doctor: any) => (
            <div 
              key={doctor._id} 
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center text-green-600 text-2xl font-bold mb-4">
                  {doctor.name.charAt(0)}
                </div>
                <h2 className="text-xl font-bold text-gray-900">Dr. {doctor.name}</h2>
                <p className="text-green-600 text-sm font-medium mb-2">Physiotherapy Specialist</p>
                <p className="text-gray-500 text-sm mb-6">{doctor.email}</p>
              </div>

              <button
                onClick={() => navigate(`/patient/book/${doctor._id}`)}
                className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition-colors"
              >
                Book Appointment
              </button>
            </div>
          ))}
        </div>

        {doctors.length === 0 && !error && (
          <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed">
            <p className="text-gray-400">No doctors are currently available.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DoctorList;