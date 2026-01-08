import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";

const AddPatient = () => {
  const navigate = useNavigate();
  const [patientEmail, setPatientEmail] = useState("");
  const [error, setError] = useState("");

  const handleAddPatient = async () => {
    setError("");

    try {
      await apiFetch("/doctor/add-patient", {
        method: "POST",
        body: JSON.stringify({ patientEmail }),
      });

      navigate("/doctor");
    } catch (err: any) {
      setError(err.message || "Failed to add patient");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Add Patient</h2>

        <input
          type="email"
          placeholder="Patient Email"
          value={patientEmail}
          onChange={(e) => setPatientEmail(e.target.value)}
          className="w-full border px-4 py-3 rounded-lg mb-3"
        />

        {error && (
          <p className="text-red-500 text-sm mb-3">{error}</p>
        )}

        <button
          onClick={handleAddPatient}
          className="w-full bg-teal-500 text-white py-3 rounded-lg"
        >
          Add Patient
        </button>
      </div>
    </div>
  );
};

export default AddPatient;
