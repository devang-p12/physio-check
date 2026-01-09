import mongoose from 'mongoose'

const exerciseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  reps: Number,
  duration: Number,
  description: String
}, {
  timestamps: true
});

const Exercise = mongoose.model('Exercise', exerciseSchema);

export const createExercise = async (exerciseData) => {
  const exercise = new Exercise(exerciseData);
  return await exercise.save();
};

export const findExerciseById = async (id) => {
  return await Exercise.findById(id);
};

export const getAllExercises = async () => {
  return await Exercise.find();
};

export const updateExercise = async (id, updateData) => {
  return await Exercise.findByIdAndUpdate(id, updateData, { new: true });
};

export const deleteExercise = async (id) => {
  return await Exercise.findByIdAndDelete(id);
};
