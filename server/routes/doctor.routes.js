import express from "express";
import { assignExercise } from "../controllers/doctor.controller.js";
import { auth } from "../middleware/auth.middleware.js";
import { doctorOnly } from "../middleware/role.middleware.js";
import { addPatient } from "../controllers/addPatient.controller.js";
import { getDoctorPatients } from "../controllers/getPatients.controller.js";
import { getExercises, seedExercises } from '../controllers/exercise.controller.js';
import {
  uploadTemplate,
  listTemplates,
  removeTemplate,
  assignCustomExercise,
} from '../controllers/customExercise.controller.js';
import { 
  getDoctorPatientSessions, 
  getSessionDetails, 
  getPatientPerformanceSummary,
  getAssignmentSessions,
  generatePatientReport
} from "../controllers/doctorSession.controller.js";
import { getPatientGoogleFit } from "../controllers/doctorSession.controller.js";


const router = express.Router();

router.post("/assign-exercise", auth, doctorOnly, assignExercise);
router.post("/add-patient", auth, doctorOnly, addPatient);
router.get("/patients", auth, doctorOnly, getDoctorPatients);
router.get("/exercises", auth, doctorOnly, getExercises);
router.post("/seed-exercises", auth, doctorOnly, seedExercises);

// Custom exercise template routes
router.post("/custom-templates", auth, doctorOnly, uploadTemplate);
router.get("/custom-templates", auth, doctorOnly, listTemplates);
router.delete("/custom-templates/:id", auth, doctorOnly, removeTemplate);
router.post("/assign-custom-exercise", auth, doctorOnly, assignCustomExercise);

// Session monitoring routes
router.get("/patient-sessions", auth, doctorOnly, getDoctorPatientSessions);
router.get("/session/:sessionId", auth, doctorOnly, getSessionDetails);
router.get("/patient/:patientId/performance", auth, doctorOnly, getPatientPerformanceSummary);
router.get("/assignment/:assignmentId/sessions", auth, doctorOnly, getAssignmentSessions);
router.get('/patient/:patientId/google-fit', auth, doctorOnly, getPatientGoogleFit);
router.get('/patient/:patientId/report', auth, doctorOnly, generatePatientReport);

export default router;
