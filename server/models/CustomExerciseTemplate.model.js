import mongoose from 'mongoose';

/**
 * exerciseMode: 'workout' = rep counting | 'stretch' = distance-hold tracking
 * exerciseType: 'body' = full pose | 'palm' = hand landmarks
 * stretchConfig: only set when exerciseMode === 'stretch'
 * frames: keyframe snapshots (empty array is OK for stretch-only templates)
 */
const customExerciseTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  category: { type: String, default: 'Custom' },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  exerciseMode: { type: String, enum: ['workout', 'stretch'], default: 'workout' },
  exerciseType: { type: String, enum: ['body', 'palm'], default: 'body' },
  frameCount: { type: Number, required: true },
  durationSeconds: { type: Number, required: true },
  frames: { type: [[[[Number]]]], default: [] },
  /** Only set when exerciseMode === 'stretch' */
  stretchConfig: {
    lm1: { type: Number },           // landmark index (0-32 for pose, 0-20 for palm)
    lm2: { type: Number },
    direction: { type: String, enum: ['inward', 'outward'] },
  },
  videoUrl: { type: String },
  keyframeTimestamps: { type: [Number], default: [] },
}, { timestamps: true });

const CustomExerciseTemplate = mongoose.model(
  'CustomExerciseTemplate',
  customExerciseTemplateSchema
);

export const createTemplate = async (data) =>
  new CustomExerciseTemplate(data).save();

export const getTemplatesByDoctor = async (doctorId) =>
  CustomExerciseTemplate.find({ createdBy: doctorId })
    .select('-frames')
    .sort({ createdAt: -1 });

export const getTemplateById = async (id) =>
  CustomExerciseTemplate.findById(id);

export const deleteTemplate = async (id, doctorId) =>
  CustomExerciseTemplate.findOneAndDelete({ _id: id, createdBy: doctorId });

export default CustomExerciseTemplate;
