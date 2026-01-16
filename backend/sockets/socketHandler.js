const MessagingService = require('../services/MessagingService');
const Group = require('../models/Group');

// Store active users and their socket connections
const activeUsers = new Map(); // userId -> { socketId, groupId, userName }

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Handle user join
    socket.on('user:join', async (data) => {
      const { userId, userName, groupId } = data;

      // Store user info
      activeUsers.set(userId, {
        socketId: socket.id,
        groupId: groupId,
        userName: userName
      });

      // Join the group room
      socket.join(`group:${groupId}`);

      console.log(`User ${userName} (${userId}) joined group ${groupId}`);

      // Notify other users in the group
      socket.to(`group:${groupId}`).emit('user:joined', {
        userId: userId,
        userName: userName,
        timestamp: new Date().toISOString()
      });

      // Send list of online users in this group
      const onlineUsers = getOnlineUsersInGroup(groupId);
      io.to(`group:${groupId}`).emit('users:online', onlineUsers);
    });

    // Handle sending message
    socket.on('message:send', async (data) => {
      try {
        const { userId, groupId, message, userName } = data;

        // Save message to database
        const result = await MessagingService.sendMessage({
          group_id: groupId,
          message_text: message,
          message_type: 'text'
        }, userId);

        if (result.success) {
          // Broadcast message to all users in the group
          io.to(`group:${groupId}`).emit('message:new', {
            ...result.data,
            sender_name: userName
          });
        } else {
          // Send error back to sender
          socket.emit('message:error', {
            message: result.message
          });
        }
      } catch (error) {
        console.error('Socket message send error:', error);
        socket.emit('message:error', {
          message: 'Failed to send message'
        });
      }
    });

    // Handle typing indicator
    socket.on('typing:start', (data) => {
      const { userId, userName, groupId } = data;
      socket.to(`group:${groupId}`).emit('user:typing', {
        userId: userId,
        userName: userName
      });
    });

    socket.on('typing:stop', (data) => {
      const { userId, groupId } = data;
      socket.to(`group:${groupId}`).emit('user:stopped-typing', {
        userId: userId
      });
    });

    // Handle user leaving group
    socket.on('user:leave', (data) => {
      const { userId, groupId, userName } = data;
      
      socket.leave(`group:${groupId}`);
      
      // Notify others
      socket.to(`group:${groupId}`).emit('user:left', {
        userId: userId,
        userName: userName,
        timestamp: new Date().toISOString()
      });

      // Update online users
      const onlineUsers = getOnlineUsersInGroup(groupId);
      io.to(`group:${groupId}`).emit('users:online', onlineUsers);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);

      // Find and remove user from active users
      for (const [userId, userData] of activeUsers.entries()) {
        if (userData.socketId === socket.id) {
          const groupId = userData.groupId;
          const userName = userData.userName;

          activeUsers.delete(userId);

          // Notify group members
          socket.to(`group:${groupId}`).emit('user:left', {
            userId: userId,
            userName: userName,
            timestamp: new Date().toISOString()
          });

          // Update online users
          const onlineUsers = getOnlineUsersInGroup(groupId);
          io.to(`group:${groupId}`).emit('users:online', onlineUsers);

          break;
        }
      }
    });
  });
}

// Helper function to get online users in a group
function getOnlineUsersInGroup(groupId) {
  const users = [];
  for (const [userId, userData] of activeUsers.entries()) {
    if (userData.groupId === groupId) {
      users.push({
        userId: userId,
        userName: userData.userName
      });
    }
  }
  return users;
}

module.exports = { setupSocketHandlers };