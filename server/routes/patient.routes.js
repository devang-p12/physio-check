import express from "express";
import { getTodaysExercises } from "../controllers/patient.controller.js";
import { auth } from "../middleware/auth.middleware.js";
import { patientOnly } from "../middleware/role.middleware.js";

const router = express.Router();

router.get("/todays-exercises",auth ,patientOnly,getTodaysExercises);




export default router;