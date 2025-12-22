import { plans,users } from "../data/db.js";

export const createPlan = (req,res) => {
  const { patientId , exerciseId, prescription, startDate , endDate} = req.body;

  if(!patientId || !exerciseId || !prescription || !startDate || !endDate){
    return res.status(400).json({
      message: "invalid input"
    })
  }

  if (startDate > endDate) {
    return res.status(400).json({
      message: "start date greater than end date"
    })
  }

  const { sets, repsPerSet } = prescription;

  if (
    !Number.isInteger(sets) || 
    !Number.isInteger(repsPerSet) || 
    sets <= 0 || 
    repsPerSet <= 0
  ) {
    return res.status(400).json({
      message: "invalid prescription values"
    });
  }

  const patient = users.find(
    (u) => u.id === patientId && u.role === "patient"
  );

  if (!patient) {
    return res.status(404).json({
      message: "Patient not found"
    });
  }

  const plan = {
    id: Date.now(),
    doctorId: req.user.id,
    patientId,
    exerciseId,
    prescription,
    startDate,
    endDate,
    frequency: "daily",
    active: true,
    createdAt: new Date().toISOString()
  };

  plans.push(plan);

  return res.status(201).json({
    message: "Exercise plan created successfully",
    plan  
  })


}
















































// import { assignments, users } from "../data/db.js";
// import { createAssignment } from "../models/Assignment.model.js";

// export const assignExercise = (req, res) => {
//   const { patientId, exerciseId, date, prescription } = req.body;

//   if (!patientId || !exerciseId || !date || !prescription) {
//     return res.status(400).json({ message: "missing required fields" });
//   }

//   const { sets, repsPerSet } = prescription;

//   if (
//     !Number.isInteger(sets) ||
//     !Number.isInteger(repsPerSet) ||
//     sets <= 0 ||
//     repsPerSet <= 0
//   ) {
//     return res.status(400).json({
//       message: "invalid prescription! sets and reps must be a positive integer",
//     });
//   }

//   const patient = users.find((u) => u.id === patientId && u.role === "patient");

//   if (!patient) {
//     return res.status(404).json({ message: "patient not found" });
//   }

//   const assignment = createAssignment({
//     doctorId: req.user.id,
//     patientId,
//     exerciseId,
//     date,
//     prescription,
//   });

//   assignments.push(assignment);

//   res.status(201).json({
//     message: "Excercise assigned Successfully",
//     assignment,
//   });
// };


