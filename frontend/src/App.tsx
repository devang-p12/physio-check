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
import PatientReactionExercise from "./pages/PatientReactionExercise";
import ProtectedRoute from "./components/ProtectedRoute";
import PatientReport from "./pages/PatientReport";
import DoctorCalendar from "./pages/DoctorCalendar";
import DoctorList from "./pages/DoctorList";
import PatientBooking from "./pages/PatientBooking";
import ChatbotPage from "./pages/Chatbot";
import DoctorTodaysAssignments from "./pages/DoctorTodaysAssignments";
import SessionPage from "./pages/SessionPage";
import CreateExercise from "./pages/CreateExercise";

// Reads localStorage fresh every render — prevents stale-closure redirect loops
const RootRedirect = () => {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  if (!token) return <Navigate to="/login" replace />;
  return <Navigate to={role === "doctor" ? "/doctor" : "/patient"} replace />;
};

const GuestRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  if (token) return <Navigate to={role === "doctor" ? "/doctor" : "/patient"} replace />;
  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* ROOT */}
        <Route path="/" element={<RootRedirect />} />

        {/* AUTH ROUTES */}
        <Route
          path="/login"
          element={
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          }
        />

        <Route
          path="/register"
          element={
            <GuestRoute>
              <RegisterPage />
            </GuestRoute>
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

        <Route
          path="/doctor/patient/:patientId/report"
          element={
            <ProtectedRoute role="doctor">
              <PatientReport />
            </ProtectedRoute>
          }
        />

        <Route
          path="/doctor/calendar"
          element={
            <ProtectedRoute role="doctor">
              <DoctorCalendar />
            </ProtectedRoute>
          }
        />

        <Route
          path="/doctor/today"
          element={
            <ProtectedRoute role="doctor">
              <DoctorTodaysAssignments />
            </ProtectedRoute>
          }
        />

        <Route
          path="/doctor/create-exercise"
          element={
            <ProtectedRoute role="doctor">
              <CreateExercise />
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
          path="/patient/reaction-session"
          element={
            <ProtectedRoute role="patient">
              <PatientReactionExercise />
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

        <Route
          path="/patient/doctors"
          element={
            <ProtectedRoute role="patient">
              <DoctorList />
            </ProtectedRoute>
          }
        />

        <Route
          path="/patient/book/:doctorId"
          element={
            <ProtectedRoute role="patient">
              <PatientBooking />
            </ProtectedRoute>
          }
        />

        <Route
          path="/patient/chatbot"
          element={
            <ProtectedRoute role="patient">
              <ChatbotPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/session/:id"
          element={
            <ProtectedRoute>
              <SessionPage />
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
