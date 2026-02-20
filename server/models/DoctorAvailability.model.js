import mongoose from "mongoose"

const doctorAvailabilitySchema = new mongoose.Schema({
    doctorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    dayOfWeek: {
        type: Number,
        required: true,
    },
    startTime: {
        type: String,
        required: true,
    },
    endTime: {
        type: String,
        required: true,
    },
});

export default mongoose.model(
    "DoctorAvailability",
    doctorAvailabilitySchema
);