import express from "express";
import { getTodaysExercises } from "../controllers/patient.controller.js";
import { getAssignment } from "../controllers/patient.controller.js";
import { auth } from "../middleware/auth.middleware.js";
import { patientOnly } from "../middleware/role.middleware.js";
import { completeExercise } from "../controllers/complete.controller.js";
import { getDoctorAvailability } from "../controllers/patientAvailability.controller.js";
import { getAllDoctors } from '../controllers/doctor.controller.js';
import { getAssignmentDetails } from '../controllers/patient.controller.js';
import { getTemplateForPatient } from '../controllers/customExercise.controller.js';

const router = express.Router();

router.get("/todays-exercises", auth, patientOnly, getTodaysExercises);
router.post("/complete-exercise", auth, patientOnly, completeExercise);
router.get('/assignment/:assignmentId', auth, patientOnly, getAssignment);
router.get("/assignment/:id", auth, patientOnly, getAssignmentDetails);
router.get("/", auth, getAllDoctors);
router.get("/doctor-availability/:doctorId", auth, patientOnly, getDoctorAvailability);
router.get("/custom-template/:id", auth, patientOnly, getTemplateForPatient);

// ── PhysioBot: patient profile for post-session chatbot personalisation ──
router.get("/profile", auth, patientOnly, async (req, res) => {
  try {
    // req.user is set by your auth middleware
    const user = req.user;
    if (!user) return res.status(404).json({ message: "Patient not found" });

    res.json({
      patient: {
        name: user.name ?? null,
        age: user.age ?? null,
        condition: user.condition ?? user.diagnosis ?? null,
        notes: user.physiotherapistNotes ?? null,
      },
    });
  } catch (err) {
    console.error("[GET /patient/profile]", err);
    res.status(500).json({ message: "Server error fetching patient profile" });
  }
});

export default router;