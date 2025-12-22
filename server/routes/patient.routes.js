import express from "express";
import { getTodaysExercises } from "../controllers/patient.controller.js";
import { auth } from "../middleware/auth.middleware.js";
import { patientOnly } from "../middleware/role.middleware.js";
import { completeExercise } from "../controllers/complete.controller.js";

const router = express.Router();

router.get("/todays-exercises", auth, patientOnly, getTodaysExercises);

router.post("/complete-exercise",auth,patientOnly,completeExercise)

export default router;
