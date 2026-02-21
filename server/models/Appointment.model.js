import mongoose from "mongoose";

const modeSwitchRequestSchema = new mongoose.Schema({
  requestedMode: { 
    type: String, 
    enum: ["online", "offline"] 
  },
  status: { 
    type: String, 
    enum: ["pending", "approved", "rejected"], 
    default: "pending" 
  },
  requestDate: { type: Date, default: Date.now }
}, { _id: false }); // _id: false — no need for a separate id on subdoc

const appointmentSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    reason: { type: String },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
    },
    sessionMode: {
      type: String,
      enum: ["online", "offline"],
      default: "online",
      required: true,
    },
    modeSwitchRequest: {
      type: modeSwitchRequestSchema,
      default: null  // null by default — only set when patient sends a request
    },
    sessionStartedAt: { type: Date }
  },
  { timestamps: true }
);

export default mongoose.model("Appointment", appointmentSchema);