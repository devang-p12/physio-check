import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import LoginPage from "./pages/Login";
import RegisterPage from "./pages/Register";
import DoctorDashboard from "./pages/DoctorDashboard";
import AssignExercise from "./pages/DoctorAssignExercise";
import PatientDashboard from "./pages/PatientDashboard";
import ExerciseSession from "./pages/PatientExercise-Id";
import AddPatient from "./pages/AddPatient";
import DoctorCalendar from "./pages/DoctorCalendar";
import DoctorList from "./pages/DoctorList"; 
import PatientBooking from "./pages/PatientBooking"; // Ensure this is imported
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  return (
    <Router>
      <Routes>
        {/* ROOT REDIRECT LOGIC */}
        <Route
          path="/"
          element={
            token ? (
              role === "doctor" ? (
                <Navigate to="/doctor" />
              ) : (
                <Navigate to="/patient" />
              )
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        {/* AUTH ROUTES */}
        <Route
          path="/login"
          element={token ? <Navigate to={role === "doctor" ? "/doctor" : "/patient"} /> : <LoginPage />}
        />
        <Route
          path="/register"
          element={token ? <Navigate to={role === "doctor" ? "/doctor" : "/patient"} /> : <RegisterPage />}
        />

        {/* ========================= */}
        {/* DOCTOR ROUTES */}
        {/* ========================= */}
        <Route path="/doctor" element={<ProtectedRoute role="doctor"><DoctorDashboard /></ProtectedRoute>} />
        <Route path="/doctor/assign" element={<ProtectedRoute role="doctor"><AssignExercise /></ProtectedRoute>} />
        <Route path="/doctor/add-patient" element={<ProtectedRoute role="doctor"><AddPatient /></ProtectedRoute>} />
        <Route path="/doctor/calendar" element={<ProtectedRoute role="doctor"><DoctorCalendar /></ProtectedRoute>} />

        {/* ========================= */}
        {/* PATIENT ROUTES */}
        {/* ========================= */}
        <Route path="/patient" element={<ProtectedRoute role="patient"><PatientDashboard /></ProtectedRoute>} />
        <Route path="/patient/session" element={<ProtectedRoute role="patient"><ExerciseSession /></ProtectedRoute>} />

        {/* 1. Browse Doctors List */}
        <Route
          path="/patient/doctors"
          element={
            <ProtectedRoute role="patient">
              <DoctorList />
            </ProtectedRoute>
          }
        />

        {/* 2. Patient Booking (Slot Selection) - FIXED element here */}
        <Route
          path="/patient/book/:doctorId"
          element={
            <ProtectedRoute role="patient">
              <PatientBooking /> 
            </ProtectedRoute>
          }
        />

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;