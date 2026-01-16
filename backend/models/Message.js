const { query, queryOne } = require('../config/database');

class Message {
  // Create new message
  static async create(messageData) {
    const sql = `
      INSERT INTO messages (group_id, sender_id, bot_id, message_text, message_type, is_bot_message)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const result = await query(sql, [
      messageData.group_id,
      messageData.sender_id || null,
      messageData.bot_id || null,
      messageData.message_text,
      messageData.message_type || 'text',
      messageData.is_bot_message || false
    ]);
    return result.insertId;
  }

  // Get messages for a group
  static async getByGroup(groupId, limit = 50, offset = 0) {
    const sql = `
      SELECT 
        m.*,
        u.full_name as sender_name,
        u.student_id as sender_student_id,
        u.role as sender_role,
        b.bot_name
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      LEFT JOIN bots b ON m.bot_id = b.id
      WHERE m.group_id = ?
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const messages = await query(sql, [groupId, limit, offset]);
    return messages.reverse(); // Return in chronological order
  }

  // Get recent messages (last N)
  static async getRecent(groupId, limit = 50) {
    const sql = `
      SELECT 
        m.*,
        u.full_name as sender_name,
        u.student_id as sender_student_id,
        u.role as sender_role,
        b.bot_name
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      LEFT JOIN bots b ON m.bot_id = b.id
      WHERE m.group_id = ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `;
    const messages = await query(sql, [groupId, limit]);
    return messages.reverse();
  }

  // Get message by ID
  static async findById(id) {
    const sql = `
      SELECT 
        m.*,
        u.full_name as sender_name,
        u.student_id as sender_student_id,
        u.role as sender_role,
        b.bot_name
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      LEFT JOIN bots b ON m.bot_id = b.id
      WHERE m.id = ?
    `;
    return await queryOne(sql, [id]);
  }

  // Get message count for group
  static async getCount(groupId) {
    const sql = 'SELECT COUNT(*) as count FROM messages WHERE group_id = ?';
    const result = await queryOne(sql, [groupId]);
    return result.count;
  }

  // Search messages in group
  static async search(groupId, searchTerm, limit = 50) {
    const sql = `
      SELECT 
        m.*,
        u.full_name as sender_name,
        u.student_id as sender_student_id,
        b.bot_name
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      LEFT JOIN bots b ON m.bot_id = b.id
      WHERE m.group_id = ? AND m.message_text LIKE ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `;
    return await query(sql, [groupId, `%${searchTerm}%`, limit]);
  }

  // Delete message
  static async delete(messageId) {
    const sql = 'DELETE FROM messages WHERE id = ?';
    return await query(sql, [messageId]);
  }

  // Get messages with pagination
  static async getPaginated(groupId, lastMessageId, limit = 50) {
    const sql = `
      SELECT 
        m.*,
        u.full_name as sender_name,
        u.student_id as sender_student_id,
        u.role as sender_role,
        b.bot_name
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      LEFT JOIN bots b ON m.bot_id = b.id
      WHERE m.group_id = ? AND m.id < ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `;
    const messages = await query(sql, [groupId, lastMessageId, limit]);
    return messages.reverse();
  }
}

module.exports = Message;