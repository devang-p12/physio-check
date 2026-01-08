import { assignments } from "../data/db.js";

export const completeExercise = (req, res) => {
  const patientId = Number(req.user.id);
  const { assignmentId, sets } = req.body;

  if (!assignmentId || !Array.isArray(sets) || sets.length === 0) {
    return res
      .status(400)
      .json({ message: "invalid input for assignment complete" });
  }

  const assignment = assignments.find((a) => a.id === assignmentId);

  if (!assignment) {
    return res.status(404).json({ message: "assignment not found" });
  }
  if (Number(assignment.patientId) !== patientId) {
    return res
      .status(403)
      .json({ message: "not authorized to complete this assignment" });
  }
  const today = new Date().toISOString().split("T")[0];

  if (assignment.date !== today) {
    return res.status(400).json({
      message: "You can only complete today's exercise"
    });
  }

  if (assignment.completed === true) {
    return res.status(409).json({ message: "exercise already completed" });
  }

  const { sets: prescribedSets, repsPerSet } = assignment.prescription;

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
  assignment.completed = true;

  assignment.performance = { sets, completedAt: new Date().toISOString() };

  return res.json({
    message: "Exercise completed successfully",
    assignment,
  });
};
