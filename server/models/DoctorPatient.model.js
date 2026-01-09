import mongoose from 'mongoose'

const doctorPatientSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Ensure unique doctor-patient pairs
doctorPatientSchema.index({ doctorId: 1, patientId: 1 }, { unique: true });

const DoctorPatient = mongoose.model('DoctorPatient', doctorPatientSchema);

export const createDoctorPatientLink = async (doctorId, patientId) => {
  const link = new DoctorPatient({ doctorId, patientId });
  return await link.save();
};

export const findDoctorPatientLink = async (doctorId, patientId) => {
  return await DoctorPatient.findOne({ doctorId, patientId });
};

export const getPatientsByDoctor = async (doctorId) => {
  const links = await DoctorPatient.find({ doctorId }).populate('patientId');
  return links.map(link => link.patientId);
};

export const getDoctorsByPatient = async (patientId) => {
  const links = await DoctorPatient.find({ patientId }).populate('doctorId');
  return links.map(link => link.doctorId);
};

export const removeDoctorPatientLink = async (doctorId, patientId) => {
  return await DoctorPatient.findOneAndDelete({ doctorId, patientId });
};