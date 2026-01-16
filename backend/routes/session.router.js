const express = require('express');
const router = express.Router();
const UserService = require('../services/UserService');
const { isAuthenticated } = require('../middleware/auth.middleware');

// POST /api/session/start - Start a new session (login)
router.post('/start', async (req, res) => {
  try {
    const { courseCode, studentId } = req.body;

    // Validate input
    if (!courseCode || !studentId) {
      return res.status(400).json({
        success: false,
        message: 'Course code and student ID are required'
      });
    }

    // Authenticate user
    const result = await UserService.authenticateUser(courseCode, studentId);

    if (!result.success) {
      return res.status(401).json(result);
    }

    // Create session
    req.session.userId = result.data.user.id;
    req.session.userRole = result.data.user.role;
    req.session.studentId = result.data.user.student_id;
    req.session.courseId = result.data.course.id;
    req.session.courseCode = result.data.course.course_code;

    return res.status(200).json(result);
  } catch (error) {
    console.error('Session start error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to start session'
    });
  }
});

// GET /api/session/verify - Verify current session
router.get('/verify', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const courseId = req.session.courseId;

    const verification = await UserService.verifySession(userId, courseId);

    if (!verification.success) {
      req.session.destroy();
      return res.status(401).json(verification);
    }

    return res.status(200).json({
      success: true,
      data: {
        userId: req.session.userId,
        userRole: req.session.userRole,
        studentId: req.session.studentId,
        courseId: req.session.courseId,
        courseCode: req.session.courseCode
      }
    });
  } catch (error) {
    console.error('Session verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify session'
    });
  }
});

// POST /api/session/end - End session (logout)
router.post('/end', isAuthenticated, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to end session'
      });
    }

    res.clearCookie('connect.sid');
    return res.status(200).json({
      success: true,
      message: 'Session ended successfully'
    });
  });
});

// GET /api/session/current - Get current session info
router.get('/current', isAuthenticated, async (req, res) => {
  try {
    const profile = await UserService.getUserProfile(req.session.userId);

    if (!profile.success) {
      return res.status(404).json(profile);
    }

    return res.status(200).json({
      success: true,
      data: {
        ...profile.data,
        currentCourse: {
          id: req.session.courseId,
          code: req.session.courseCode
        }
      }
    });
  } catch (error) {
    console.error('Get session error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get session info'
    });
  }
});

module.exports = router;