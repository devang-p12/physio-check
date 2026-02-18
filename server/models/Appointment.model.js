import mongoose from "mongoose"

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
        startTime: {
            type: Date,
            required: true,
        },
        endTime: {
            type: Date,
            required: true,
        },
        reason: {
            type: String,
        },
        status: {
            type: String,
            enum: ["pending","approved","rejected","cancelled"],
            default: "pending",
        },
    },
    {
        timestamp: true
    }
);

export default mongoose.model("Appointment", appointmentSchema);