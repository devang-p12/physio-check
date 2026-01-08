import { users, doctorPatients } from "../data/db.js";

export const getDoctorPatients = (req, res) => {
  const doctorId = req.user.id;

  const patientIds = doctorPatients
    .filter((dp) => dp.doctorId === doctorId)
    .map((dp) => dp.patientId);

  const patients = users.filter(
    (u) => patientIds.includes(u.id) && u.role === "patient"
  );

  // 🔍 ADD DEBUG LOGS HERE
  console.log("doctorId:", doctorId);
  console.log("doctorPatients:", doctorPatients);
  console.log("patientIds:", patientIds);
  console.log("patients:", patients);

  return res.json({
    patients,
  });
};
