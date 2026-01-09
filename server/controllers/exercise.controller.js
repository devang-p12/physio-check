import { createExercise, getAllExercises } from "../models/Exercise.model.js";

export const getExercises = async (req, res) => {
  try {
    const exercises = await getAllExercises();
    res.json({ exercises });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const seedExercises = async (req, res) => {
  try {
    const exercises = await getAllExercises();
    
    // Only seed if no exercises exist
    if (exercises.length > 0) {
      return res.json({ message: "Exercises already exist", exercises });
    }

    const exerciseData = [
      { name: "Leg Press", reps: 10, duration: null, description: "Strength exercise for Quads" },
      { name: "Heel Slides", reps: 15, duration: null, description: "Mobility exercise for Knee Flexion" },
      { name: "Wall Squats", reps: 12, duration: 30, description: "Endurance exercise for Quads/Glutes" },
      { name: "Calf Raises", reps: 15, duration: null, description: "Strength exercise for Calves" },
      { name: "Single Leg Balance", reps: null, duration: 60, description: "Stability exercise for Balance" },
    ];

    const createdExercises = [];
    for (const ex of exerciseData) {
      const created = await createExercise(ex);
      createdExercises.push(created);
    }

    res.status(201).json({ 
      message: "Exercises seeded successfully", 
      exercises: createdExercises 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
