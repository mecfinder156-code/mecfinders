'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { ROLES } = require('../../../constants/roles');

const documentSchema = new mongoose.Schema({
  documentType: {
    type: String,
    enum: ['AADHAAR', 'PAN'],
    required: true,
  },
  documentUrl: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['PENDING', 'VERIFIED', 'REJECTED'],
    default: 'PENDING',
  },
  rejectionReason: {
    type: String,
    default: null,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
  verifiedAt: {
    type: Date,
    default: null,
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, { _id: true });

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name must be at most 50 characters'],
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    password: {
      type: String,
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    profileImage: {
      type: String,
      default: null,
    },
    // Mobile-specific fields (mechanic/customer)
    firebaseUid: {
      type: String,
      sparse: true,
      trim: true,
    },
    age: {
      type: Number,
      default: null,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', null],
      default: null,
    },
    // Document verification
    documents: [documentSchema],
    // Push notification token
    fcmToken: {
      type: String,
      default: null,
    },
    refreshToken: {
      type: String,
      select: false,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    discriminatorKey: 'role',
    toJSON: {
      transform(doc, ret) {
        delete ret.password;
        delete ret.refreshToken;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform(doc, ret) {
        delete ret.password;
        delete ret.refreshToken;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// --- Indexes ---
userSchema.index({ role: 1 });
userSchema.index({ firebaseUid: 1, role: 1 }, { unique: true, sparse: true });

// --- Pre-save hook: Hash password ---
userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) {
    return;
  }

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// --- Instance methods ---
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.isPasswordSet = function () {
  return !!this.password;
};

const User = mongoose.model('User', userSchema);

module.exports = User;

// Register every role discriminator as soon as the base User model is loaded.
// `User.create({ role })` (used by mobile register) resolves the sub-model by
// the `role` discriminator key, which only exists once that role's model file
// has been required. Previously only `mechanic` was loaded transitively, so
// creating a `customer` threw `Discriminator "customer" not found for model
// "User"`. Requiring these AFTER `module.exports` avoids a circular-require
// deadlock (each discriminator file requires this base model).
require('./customer.model');
require('./mechanic.model');
require('./admin.model');
require('./superadmin.model');
