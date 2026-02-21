import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

import authRoutes from "./routes/auth.routes.js";
import doctorRoutes from "./routes/doctor.routes.js";
import patientRoutes from "./routes/patient.routes.js";
import appointmentRoutes from "./routes/appointment.routes.js";
import { connectDB } from "./data/db.js";

console.log("🔥 PhysioCheck backend started");

const app = express();

app.use(cors());
app.use(express.json());

await connectDB();

app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Auth service running" });
});

app.use("/auth", authRoutes);
app.use("/doctor", doctorRoutes);
app.use("/patient", patientRoutes);
app.use("/appointment", appointmentRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "route not found" });
});


// ✅ CREATE HTTP SERVER
const server = http.createServer(app);


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

    socket.broadcast.to(roomId).emit("user-joined", {
      emailId
    });

  });


  socket.on("call-user", ({ emailId, offer }) => {

    const fromEmail = socketToEmailMapping.get(socket.id);
    const socketId = emailToSocketMapping.get(emailId);

    if (socketId) {
      io.to(socketId).emit("incoming-call", {
        from: fromEmail,
        offer
      });
    }

  });


  socket.on("call-accepted", ({ emailId, ans }) => {

    const socketId = emailToSocketMapping.get(emailId);

    if (socketId) {
      io.to(socketId).emit("call-accepted", {
        ans
      });
    }

  });


  socket.on("ice-candidate", ({ to, candidate }) => {

    const socketId = emailToSocketMapping.get(to);

    if (socketId) {
      io.to(socketId).emit("ice-candidate", {
        candidate
      });
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