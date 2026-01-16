const express = require('express');
const router = express.Router();
const GroupService = require('../services/GroupService');
const { isAuthenticated } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(isAuthenticated);

// GET /api/groups - Get all groups for current user in current course
router.get('/', async (req, res) => {
  try {
    const userId = req.session.userId;
    const courseId = req.session.courseId;

    const result = await GroupService.getUserGroups(userId, courseId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Get groups error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve groups'
    });
  }
});

// POST /api/groups - Create new group
router.post('/', async (req, res) => {
  try {
    const userId = req.session.userId;
    const courseId = req.session.courseId;
    const groupData = req.body;

    const result = await GroupService.createGroup(groupData, userId, courseId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(201).json(result);
  } catch (error) {
    console.error('Create group error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create group'
    });
  }
});

// GET /api/groups/:id - Get group details
router.get('/:id', async (req, res) => {
  try {
    const userId = req.session.userId;
    const groupId = parseInt(req.params.id);

    const result = await GroupService.getGroupDetails(groupId, userId);

    if (!result.success) {
      return res.status(404).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Get group details error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve group details'
    });
  }
});

// POST /api/groups/:id/members - Add member to group
router.post('/:id/members', async (req, res) => {
  try {
    const requesterId = req.session.userId;
    const groupId = parseInt(req.params.id);
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const result = await GroupService.addMemberToGroup(groupId, userId, requesterId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Add member error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add member'
    });
  }
});

// DELETE /api/groups/:id/members/:userId - Remove member from group
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const requesterId = req.session.userId;
    const groupId = parseInt(req.params.id);
    const userIdToRemove = parseInt(req.params.userId);

    const result = await GroupService.removeMemberFromGroup(groupId, userIdToRemove, requesterId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Remove member error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove member'
    });
  }
});

// DELETE /api/groups/:id - Delete group
router.delete('/:id', async (req, res) => {
  try {
    const requesterId = req.session.userId;
    const userRole = req.session.userRole;
    const groupId = parseInt(req.params.id);

    const result = await GroupService.deleteGroup(groupId, requesterId, userRole);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Delete group error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete group'
    });
  }
});

// GET /api/groups/course/members - Get all course members (for creating groups)
router.get('/course/members', async (req, res) => {
  try {
    const userId = req.session.userId;
    const courseId = req.session.courseId;

    const result = await GroupService.getCourseMembers(courseId, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Get course members error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve course members'
    });
  }
});

module.exports = router;