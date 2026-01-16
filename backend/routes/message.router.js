const express = require('express');
const router = express.Router();
const MessagingService = require('../services/MessagingService');
const { isAuthenticated } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(isAuthenticated);

// GET /api/messages/:groupId - Get message history
router.get('/:groupId', async (req, res) => {
  try {
    const userId = req.session.userId;
    const groupId = parseInt(req.params.groupId);
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const result = await MessagingService.getMessageHistory(groupId, userId, limit, offset);

    if (!result.success) {
      return res.status(403).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Get messages error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve messages'
    });
  }
});

// GET /api/messages/:groupId/recent - Get recent messages
router.get('/:groupId/recent', async (req, res) => {
  try {
    const userId = req.session.userId;
    const groupId = parseInt(req.params.groupId);
    const limit = parseInt(req.query.limit) || 50;

    const result = await MessagingService.getRecentMessages(groupId, userId, limit);

    if (!result.success) {
      return res.status(403).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Get recent messages error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve messages'
    });
  }
});

// GET /api/messages/:groupId/search - Search messages
router.get('/:groupId/search', async (req, res) => {
  try {
    const userId = req.session.userId;
    const groupId = parseInt(req.params.groupId);
    const searchTerm = req.query.q;
    const limit = parseInt(req.query.limit) || 50;

    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        message: 'Search term is required'
      });
    }

    const result = await MessagingService.searchMessages(groupId, userId, searchTerm, limit);

    if (!result.success) {
      return res.status(403).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Search messages error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search messages'
    });
  }
});

// DELETE /api/messages/:messageId - Delete a message
router.delete('/:messageId', async (req, res) => {
  try {
    const userId = req.session.userId;
    const userRole = req.session.userRole;
    const messageId = parseInt(req.params.messageId);

    const result = await MessagingService.deleteMessage(messageId, userId, userRole);

    if (!result.success) {
      return res.status(403).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Delete message error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete message'
    });
  }
});

// GET /api/messages/:groupId/load-more - Load more messages (pagination)
router.get('/:groupId/load-more/:lastMessageId', async (req, res) => {
  try {
    const userId = req.session.userId;
    const groupId = parseInt(req.params.groupId);
    const lastMessageId = parseInt(req.params.lastMessageId);
    const limit = parseInt(req.query.limit) || 50;

    const result = await MessagingService.loadMoreMessages(groupId, userId, lastMessageId, limit);

    if (!result.success) {
      return res.status(403).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Load more messages error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load more messages'
    });
  }
});

module.exports = router;