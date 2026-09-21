'use strict';

const Admin = require('../users/models/admin.model');
const User = require('../users/models/user.model');
const ApiError = require('../../utils/ApiError');
const { ROLES } = require('../../constants/roles');

class AdminService {
  /**
   * Create a new Admin user.
   */
  async createAdmin(data, createdByUserId) {
    // Check for duplicate email
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      throw ApiError.conflict('A user with this email already exists');
    }

    const admin = await Admin.create({
      name: data.name,
      email: data.email,
      password: data.password,
      role: ROLES.ADMIN,
      permissions: data.permissions || [],
      createdBy: createdByUserId,
    });

    return admin.toJSON();
  }

  /**
   * Get all Admin users with pagination.
   */
  async getAdmins({ page = 1, limit = 10, search = '' }) {
    const query = { role: ROLES.ADMIN };

    // Optional search by name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [admins, total] = await Promise.all([
      Admin.find(query)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Admin.countDocuments(query),
    ]);

    const pagination = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      pages: Math.ceil(total / limit),
    };

    return { admins, pagination };
  }

  /**
   * Get a single Admin by ID.
   */
  async getAdminById(id) {
    const admin = await Admin.findOne({ _id: id, role: ROLES.ADMIN })
      .populate('createdBy', 'name email');

    if (!admin) {
      throw ApiError.notFound('Admin not found');
    }

    return admin.toJSON();
  }

  /**
   * Update an Admin's details (name, email, permissions).
   */
  async updateAdmin(id, data) {
    const admin = await Admin.findOne({ _id: id, role: ROLES.ADMIN });

    if (!admin) {
      throw ApiError.notFound('Admin not found');
    }

    // If email is being changed, check for duplicates
    if (data.email && data.email !== admin.email) {
      const existingUser = await User.findOne({ email: data.email });
      if (existingUser) {
        throw ApiError.conflict('A user with this email already exists');
      }
    }

    // Update allowed fields
    const allowedFields = ['name', 'email', 'permissions'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        admin[field] = data[field];
      }
    }

    await admin.save();
    return admin.toJSON();
  }

  /**
   * Activate or deactivate an Admin.
   */
  async updateAdminStatus(id, isActive) {
    const admin = await Admin.findOne({ _id: id, role: ROLES.ADMIN })
      .select('+refreshToken');

    if (!admin) {
      throw ApiError.notFound('Admin not found');
    }

    admin.isActive = isActive;

    // If deactivating, clear refresh token to force logout
    if (!isActive) {
      admin.refreshToken = null;
    }

    await admin.save({ validateBeforeSave: false });
    return admin.toJSON();
  }

  /**
   * Reset an Admin's password.
   */
  async resetAdminPassword(id, newPassword) {
    const admin = await Admin.findOne({ _id: id, role: ROLES.ADMIN })
      .select('+password +refreshToken');

    if (!admin) {
      throw ApiError.notFound('Admin not found');
    }

    admin.password = newPassword;
    admin.refreshToken = null; // Force re-login after password reset
    await admin.save();

    return admin.toJSON();
  }
}

module.exports = new AdminService();

