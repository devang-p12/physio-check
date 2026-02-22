import mongoose from 'mongoose';

const sensorDataPointSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    required: true
  },
  heartRate: Number, // beats per minute
  steps: Number,
  calories: Number,
  distance: Number, // in meters
  speed: Number, // m/s
  elevation: Number, // in meters
  acceleration: {
    x: Number,
    y: Number,
    z: Number
  },
  gyroscope: {
    x: Number,
    y: Number,
    z: Number
  },
  orientation: {
    pitch: Number,
    roll: Number,
    yaw: Number
  }
}, { _id: false });

const sessionSchema = new mongoose.Schema({
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    required: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'aborted'],
    default: 'active'
  },
  requiresSensorData: {
    type: Boolean,
    default: false
  },
  sensorData: [sensorDataPointSchema],
  // Analytics data (computed after session ends)
  analytics: {
    avgHeartRate: Number,
    maxHeartRate: Number,
    minHeartRate: Number,
    totalCalories: Number,
    totalSteps: Number,
    totalDistance: Number,
    totalDuration: Number, // in seconds
    intensityZones: {
      low: Number, // time in seconds
      moderate: Number,
      high: Number,
      peak: Number
    },
    formQuality: {
      score: Number, // 0-100
      issues: [String] // e.g., ["poor posture", "incorrect angle"]
    },
    repsCompleted: Number,
    setsCompleted: Number,
    bestStretchDist: Number
  },
  // Google Fit specific data
  googleFitData: {
    dataSourceId: String,
    sessionId: String,
    activityType: String,
    syncedAt: Date
  }
}, {
  timestamps: true
});

// Index for efficient queries
sessionSchema.index({ assignmentId: 1, patientId: 1 });
sessionSchema.index({ patientId: 1, startTime: -1 });
sessionSchema.index({ status: 1 });

const Session = mongoose.model('Session', sessionSchema);

// CRUD operations
export const createSession = async (sessionData) => {
  const session = new Session(sessionData);
  return await session.save();
};

export const findSessionById = async (id) => {
  return await Session.findById(id)
    .populate({
      path: 'assignmentId',
      populate: [
        { path: 'exerciseId' },
        { path: 'customTemplateId', select: '-frames' }
      ]
    })
    .populate('patientId');
};

export const getSessionsByAssignment = async (assignmentId) => {
  return await Session.find({ assignmentId })
    .sort({ startTime: -1 })
    .populate({
      path: 'assignmentId',
      populate: [
        { path: 'exerciseId' },
        { path: 'customTemplateId', select: '-frames' }
      ]
    });
};

export const getSessionsByPatient = async (patientId, limit = 10) => {
  return await Session.find({ patientId })
    .sort({ startTime: -1 })
    .limit(limit)
    .populate({
      path: 'assignmentId',
      populate: [
        { path: 'exerciseId' },
        { path: 'customTemplateId', select: '-frames' }
      ]
    });
};

export const getActiveSession = async (patientId) => {
  return await Session.findOne({
    patientId,
    status: 'active'
  }).populate({
    path: 'assignmentId',
    populate: [
      { path: 'exerciseId' },
      { path: 'customTemplateId', select: '-frames' }
    ]
  });
};

export const updateSession = async (id, updateData) => {
  return await Session.findByIdAndUpdate(id, updateData, { new: true });
};

export const addSensorDataPoint = async (sessionId, dataPoint) => {
  return await Session.findByIdAndUpdate(
    sessionId,
    { $push: { sensorData: dataPoint } },
    { new: true }
  );
};

export const endSession = async (sessionId, analytics) => {
  return await Session.findByIdAndUpdate(
    sessionId,
    {
      endTime: new Date(),
      status: 'completed',
      analytics: analytics
    },
    { new: true }
  );
};

export const deleteSession = async (id) => {
  return await Session.findByIdAndDelete(id);
};

export default Session;
