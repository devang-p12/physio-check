import express from "express";
import { assignExercise } from "../controllers/doctor.controller.js";
import { auth } from "../middleware/auth.middleware.js";
import { doctorOnly } from "../middleware/role.middleware.js";

const router = express.Router();

router.post("/assign-exercise", auth, doctorOnly, assignExercise);

export default router;
