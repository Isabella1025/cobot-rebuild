// Chat Interface Logic
let currentGroup = null;
let currentUser = null;
let messages = [];
let typingTimeout = null;
let selectedFile = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Get group ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const groupId = urlParams.get('groupId');

    if (!groupId) {
        alert('No group selected');
        window.location.href = '/group-list.html';
        return;
    }

    // Verify session
    await verifySession();

    // Load user data
    loadUserData();

    // Load group details
    await loadGroupDetails(groupId);

    // Initialize socket
    socketClient.init();
    socketClient.joinGroup(parseInt(groupId), currentUser);

    // Setup socket event handlers
    setupSocketHandlers();

    // Load message history
    await loadMessages(groupId);

    // Setup UI event listeners
    setupEventListeners();

    // Auto-scroll to bottom
    scrollToBottom();
});

async function verifySession() {
    try {
        const response = await fetch('/api/session/verify');
        if (!response.ok) {
            window.location.href = '/';
            return;
        }
    } catch (error) {
        console.error('Session verification error:', error);
        window.location.href = '/';
    }
}

function loadUserData() {
    const userData = sessionStorage.getItem('userData');
    if (userData) {
        const data = JSON.parse(userData);
        currentUser = data.user;
    }
}

async function loadGroupDetails(groupId) {
    try {
        const response = await fetch(`/api/groups/${groupId}`);
        const data = await response.json();

        if (data.success) {
            currentGroup = data.data.group;
            updateGroupHeader(data.data);
        } else {
            alert('Failed to load group details');
            window.location.href = '/group-list.html';
        }
    } catch (error) {
        console.error('Load group error:', error);
        alert('Error loading group');
        window.location.href = '/group-list.html';
    }
}

function updateGroupHeader(groupData) {
    document.getElementById('groupName').textContent = groupData.group.group_name;
    document.getElementById('memberCount').textContent = `${groupData.members.length} members`;
}

async function loadMessages(groupId) {
    const messagesArea = document.getElementById('messagesArea');

    try {
        const response = await fetch(`/api/messages/${groupId}/recent?limit=50`);
        const data = await response.json();

        if (data.success) {
            messages = data.data;
            renderMessages(messages);
        } else {
            messagesArea.innerHTML = '<div class="messages-loading">Failed to load messages</div>';
        }
    } catch (error) {
        console.error('Load messages error:', error);
        messagesArea.innerHTML = '<div class="messages-loading">Error loading messages</div>';
    }
}

function renderMessages(messageList) {
    const messagesArea = document.getElementById('messagesArea');

    if (messageList.length === 0) {
        messagesArea.innerHTML = '<div class="messages-loading">No messages yet. Start the conversation!</div>';
        return;
    }

    messagesArea.innerHTML = messageList.map(message => {
        const isOwnMessage = message.sender_id === currentUser.id;
        const isBot = message.is_bot_message;
        const senderName = message.sender_name || message.bot_name || 'Unknown';
        const initials = getInitials(senderName);
        const isFileMessage = message.message_type === 'file';

        return `
            <div class="message ${isOwnMessage ? 'own-message' : ''} ${isBot ? 'bot-message' : ''}" data-message-id="${message.id}">
                <div class="message-avatar">${initials}</div>
                <div class="message-content">
                    <div class="message-header">
                        <span class="message-sender">${escapeHtml(senderName)}</span>
                        <span class="message-time">${formatTime(message.created_at)}</span>
                    </div>
                    <div class="message-bubble">
                        <div class="message-text">${escapeHtml(message.message_text)}</div>
                        ${isFileMessage ? '<div class="message-file-placeholder">Loading file...</div>' : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Load file data for file messages
    messageList.forEach(async (message) => {
        if (message.message_type === 'file') {
            await loadFileForMessage(message.id);
        }
    });
}

function addMessage(message) {
    console.log('Adding message to UI:', message);
    
    messages.push(message);

    const messagesArea = document.getElementById('messagesArea');
    const isOwnMessage = message.sender_id === currentUser.id;
    const isBot = message.is_bot_message;
    const senderName = message.sender_name || message.bot_name || 'Unknown';
    const initials = getInitials(senderName);
    const isFileMessage = message.message_type === 'file';

    console.log('Message details:', {
        isFileMessage,
        hasFile: !!message.file,
        messageType: message.message_type
    });

    const messageElement = document.createElement('div');
    messageElement.className = `message ${isOwnMessage ? 'own-message' : ''} ${isBot ? 'bot-message' : ''}`;
    messageElement.dataset.messageId = message.id;
    messageElement.innerHTML = `
        <div class="message-avatar">${initials}</div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-sender">${escapeHtml(senderName)}</span>
                <span class="message-time">${formatTime(message.created_at)}</span>
            </div>
            <div class="message-bubble">
                <div class="message-text">${escapeHtml(message.message_text)}</div>
                ${isFileMessage && message.file ? renderFileAttachment(message.file) : ''}
            </div>
        </div>
    `;

    messagesArea.appendChild(messageElement);
    scrollToBottom();
}

function setupSocketHandlers() {
    // Handle incoming messages
    socketClient.onMessage((message) => {
        console.log('Received message via socket:', message);
        addMessage(message);
    });

    // Handle typing indicators
    socketClient.onTyping((data, isTyping) => {
        showTypingIndicator(data.userName, isTyping);
    });

    // Handle online users
    socketClient.onOnlineUsers((users) => {
        document.getElementById('onlineCount').textContent = `${users.length} online`;
    });
}

function setupEventListeners() {
    // Back button
    document.getElementById('backBtn').addEventListener('click', () => {
        socketClient.leaveGroup();
        window.location.href = '/group-list.html';
    });

    // Message form
    document.getElementById('messageForm').addEventListener('submit', handleSendMessage);

    // Message input
    const messageInput = document.getElementById('messageInput');

    messageInput.addEventListener('input', handleInputChange);

    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            document.getElementById('messageForm').dispatchEvent(new Event('submit'));
        }
    });

    // Auto-resize textarea
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    // Attach button - open file picker
    document.getElementById('attachBtn').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });

    // File input change
    document.getElementById('fileInput').addEventListener('change', handleFileSelect);

    // Remove file button
    document.getElementById('removeFileBtn').addEventListener('click', clearFileSelection);
}

// File handling functions - DEFINED BEFORE handleSendMessage
function handleFileSelect(e) {
    console.log('File input changed');
    const file = e.target.files[0];
    
    if (!file) {
        console.log('No file selected');
        return;
    }

    console.log('File selected:', file.name, file.size, file.type);

    // Check file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        alert('File is too large. Maximum size is 10MB.');
        e.target.value = '';
        return;
    }

    // Check file type
    const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp'
    ];

    if (!allowedTypes.includes(file.type)) {
        alert('File type not allowed. Allowed: PDF, DOC, DOCX, PPT, PPTX, TXT, JPG, PNG, GIF, WEBP');
        e.target.value = '';
        return;
    }

    selectedFile = file;
    console.log('selectedFile set to:', selectedFile);
    showFilePreview(file);
}

function showFilePreview(file) {
    console.log('Showing file preview for:', file.name);
    const preview = document.getElementById('filePreview');
    const fileName = document.getElementById('filePreviewName');
    const fileSize = document.getElementById('filePreviewSize');

    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    preview.style.display = 'block';
    
    console.log('File preview displayed');
}

function clearFileSelection() {
    console.log('Clearing file selection');
    selectedFile = null;
    document.getElementById('fileInput').value = '';
    document.getElementById('filePreview').style.display = 'none';
}

async function uploadFile() {
    if (!selectedFile) {
        console.error('uploadFile called but selectedFile is null!');
        return null;
    }

    console.log('Creating FormData for file:', selectedFile.name);
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('groupId', currentGroup.id);

    console.log('Sending POST request to /api/files/share');
    console.log('Group ID:', currentGroup.id);

    try {
        const response = await fetch('/api/files/share', {
            method: 'POST',
            body: formData
        });

        console.log('Response status:', response.status);

        const data = await response.json();
        console.log('Response data:', data);

        if (data.success) {
            console.log('Upload successful!');
            return data.data;
        } else {
            console.error('Upload failed:', data.message);
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('File upload error:', error);
        throw error;
    }
}

async function handleFileUpload() {
    console.log('handleFileUpload called');
    
    if (!selectedFile) {
        console.error('handleFileUpload called but selectedFile is null!');
        return;
    }

    console.log('Uploading file:', selectedFile.name);

    // Show uploading state
    const sendBtn = document.getElementById('sendBtn');
    const originalText = sendBtn.innerHTML;
    sendBtn.innerHTML = '⏳';
    sendBtn.disabled = true;

    try {
        console.log('Calling uploadFile()...');
        const result = await uploadFile();
        
        console.log('File upload result:', result);
        
        if (result && result.message) {
            console.log('File uploaded successfully, server will broadcast');
        }

        // Clear file selection
        clearFileSelection();
    } catch (error) {
        console.error('File upload failed:', error);
        alert('Failed to upload file: ' + error.message);
    } finally {
        console.log('Restoring send button');
        sendBtn.innerHTML = originalText;
        sendBtn.disabled = false;
    }
}

// Now handleSendMessage can safely call handleFileUpload
function handleSendMessage(e) {
    e.preventDefault();

    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();

    console.log('Attempting to send message:', message);
    console.log('Selected file:', selectedFile);

    // Check if there's a file to upload
    if (selectedFile) {
        console.log('File selected, calling handleFileUpload');
        handleFileUpload();
        return;
    }

    // Regular text message
    if (!message) {
        console.log('Message is empty and no file selected, not sending');
        return;
    }

    // Check if socket is connected
    if (!socketClient.socket || !socketClient.connected) {
        console.error('Socket not connected!');
        alert('Connection lost. Please refresh the page.');
        return;
    }

    // Send via socket
    console.log('Sending message via socket...');
    const sent = socketClient.sendMessage(message);

    if (sent) {
        console.log('Message sent successfully');
        // Clear input
        messageInput.value = '';
        messageInput.style.height = 'auto';

        // Stop typing indicator
        socketClient.sendTypingStop();
    } else {
        console.error('Failed to send message');
        alert('Failed to send message. Please try again.');
    }
}

let typingTimer = null;
function handleInputChange(e) {
    const value = e.target.value;

    // Send typing indicator
    if (value.trim()) {
        socketClient.sendTypingStart();

        // Clear existing timer
        if (typingTimer) {
            clearTimeout(typingTimer);
        }

        // Stop typing after 3 seconds of no input
        typingTimer = setTimeout(() => {
            socketClient.sendTypingStop();
        }, 3000);
    } else {
        socketClient.sendTypingStop();
    }
}

function showTypingIndicator(userName, isTyping) {
    const indicator = document.getElementById('typingIndicator');
    const userSpan = indicator.querySelector('.typing-user');

    if (isTyping) {
        userSpan.textContent = userName;
        indicator.style.display = 'block';
    } else {
        indicator.style.display = 'none';
    }
}

function scrollToBottom() {
    const messagesArea = document.getElementById('messagesArea');
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function renderFileAttachment(file) {
    if (!file) {
        console.log('No file data to render');
        return '';
    }
    
    console.log('Rendering file attachment:', file);
    
    const icon = getFileIcon(file.file_type);
    const size = formatFileSize(file.file_size);
    
    return `
        <div class="message-file" onclick="window.downloadFile(${file.id})">
            <span class="file-icon">${icon}</span>
            <div class="file-info">
                <span class="file-name">${escapeHtml(file.original_name)}</span>
                <span class="file-size">${size}</span>
            </div>
            <button class="file-download-btn" onclick="event.stopPropagation(); window.downloadFile(${file.id})">
                Download
            </button>
        </div>
    `;
}

async function loadFileForMessage(messageId) {
    try {
        const response = await fetch(`/api/files/message/${messageId}`);
        const data = await response.json();
        
        if (data.success && data.data) {
            const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
            if (messageEl) {
                const placeholder = messageEl.querySelector('.message-file-placeholder');
                if (placeholder) {
                    placeholder.outerHTML = renderFileAttachment(data.data);
                }
            }
        }
    } catch (error) {
        console.error('Failed to load file for message:', error);
    }
}

// When chat loads, initialize enhanced bot
EnhancedBotUI.init(currentServiceId, currentChannelId);

// When sending message to bot, use enhanced response
async function sendBotMessage(message) {
    const response = await fetch('window.location.origin/api/bot/enhanced-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
            message: message,
            service_id: currentServiceId,
            channel_id: currentChannelId,
            bot_id: currentBotId
        })
    });
    
    const data = await response.json();
    
    if (data.success) {
        // Render enhanced bot message
        const messageElement = EnhancedBotUI.renderBotMessage(data.data, Date.now());
        document.getElementById('messagesContainer').appendChild(messageElement);
    }
}

// Make downloadFile globally accessible
window.downloadFile = function(fileId) {
    console.log('Downloading file:', fileId);
    window.open(`/api/files/download/${fileId}`, '_blank');
};

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getInitials(name) {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

function formatTime(dateString) {
    if (!dateString) return '';

    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes}m ago`;
    }
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours}h ago`;
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function getFileIcon(mimetype) {
    if (mimetype.startsWith('image/')) return '🖼️';
    if (mimetype.includes('pdf')) return '📄';
    if (mimetype.includes('word') || mimetype.includes('document')) return '📝';
    if (mimetype.includes('powerpoint') || mimetype.includes('presentation')) return '📊';
    if (mimetype.includes('text')) return '📃';
    return '📎';
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    socketClient.disconnect();
});