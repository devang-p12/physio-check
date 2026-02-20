import express from "express";
import { getTodaysExercises } from "../controllers/patient.controller.js";
import { auth } from "../middleware/auth.middleware.js";
import { patientOnly } from "../middleware/role.middleware.js";
import { completeExercise } from "../controllers/complete.controller.js";
import { getDoctorAvailability } from "../controllers/patientAvailability.controller.js";
import { getAllDoctors } from "../controllers/doctor.controller.js";
// ... existing imports
import { getAssignmentDetails } from "../controllers/patient.controller.js";

const router = express.Router();

router.get("/todays-exercises", auth, patientOnly, getTodaysExercises);
router.post("/complete-exercise", auth, patientOnly, completeExercise);

// Add this line
router.get("/assignment/:id", auth, patientOnly, getAssignmentDetails);

router.get("/", auth, getAllDoctors);
router.get("/doctor-availability/:doctorId", auth, patientOnly, getDoctorAvailability);

export default router;
