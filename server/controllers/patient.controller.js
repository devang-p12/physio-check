import { plans, assignments } from "../data/db.js";

export const getTodaysExercises = (req, res) => {
  const patientId = Number(req.user.id);
  const today = new Date().toISOString().split("T")[0];

  const activePlans = plans.filter(
    (plan) =>
      Number(plan.patientId) === patientId &&
      plan.active === true &&
      plan.startDate <= today &&
      plan.endDate >= today
  );

  for (const plan of activePlans) {
    const alreadyExists = assignments.find(
      (a) =>
        a.planId === plan.id &&
        a.date === today
    );

    if (!alreadyExists) {
      assignments.push({
        id: Date.now(),
        planId: plan.id,
        doctorId: plan.doctorId,
        patientId: plan.patientId,
        exerciseId: plan.exerciseId,
        date: today,
        prescription: plan.prescription,
        completed: false,
        performance: null,
        createdAt: new Date().toISOString()
      });
    }
  }

  const todaysExercises = assignments.filter(
    (a) =>
      Number(a.patientId) === patientId &&
      a.date === today &&
      a.completed === false
  );

  console.log("TODAY:", today);
  console.log("ACTIVE PLANS:", activePlans);
  console.log("ASSIGNMENTS:", assignments);

  return res.json({
    exercises: todaysExercises
  });
};
