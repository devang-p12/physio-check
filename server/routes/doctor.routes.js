import express from "express";
import { createPlan } from "../controllers/doctor.controller.js";
import { auth } from "../middleware/auth.middleware.js";
import { doctorOnly } from "../middleware/role.middleware.js";
import { addPatient } from "../controllers/addPatient.controller.js";
import { getDoctorPatients } from "../controllers/getPatients.controller.js";


const router = express.Router();

router.post("/create-plan", auth, doctorOnly, createPlan);
router.post("/add-patient", auth, doctorOnly, addPatient);
router.get( "/patients", auth, doctorOnly, getDoctorPatients);

export default router;
