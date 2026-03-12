const express = require('express');
const router = express.Router();
const { query, queryOne } = require('../config/database');
const bcrypt = require('bcryptjs');

/**
 * @route   GET /api/user/profile
 * @desc    Get current user's profile
 * @access  Private
 */
router.get('/profile', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const userId = req.session.user.id;

    const user = await queryOne(`
      SELECT 
        id,
        full_name,
        email,
        student_id,
        role,
        account_status,
        assigned_service_id,
        staff_position,
        created_at,
        last_login
      FROM users
      WHERE id = ?
    `, [userId]);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile'
    });
  }
});

/**
 * @route   PUT /api/user/profile
 * @desc    Update user profile (name only for now)
 * @access  Private
 */
router.put('/profile', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const userId = req.session.user.id;
    const { full_name } = req.body;

    // Validation
    if (!full_name || full_name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Full name must be at least 2 characters'
      });
    }

    // Update profile
    await query(`
      UPDATE users
      SET full_name = ?, updated_at = NOW()
      WHERE id = ?
    `, [full_name.trim(), userId]);

    // Update session
    req.session.user.full_name = full_name.trim();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        full_name: full_name.trim()
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

/**
 * @route   POST /api/user/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post('/change-password', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const userId = req.session.user.id;
    const { current_password, new_password } = req.body;

    // Validation
    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters'
      });
    }

    // Get current password hash
    const user = await queryOne(`
      SELECT password_hash
      FROM users
      WHERE id = ?
    `, [userId]);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(current_password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(new_password, 10);

    // Update password
    await query(`
      UPDATE users
      SET password_hash = ?, updated_at = NOW()
      WHERE id = ?
    `, [newPasswordHash, userId]);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password'
    });
  }
});

/**
 * @route   GET /api/user/stats
 * @desc    Get user statistics (appointment count, etc.)
 * @access  Private
 */
router.get('/stats', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const userId = req.session.user.id;

    // Get appointment count
    const appointmentStats = await queryOne(`
      SELECT COUNT(*) as total_appointments
      FROM appointments
      WHERE student_id = ?
    `, [userId]);

    // Get message count (if applicable)
    const messageStats = await queryOne(`
      SELECT COUNT(*) as total_messages
      FROM messages
      WHERE sender_id = ?
    `, [userId]);

    res.json({
      success: true,
      data: {
        total_appointments: appointmentStats?.total_appointments || 0,
        total_messages: messageStats?.total_messages || 0
      }
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

module.exports = router;
