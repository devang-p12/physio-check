export const getDoctorPatientsMap = () => {
  const data = localStorage.getItem("doctorPatients");
  return data ? JSON.parse(data) : {};
};

export const addPatientToDoctor = (doctorId, patientId) => {
  const map = getDoctorPatientsMap();

  if (!map[doctorId]) {
    map[doctorId] = [];
  }

  if (!map[doctorId].includes(patientId)) {
    map[doctorId].push(patientId);
  }

  localStorage.setItem("doctorPatients", JSON.stringify(map));
};
