import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    required: true,
    enum: ['doctor', 'patient']
  },
  googleFit: {
    accessToken: String,
    refreshToken: String,
    expiresAt: Date,
    scope: String,
    connectedAt: Date
  },
  settings: {
    smartwatchEnabled: {
      type: Boolean,
      default: false
    },
    enableRealTimeTracking: {
      type: Boolean,
      default: true
    },
    enableFormAnalysis: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

const User = mongoose.model('User', userSchema);

export const createUser = async (userData) => {
  const user = new User(userData);
  return await user.save();
};

export const findUserByEmail = async (email) => {
  return await User.findOne({ email });
};

export const findUserById = async (id) => {
  return await User.findById(id);
};

export const getAllUsers = async () => {
  return await User.find();
};

export const getUsersByRole = async (role) => {
  return await User.find({ role });
};

export const updateUser = async (id, updateData) => {
  return await User.findByIdAndUpdate(id, updateData, { new: true });
};
