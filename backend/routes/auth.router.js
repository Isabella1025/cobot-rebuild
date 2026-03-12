const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const AuthService = require('../services/AuthService');
const { query } = require('../config/database');  // IMPORTANT: Add this line!

/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user (student or staff)
 * @access  Public
 */
router.post('/signup', async (req, res) => {
  try {
    const { full_name, email, student_id, password, is_staff, service_id, position, reason } = req.body;

    // Validation
    if (!full_name || !email || !student_id || !password) {
      return res.status(400).json({
        success: false,
        error: 'Full name, email, student ID, and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    // If staff signup, validate service selection
    if (is_staff && !service_id) {
      return res.status(400).json({
        success: false,
        error: 'Please select a service to join as staff'
      });
    }

    const result = await AuthService.signup(full_name, email, student_id, password, is_staff, service_id, position, reason);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Signup failed'
    });
  }
});

/**
 * @route   POST /api/auth/verify
 * @desc    Verify email with OTP
 * @access  Public
 */
router.post('/verify', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        error: 'Email and verification code are required'
      });
    }

    const result = await AuthService.verifyEmail(email, otp);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Verification error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Verification failed'
    });
  }
});

/**
 * @route   POST /api/auth/resend-otp
 * @desc    Resend verification OTP
 * @access  Public
 */
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const result = await AuthService.resendOTP(email);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to resend OTP'
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const user = await AuthService.login(email, password);

    // Set session
    req.session.user = user;

    res.json({
      success: true,
      data: user,
      message: 'Login successful'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'Login failed'
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  });
});

/**
 * @route   GET /api/auth/current
 * @desc    Get current user
 * @access  Private
 */
router.get('/current', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      error: 'Not authenticated'
    });
  }

  res.json({
    success: true,
    data: req.session.user
  });
});

/**
 * @route   GET /api/auth/staff-applications
 * @desc    Get pending staff applications (for service admin)
 * @access  Private (service_admin only)
 */
router.get('/staff-applications', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    // Only service_admin can view applications
    if (req.session.user.role !== 'service_admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only service administrators can view applications.'
      });
    }

    // Service admin can filter by their assigned service or view all
    const serviceId = req.query.service_id || null;

    const applications = await AuthService.getPendingStaffApplications(serviceId);

    res.json({
      success: true,
      data: applications
    });

  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get applications'
    });
  }
});

/**
 * @route   POST /api/auth/staff-applications/:id/approve
 * @desc    Approve staff application
 * @access  Private (service_admin only)
 */
router.post('/staff-applications/:id/approve', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    if (req.session.user.role !== 'service_admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const { notes } = req.body;
    const applicationId = req.params.id;

    const result = await AuthService.approveStaffApplication(applicationId, req.session.user.id, notes);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Approve application error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to approve application'
    });
  }
});

/**
 * @route   POST /api/auth/staff-applications/:id/reject
 * @desc    Reject staff application
 * @access  Private (service_admin only)
 */
router.post('/staff-applications/:id/reject', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    if (req.session.user.role !== 'service_admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const { notes } = req.body;
    const applicationId = req.params.id;

    const result = await AuthService.rejectStaffApplication(applicationId, req.session.user.id, notes);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Reject application error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to reject application'
    });
  }
});

// ============================================
// PASSWORD RESET ROUTES
// ============================================

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Check if user exists
    const user = await query(
      'SELECT id, email, full_name FROM users WHERE email = ?',
      [email]
    );

    if (!user || user.length === 0) {
      // Don't reveal if user exists for security
      return res.json({
        success: true,
        message: 'If an account exists with that email, a reset link has been sent'
      });
    }

    const userData = user[0];

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Store token in database
    await query(
      `UPDATE users 
       SET reset_token = ?, reset_token_expiry = ? 
       WHERE id = ?`,
      [resetTokenHash, resetTokenExpiry, userData.id]
    );

    // Send email with the plain token (EmailService will build the URL)
    const emailService = require('../services/EmailService');
    await emailService.sendPasswordReset(
      userData.email,
      resetToken,  // Pass plain token, not URL
      userData.full_name
    );

    res.json({
      success: true,
      message: 'Password reset email sent'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process password reset request'
    });
  }
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    console.log('Reset password attempt:', {
      hasToken: !!token,
      hasPassword: !!newPassword,
      tokenLength: token ? token.length : 0
    });

    if (!token || !newPassword) {
      console.log('Missing token or password');
      return res.status(400).json({
        success: false,
        error: 'Token and new password are required'
      });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      console.log('Password too short');
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long'
      });
    }

    // Hash the token to compare with database
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    console.log('Looking for token hash in database...');

    // Find user with valid token
    const user = await query(
      `SELECT id, email, full_name 
       FROM users 
       WHERE reset_token = ? 
       AND reset_token_expiry > NOW()`,
      [resetTokenHash]
    );

    console.log('User lookup result:', {
      found: user && user.length > 0,
      count: user ? user.length : 0
    });

    if (!user || user.length === 0) {
      console.log('Invalid or expired token');
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token'
      });
    }

    const userData = user[0];
    console.log('Resetting password for user:', userData.email);

    // Hash new password
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    await query(
      `UPDATE users 
       SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL 
       WHERE id = ?`,
      [hashedPassword, userData.id]
    );

    console.log('Password updated successfully');

    // Send confirmation email
    const emailService = require('../services/EmailService');
    await emailService.sendPasswordResetConfirmation(
      userData.email,
      userData.full_name
    );

    console.log('Confirmation email sent');

    res.json({
      success: true,
      message: 'Password reset successful'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password'
    });
  }
});

module.exports = router;
