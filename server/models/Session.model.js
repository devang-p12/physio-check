import mongoose from 'mongoose';

const sensorDataPointSchema = new mongoose.Schema({
  timestamp: { type: Date, required: true },
  heartRate: Number, steps: Number, calories: Number, distance: Number,
  speed: Number, elevation: Number,
  acceleration: { x: Number, y: Number, z: Number },
  gyroscope: { x: Number, y: Number, z: Number },
  orientation: { pitch: Number, roll: Number, yaw: Number }
}, { _id: false });

const sessionSchema = new mongoose.Schema({
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
  patientId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startTime: { type: Date, required: true },
  endTime:   { type: Date },
  status: { type: String, enum: ['active', 'completed', 'aborted'], default: 'active' },
  requiresSensorData: { type: Boolean, default: false },
  sensorData: [sensorDataPointSchema],
  analytics: {
    avgHeartRate: Number, maxHeartRate: Number, minHeartRate: Number,
    totalCalories: Number, totalSteps: Number, totalDistance: Number,
    totalDuration: Number,
    intensityZones: { low: Number, moderate: Number, high: Number, peak: Number },
    formQuality: { score: Number, issues: [String] },
    repsCompleted: Number,
    setsCompleted: Number,
    bestStretchDist: Number,
    insights: [String],
    recommendations: [String],
    // NEW — stretch mode
    allocatedDuration:     Number,
    correctPostureSeconds: Number,
    postureAccuracy:       { type: Number, min: 0, max: 100 },
    // NEW — emotion analytics (all sessions)
    dominantEmotion: {
      type: String,
      enum: ['happy','neutral','surprised','angry','sad','fearful','disgusted', null],
      default: null
    },
    emotionCounts: { type: Map, of: Number, default: {} }
  },
  googleFitData: { dataSourceId: String, sessionId: String, activityType: String, syncedAt: Date }
}, { timestamps: true });

sessionSchema.index({ assignmentId: 1, patientId: 1 });
sessionSchema.index({ patientId: 1, startTime: -1 });
sessionSchema.index({ status: 1 });

const Session = mongoose.model('Session', sessionSchema);

export const createSession = async (d) => new Session(d).save();
export const findSessionById = async (id) =>
  Session.findById(id)
    .populate({ path: 'assignmentId', populate: [{ path: 'exerciseId' }, { path: 'customTemplateId', select: '-frames' }] })
    .populate('patientId');
export const getSessionsByAssignment = async (assignmentId) =>
  Session.find({ assignmentId }).sort({ startTime: -1 })
    .populate({ path: 'assignmentId', populate: [{ path: 'exerciseId' }, { path: 'customTemplateId', select: '-frames' }] });
export const getSessionsByPatient = async (patientId, limit = 10) =>
  Session.find({ patientId }).sort({ startTime: -1 }).limit(limit)
    .populate({ path: 'assignmentId', populate: [{ path: 'exerciseId' }, { path: 'customTemplateId', select: '-frames' }] });
export const getActiveSession = async (patientId) =>
  Session.findOne({ patientId, status: 'active' })
    .populate({ path: 'assignmentId', populate: [{ path: 'exerciseId' }, { path: 'customTemplateId', select: '-frames' }] });
export const updateSession = async (id, data) => Session.findByIdAndUpdate(id, data, { new: true });
export const addSensorDataPoint = async (sessionId, dataPoint) =>
  Session.findByIdAndUpdate(sessionId, { $push: { sensorData: dataPoint } }, { new: true });
export const endSession = async (sessionId, analytics) =>
  Session.findByIdAndUpdate(sessionId, { endTime: new Date(), status: 'completed', analytics }, { new: true });
export const deleteSession = async (id) => Session.findByIdAndDelete(id);

export default Session;     