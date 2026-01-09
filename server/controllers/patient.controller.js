import { getAssignmentsByPatient } from "../models/Assignment.model.js";

export const getTodaysExercises = async (req, res) => {
  const patientId = req.user.id;
  const today = new Date().toISOString().split("T")[0];

  try {
    const allAssignments = await getAssignmentsByPatient(patientId);

    const todaysExercises = allAssignments.filter(
      (a) => {
        const assignmentDate = new Date(a.date).toISOString().split("T")[0];
        return assignmentDate === today && !a.completed;
      }
    );

    return res.json({
      exercises: todaysExercises.map(exercise => ({
        id: exercise._id.toString(),
        doctorId: exercise.doctorId ? exercise.doctorId._id.toString() : exercise.doctorId.toString(),
        patientId: exercise.patientId ? exercise.patientId._id.toString() : exercise.patientId.toString(),
        exerciseId: exercise.exerciseId ? exercise.exerciseId._id.toString() : exercise.exerciseId.toString(),
        date: exercise.date,
        prescription: JSON.parse(exercise.prescription),
        completed: exercise.completed,
        performance: exercise.performance,
        doctor: exercise.doctorId && exercise.doctorId._id ? {
          id: exercise.doctorId._id.toString(),
          name: exercise.doctorId.name,
          email: exercise.doctorId.email
        } : null,
        exercise: exercise.exerciseId && exercise.exerciseId._id ? {
          id: exercise.exerciseId._id.toString(),
          name: exercise.exerciseId.name,
          reps: exercise.exerciseId.reps,
          duration: exercise.exerciseId.duration,
          description: exercise.exerciseId.description
        } : null
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
