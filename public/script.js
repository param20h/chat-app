const socket = io();
let username = '';
let currentRoom = 'general';
let typingTimer;
let pendingRoomJoin = null;

// DOM Elements
const loginModal = document.getElementById('loginModal');
const usernameInput = document.getElementById('usernameInput');
const joinBtn = document.getElementById('joinBtn');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const messages = document.getElementById('messages');
const userList = document.getElementById('userList');
const userCount = document.getElementById('userCount');
const usernameDisplay = document.getElementById('username-display');
const typing = document.getElementById('typing');
const roomList = document.getElementById('roomList');
const newRoomInput = document.getElementById('newRoomInput');
const roomPasswordInput = document.getElementById('roomPasswordInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const roomPasswordModal = document.getElementById('roomPasswordModal');
const roomPasswordPrompt = document.getElementById('roomPasswordPrompt');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const cancelJoinBtn = document.getElementById('cancelJoinBtn');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebar = document.getElementById('sidebar');
const replyPreview = document.getElementById('replyPreview');
const cancelReply = document.getElementById('cancelReply');
const replyUsername = document.getElementById('replyUsername');
const replyMessage = document.getElementById('replyMessage');
const reactionPicker = document.getElementById('reactionPicker');
const themeToggle = document.getElementById('themeToggle');
const soundToggle = document.getElementById('soundToggle');
const fileInput = document.getElementById('fileInput');
const fileBtn = document.getElementById('fileBtn');
const profileBtn = document.getElementById('profileBtn');
const profileModal = document.getElementById('profileModal');
const profileUsername = document.getElementById('profileUsername');
const profileStatus = document.getElementById('profileStatus');
const profileBio = document.getElementById('profileBio');
const profileAvatar = document.getElementById('profileAvatar');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const closeProfileBtn = document.getElementById('closeProfileBtn');

let replyingTo = null;
let currentReactionMessage = null;
let currentTheme = localStorage.getItem('chatTheme') || 'light';
let soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
let currentUserProfile = null;

// Initialize theme
document.documentElement.setAttribute('data-theme', currentTheme);
updateThemeButton();

// Create audio context for notifications
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playNotificationSound() {
    if (!soundEnabled) return;
    
    try {
        // Create a simple beep sound
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
        console.log('Audio notification failed:', error);
    }
}

// Event Listeners
joinBtn.addEventListener('click', joinChat);
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinChat();
});

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    } else {
        handleTyping();
    }
});

createRoomBtn.addEventListener('click', createRoom);
joinRoomBtn.addEventListener('click', joinProtectedRoom);
cancelJoinBtn.addEventListener('click', cancelRoomJoin);
mobileMenuBtn.addEventListener('click', toggleSidebar);
cancelReply.addEventListener('click', cancelReplyMode);
themeToggle.addEventListener('click', toggleTheme);
soundToggle.addEventListener('click', toggleSound);
fileBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileUpload);
profileBtn.addEventListener('click', openProfileModal);
saveProfileBtn.addEventListener('click', saveProfile);
closeProfileBtn.addEventListener('click', closeProfileModal);

// Initialize sound button
updateSoundButton();

// Reaction picker events
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('reaction-emoji')) {
        const emoji = e.target.dataset.emoji;
        if (currentReactionMessage) {
            socket.emit('reaction', { messageId: currentReactionMessage, emoji });
            hideReactionPicker();
        }
    } else if (!reactionPicker.contains(e.target) && !e.target.classList.contains('react-btn')) {
        hideReactionPicker();
    }
});

// Room list click handler
roomList.addEventListener('click', (e) => {
    const roomItem = e.target.closest('.room-item');
    if (roomItem) {
        const roomName = roomItem.dataset.room;
        const isProtected = roomItem.classList.contains('protected');
        
        if (isProtected && roomName !== 'general') {
            showPasswordPrompt(roomName);
        } else {
            switchRoom(roomName);
        }
    }
});

// Functions
function joinChat() {
    const name = usernameInput.value.trim();
    if (name && name.length <= 20 && /^[a-zA-Z0-9_-]+$/.test(name)) {
        socket.emit('checkUsername', { username: name });
    } else {
        alert('Username must be 1-20 characters and contain only letters, numbers, underscore, or dash.');
    }
}

function completeLogin(name) {
    username = name;
    socket.emit('join', { username, room: currentRoom });
    loginModal.style.display = 'none';
    messageInput.disabled = false;
    sendBtn.disabled = false;
    updateUsernameDisplay();
    messageInput.focus();
}

function updateUsernameDisplay() {
    usernameDisplay.textContent = `@${username} in #${currentRoom}`;
}

function sendMessage() {
    const message = messageInput.value.trim();
    if (message && message.length <= 500) {
        let messageData = { message };
        
        // Add reply data if replying
        if (replyingTo) {
            messageData.replyTo = {
                username: replyingTo.username,
                message: replyingTo.message,
                id: replyingTo.id
            };
            cancelReplyMode();
        }
        
        if (message.startsWith('/pm ')) {
            const parts = message.split(' ');
            const to = parts[1];
            const privateMessage = parts.slice(2).join(' ');
            if (to && privateMessage) {
                socket.emit('privateMessage', { to, message: privateMessage, ...messageData });
            }
        } else {
            socket.emit('message', messageData);
        }
        messageInput.value = '';
        socket.emit('typing', { isTyping: false });
    }
}

function handleTyping() {
    socket.emit('typing', { isTyping: true });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        socket.emit('typing', { isTyping: false });
    }, 1000);
}

function switchRoom(newRoom) {
    if (newRoom && newRoom !== currentRoom) {
        socket.emit('switchRoom', { room: newRoom, password: null });
    }
}

function showPasswordPrompt(roomName) {
    pendingRoomJoin = roomName;
    document.getElementById('roomNameDisplay').textContent = roomName;
    roomPasswordModal.style.display = 'flex';
    roomPasswordPrompt.focus();
}

function joinProtectedRoom() {
    const password = roomPasswordPrompt.value.trim();
    if (pendingRoomJoin && password) {
        socket.emit('switchRoom', { room: pendingRoomJoin, password });
        cancelRoomJoin();
    }
}

function cancelRoomJoin() {
    roomPasswordModal.style.display = 'none';
    roomPasswordPrompt.value = '';
    pendingRoomJoin = null;
}

function createRoom() {
    const roomName = newRoomInput.value.trim();
    const password = roomPasswordInput.value.trim();
    
    if (roomName && roomName.length <= 20 && /^[a-zA-Z0-9_-]+$/.test(roomName)) {
        if (roomName.toLowerCase() === 'general') {
            alert('Cannot create room with reserved name "general"');
            return;
        }
        
        socket.emit('createRoom', { 
            room: roomName, 
            password: password || null,
            owner: username 
        });
        
        newRoomInput.value = '';
        roomPasswordInput.value = '';
    } else {
        alert('Room name must be 1-20 characters and contain only letters, numbers, underscore, or dash.');
    }
}

function addMessage(data, isSystem = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = isSystem ? 'message system-message' : 'message';
    
    if (data && data.private) {
        messageDiv.className += ' private-message';
    }
    
    // Add own/other class for styling
    if (data && data.username === username) {
        messageDiv.className += ' own';
    } else if (data && data.username && !isSystem) {
        messageDiv.className += ' other';
    }
    
    // Check if this message should be grouped with the previous one
    const lastMessage = messages.lastElementChild;
    let isGrouped = false;
    
    if (lastMessage && !isSystem && data && data.username) {
        const lastUsername = lastMessage.dataset.username;
        const lastTimestamp = lastMessage.dataset.timestamp;
        const currentTimestamp = Date.now();
        const timeDiff = currentTimestamp - (parseInt(lastTimestamp) || 0);
        
        // Group if same user and within 2 minutes
        if (lastUsername === data.username && timeDiff < 120000 && !lastMessage.classList.contains('system-message')) {
            isGrouped = true;
            messageDiv.className += ' grouped';
        }
    }
    
    if (isSystem) {
        messageDiv.textContent = typeof data === 'string' ? data : 'System message';
    } else if (data && data.username && data.message) {
        const messageId = data.id || Date.now() + Math.random();
        const privateLabel = data.private ? `[Private ${data.to ? 'to ' + data.to : 'from ' + data.username}] ` : '';
        
        // Create avatar (only if not grouped)
        const avatar = !isGrouped ? createAvatar(data.username) : '';
        
        // Create reply section if this is a reply
        let replyHtml = '';
        if (data.replyTo) {
            replyHtml = `
                <div class="replied-message">
                    <div class="replied-user">@${escapeHtml(data.replyTo.username)}</div>
                    <div class="replied-text">${escapeHtml(data.replyTo.message.substring(0, 100))}${data.replyTo.message.length > 100 ? '...' : ''}</div>
                </div>
            `;
        }
        
        let contentHtml = '';
        if (data.file) {
            const fileIcon = getFileIcon(data.file.type);
            const fileSize = formatFileSize(data.file.size);
            console.log('Rendering file:', data.file);
            
            if (data.file.type.startsWith('image/')) {
                contentHtml = `
                    <div class="file-message">
                        <img src="${data.file.url}" alt="${data.file.name}" class="image-preview" onclick="openImageModal('${data.file.url}')" loading="lazy">
                        <div class="file-info">
                            <span class="file-name">${escapeHtml(data.file.name)}</span>
                            <span class="file-size">${fileSize}</span>
                        </div>
                    </div>
                `;
            } else {
                contentHtml = `
                    <div class="file-message">
                        <div class="file-content" onclick="downloadFile('${data.file.url}', '${escapeHtml(data.file.name)}')">
                            <span class="file-icon">${fileIcon}</span>
                            <div class="file-details">
                                <span class="file-name">${escapeHtml(data.file.name)}</span>
                                <span class="file-size">${fileSize}</span>
                            </div>
                            <span class="download-icon">⬇️</span>
                        </div>
                    </div>
                `;
            }
        } else {
            contentHtml = escapeHtml(data.message);
        }
        
        const isOwnMessage = data.username === username;
        
        if (isGrouped) {
            // Simplified grouped message layout
            messageDiv.innerHTML = `
                ${replyHtml}
                <div class="message-content grouped-content">${privateLabel}${contentHtml}</div>
                <div class="message-actions">
                    <button class="reply-btn" onclick="startReply('${escapeHtml(data.username)}', '${escapeHtml(data.message)}', '${messageId}')">↩️</button>
                    <button class="react-btn" onclick="showReactionPicker(event, '${messageId}')">😀</button>
                    ${data.username === username ? `<button class="edit-btn" onclick="editMessage('${messageId}', '${escapeHtml(data.message)}')">✏️</button>` : ''}
                </div>
            `;
        } else {
            // Full message layout with header
            messageDiv.innerHTML = `
                <div class="message-header">
                    ${!isOwnMessage ? avatar : ''}
                    <div class="message-info">
                        <span class="username">${escapeHtml(data.username)}</span>
                        <span class="timestamp">${data.timestamp || ''}</span>
                    </div>
                    ${isOwnMessage ? avatar : ''}
                </div>
                ${replyHtml}
                <div class="message-content">${privateLabel}${contentHtml}</div>
                <div class="message-actions">
                    <button class="reply-btn" onclick="startReply('${escapeHtml(data.username)}', '${escapeHtml(data.message)}', '${messageId}')">↩️ Reply</button>
                    <button class="react-btn" onclick="showReactionPicker(event, '${messageId}')">😀 React</button>
                    ${data.username === username ? `<button class="edit-btn" onclick="editMessage('${messageId}', '${escapeHtml(data.message)}')">✏️ Edit</button>` : ''}
                </div>
            `;
        }
        
        messageDiv.dataset.messageId = messageId;
        messageDiv.dataset.username = data.username;
        messageDiv.dataset.timestamp = Date.now();
        
        // Add reactions if they exist
        if (data.reactions && Object.keys(data.reactions).length > 0) {
            const reactionsHtml = createReactionsHtml(data.reactions, messageId);
            messageDiv.innerHTML += reactionsHtml;
        }
    } else {
        return;
    }
    
    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
}

function createAvatar(username) {
    const initials = username.substring(0, 2).toUpperCase();
    const colors = [
        '#e74c3c', '#3498db', '#9b59b6', '#f39c12', 
        '#2ecc71', '#e67e22', '#1abc9c', '#34495e'
    ];
    const colorIndex = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    const backgroundColor = colors[colorIndex];
    
    return `<div class="avatar" style="background-color: ${backgroundColor}">${initials}</div>`;
}

function getFileIcon(mimeType) {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return '📦';
    return '📎';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function downloadFile(url, filename) {
    console.log('Downloading file:', url, filename);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function updateUserList(users) {
    userList.innerHTML = '';
    const userArray = Array.isArray(users) ? users : [];
    userCount.textContent = userArray.length;
    
    userArray.forEach(user => {
        const li = document.createElement('li');
        const userData = typeof user === 'object' ? user : { username: user };
        const username = userData.username || 'Unknown';
        const status = userData.status || 'online';
        const bio = userData.bio || '';
        
        const avatar = createAvatar(username);
        const statusIcon = getStatusIcon(status);
        
        li.innerHTML = `
            ${avatar}
            <div class="user-details">
                <span class="user-name">${username}</span>
                ${bio ? `<span class="user-bio">${bio}</span>` : ''}
            </div>
            <span class="user-status ${status}">${statusIcon}</span>
        `;
        
        li.onclick = () => {
            messageInput.value = `/pm ${username} `;
            messageInput.focus();
        };
        userList.appendChild(li);
    });
}

function getStatusIcon(status) {
    switch (status) {
        case 'online': return '🟢';
        case 'away': return '🟡';
        case 'busy': return '🔴';
        case 'offline': return '⚫';
        default: return '🟢';
    }
}

function updateActiveRoom(roomName) {
    document.querySelectorAll('.room-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.room === roomName) {
            item.classList.add('active');
        }
    });
}

function addRoomToList(roomName, hasPassword, owner) {
    if (!roomList || !roomName) return;
    
    if (roomList.querySelector(`[data-room="${roomName}"]`)) return;
    
    const roomItem = document.createElement('div');
    roomItem.className = `room-item ${hasPassword ? 'protected' : ''}`;
    roomItem.dataset.room = roomName;
    
    roomItem.innerHTML = `
        <div>
            <div>${hasPassword ? '🔒' : '🌍'} ${roomName}</div>
            <div class="room-owner">by ${owner || 'Unknown'}</div>
        </div>
    `;
    
    roomList.appendChild(roomItem);
}

function openImageModal(src) {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
        <img src="${src}" onclick="closeImageModal()">
        <button class="close-btn" onclick="closeImageModal()">✕</button>
    `;
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeImageModal();
    });
    
    document.body.appendChild(modal);
}

function closeImageModal() {
    const modal = document.querySelector('.image-modal');
    if (modal) modal.remove();
}

function toggleSidebar() {
    sidebar.classList.toggle('open');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

const typingUsers = new Set();

function updateTyping() {
    if (typingUsers.size > 0) {
        const users = Array.from(typingUsers);
        typing.textContent = `${users.join(', ')} ${users.length === 1 ? 'is' : 'are'} typing...`;
    } else {
        typing.textContent = '';
    }
}

// Socket Events
socket.on('usernameCheck', (data) => {
    if (data && data.available) {
        completeLogin(data.username);
    } else {
        alert('Username already taken. Please choose another.');
        usernameInput.focus();
        usernameInput.select();
    }
});

socket.on('message', (data) => {
    addMessage(data);
    // Play sound for messages from other users
    if (data.username !== username) {
        playNotificationSound();
    }
});

socket.on('privateMessage', (data) => {
    addMessage(data);
    // Always play sound for private messages
    playNotificationSound();
});

socket.on('userJoined', (user) => {
    addMessage(`${user} joined the chat`, true);
    playNotificationSound();
});

socket.on('userLeft', (user) => {
    addMessage(`${user} left the chat`, true);
});

socket.on('userList', (users) => {
    updateUserList(users);
});

socket.on('typing', (data) => {
    if (data.isTyping) {
        typingUsers.add(data.username);
    } else {
        typingUsers.delete(data.username);
    }
    updateTyping();
});

// No message history - new users start with clean chat

socket.on('roomSwitched', (data) => {
    if (data && data.success) {
        currentRoom = data.room;
        updateActiveRoom(data.room);
        updateUsernameDisplay();
        // Don't clear messages here - let messageHistory handle it
    } else {
        addMessage(`Failed to join room: ${data?.error || 'Unknown error'}`, true);
    }
});

socket.on('roomCreated', (data) => {
    if (data && data.room) {
        addMessage(`Room '${data.room}' was created by ${data.owner}`, true);
        addRoomToList(data.room, data.hasPassword, data.owner);
    }
});

socket.on('roomList', (rooms) => {
    if (Array.isArray(rooms) && roomList) {
        const generalRoom = roomList.querySelector('[data-room="general"]');
        roomList.innerHTML = '';
        if (generalRoom) roomList.appendChild(generalRoom);
        
        rooms.forEach(room => {
            if (room && room.name && room.name !== 'general') {
                addRoomToList(room.name, room.hasPassword, room.owner);
            }
        });
    }
});

socket.on('roomError', (data) => {
    addMessage(`Room error: ${data.message}`, true);
    if (data.type === 'wrong_password') {
        showPasswordPrompt(data.room);
    }
});

socket.on('reaction', (data) => {
    const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (messageElement) {
        // Remove existing reactions
        const existingReactions = messageElement.querySelector('.message-reactions');
        if (existingReactions) {
            existingReactions.remove();
        }
        
        // Add updated reactions
        if (data.reactions && Object.keys(data.reactions).length > 0) {
            const reactionsHtml = createReactionsHtml(data.reactions, data.messageId);
            messageElement.innerHTML += reactionsHtml;
        }
    }
});

socket.on('messageEdited', (data) => {
    const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (messageElement) {
        const messageContent = messageElement.querySelector('div:not(.message-actions):not(.message-reactions):not(.replied-message)');
        if (messageContent) {
            messageContent.innerHTML = escapeHtml(data.newMessage) + ' <small style="color: #7f8c8d; font-style: italic;">(edited)</small>';
        }
    }
});

socket.on('profileData', (profile) => {
    currentUserProfile = profile;
    console.log('Received profile data:', profile);
});

socket.on('profileUpdated', (data) => {
    if (data.username === username) {
        currentUserProfile = data.profile;
        addMessage('Your profile was updated successfully!', true);
    } else {
        addMessage(`${data.username} updated their profile`, true);
    }
    console.log('Profile updated:', data);
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeImageModal();
        if (roomPasswordModal.style.display === 'flex') {
            cancelRoomJoin();
        }
        if (replyPreview.style.display === 'flex') {
            cancelReplyMode();
        }
        if (profileModal.style.display === 'flex') {
            closeProfileModal();
        }
        hideReactionPicker();
    }
});

// Mobile responsive
window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        sidebar.classList.remove('open');
    }
});

function startReply(username, message, messageId) {
    replyingTo = {
        username: username,
        message: message,
        id: messageId
    };
    
    replyUsername.textContent = username;
    replyMessage.textContent = message.length > 50 ? message.substring(0, 50) + '...' : message;
    replyPreview.style.display = 'flex';
    messageInput.focus();
}

function cancelReplyMode() {
    replyingTo = null;
    replyPreview.style.display = 'none';
}

function showReactionPicker(event, messageId) {
    currentReactionMessage = messageId;
    reactionPicker.style.display = 'block';
    
    // Position the picker
    if (window.innerWidth <= 768) {
        // Mobile: center at bottom
        reactionPicker.style.position = 'fixed';
        reactionPicker.style.bottom = '100px';
        reactionPicker.style.left = '50%';
        reactionPicker.style.transform = 'translateX(-50%)';
    } else {
        // Desktop: near click position
        reactionPicker.style.position = 'absolute';
        reactionPicker.style.left = event.pageX - 100 + 'px';
        reactionPicker.style.top = event.pageY - 50 + 'px';
        reactionPicker.style.transform = 'none';
    }
}

function hideReactionPicker() {
    reactionPicker.style.display = 'none';
    currentReactionMessage = null;
}

function createReactionsHtml(reactions, messageId) {
    if (!reactions || Object.keys(reactions).length === 0) return '';
    
    let html = '<div class="message-reactions">';
    for (const [emoji, users] of Object.entries(reactions)) {
        const isActive = users.includes(username) ? 'active' : '';
        const count = users.length;
        html += `
            <div class="reaction-count ${isActive}" onclick="toggleReaction('${messageId}', '${emoji}')">
                <span>${emoji}</span>
                <span class="count">${count}</span>
            </div>
        `;
    }
    html += '</div>';
    return html;
}

function toggleReaction(messageId, emoji) {
    socket.emit('reaction', { messageId, emoji });
}

function editMessage(messageId, currentMessage) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement) return;
    
    const messageContent = messageElement.querySelector('div:not(.message-actions):not(.message-reactions):not(.replied-message)');
    if (!messageContent) return;
    
    // Store original content
    const originalContent = messageContent.innerHTML;
    
    // Replace with edit input
    messageContent.innerHTML = `
        <input type="text" class="edit-input" value="${currentMessage}" id="edit-${messageId}">
        <div class="edit-actions">
            <button class="save-btn" onclick="saveEdit('${messageId}', '${originalContent}')">Save</button>
            <button class="cancel-btn" onclick="cancelEdit('${messageId}', '${originalContent}')">Cancel</button>
        </div>
    `;
    
    // Focus and select text
    const input = document.getElementById(`edit-${messageId}`);
    input.focus();
    input.select();
    
    // Save on Enter
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveEdit(messageId, originalContent);
        } else if (e.key === 'Escape') {
            cancelEdit(messageId, originalContent);
        }
    });
}

function saveEdit(messageId, originalContent) {
    const input = document.getElementById(`edit-${messageId}`);
    const newMessage = input.value.trim();
    
    if (newMessage && newMessage.length <= 500) {
        socket.emit('editMessage', { messageId, newMessage });
    } else {
        cancelEdit(messageId, originalContent);
    }
}

function cancelEdit(messageId, originalContent) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    const messageContent = messageElement.querySelector('div:not(.message-actions):not(.message-reactions):not(.replied-message)');
    messageContent.innerHTML = originalContent;
}

function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('chatTheme', currentTheme);
    updateThemeButton();
}

function updateThemeButton() {
    const themeIcon = themeToggle.querySelector('.theme-icon');
    const themeText = themeToggle.querySelector('.theme-text');
    
    if (currentTheme === 'dark') {
        themeIcon.textContent = '☀️';
        themeText.textContent = 'Light';
    } else {
        themeIcon.textContent = '🌙';
        themeText.textContent = 'Dark';
    }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem('soundEnabled', soundEnabled);
    updateSoundButton();
    
    if (soundEnabled) {
        playNotificationSound(); // Test sound
    }
}

function updateSoundButton() {
    const soundIcon = soundToggle.querySelector('.sound-icon');
    soundIcon.textContent = soundEnabled ? '🔊' : '🔇';
    soundToggle.title = soundEnabled ? 'Disable sounds' : 'Enable sounds';
}

async function handleFileUpload() {
    const file = fileInput.files[0];
    if (!file) return;
    
    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        sendBtn.disabled = true;
        sendBtn.textContent = 'Uploading...';
        
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        console.log('Upload result:', result);
        
        if (result.success) {
            // Send file message with proper file data
            const fileMessage = {
                message: `📎 Shared a file: ${result.file.originalname}`,
                file: {
                    url: result.file.url,
                    name: result.file.originalname,
                    type: result.file.mimetype,
                    size: result.file.size
                }
            };
            
            console.log('Sending file message:', fileMessage);
            socket.emit('message', fileMessage);
            fileInput.value = '';
        } else {
            alert('Upload failed: ' + result.error);
        }
    } catch (error) {
        console.error('Upload error:', error);
        alert('Upload failed: ' + error.message);
    } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send';
    }
}

function openProfileModal() {
    if (currentUserProfile) {
        profileUsername.textContent = currentUserProfile.username;
        profileStatus.value = currentUserProfile.status;
        profileBio.value = currentUserProfile.bio;
        profileAvatar.innerHTML = createAvatar(currentUserProfile.username);
    }
    profileModal.style.display = 'flex';
}

function closeProfileModal() {
    profileModal.style.display = 'none';
}

async function saveProfile() {
    try {
        saveProfileBtn.disabled = true;
        saveProfileBtn.textContent = 'Saving...';
        
        const profileData = {
            status: profileStatus.value,
            bio: profileBio.value.trim()
        };
        
        console.log('Saving profile data:', profileData);
        
        const response = await fetch(`/profile/${username}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(profileData)
        });
        
        const result = await response.json();
        console.log('Profile save result:', result);
        
        if (result.success) {
            closeProfileModal();
        } else {
            alert('Failed to update profile: ' + result.error);
        }
    } catch (error) {
        console.error('Profile save error:', error);
        alert('Failed to update profile: ' + error.message);
    } finally {
        saveProfileBtn.disabled = false;
        saveProfileBtn.textContent = 'Save Changes';
    }
}

window.closeImageModal = closeImageModal;
window.startReply = startReply;
window.showReactionPicker = showReactionPicker;
window.toggleReaction = toggleReaction;
window.editMessage = editMessage;
window.saveEdit = saveEdit;
window.cancelEdit = cancelEdit;
window.downloadFile = downloadFile;