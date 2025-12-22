import express from "express";
import { createPlan } from "../controllers/doctor.controller.js";
import { auth } from "../middleware/auth.middleware.js";
import { doctorOnly } from "../middleware/role.middleware.js";

const router = express.Router();

router.post("/create-plan", auth, doctorOnly, createPlan);

export default router;
