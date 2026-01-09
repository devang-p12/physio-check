import { getPatientsByDoctor } from "../models/DoctorPatient.model.js";

export const getDoctorPatients = async (req, res) => {
  const doctorId = req.user.id;

  try {
    const patients = await getPatientsByDoctor(doctorId);

    return res.json({
      patients: patients.map(patient => ({
        id: patient._id.toString(),
        name: patient.name,
        email: patient.email,
        role: patient.role
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
