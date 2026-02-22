import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import authRoutes from "./routes/auth.routes.js";
import doctorRoutes from "./routes/doctor.routes.js";
import patientRoutes from "./routes/patient.routes.js";
import sessionRoutes from "./routes/session.routes.js";
import googleFitRoutes from "./routes/googleFit.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import appointmentRoutes from "./routes/appointment.routes.js";
import geminiRoutes from "./routes/gemini.routes.js"; // ← NEW
import chatbotRoutes from "./routes/chatbot.routes.js";

import { connectDB } from "./data/db.js";
import { initializeWebSocket } from "./services/websocket.service.js";

console.log("🔥 PhysioCheck backend started");

const app = express();
const server = createServer(app);

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

await connectDB();

// Initialize WebSocket server
initializeWebSocket(server);

app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Auth service running" });
});

app.use("/auth", authRoutes);
app.use("/doctor", doctorRoutes);
app.use("/patient", patientRoutes);
app.use("/appointment", appointmentRoutes);
app.use("/session", sessionRoutes);
app.use("/google-fit", googleFitRoutes);
app.use("/settings", settingsRoutes);
app.use("/api/gemini", geminiRoutes); // ← NEW
app.use("/chatbot", chatbotRoutes);


// 404 LAST
app.use((req, res) => {
  res.status(404).json({ message: "route not found" });
});

// ✅ CREATE SOCKET SERVER
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ✅ SOCKET DATA MAPS
const emailToSocketMapping = new Map();
const socketToEmailMapping = new Map();

// ✅ SOCKET CONNECTION
io.on("connection", (socket) => {
  console.log("⚡ User connected:", socket.id);

  socket.on("join-room", ({ emailId, roomId }) => {
    console.log(`User ${emailId} joined room ${roomId}`);
    emailToSocketMapping.set(emailId, socket.id);
    socketToEmailMapping.set(socket.id, emailId);
    socket.join(roomId);
    socket.emit("joined-room", { roomId });
    socket.broadcast.to(roomId).emit("user-joined", { emailId });
  });

  socket.on("call-user", ({ emailId, offer }) => {
    const fromEmail = socketToEmailMapping.get(socket.id);
    const socketId = emailToSocketMapping.get(emailId);
    if (socketId) {
      io.to(socketId).emit("incoming-call", { from: fromEmail, offer });
    }
  });

  socket.on("call-accepted", ({ emailId, ans }) => {
    const socketId = emailToSocketMapping.get(emailId);
    if (socketId) {
      io.to(socketId).emit("call-accepted", { ans });
    }
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    const socketId = emailToSocketMapping.get(to);
    if (socketId) {
      io.to(socketId).emit("ice-candidate", { candidate });
    }
  });

  socket.on("disconnect", () => {
    const email = socketToEmailMapping.get(socket.id);
    if (email) {
      emailToSocketMapping.delete(email);
      socketToEmailMapping.delete(socket.id);
    }
    console.log("❌ User disconnected:", socket.id);
  });
});

// ✅ START SERVER
server.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
});