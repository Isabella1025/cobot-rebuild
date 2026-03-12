const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

/**
 * @route   GET /api/analytics
 * @desc    Get analytics data
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

    // Get overall stats
    const stats = await getOverallStats();

    // Get appointments by service
    const appointmentsByService = await query(`
      SELECT 
        s.service_name,
        COUNT(a.id) as count
      FROM services s
      LEFT JOIN appointments a ON s.id = a.service_id
      GROUP BY s.id, s.service_name
      ORDER BY count DESC
    `);

    // Get appointments over time (last 7 days)
    const appointmentsOverTime = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM appointments
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    // Get messages by channel
    const messagesByChannel = await query(`
      SELECT 
        c.channel_name,
        COUNT(m.id) as count
      FROM service_channels c
      LEFT JOIN messages m ON c.id = m.channel_id
      GROUP BY c.id, c.channel_name
      ORDER BY count DESC
      LIMIT 5
    `);

    // Get appointments by status
    const appointmentsByStatus = await query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM appointments
      GROUP BY status
    `);

    // Get recent activity (last 10 activities)
    const recentActivity = await query(`
      SELECT 
        'Appointment' as activity_type,
        a.created_at,
        u.full_name as user_name,
        u.email as user_email,
        a.status
      FROM appointments a
      LEFT JOIN users u ON a.student_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        stats,
        appointmentsByService,
        appointmentsOverTime,
        messagesByChannel,
        appointmentsByStatus,
        recentActivity
      }
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics data'
    });
  }
});

async function getOverallStats() {
  try {
    // Total appointments
    const totalAppointments = await query(
      'SELECT COUNT(*) as count FROM appointments'
    );

    // Appointments this week
    const appointmentsThisWeek = await query(`
      SELECT COUNT(*) as count 
      FROM appointments 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);

    // Total messages
    const totalMessages = await query(
      'SELECT COUNT(*) as count FROM messages'
    );

    // Messages this week
    const messagesThisWeek = await query(`
      SELECT COUNT(*) as count 
      FROM messages 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);

    // Active users (users who logged in within last 30 days)
    const activeUsers = await query(`
      SELECT COUNT(DISTINCT id) as count 
      FROM users 
      WHERE last_login >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    // New users this week
    const newUsersThisWeek = await query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);

    // Bot interactions (messages from bots)
    const botInteractions = await query(
      'SELECT COUNT(*) as count FROM messages WHERE is_bot_message = TRUE'
    );

    // Bot interactions this week
    const botInteractionsThisWeek = await query(`
      SELECT COUNT(*) as count 
      FROM messages 
      WHERE is_bot_message = TRUE 
      AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);

    return {
      totalAppointments: totalAppointments[0]?.count || 0,
      appointmentsThisWeek: appointmentsThisWeek[0]?.count || 0,
      totalMessages: totalMessages[0]?.count || 0,
      messagesThisWeek: messagesThisWeek[0]?.count || 0,
      activeUsers: activeUsers[0]?.count || 0,
      newUsersThisWeek: newUsersThisWeek[0]?.count || 0,
      botInteractions: botInteractions[0]?.count || 0,
      botInteractionsThisWeek: botInteractionsThisWeek[0]?.count || 0
    };
  } catch (error) {
    console.error('Error getting overall stats:', error);
    return {};
  }
}

module.exports = router;
