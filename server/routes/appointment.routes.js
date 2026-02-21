import express from "express";
import {
  bookAppointment,
  getDoctorAppointments,
  setDoctorAvailability,
  updateAppointmentStatus,
  getPatientAppointments,   // ← add
  requestModeSwitch,        // ← add
} from "../controllers/appointment.controller.js";
import { auth } from "../middleware/auth.middleware.js";
import { doctorOnly, patientOnly } from "../middleware/role.middleware.js";

const router = express.Router();

router.post("/book", auth, patientOnly, bookAppointment);
router.get("/doctor", auth, doctorOnly, getDoctorAppointments);
router.patch("/update", auth, doctorOnly, updateAppointmentStatus);
router.post("/availability", auth, doctorOnly, setDoctorAvailability);

// ← add these two
router.get("/patient", auth, patientOnly, getPatientAppointments);
router.post("/switch-request", auth, patientOnly, requestModeSwitch);

export default router;