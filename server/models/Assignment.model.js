export const createAssignment = ({doctorId,patientId,exerciseId,date}) => ({
    id: Date.now(),
    doctorId,
    patientId,
    exerciseId,
    date,
    completed: false,
    performance: null,
    createdAt: new Date()
})