export const createAssignment = ({
  doctorId,
  patientId,
  exerciseId,
  date,
  prescription,
}) => ({
  id: Date.now(),
  doctorId,
  patientId,
  exerciseId,
  date,
  prescription,
  completed: false,
  performance: null,
  createdAt: new Date(),
});
