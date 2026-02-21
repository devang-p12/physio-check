import express from "express";
import { createServer } from "http";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import doctorRoutes from "./routes/doctor.routes.js";
import patientRoutes from "./routes/patient.routes.js";
import sessionRoutes from "./routes/session.routes.js";
import googleFitRoutes from "./routes/googleFit.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import appointmentRoutes from "./routes/appointment.routes.js";
import { connectDB } from "./data/db.js";
import { initializeWebSocket } from "./services/websocket.service.js";

console.log("🔥 PhysioCheck backend started");

const app = express();
const server = createServer(app);

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Connect to database
await connectDB();

// Initialize WebSocket server
initializeWebSocket(server);

app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Auth service running" });
});

// ADD AUTH ROUTES HERE
app.use("/auth", authRoutes);

app.use("/doctor", doctorRoutes);

app.use("/patient", patientRoutes);

app.use("/session", sessionRoutes);

app.use("/google-fit", googleFitRoutes);

app.use("/settings", settingsRoutes);

app.use("/appointment", appointmentRoutes);

// 404 LAST
app.use((req, res) => {
  res.status(404).json({ message: "route not found" });
});

server.listen(5000, () => {
  console.log("🚀 Server running on 5000");
  console.log("🔌 WebSocket available at ws://localhost:5000/ws");
});
