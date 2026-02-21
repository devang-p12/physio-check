import Availability from "../models/DoctorAvailability.model.js";
import Appointment from "../models/Appointment.model.js";

export const getDoctorAvailability = async (req, res) => {
  const { doctorId } = req.params;

  if (!doctorId) {
    return res.status(400).json({ message: "doctorId is required" });
  }

  try {
    const availabilityList = await Availability.find({ doctorId });
    if (!availabilityList.length) return res.json({ slots: [] });

    // 1. Fetch existing appointments to check for conflicts
    const appointments = await Appointment.find({
      doctorId,
      status: { $in: ["pending", "approved"] },
    });

    const today = new Date();
    const allGeneratedSlots = [];
    const SLOT_DURATION_MINUTES = 30;

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date();
      currentDate.setDate(today.getDate() + i);
      const dayOfWeek = currentDate.getDay();

      const dayAvailability = availabilityList.find((a) => a.dayOfWeek === dayOfWeek);
      if (!dayAvailability) continue;

      const [startHour, startMin] = dayAvailability.startTime.split(":").map(Number);
      const [endHour, endMin] = dayAvailability.endTime.split(":").map(Number);

      let startDateTime = new Date(currentDate);
      startDateTime.setHours(startHour, startMin, 0, 0);

      const endDateTime = new Date(currentDate);
      endDateTime.setHours(endHour, endMin, 0, 0);

      while (startDateTime < endDateTime) {
        const slotStart = new Date(startDateTime);
        const slotEnd = new Date(startDateTime);
        slotEnd.setMinutes(slotEnd.getMinutes() + SLOT_DURATION_MINUTES);

        if (slotEnd <= endDateTime) {
          // 2. Identify the status of this specific slot
          const slotStartTimeUTC = slotStart.getTime();
          
          const existingAppt = appointments.find(
            (appt) => new Date(appt.startTime).getTime() === slotStartTimeUTC
          );

          allGeneratedSlots.push({
            date: currentDate.toISOString().split("T")[0],
            startTime: slotStart,
            endTime: slotEnd,
            // 🔥 Status is now part of the object
            status: existingAppt ? existingAppt.status : "available",
          });
        }
        startDateTime.setMinutes(startDateTime.getMinutes() + SLOT_DURATION_MINUTES);
      }
    }

    return res.json({ slots: allGeneratedSlots });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};