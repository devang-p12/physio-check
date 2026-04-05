import { createExercise, getAllExercises } from "../models/Exercise.model.js";

export const getExercises = async (req, res) => {
  try {
    let exercises = await getAllExercises();

    const requiredExercises = [
      { name: 'Reaction Exercise', reps: null, duration: 30, description: 'Reaction time exercise (tap targets / fingertip)' },
      { name: 'Knee Extension', reps: 10, duration: null, description: 'MediaPipe tracked Seated Leg Raise' },
      { name: 'Shoulder Abduction', reps: 10, duration: null, description: 'MediaPipe tracked Lateral Arm Raise' },
      { name: 'Hip Hinge', reps: 10, duration: null, description: 'MediaPipe tracked Forward Bend' },
      { name: 'Calf Raise', reps: 15, duration: null, description: 'MediaPipe tracked Heel Raise' },
      { name: 'Lateral Leg Raise', reps: 10, duration: null, description: 'MediaPipe tracked Side Leg Raise' },
      { name: 'Knee Flexion', reps: 10, duration: null, description: 'MediaPipe tracked Standing Hamstring Curl' },
      { name: 'Shoulder Flexion', reps: 10, duration: null, description: 'MediaPipe tracked Forward Arm Raise' },
      { name: 'Side Bend', reps: 10, duration: null, description: 'MediaPipe tracked Lateral Trunk Flexion' },
      { name: 'Single Leg Balance', reps: null, duration: 30, description: 'MediaPipe tracked Static Balance' },
      { name: 'Elbow Flexion', reps: 10, duration: null, description: 'MediaPipe tracked Bicep Curl' }
    ];

    let updated = false;
    for (const reqEx of requiredExercises) {
      if (!exercises.some(e => e.name === reqEx.name)) {
        const created = await createExercise(reqEx);
        exercises.push(created);
        updated = true;
      }
    }

    res.json({ exercises });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const seedExercises = async (req, res) => {
  try {
    const exercises = await getAllExercises();

    // If no exercises exist, seed the default set (including Reaction Exercise)
    if (exercises.length === 0) {
      const exerciseData = [
        { name: "Leg Press", reps: 10, duration: null, description: "Strength exercise for Quads" },
        { name: "Heel Slides", reps: 15, duration: null, description: "Mobility exercise for Knee Flexion" },
        { name: "Wall Squats", reps: 12, duration: 30, description: "Endurance exercise for Quads/Glutes" },
        { name: "Calf Raises", reps: 15, duration: null, description: "Strength exercise for Calves" },
        { name: "Single Leg Balance", reps: null, duration: 60, description: "Stability exercise for Balance" },
        { name: "Reaction Exercise", reps: null, duration: 30, description: "Reaction time exercise (tap targets / fingertip)" },
      ];

      const createdExercises = [];
      for (const ex of exerciseData) {
        const created = await createExercise(ex);
        createdExercises.push(created);
      }

      return res.status(201).json({ message: "Exercises seeded successfully", exercises: createdExercises });
    }

    // If exercises already exist, ensure Reaction Exercise exists and create it if missing
    const hasReaction = exercises.some(e => e.name === 'Reaction Exercise');
    if (!hasReaction) {
      const created = await createExercise({ name: 'Reaction Exercise', reps: null, duration: 30, description: 'Reaction time exercise (tap targets / fingertip)' });
      return res.status(201).json({ message: 'Reaction Exercise added', exercises: [...exercises, created] });
    }

    return res.json({ message: "Exercises already exist", exercises });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
