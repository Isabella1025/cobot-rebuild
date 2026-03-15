const express = require('express');
const router = express.Router();
const EnhancedBotService = require('../services/EnhancedBotService');
const { query, queryOne } = require('../config/database');

/**
 * @route   POST /api/bot/enhanced-chat
 * @desc    Send message to enhanced bot with quick actions and memory
 * @access  Private
 */
router.post('/enhanced-chat', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const { message, service_id, channel_id, bot_id } = req.body;

    if (!message || !service_id || !channel_id) {
      return res.status(400).json({
        success: false,
        error: 'Message, service_id, and channel_id are required'
      });
    }

    // Get bot configuration
    const botConfig = bot_id ? await queryOne(`
      SELECT instructions, personality, model
      FROM service_bots
      WHERE id = ?
    `, [bot_id]) : null;

    // Generate enhanced response
    const enhancedResponse = await EnhancedBotService.generateEnhancedResponse(
      message,
      service_id,
      channel_id,
      botConfig,
      req.session.user.id
    );

    res.json({
      success: true,
      data: enhancedResponse
    });

  } catch (error) {
    console.error('Enhanced bot chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate bot response'
    });
  }
});

/**
 * @route   POST /api/bot/quick-action
 * @desc    Process quick action button click
 * @access  Private
 */
router.post('/quick-action', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const { action, data } = req.body;

    if (!action) {
      return res.status(400).json({
        success: false,
        error: 'Action is required'
      });
    }

    const result = await EnhancedBotService.processQuickAction(
      action,
      data || {},
      req.session.user.id
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Quick action error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process action'
    });
  }
});

/**
 * @route   GET /api/bot/conversation-memory/:channelId
 * @desc    Get conversation history for a channel
 * @access  Private
 */
router.get('/conversation-memory/:channelId', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const { channelId } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    const memory = await EnhancedBotService.getConversationMemory(channelId, limit);

    res.json({
      success: true,
      data: memory
    });

  } catch (error) {
    console.error('Get conversation memory error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversation memory'
    });
  }
});

module.exports = router;
