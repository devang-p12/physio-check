import { assignments, exercises } from "../data/db.js";

export const getTodaysExercises = (req, res) => {
  console.log("🔥 getTodaysExercises HIT");

  const patientId = Number(req.user.id);
  const today = new Date().toISOString().split("T")[0];

  console.log("Patient ID from token:", patientId);
  console.log("Today:", today);
  console.log("Assignments in DB:", assignments);

  const todaysExercises = assignments.filter(
    a =>
      a.patientId == patientId &&
      a.date == today &&
      !a.completed
  );

  console.log("Filtered todaysExercises:", todaysExercises);

  res.json({ exercises: todaysExercises });
};
