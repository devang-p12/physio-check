import mongoose from 'mongoose'

const assignmentSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  exerciseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exercise',
    // Not required for custom-template exercises
  },
  // Present only for custom-template exercises created via CreateExercise
  customTemplateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CustomExerciseTemplate',
  },
  date: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date
  },
  prescription: {
    type: String,
    required: true
  },
  completed: {
    type: Boolean,
    default: false
  },
  performance: String,
  // Track all sessions for this assignment
  sessions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session'
  }],
  // Summary stats from all sessions
  totalSessions: {
    type: Number,
    default: 0
  },
  lastSessionDate: Date,
  averagePerformance: {
    avgHeartRate: Number,
    avgFormScore: Number,
    totalReps: Number,
    totalDuration: Number
  }
}, {
  timestamps: true
});

const Assignment = mongoose.model('Assignment', assignmentSchema);

export const createAssignment = async (assignmentData) => {
  const assignment = new Assignment(assignmentData);
  return await assignment.save();
};

export const findAssignmentById = async (id) => {
  return await Assignment.findById(id)
    .populate('doctorId')
    .populate('patientId')
    .populate('exerciseId')
    .populate('customTemplateId', '-frames');
};

export const getAssignmentsByPatient = async (patientId) => {
  return await Assignment.find({ patientId })
    .populate('doctorId')
    .populate('exerciseId')
    .populate('customTemplateId', '-frames')  // no frames in list view
    .sort({ date: -1 });
};

export const getAssignmentsByDoctor = async (doctorId) => {
  return await Assignment.find({ doctorId })
    .populate('patientId')
    .populate('exerciseId')
    .sort({ date: -1 });
};

export const updateAssignment = async (id, updateData) => {
  return await Assignment.findByIdAndUpdate(id, updateData, { new: true });
};

export const deleteAssignment = async (id) => {
  return await Assignment.findByIdAndDelete(id);
};

export const addSessionToAssignment = async (assignmentId, sessionId) => {
  return await Assignment.findByIdAndUpdate(
    assignmentId,
    { 
      $push: { sessions: sessionId },
      $inc: { totalSessions: 1 },
      lastSessionDate: new Date()
    },
    { new: true }
  );
};

export const markAssignmentCompleted = async (assignmentId) => {
  return await Assignment.findByIdAndUpdate(
    assignmentId,
    { completed: true },
    { new: true }
  );
};

export const updateAssignmentStats = async (assignmentId, sessionAnalytics) => {
  const assignment = await Assignment.findById(assignmentId).populate('sessions');
  
  if (!assignment) return null;

  // Calculate average performance from all sessions
  const sessions = assignment.sessions;
  const totalReps = sessions.reduce((sum, s) => sum + (s.analytics?.repsCompleted || 0), 0);
  const avgHeartRate = sessions.reduce((sum, s) => sum + (s.analytics?.avgHeartRate || 0), 0) / sessions.length;
  const avgFormScore = sessions.reduce((sum, s) => sum + (s.analytics?.formQuality?.score || 0), 0) / sessions.length;
  const totalDuration = sessions.reduce((sum, s) => sum + (s.analytics?.totalDuration || 0), 0);

  return await Assignment.findByIdAndUpdate(
    assignmentId,
    {
      averagePerformance: {
        avgHeartRate: Math.round(avgHeartRate),
        avgFormScore: Math.round(avgFormScore),
        totalReps,
        totalDuration
      }
    },
    { new: true }
  );
};
