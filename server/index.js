import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import doctorRoutes from "./routes/doctor.routes.js";
import patientRoutes from "./routes/patient.routes.js";

console.log("🔥 PhysioCheck backend started");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Auth service running" });
});

// ADD AUTH ROUTES HERE
app.use("/auth", authRoutes);

app.use("/doctor", doctorRoutes);

app.use("/patient", patientRoutes);

// 404 LAST
app.use((req, res) => {
  res.status(404).json({ message: "route not found" });
});

app.listen(5000, () => {
  console.log("🚀 Server running on 5000");
});
