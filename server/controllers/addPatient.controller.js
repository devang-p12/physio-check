import { findUserByEmail } from "../models/User.model.js";
import { createDoctorPatientLink, findDoctorPatientLink } from "../models/DoctorPatient.model.js";

export const addPatient = async (req, res) => {
  const doctorId = req.user.id;
  const { patientEmail } = req.body;

  if (!patientEmail) {
    return res.status(400).json({
      message: "Patient email required",
    });
  }

  try {
    // 1️⃣ Find patient
    const patient = await findUserByEmail(patientEmail);
    if (!patient || patient.role !== "patient") {
      return res.status(404).json({
        message: "Patient not found",
      });
    }

    // 2️⃣ Check if already linked
    const alreadyLinked = await findDoctorPatientLink(doctorId, patient.id);
    if (alreadyLinked) {
      return res.status(409).json({
        message: "Patient already added",
      });
    }

    // 3️⃣ Link doctor ↔ patient
    await createDoctorPatientLink(doctorId, patient.id);

    return res.status(201).json({
      message: "Patient added successfully",
      patient: {
        id: patient._id.toString(),
        name: patient.name,
        email: patient.email,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
