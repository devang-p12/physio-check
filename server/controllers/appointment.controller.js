import Appointment from "../models/Appointment.model.js";
import DoctorAvailability from "../models/DoctorAvailability.model.js";

export const bookAppointment = async (req, res) => {
  const patientId = req.user.id;
  const { doctorId, startTime, endTime, reason } = req.body;

  if (!doctorId || !startTime || !endTime) {
    return res.status(400).json({
      message: "Missing Required Fields",
    });
  }

  const newStart = new Date(startTime);
  const newEnd = new Date(endTime);

  if (newStart >= newEnd) {
    return res.status(400).json({
      message: "Invalid time range",
    });
  }

  try {
    const conflictingAppointment = await Appointment.findOne({
      doctorId,
      status: { $in: ["pending", "approved"] },
      startTime: { $lt: newEnd },
      endTime: { $gt: newStart },
    });

    if (conflictingAppointment) {
      return res.status(409).json({
        message: "Doctor already has an appointment in this time slot",
      });
    }

    const appointment = await Appointment.create({
      doctorId,
      patientId,
      startTime: newStart,
      endTime: newEnd,
      reason,
      status: "pending",
    });

    return res.status(201).json({
      message: "Appointment Request Sent",
      appointment,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error",
    });
  }
};

export const getDoctorAppointments = async (req, res) => {
  const doctorId = req.user.id;

  try {
    const appointments = await Appointment.find({ doctorId })
      .populate("patientId", "name email")
      .sort({ startTime: 1 });

    return res.json({ appointments });
  } catch (error) {
    return res.status(500).json({ message: "Server Error" });
  }
};

export const updateAppointmentStatus = async (req, res) => {
  const doctorId = req.user.id;
  const { appointmentId, status } = req.body;

  if (!["approved", "rejected", "cancelled"].includes(status)) {
    return res.status(400).json({
      message: "Invalid status",
    });
  }

  try {
    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        message: "Appointment not found",
      });
    }

    if (appointment.doctorId.toString() !== doctorId) {
      return res.status(403).json({
        message: "Not authorized",
      });
    }

    appointment.status = status;
    await appointment.save();

    return res.json({
      message: "Appointment updated",
      appointment,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server Error" });
  }
};

export const setDoctorAvailability = async (req, res) => {
  const doctorId = req.user.id;
  const { dayOfWeek, startTime, endTime } = req.body;

  if (dayOfWeek == undefined || !startTime || !endTime) {
    return res.status(400).json({
      message: "dayOfWeek, startTime and endTime required",
    });
  }

  if (startTime >= endTime) {
    return res.status(400).json({
      message: "start time must be before end time",
    });
  }

  try {
    const existing = await DoctorAvailability.findOne({
      doctorId,
      dayOfWeek,
    });

    if (existing) {
      existing.startTime = startTime;
      existing.endTime = endTime;
      await existing.save();

      return res.json({
        message: "Availability updated",
        availability: existing,
      });
    }

    const availability = await DoctorAvailability.create({
      doctorId,
      dayOfWeek,
      startTime,
      endTime,
    });

    return res.status(201).json({
      message: "availability set successfully",
      availability,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
