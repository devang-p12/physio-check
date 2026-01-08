import { users, doctorPatients } from "../data/db.js";

export const addPatient = (req, res) => {
  const doctorId = req.user.id;
  const { patientEmail } = req.body;

  if (!patientEmail) {
    return res.status(400).json({
      message: "Patient email required",
    });
  }

  // 1️⃣ Find patient
  const patient = users.find(
    (u) => u.email === patientEmail && u.role === "patient"
  );

  if (!patient) {
    return res.status(404).json({
      message: "Patient not found",
    });
  }

  // 2️⃣ Check if already linked
  const alreadyLinked = doctorPatients.find(
    (dp) =>
      dp.doctorId === doctorId && dp.patientId === patient.id
  );

  if (alreadyLinked) {
    return res.status(409).json({
      message: "Patient already added",
    });
  }

  // 3️⃣ Link doctor ↔ patient
  doctorPatients.push({
    doctorId,
    patientId: patient.id,
  });

  return res.status(201).json({
    message: "Patient added successfully",
    patient: {
      id: patient.id,
      name: patient.name,
      email: patient.email,
    },
  });
};
