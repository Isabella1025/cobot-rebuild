const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

/**
 * @route   GET /api/search/appointments
 * @desc    Search appointments with filters
 * @access  Private
 */
router.get('/appointments', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const userId = req.session.user.id;
    const { 
      search, 
      status, 
      service_id, 
      date_from, 
      date_to,
      limit = 50,
      offset = 0
    } = req.query;

    let sql = `
      SELECT 
        a.*,
        s.service_name,
        u.full_name as staff_name
      FROM appointments a
      LEFT JOIN services s ON a.service_id = s.id
      LEFT JOIN users u ON a.assigned_staff_id = u.id
      WHERE a.student_id = ?
    `;

    const params = [userId];

    // Add search filter
    if (search) {
      sql += ` AND (
        s.service_name LIKE ? OR 
        a.reason LIKE ? OR 
        a.staff_notes LIKE ?
      )`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Add status filter
    if (status) {
      sql += ` AND a.status = ?`;
      params.push(status);
    }

    // Add service filter
    if (service_id) {
      sql += ` AND a.service_id = ?`;
      params.push(service_id);
    }

    // Add date range filter
    if (date_from) {
      sql += ` AND a.appointment_date >= ?`;
      params.push(date_from);
    }

    if (date_to) {
      sql += ` AND a.appointment_date <= ?`;
      params.push(date_to);
    }

    sql += ` ORDER BY a.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const results = await query(sql, params);

    // Get total count for pagination
    let countSql = `
      SELECT COUNT(*) as total
      FROM appointments a
      LEFT JOIN services s ON a.service_id = s.id
      WHERE a.student_id = ?
    `;

    const countParams = [userId];

    if (search) {
      countSql += ` AND (
        s.service_name LIKE ? OR 
        a.reason LIKE ? OR 
        a.staff_notes LIKE ?
      )`;
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm);
    }

    if (status) {
      countSql += ` AND a.status = ?`;
      countParams.push(status);
    }

    if (service_id) {
      countSql += ` AND a.service_id = ?`;
      countParams.push(service_id);
    }

    if (date_from) {
      countSql += ` AND a.appointment_date >= ?`;
      countParams.push(date_from);
    }

    if (date_to) {
      countSql += ` AND a.appointment_date <= ?`;
      countParams.push(date_to);
    }

    const countResult = await query(countSql, countParams);
    const total = countResult[0]?.total || 0;

    res.json({
      success: true,
      data: results,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + results.length) < total
      }
    });

  } catch (error) {
    console.error('Search appointments error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search appointments'
    });
  }
});

/**
 * @route   GET /api/search/messages
 * @desc    Search messages in channels
 * @access  Private
 */
router.get('/messages', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const { 
      search, 
      channel_id,
      date_from,
      date_to,
      limit = 50,
      offset = 0
    } = req.query;

    if (!search || search.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search term must be at least 2 characters'
      });
    }

    let sql = `
      SELECT 
        m.*,
        u.full_name as sender_name,
        sc.channel_name
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      LEFT JOIN service_channels sc ON m.channel_id = sc.id
      WHERE m.message_text LIKE ?
    `;

    const params = [`%${search}%`];

    // Filter by channel if specified
    if (channel_id) {
      sql += ` AND m.channel_id = ?`;
      params.push(channel_id);
    }

    // Date filters
    if (date_from) {
      sql += ` AND m.created_at >= ?`;
      params.push(date_from);
    }

    if (date_to) {
      sql += ` AND m.created_at <= ?`;
      params.push(date_to);
    }

    sql += ` ORDER BY m.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const results = await query(sql, params);

    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search messages'
    });
  }
});

/**
 * @route   GET /api/search/documents
 * @desc    Search documents
 * @access  Private
 */
router.get('/documents', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const { 
      search, 
      file_type,
      service_id,
      limit = 50,
      offset = 0
    } = req.query;

    let sql = `
      SELECT 
        f.*,
        s.service_name
      FROM files f
      LEFT JOIN services s ON f.course_id = s.id
      WHERE 1=1
    `;

    const params = [];

    // Search filter
    if (search) {
      sql += ` AND (f.original_name LIKE ? OR f.file_name LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    // File type filter
    if (file_type) {
      sql += ` AND f.file_type = ?`;
      params.push(file_type);
    }

    // Service filter
    if (service_id) {
      sql += ` AND f.course_id = ?`;
      params.push(service_id);
    }

    sql += ` ORDER BY f.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const results = await query(sql, params);

    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('Search documents error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search documents'
    });
  }
});

/**
 * @route   GET /api/search/services
 * @desc    Search services
 * @access  Private
 */
router.get('/services', async (req, res) => {
  try {
    const { search } = req.query;

    let sql = `
      SELECT 
        id,
        service_name,
        service_description,
        service_type,
        is_active
      FROM services
      WHERE is_active = TRUE
    `;

    const params = [];

    if (search) {
      sql += ` AND (
        service_name LIKE ? OR 
        service_description LIKE ? OR 
        service_type LIKE ?
      )`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    sql += ` ORDER BY service_name`;

    const results = await query(sql, params);

    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('Search services error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search services'
    });
  }
});

module.exports = router;
