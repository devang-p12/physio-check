import express from "express";
import { assignExercise } from "../controllers/doctor.controller.js";
import { auth } from "../middleware/auth.middleware.js";
import { doctorOnly } from "../middleware/role.middleware.js";
import { addPatient } from "../controllers/addPatient.controller.js";
import { getDoctorPatients } from "../controllers/getPatients.controller.js";
import { getExercises, seedExercises } from "../controllers/exercise.controller.js";


const router = express.Router();

router.post("/assign-exercise", auth, doctorOnly, assignExercise);
router.post("/add-patient", auth, doctorOnly, addPatient);
router.get("/patients", auth, doctorOnly, getDoctorPatients);
router.get("/exercises", auth, doctorOnly, getExercises);
router.post("/seed-exercises", auth, doctorOnly, seedExercises);

export default router;
