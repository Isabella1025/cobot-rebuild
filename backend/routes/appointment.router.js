const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const { query } = require('../config/database');
const { requireAuth, requireRole, requireAppointmentAccess } = require('../middleware/permission.middleware');

/**
 * @route   GET /api/appointments/staff/:serviceId
 * @desc    Get staff members for a service
 * @access  Public
 */
router.get('/staff/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;

    const staff = await query(
      `SELECT 
        u.id as staff_id,
        u.full_name,
        u.email,
        ss.staff_role,
        u.staff_position
      FROM service_staff ss
      JOIN users u ON ss.staff_id = u.id
      WHERE ss.service_id = ? 
        AND ss.is_active = TRUE
        AND u.account_status = 'active'
        AND u.is_verified = TRUE
      ORDER BY u.full_name`,
      [serviceId]
    );

    res.json({
      success: true,
      data: staff
    });

  } catch (error) {
    console.error('Error fetching service staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch service staff'
    });
  }
});

/**
 * @route   GET /api/appointments/my-assigned
 * @desc    Get appointments assigned to current staff member
 * @access  Staff
 */
router.get('/my-assigned', requireAuth, requireRole('staff', 'service_admin', 'admin'), async (req, res) => {
  try {
    const { status } = req.query;
    const appointments = await Appointment.getByAssignedStaff(req.session.user.id, status);

    res.json({
      success: true,
      data: appointments
    });

  } catch (error) {
    console.error('Error fetching assigned appointments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch appointments'
    });
  }
});

/**
 * @route   POST /api/appointments
 * @desc    Create a new appointment request
 * @access  Student
 */
router.post('/', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { service_id, appointment_date, appointment_time, reason, duration_minutes, assigned_staff_id } = req.body;

    // Validation
    if (!service_id || !appointment_date || !appointment_time) {
      return res.status(400).json({
        success: false,
        error: 'Service, date, and time are required'
      });
    }

    // Check for conflicts
    const hasConflict = await Appointment.checkConflict(service_id, appointment_date, appointment_time);
    
    if (hasConflict) {
      return res.status(409).json({
        success: false,
        error: 'This time slot is already booked. Please choose another time.'
      });
    }

    // Create appointment
    const appointmentId = await Appointment.create({
      student_id: req.session.user.id,
      service_id,
      appointment_date,
      appointment_time,
      reason,
      duration_minutes,
      assigned_staff_id: assigned_staff_id || null  // Include staff assignment
    });

    const appointment = await Appointment.getById(appointmentId);

    // Notify assigned staff member (if one was selected)
    try {
      if (assigned_staff_id) {
        // Get service name and student name
        const appointmentDetails = await query(
          `SELECT s.service_name, u.full_name as student_name
           FROM appointments a
           JOIN services s ON a.service_id = s.id
           JOIN users u ON a.student_id = u.id
           WHERE a.id = ?`,
          [appointmentId]
        );

        if (appointmentDetails && appointmentDetails.length > 0) {
          const { service_name, student_name } = appointmentDetails[0];

          // Create notification for staff
          await query(
            `INSERT INTO notifications (user_id, type, title, message, icon, is_read, created_at)
             VALUES (?, ?, ?, ?, ?, FALSE, NOW())`,
            [
              assigned_staff_id,
              'appointment',
              'New Appointment Request',
              `${student_name} has requested an appointment with ${service_name} on ${appointment_date}`,
              '📅'
            ]
          );

          console.log(`✓ Notification created for staff ${assigned_staff_id}: New Appointment Request`);

          // Send real-time notification via Socket.IO
          const io = req.app.get('io');
          if (io) {
            io.to(`user_${assigned_staff_id}`).emit('notification', {
              type: 'appointment',
              title: 'New Appointment Request',
              message: `${student_name} has requested an appointment with ${service_name}`,
              icon: '📅',
              timestamp: new Date(),
              read: false
            });
            console.log(`✓ Socket.IO notification sent to staff user_${assigned_staff_id}`);
          }
        }
      }
    } catch (notificationError) {
      console.error('Staff notification creation failed:', notificationError);
    }

    res.json({
      success: true,
      message: 'Appointment request submitted successfully',
      data: appointment
    });

  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create appointment'
    });
  }
});

/**
 * @route   GET /api/appointments/my
 * @desc    Get current user's appointments
 * @access  Student
 */
router.get('/my', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const appointments = await Appointment.getByStudent(req.session.user.id);

    res.json({
      success: true,
      data: appointments
    });

  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch appointments'
    });
  }
});

/**
 * @route   GET /api/appointments/service/:serviceId
 * @desc    Get appointments for a service (staff only)
 * @access  Staff/Admin
 */
router.get('/service/:serviceId', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Check if user is staff/admin
    if (!['staff', 'service_admin', 'admin'].includes(req.session.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Staff only.'
      });
    }

    const { serviceId } = req.params;
    const { status } = req.query;

    const appointments = await Appointment.getByService(serviceId, status);

    res.json({
      success: true,
      data: appointments
    });

  } catch (error) {
    console.error('Error fetching service appointments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch appointments'
    });
  }
});

/**
 * @route   GET /api/appointments/:id
 * @desc    Get appointment details
 * @access  Authenticated
 */
router.get('/:id', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const appointment = await Appointment.getById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    // Check authorization
    const isStudent = appointment.student_id === req.session.user.id;
    const isStaff = ['staff', 'service_admin', 'admin'].includes(req.session.user.role);

    if (!isStudent && !isStaff) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: appointment
    });

  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch appointment'
    });
  }
});

/**
 * @route   PUT /api/appointments/:id/status
 * @desc    Update appointment status (approve/decline)
 * @access  Staff/Admin
 */
router.put('/:id/status', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Check if user is staff/admin
    if (!['staff', 'service_admin', 'admin'].includes(req.session.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Staff only.'
      });
    }

    const { status, notes } = req.body;

    if (!['approved', 'declined', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const appointment = await Appointment.updateStatus(
      req.params.id,
      status,
      req.session.user.id,
      notes
    );

    // Try to create notification (don't break if it fails)
    try {
      // Get appointment details to find the student
      const appointmentDetails = await query(
        `SELECT a.student_id, u.full_name, s.service_name 
         FROM appointments a
         JOIN users u ON a.student_id = u.id
         JOIN services s ON a.service_id = s.id
         WHERE a.id = ?`,
        [req.params.id]
      );

      if (appointmentDetails && appointmentDetails.length > 0) {
        const studentId = appointmentDetails[0].student_id;
        const serviceName = appointmentDetails[0].service_name;

        // Create notification for student
        let notificationTitle = '';
        let notificationMessage = '';
        let notificationIcon = '';

        if (status === 'approved') {
          notificationTitle = 'Appointment Approved';
          notificationMessage = `Your appointment with ${serviceName} has been approved`;
          notificationIcon = '✅';
        } else if (status === 'declined') {
          notificationTitle = 'Appointment Declined';
          notificationMessage = `Your appointment with ${serviceName} has been declined`;
          notificationIcon = '❌';
        } else if (status === 'completed') {
          notificationTitle = 'Appointment Completed';
          notificationMessage = `Your appointment with ${serviceName} has been completed`;
          notificationIcon = '✔️';
        }

        // Insert notification into database
        await query(
          `INSERT INTO notifications (user_id, type, title, message, icon, is_read, created_at)
           VALUES (?, ?, ?, ?, ?, FALSE, NOW())`,
          [studentId, 'appointment', notificationTitle, notificationMessage, notificationIcon]
        );

        console.log(`✓ Notification created for user ${studentId}: ${notificationTitle}`);

        // Send real-time notification via Socket.IO
        const io = req.app.get('io');
        if (io) {
          io.to(`user_${studentId}`).emit('notification', {
            type: 'appointment',
            title: notificationTitle,
            message: notificationMessage,
            icon: notificationIcon,
            timestamp: new Date(),
            read: false
          });
          console.log(`✓ Socket.IO notification sent to user_${studentId}`);
        }
      }
    } catch (notificationError) {
      // Log error but don't fail the appointment update
      console.error('Notification creation failed:', notificationError);
    }

    res.json({
      success: true,
      message: `Appointment ${status} successfully`,
      data: appointment
    });

  } catch (error) {
    console.error('Error updating appointment status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update appointment'
    });
  }
});

/**
 * @route   PUT /api/appointments/:id/reschedule
 * @desc    Reschedule appointment
 * @access  Student or Staff
 */
router.put('/:id/reschedule', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { appointment_date, appointment_time } = req.body;

    if (!appointment_date || !appointment_time) {
      return res.status(400).json({
        success: false,
        error: 'Date and time are required'
      });
    }

    const existing = await Appointment.getById(req.params.id);
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    // Check for conflicts
    const hasConflict = await Appointment.checkConflict(
      existing.service_id,
      appointment_date,
      appointment_time,
      req.params.id
    );

    if (hasConflict) {
      return res.status(409).json({
        success: false,
        error: 'This time slot is already booked'
      });
    }

    const appointment = await Appointment.updateDateTime(
      req.params.id,
      appointment_date,
      appointment_time
    );

    res.json({
      success: true,
      message: 'Appointment rescheduled successfully',
      data: appointment
    });

  } catch (error) {
    console.error('Error rescheduling appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reschedule appointment'
    });
  }
});

/**
 * @route   DELETE /api/appointments/:id
 * @desc    Cancel appointment
 * @access  Student (owner) or Staff
 */
router.delete('/:id', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const appointment = await Appointment.getById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    // Check authorization
    const isStudent = appointment.student_id === req.session.user.id;
    const isStaff = ['staff', 'service_admin', 'admin'].includes(req.session.user.role);

    if (!isStudent && !isStaff) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await Appointment.cancel(req.params.id);

    res.json({
      success: true,
      message: 'Appointment cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel appointment'
    });
  }
});

/**
 * @route   GET /api/appointments/my-appointments
 * @desc    Get current user's appointments (for profile page)
 * @access  Private
 */
router.get('/my-appointments', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const userId = req.session.user.id;

    const appointments = await query(`
      SELECT 
        a.*,
        s.service_name,
        u.full_name as staff_name
      FROM appointments a
      LEFT JOIN services s ON a.service_id = s.id
      LEFT JOIN users u ON a.assigned_staff_id = u.id
      WHERE a.student_id = ?
      ORDER BY a.created_at DESC
    `, [userId]);

    res.json({
      success: true,
      data: appointments
    });

  } catch (error) {
    console.error('Get my appointments error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch appointments'
    });
  }
});

module.exports = router;