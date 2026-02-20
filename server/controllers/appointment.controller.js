import Appointment from "../models/Appointment.model.js";
import DoctorAvailability from "../models/DoctorAvailability.model.js";

// 1. Book Appointment (includes sessionMode)
export const bookAppointment = async (req, res) => {
  const patientId = req.user.id;
  const { doctorId, startTime, endTime, reason, sessionMode } = req.body;

  if (!doctorId || !startTime || !endTime || !sessionMode) {
    return res.status(400).json({
      message: "Missing Required Fields (Include doctorId, times, and mode)",
    });
  }

  const newStart = new Date(startTime);
  const newEnd = new Date(endTime);

  if (newStart >= newEnd) {
    return res.status(400).json({ message: "Invalid time range" });
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
      sessionMode,
      status: "pending",
    });

    return res.status(201).json({
      message: "Appointment Request Sent",
      appointment,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

// 2. Get Appointments for the logged-in Patient
export const getPatientAppointments = async (req, res) => {
  const patientId = req.user.id;

  try {
    const appointments = await Appointment.find({ patientId })
      .populate("doctorId", "name email specialization")
      .sort({ startTime: 1 });

    return res.json({ appointments });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server Error" });
  }
};

// 3. Request Mode Switch (For Patients)
export const requestModeSwitch = async (req, res) => {
  const patientId = req.user.id;
  const { appointmentId, requestedMode } = req.body;

  if (!appointmentId || !requestedMode) {
    return res.status(400).json({ message: "appointmentId and requestedMode are required" });
  }

  if (!["online", "offline"].includes(requestedMode)) {
    return res.status(400).json({ message: "requestedMode must be 'online' or 'offline'" });
  }

  try {
    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) return res.status(404).json({ message: "Appointment not found" });
    if (appointment.patientId.toString() !== patientId) {
      return res.status(403).json({ message: "Not authorized" });
    }
    if (appointment.status !== "approved") {
      return res.status(400).json({ message: "Can only request mode switch for approved appointments" });
    }
    if (appointment.sessionMode === requestedMode) {
      return res.status(400).json({ message: `Appointment is already in ${requestedMode} mode` });
    }

    // Set the pending mode switch request
    appointment.modeSwitchRequest = {
      requestedMode,
      status: "pending",
      requestDate: new Date()
    };

    await appointment.save();
    return res.json({ message: `Request to switch to ${requestedMode} sent to doctor`, appointment });
  } catch (error) {
    return res.status(500).json({ message: "Server Error" });
  }
};

// 4. Update Appointment Status or Handle Mode Switch Approval (For Doctors)
export const updateAppointmentStatus = async (req, res) => {
  const doctorId = req.user.id;
  const { appointmentId, status, switchAction } = req.body;

  try {
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return res.status(404).json({ message: "Not found" });
    if (appointment.doctorId.toString() !== doctorId) return res.status(403).json({ message: "Unauthorized" });

    // Handle Mode Switch Request Approval/Rejection
    // Only processes if there is an actual pending switch request
    if (switchAction && appointment.modeSwitchRequest?.status === 'pending') {
      if (switchAction === "approve") {
        appointment.sessionMode = appointment.modeSwitchRequest.requestedMode;
        appointment.modeSwitchRequest.status = "approved";
      } else if (switchAction === "reject") {
        appointment.modeSwitchRequest.status = "rejected";
      } else {
        return res.status(400).json({ message: "switchAction must be 'approve' or 'reject'" });
      }
    }

    // Handle Main Appointment Status Update
    if (status) {
      if (!["approved", "rejected", "cancelled"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      appointment.status = status;
    }

    await appointment.save();
    return res.json({ message: "Appointment updated successfully", appointment });
  } catch (error) {
    return res.status(500).json({ message: "Server Error" });
  }
};

// 5. Get Appointments for the logged-in Doctor (with live session flag)
export const getDoctorAppointments = async (req, res) => {
  const doctorId = req.user.id;
  const now = new Date();

  try {
    const appointments = await Appointment.find({ doctorId })
      .populate("patientId", "name email")
      .sort({ startTime: 1 });

    const formatted = appointments.map(app => {
      const appObj = app.toObject();
      const start = new Date(app.startTime);
      const end = new Date(app.endTime);

      // Access allowed 10 minutes before start until end time
      const buffer = 10 * 60 * 1000;
      appObj.isLiveNow = now >= (start.getTime() - buffer) && now <= end;

      return appObj;
    });

    return res.json({ appointments: formatted });
  } catch (error) {
    return res.status(500).json({ message: "Server Error" });
  }
};

// 6. Set Doctor Availability
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
    const existing = await DoctorAvailability.findOne({ doctorId, dayOfWeek });

    if (existing) {
      existing.startTime = startTime;
      existing.endTime = endTime;
      await existing.save();
      return res.json({ message: "Availability updated", availability: existing });
    }

    const availability = await DoctorAvailability.create({
      doctorId,
      dayOfWeek,
      startTime,
      endTime,
    });

    return res.status(201).json({ message: "Availability set successfully", availability });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};