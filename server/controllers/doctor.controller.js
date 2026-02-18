import User from "../models/User.model.js";
import { findUserById } from "../models/User.model.js";
import { findExerciseById } from "../models/Exercise.model.js";
import { createAssignment } from "../models/Assignment.model.js";

export const assignExercise = async (req, res) => {
  const { patientId, exerciseId, date, prescription } = req.body;

  if (!patientId || !exerciseId || !date || !prescription) {
    return res.status(400).json({ message: "missing required fields" });
  }

  try {
    const { sets, repsPerSet } = prescription;

    if (
      !Number.isInteger(sets) ||
      !Number.isInteger(repsPerSet) ||
      sets <= 0 ||
      repsPerSet <= 0
    ) {
      return res.status(400).json({
        message: "invalid prescription! sets and reps must be a positive integer",
      });
    }

    const patient = await findUserById(patientId);
    if (!patient || patient.role !== "patient") {
      return res.status(404).json({ message: "patient not found" });
    }

    const exercise = await findExerciseById(exerciseId);
    if (!exercise) {
      return res.status(404).json({ message: "exercise not found" });
    }

    const assignment = await createAssignment({
      doctorId: req.user.id,
      patientId,
      exerciseId,
      date: new Date(date),
      prescription: JSON.stringify(prescription),
    });

    res.status(201).json({
      message: "Exercise assigned Successfully",
      assignment: {
        id: assignment._id.toString(),
        doctorId: assignment.doctorId.toString(),
        patientId: assignment.patientId.toString(),
        exerciseId: assignment.exerciseId.toString(),
        date: assignment.date,
        prescription: assignment.prescription,
        completed: assignment.completed,
        performance: assignment.performance
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllDoctors = async (req, res) => {
  try {
    // We find all users where the role is 'doctor'
    // We use .select() to only return public info (no passwords!)
    const doctors = await User.find({ role: "doctor" }).select("name email specialization");

    return res.status(200).json({
      success: true,
      doctors,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error fetching doctors" });
  }
};














































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


