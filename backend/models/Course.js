const { query, queryOne } = require('../config/database');

class Course {
  // Find course by code
  static async findByCourseCode(courseCode) {
    const sql = 'SELECT * FROM courses WHERE course_code = ? AND is_active = TRUE';
    return await queryOne(sql, [courseCode]);
  }

  // Find course by ID
  static async findById(id) {
    const sql = 'SELECT * FROM courses WHERE id = ? AND is_active = TRUE';
    return await queryOne(sql, [id]);
  }

  // Get all active courses
  static async getAll() {
    const sql = 'SELECT * FROM courses WHERE is_active = TRUE ORDER BY course_name';
    return await query(sql);
  }

  // Create new course
  static async create(courseData) {
    const sql = `
      INSERT INTO courses (course_code, course_name, course_description, lecturer_id)
      VALUES (?, ?, ?, ?)
    `;
    const result = await query(sql, [
      courseData.course_code,
      courseData.course_name,
      courseData.course_description || null,
      courseData.lecturer_id
    ]);
    return result.insertId;
  }

  // Enroll user in course
  static async enrollUser(userId, courseId) {
    const sql = `
      INSERT IGNORE INTO course_enrollments (user_id, course_id)
      VALUES (?, ?)
    `;
    return await query(sql, [userId, courseId]);
  }

  // Check if user is enrolled
  static async isUserEnrolled(userId, courseId) {
    const sql = `
      SELECT * FROM course_enrollments 
      WHERE user_id = ? AND course_id = ?
    `;
    const result = await queryOne(sql, [userId, courseId]);
    return result !== null;
  }

  // Get course enrollment count
  static async getEnrollmentCount(courseId) {
    const sql = 'SELECT COUNT(*) as count FROM course_enrollments WHERE course_id = ?';
    const result = await queryOne(sql, [courseId]);
    return result.count;
  }
}

module.exports = Course;