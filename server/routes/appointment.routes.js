import express from "express";
import {
    bookAppointment,
    getDoctorAppointments,
    setDoctorAvailability,
    updateAppointmentStatus,
} from "../controllers/appointment.controller.js"
import {auth} from "../middleware/auth.middleware.js"
import {doctorOnly} from "../middleware/role.middleware.js"
import { patientOnly } from "../middleware/role.middleware.js";

const router = express.Router();

router.post("/book", auth , patientOnly, bookAppointment);
router.get("/doctor" , auth, doctorOnly, getDoctorAppointments);
router.patch("/update", auth , doctorOnly, updateAppointmentStatus);
router.post("/availability",auth , doctorOnly,setDoctorAvailability);

export default router;