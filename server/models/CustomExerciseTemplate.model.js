import mongoose from 'mongoose';

/**
 * Stores a doctor-recorded exercise template.
 * `frames` is the compact array produced by CreateExercise.tsx:
 *   frames[i][j] = [x, y, z, visibility]  (normalised landmarks)
 */
const customExerciseTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  category: { type: String, default: 'Custom' },
  videoUrl: String, 
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  frameCount: { type: Number, required: true },
  durationSeconds: { type: Number, required: true },
  /** Raw frames as produced by PoseNormalizer.serialise() in CreateExercise */
  frames: { type: [[[[Number]]]], required: true },
}, { timestamps: true });

const CustomExerciseTemplate = mongoose.model(
  'CustomExerciseTemplate',
  customExerciseTemplateSchema
);

export const createTemplate = async (data) =>
  new CustomExerciseTemplate(data).save();

export const getTemplatesByDoctor = async (doctorId) =>
  CustomExerciseTemplate.find({ createdBy: doctorId })
    .select('-frames')          // exclude frames for list view — keeps payload small
    .sort({ createdAt: -1 });

export const getTemplateById = async (id) =>
  CustomExerciseTemplate.findById(id);  // includes frames for patient playback

export const deleteTemplate = async (id, doctorId) =>
  CustomExerciseTemplate.findOneAndDelete({ _id: id, createdBy: doctorId });

export default CustomExerciseTemplate;
