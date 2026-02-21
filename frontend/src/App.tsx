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
import PatientBooking from "./pages/PatientBooking";
import ProtectedRoute from "./components/ProtectedRoute";
import DoctorTodaysAssignments from "./pages/DoctorTodaysAssignments";
import SessionPage from "./pages/SessionPage";
import ChatbotPage from "./pages/Chatbot";
import CreateExercise from "./pages/CreateExercise";
import { SocketProvider } from './providers/socket';
import { PeerProvider } from './providers/PeerProvider'; // Make sure to import this

function App() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  return (
    <SocketProvider>      {/* SocketProvider must be at the top level */}
      <PeerProvider>       {/* PeerProvider inside SocketProvider */}
        <Router>           {/* Single Router instance */}
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

            {/* DOCTOR ROUTES */}
            <Route path="/doctor" element={<ProtectedRoute role="doctor"><DoctorDashboard /></ProtectedRoute>} />
            <Route path="/doctor/assign" element={<ProtectedRoute role="doctor"><AssignExercise /></ProtectedRoute>} />
            <Route path="/doctor/add-patient" element={<ProtectedRoute role="doctor"><AddPatient /></ProtectedRoute>} />
            <Route path="/doctor/calendar" element={<ProtectedRoute role="doctor"><DoctorCalendar /></ProtectedRoute>} />
            <Route path="/doctor/today" element={<ProtectedRoute role="doctor"><DoctorTodaysAssignments /></ProtectedRoute>} />
            <Route path="/doctor/create-exercise" element={<ProtectedRoute role="doctor"><CreateExercise /></ProtectedRoute>} />

            {/* PATIENT ROUTES */}
            <Route path="/patient" element={<ProtectedRoute role="patient"><PatientDashboard /></ProtectedRoute>} />
            <Route path="/patient/session" element={<ProtectedRoute role="patient"><ExerciseSession /></ProtectedRoute>} />
            <Route path="/patient/doctors" element={<ProtectedRoute role="patient"><DoctorList /></ProtectedRoute>} />
            <Route path="/patient/book/:doctorId" element={<ProtectedRoute role="patient"><PatientBooking /></ProtectedRoute>} />
            <Route path="/patient/chatbot" element={<ProtectedRoute role="patient"><ChatbotPage /></ProtectedRoute>} />

            {/* SHARED LIVE SESSION ROUTE */}
            {/* ========================= */}
            {/* PUBLIC SESSION ROUTE - NO AUTH REQUIRED */}
            {/* ========================= */}
            <Route
              path="/session/:id"
              element={<SessionPage />}  // Publicly accessible
            />
            
            {/* FALLBACK */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </PeerProvider>
    </SocketProvider>
  );
}

export default App;