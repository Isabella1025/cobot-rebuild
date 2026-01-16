// Socket.IO Client Manager
class SocketClient {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.currentGroupId = null;
        this.currentUser = null;
        this.messageHandlers = [];
        this.typingHandlers = [];
        this.onlineUsersHandlers = [];
    }

    // Initialize socket connection
    init() {
        // Ensure Socket.IO client is loaded
        if (typeof io === 'undefined') {
            console.error('Socket.IO client not loaded! Check if script is included.');
            return;
        }

        this.socket = io({
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        console.log('Socket.IO client initialized');
        this.setupEventListeners();
    }

    // Setup socket event listeners
    setupEventListeners() {
        // Connection events
        this.socket.on('connect', () => {
            console.log('Socket connected:', this.socket.id);
            this.connected = true;

            // Rejoin group if we were in one or if join was pending
            if (this.currentGroupId && this.currentUser) {
                console.log('Auto-joining group after connection...');
                
                // Actually emit the join event now that we're connected
                this.socket.emit('user:join', {
                    userId: this.currentUser.id,
                    userName: this.currentUser.full_name || this.currentUser.student_id,
                    groupId: this.currentGroupId
                });
                
                console.log('Joined group:', this.currentGroupId);
            }
        });

        this.socket.on('disconnect', () => {
            console.log('Socket disconnected');
            this.connected = false;
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
        });

        // Message events
        this.socket.on('message:new', (message) => {
            this.messageHandlers.forEach(handler => handler(message));
        });

        this.socket.on('message:error', (data) => {
            console.error('Message error:', data.message);
            alert('Failed to send message: ' + data.message);
        });

        // Typing events
        this.socket.on('user:typing', (data) => {
            this.typingHandlers.forEach(handler => handler(data, true));
        });

        this.socket.on('user:stopped-typing', (data) => {
            this.typingHandlers.forEach(handler => handler(data, false));
        });

        // User events
        this.socket.on('user:joined', (data) => {
            console.log('User joined:', data.userName);
        });

        this.socket.on('user:left', (data) => {
            console.log('User left:', data.userName);
        });

        this.socket.on('users:online', (users) => {
            this.onlineUsersHandlers.forEach(handler => handler(users));
        });
    }

    // Join a group
    joinGroup(groupId, user) {
        console.log('joinGroup called with:', { groupId, user });
        
        if (!this.socket) {
            console.error('Socket not initialized');
            return;
        }

        // Store the group and user info
        this.currentGroupId = groupId;
        this.currentUser = user;
        
        // If already connected, join immediately
        if (this.connected) {
            console.log('Emitting user:join event...');
            this.socket.emit('user:join', {
                userId: user.id,
                userName: user.full_name || user.student_id,
                groupId: groupId
            });

            console.log('Joined group:', groupId);
        } else {
            console.log('Socket not connected yet, will join when connected');
            // The connect event handler will join once connected
        }
    }

    // Leave current group
    leaveGroup() {
        if (!this.socket || !this.connected || !this.currentGroupId) {
            return;
        }

        this.socket.emit('user:leave', {
            userId: this.currentUser.id,
            userName: this.currentUser.full_name || this.currentUser.student_id,
            groupId: this.currentGroupId
        });

        this.currentGroupId = null;
    }

    // Send a message
    sendMessage(message) {
        console.log('sendMessage called with:', message);
        
        if (!this.socket) {
            console.error('Socket not initialized');
            return false;
        }
        
        if (!this.connected) {
            console.error('Socket not connected, cannot send message');
            alert('Not connected to chat server. Please wait or refresh the page.');
            return false;
        }

        if (!this.currentGroupId) {
            console.error('Not in a group - currentGroupId is:', this.currentGroupId);
            alert('Not connected to group. Please refresh the page.');
            return false;
        }
        
        if (!this.currentUser) {
            console.error('No user data - currentUser is:', this.currentUser);
            alert('User data not loaded. Please refresh the page.');
            return false;
        }

        console.log('Emitting message:send event...');
        console.log('Data:', {
            userId: this.currentUser.id,
            userName: this.currentUser.full_name || this.currentUser.student_id,
            groupId: this.currentGroupId,
            message: message
        });
        
        this.socket.emit('message:send', {
            userId: this.currentUser.id,
            userName: this.currentUser.full_name || this.currentUser.student_id,
            groupId: this.currentGroupId,
            message: message
        });

        console.log('Message emitted successfully');
        return true;
    }

    // Send typing indicator
    sendTypingStart() {
        if (!this.socket || !this.connected || !this.currentGroupId) {
            return;
        }

        this.socket.emit('typing:start', {
            userId: this.currentUser.id,
            userName: this.currentUser.full_name || this.currentUser.student_id,
            groupId: this.currentGroupId
        });
    }

    // Send stop typing indicator
    sendTypingStop() {
        if (!this.socket || !this.connected || !this.currentGroupId) {
            return;
        }

        this.socket.emit('typing:stop', {
            userId: this.currentUser.id,
            groupId: this.currentGroupId
        });
    }

    // Register message handler
    onMessage(handler) {
        this.messageHandlers.push(handler);
    }

    // Register typing handler
    onTyping(handler) {
        this.typingHandlers.push(handler);
    }

    // Register online users handler
    onOnlineUsers(handler) {
        this.onlineUsersHandlers.push(handler);
    }

    // Disconnect
    disconnect() {
        if (this.socket) {
            this.leaveGroup();
            this.socket.disconnect();
        }
    }
}

// Create global socket client instance
const socketClient = new SocketClient();