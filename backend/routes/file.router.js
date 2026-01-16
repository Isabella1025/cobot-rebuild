const express = require('express');
const router = express.Router();
const FileService = require('../services/FileService');
const { isAuthenticated } = require('../middleware/auth.middleware');
const { uploadSingle, handleUploadError, getFileCategory } = require('../middleware/upload.middleware');
const path = require('path');
const fs = require('fs');

// All routes require authentication
router.use(isAuthenticated);

// POST /api/files/upload - Upload file to course
router.post('/upload', uploadSingle, handleUploadError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided'
      });
    }

    const userId = req.session.userId;
    const courseId = req.session.courseId;
    const groupId = req.body.groupId ? parseInt(req.body.groupId) : null;

    const result = await FileService.uploadFile(req.file, userId, courseId, groupId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(201).json(result);
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload file'
    });
  }
});

// POST /api/files/share - Share file in chat
router.post('/share', uploadSingle, handleUploadError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided'
      });
    }

    const userId = req.session.userId;
    const groupId = parseInt(req.body.groupId);

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Group ID is required'
      });
    }

    const result = await FileService.shareFileInChat(req.file, userId, groupId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Get Socket.IO instance and broadcast to group
    const io = req.app.get('io');
    if (io) {
      io.to(`group:${groupId}`).emit('message:new', {
        ...result.data.message,
        file: result.data.file
      });
    }

    return res.status(201).json(result);
  } catch (error) {
    console.error('Share file error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to share file'
    });
  }
});

// GET /api/files/message/:messageId - Get file for a message
router.get('/message/:messageId', async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId);
    const files = await File.getByMessage(messageId);
    
    if (files && files.length > 0) {
      return res.status(200).json({
        success: true,
        data: files[0]
      });
    } else {
      return res.status(404).json({
        success: false,
        message: 'No file found for this message'
      });
    }
  } catch (error) {
    console.error('Get file by message error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve file'
    });
  }
});

// GET /api/files/:id - Get file details
router.get('/:id', async (req, res) => {
  try {
    const userId = req.session.userId;
    const fileId = parseInt(req.params.id);

    const result = await FileService.getFileDetails(fileId, userId);

    if (!result.success) {
      return res.status(404).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Get file error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve file'
    });
  }
});

// GET /api/files/download/:id - Download file
router.get('/download/:id', async (req, res) => {
  try {
    const userId = req.session.userId;
    const fileId = parseInt(req.params.id);

    const result = await FileService.getFileDetails(fileId, userId);

    if (!result.success) {
      return res.status(404).json(result);
    }

    const file = result.data;
    const filePath = path.resolve(file.file_path);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.original_name)}"`);
    res.setHeader('Content-Type', file.file_type);

    // Stream file to response
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Download error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to download file'
    });
  }
});

// GET /api/files/group/:groupId - Get files for a group
router.get('/group/:groupId', async (req, res) => {
  try {
    const userId = req.session.userId;
    const groupId = parseInt(req.params.groupId);

    const result = await FileService.getGroupFiles(groupId, userId);

    if (!result.success) {
      return res.status(403).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Get group files error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve files'
    });
  }
});

// DELETE /api/files/:id - Delete file
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.session.userId;
    const userRole = req.session.userRole;
    const fileId = parseInt(req.params.id);

    const result = await FileService.deleteFile(fileId, userId, userRole);

    if (!result.success) {
      return res.status(403).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Delete file error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete file'
    });
  }
});

// GET /api/files/stats/me - Get user's file statistics
router.get('/stats/me', async (req, res) => {
  try {
    const userId = req.session.userId;

    const result = await FileService.getUserStats(userId);

    if (!result.success) {
      return res.status(500).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Get stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve statistics'
    });
  }
});

module.exports = router;