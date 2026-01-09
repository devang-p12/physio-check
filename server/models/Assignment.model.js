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
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  prescription: {
    type: String,
    required: true
  },
  completed: {
    type: Boolean,
    default: false
  },
  performance: String
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
    .populate('exerciseId');
};

export const getAssignmentsByPatient = async (patientId) => {
  return await Assignment.find({ patientId })
    .populate('doctorId')
    .populate('exerciseId')
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
