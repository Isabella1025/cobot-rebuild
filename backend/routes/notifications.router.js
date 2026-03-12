const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

/**
 * @route   GET /api/notifications
 * @desc    Get user's notifications
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const userId = req.session.user.id;

    // Get notifications for this user
    const notifications = await query(`
      SELECT 
        id,
        type,
        title,
        message,
        icon,
        is_read as \`read\`,
        created_at as timestamp
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `, [userId]);

    res.json({
      success: true,
      data: notifications
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications'
    });
  }
});

/**
 * @route   POST /api/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.post('/:id/read', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const notificationId = req.params.id;
    const userId = req.session.user.id;

    await query(`
      UPDATE notifications
      SET is_read = TRUE
      WHERE id = ? AND user_id = ?
    `, [notificationId, userId]);

    res.json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification'
    });
  }
});

/**
 * @route   POST /api/notifications/mark-all-read
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.post('/mark-all-read', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const userId = req.session.user.id;

    await query(`
      UPDATE notifications
      SET is_read = TRUE
      WHERE user_id = ? AND is_read = FALSE
    `, [userId]);

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });

  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notifications'
    });
  }
});

/**
 * Helper function to create a notification
 */
async function createNotification(userId, type, title, message, icon = '🔔') {
  try {
    await query(`
      INSERT INTO notifications (user_id, type, title, message, icon, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, FALSE, NOW())
    `, [userId, type, title, message, icon]);

    // Emit socket event if available
    const io = global.io;
    if (io) {
      io.to(`user_${userId}`).emit('notification', {
        type,
        title,
        message,
        icon,
        timestamp: new Date(),
        read: false
      });
    }

    return true;
  } catch (error) {
    console.error('Create notification error:', error);
    return false;
  }
}

module.exports = router;
module.exports.createNotification = createNotification;
