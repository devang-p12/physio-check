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
import PatientSessionHistory from "./pages/PatientSessionHistory";
import SessionDetails from "./pages/SessionDetails";
import DoctorPatientMonitoring from "./pages/DoctorPatientMonitoring";
import PatientSettings from "./pages/PatientSettings";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  return (
    <Router>
      <Routes>
        {/* ROOT */}
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
          element={
            token ? (
              <Navigate to={role === "doctor" ? "/doctor" : "/patient"} />
            ) : (
              <LoginPage />
            )
          }
        />

        <Route
          path="/register"
          element={
            token ? (
              <Navigate to={role === "doctor" ? "/doctor" : "/patient"} />
            ) : (
              <RegisterPage />
            )
          }
        />

        {/* DOCTOR ROUTES */}
        <Route
          path="/doctor"
          element={
            <ProtectedRoute role="doctor">
              <DoctorDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/doctor/assign"
          element={
            <ProtectedRoute role="doctor">
              <AssignExercise />
            </ProtectedRoute>
          }
        />

        <Route
          path="/doctor/add-patient"
          element={
            <ProtectedRoute role="doctor">
              <AddPatient />
            </ProtectedRoute>
          }
        />

        <Route
          path="/doctor/patient/:patientId"
          element={
            <ProtectedRoute role="doctor">
              <DoctorPatientMonitoring />
            </ProtectedRoute>
          }
        />

        <Route
          path="/doctor/session/:sessionId"
          element={
            <ProtectedRoute role="doctor">
              <SessionDetails />
            </ProtectedRoute>
          }
        />

        {/* PATIENT ROUTES */}
        <Route
          path="/patient"
          element={
            <ProtectedRoute role="patient">
              <PatientDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/patient/session/details/:sessionId"
          element={
            <ProtectedRoute role="patient">
              <SessionDetails />
            </ProtectedRoute>
          }
        />

        <Route
          path="/patient/session"
          element={
            <ProtectedRoute role="patient">
              <ExerciseSession />
            </ProtectedRoute>
          }
        />

        <Route
          path="/patient/history"
          element={
            <ProtectedRoute role="patient">
              <PatientSessionHistory />
            </ProtectedRoute>
          }
        />

        <Route
          path="/patient/settings"
          element={
            <ProtectedRoute role="patient">
              <PatientSettings />
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
