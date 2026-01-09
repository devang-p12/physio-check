import { findAssignmentById, updateAssignment } from "../models/Assignment.model.js";

export const completeExercise = async (req, res) => {
  const patientId = req.user.id;
  const { assignmentId, sets } = req.body;

  if (!assignmentId || !Array.isArray(sets) || sets.length === 0) {
    return res
      .status(400)
      .json({ message: "invalid input for assignment complete" });
  }

  try {
    const assignment = await findAssignmentById(assignmentId);

    if (!assignment) {
      return res.status(404).json({ message: "assignment not found" });
    }

    if (assignment.patientId.toString() !== patientId) {
      return res
        .status(403)
        .json({ message: "not authorized to complete this assignment" });
    }

    const today = new Date().toISOString().split("T")[0];
    const assignmentDate = new Date(assignment.date).toISOString().split("T")[0];

    if (assignmentDate !== today) {
      return res.status(400).json({
        message: "You can only complete today's exercise"
      });
    }

    if (assignment.completed === true) {
      return res.status(409).json({ message: "exercise already completed" });
    }

    const prescription = JSON.parse(assignment.prescription);
    const { sets: prescribedSets, repsPerSet } = prescription;

    if (sets.length > prescribedSets) {
      return res.status(400).json({
        message: "More sets submitted than prescribed",
      });
    }

    for (const set of sets) {
      const { setNumber, performedReps, accuracy } = set;

      if (setNumber == null || performedReps == null || accuracy == null) {
        return res.status(400).json({
          message: "Invalid set data",
        });
      }

      if (performedReps < 0 || performedReps > repsPerSet + 2) {
        return res.status(400).json({
          message: "Performed reps out of allowed range",
        });
      }

      if (accuracy < 0 || accuracy > 100) {
        return res.status(400).json({
          message: "Accuracy must be between 0 and 100",
        });
      }
    }

    const updatedAssignment = await updateAssignment(assignmentId, {
      completed: true,
      performance: JSON.stringify({ sets, completedAt: new Date().toISOString() })
    });

    return res.json({
      message: "Exercise completed successfully",
      assignment: {
        id: updatedAssignment._id.toString(),
        doctorId: updatedAssignment.doctorId.toString(),
        patientId: updatedAssignment.patientId.toString(),
        exerciseId: updatedAssignment.exerciseId.toString(),
        date: updatedAssignment.date,
        prescription: updatedAssignment.prescription,
        completed: updatedAssignment.completed,
        performance: updatedAssignment.performance
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
