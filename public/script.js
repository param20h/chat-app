const socket = io();
let username = '';
let currentRoom = 'general';
let typingTimer;

const loginModal = document.getElementById('loginModal');
const usernameInput = document.getElementById('usernameInput');
const joinBtn = document.getElementById('joinBtn');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');
const messages = document.getElementById('messages');
const userList = document.getElementById('userList');
const userCount = document.getElementById('userCount');
const usernameDisplay = document.getElementById('username-display');
const typing = document.getElementById('typing');
const roomSelect = document.getElementById('roomSelect');
const newRoomInput = document.getElementById('newRoomInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const changeUsernameBtn = document.getElementById('changeUsernameBtn');
const changeNameModal = document.getElementById('changeNameModal');
const newUsernameInput = document.getElementById('newUsernameInput');
const confirmChangeBtn = document.getElementById('confirmChangeBtn');
const cancelChangeBtn = document.getElementById('cancelChangeBtn');
const themeToggle = document.getElementById('themeToggle');
const notificationToggle = document.getElementById('notificationToggle');
const reactionPicker = document.getElementById('reactionPicker');
const searchInput = document.getElementById('searchInput');
const fileInput = document.getElementById('fileInput');
const fileBtn = document.getElementById('fileBtn');
const statusSelect = document.getElementById('statusSelect');
const replyPreview = document.getElementById('replyPreview');
const cancelReply = document.getElementById('cancelReply');
const emojiBtn = document.getElementById('emojiBtn');
const emojiPicker = document.getElementById('emojiPicker');
const voiceBtn = document.getElementById('voiceBtn');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebar = document.getElementById('sidebar');

let notificationsEnabled = false;
let isMobile = window.innerWidth <= 768;
let currentReactionMessage = null;
let replyingTo = null;
let userStatus = 'online';
let isRecording = false;
let mediaRecorder = null;
let unreadMessages = 0;
let lastActivity = Date.now();

joinBtn.addEventListener('click', joinChat);
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinChat();
});

sendBtn.addEventListener('click', sendMessage);
clearBtn.addEventListener('click', () => messages.innerHTML = '');
roomSelect.addEventListener('change', switchRoom);
createRoomBtn.addEventListener('click', createRoom);
changeUsernameBtn.addEventListener('click', showChangeNameModal);
confirmChangeBtn.addEventListener('click', changeUsername);
cancelChangeBtn.addEventListener('click', hideChangeNameModal);
newUsernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') changeUsername();
});
themeToggle.addEventListener('click', toggleTheme);
notificationToggle.addEventListener('click', toggleNotifications);
fileBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileUpload);
searchInput.addEventListener('input', searchMessages);
statusSelect.addEventListener('change', updateStatus);
cancelReply.addEventListener('click', cancelReplyMode);
emojiBtn.addEventListener('click', toggleEmojiPicker);
voiceBtn.addEventListener('click', toggleVoiceRecording);
mobileMenuBtn.addEventListener('click', toggleSidebar);
sidebarToggle.addEventListener('click', toggleSidebar);

// Handle window resize
window.addEventListener('resize', () => {
    const wasMobile = isMobile;
    isMobile = window.innerWidth <= 768;
    
    if (wasMobile !== isMobile) {
        if (!isMobile) {
            sidebar.classList.remove('open');
            removeSidebarOverlay();
        }
    }
});

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
    if (isMobile && sidebar.classList.contains('open')) {
        if (!sidebar.contains(e.target) && e.target !== mobileMenuBtn) {
            toggleSidebar();
        }
    }
});

// Emoji picker events
document.addEventListener('click', (e) => {
    if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
        emojiPicker.style.display = 'none';
    }
    if (e.target.classList.contains('emoji-item')) {
        insertEmoji(e.target.textContent);
    }
});

// Auto-resize message input
messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, isMobile ? 80 : 100) + 'px';
    
    if (messageInput.value.trim()) {
        messageInput.classList.add('typing');
    } else {
        messageInput.classList.remove('typing');
    }
});

// Connection status
let connectionStatus = document.createElement('div');
connectionStatus.className = 'connection-status connected';
connectionStatus.textContent = '🟢 Connected';
document.body.appendChild(connectionStatus);

// Quick actions
let quickActions = document.createElement('div');
quickActions.className = 'quick-actions';
quickActions.innerHTML = `
    <button class="quick-action" onclick="scrollToBottom()" title="Scroll to bottom">⬇️</button>
    <button class="quick-action" onclick="markAllRead()" title="Mark all read">✅</button>
    <button class="quick-action" onclick="exportChat()" title="Export chat">💾</button>
`;
document.body.appendChild(quickActions);

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
}

function handleDrop(e) {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) uploadFile(files[0]);
}

// Reaction picker events
document.addEventListener('click', (e) => {
    if (!reactionPicker.contains(e.target) && !e.target.classList.contains('react-btn')) {
        reactionPicker.style.display = 'none';
    }
});

document.querySelectorAll('.reaction').forEach(reaction => {
    reaction.addEventListener('click', (e) => {
        const emoji = e.target.dataset.emoji;
        if (currentReactionMessage) {
            socket.emit('reaction', { messageId: currentReactionMessage, emoji });
            reactionPicker.style.display = 'none';
        }
    });
});

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    } else {
        handleTyping();
    }
});

function joinChat() {
    const name = usernameInput.value.trim();
    if (name && name.length <= 20 && /^[a-zA-Z0-9_-]+$/.test(name)) {
        username = name;
        socket.emit('join', { username, room: currentRoom });
        loginModal.style.display = 'none';
        messageInput.disabled = false;
        sendBtn.disabled = false;
        updateUsernameDisplay();
        messageInput.focus();
    } else {
        alert('Username must be 1-20 characters and contain only letters, numbers, underscore, or dash.');
    }
}

function updateUsernameDisplay() {
    usernameDisplay.textContent = `@${username} in #${currentRoom}`;
}

function showChangeNameModal() {
    newUsernameInput.value = username;
    changeNameModal.style.display = 'flex';
    newUsernameInput.focus();
    newUsernameInput.select();
}

function hideChangeNameModal() {
    changeNameModal.style.display = 'none';
}

function changeUsername() {
    const newName = newUsernameInput.value.trim();
    if (newName && newName !== username && newName.length <= 20 && /^[a-zA-Z0-9_-]+$/.test(newName)) {
        const oldUsername = username;
        username = newName;
        socket.emit('usernameChange', { oldUsername, newUsername: newName });
        updateUsernameDisplay();
        hideChangeNameModal();
        addMessage(`You changed your name from ${oldUsername} to ${newName}`, true);
    } else {
        alert('Username must be 1-20 characters and contain only letters, numbers, underscore, or dash.');
        hideChangeNameModal();
    }
}

function sendMessage() {
    const message = messageInput.value.trim();
    if (message && message.length <= 500) {
        if (replyingTo) {
            socket.emit('message', { 
                message, 
                replyTo: replyingTo.user,
                replyText: replyingTo.text 
            });
            cancelReplyMode();
        } else if (message.startsWith('/pm ')) {
            const parts = message.split(' ');
            const to = parts[1];
            const privateMessage = parts.slice(2).join(' ');
            if (to && privateMessage && to.length <= 20 && privateMessage.length <= 500) {
                socket.emit('privateMessage', { to, message: privateMessage });
            }
        } else {
            socket.emit('message', { message });
        }
        messageInput.value = '';
        socket.emit('typing', { isTyping: false });
    }
}

function switchRoom() {
    const newRoom = roomSelect.value;
    if (newRoom && newRoom !== currentRoom) {
        socket.emit('switchRoom', newRoom);
    }
}

function createRoom() {
    const roomName = newRoomInput.value.trim().toLowerCase();
    if (roomName && roomName !== currentRoom) {
        socket.emit('createRoom', { room: roomName });
        newRoomInput.value = '';
    }
}

function handleTyping() {
    socket.emit('typing', { isTyping: true });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        socket.emit('typing', { isTyping: false });
    }, 1000);
}

function addMessage(data, isSystem = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = isSystem ? 'message system-message' : 'message';
    
    if (data && data.private) {
        messageDiv.className += ' private-message';
    }
    
    // Mark as unread if not from current user
    if (!isSystem && data.username !== username) {
        messageDiv.classList.add('unread');
        unreadMessages++;
        updateTitle();
    }
    
    if (isSystem) {
        messageDiv.textContent = typeof data === 'string' ? data : 'System message';
    } else if (data && data.username) {
        const messageId = data.id || Date.now();
        const privateLabel = data.private ? `<small>[Private ${data.to ? 'to ' + escapeHtml(data.to) : 'from ' + escapeHtml(data.username)}]</small><br>` : '';
        const replyLabel = data.replyTo ? `<div class="reply-preview"><small>Replying to ${escapeHtml(data.replyTo)}: ${escapeHtml(data.replyText || '')}</small></div>` : '';
        const reactionsHtml = data.reactions ? createReactionsHtml(data.reactions, messageId) : '';
        
        let contentHtml = '';
        if (data.voice) {
            contentHtml = `<div class="voice-message">
                <div class="voice-controls">
                    <button class="play-btn" onclick="playVoice('${data.voice.data}')">▶️</button>
                    <span class="voice-duration">${data.voice.duration}s</span>
                </div>
                <div>Voice message</div>
            </div>`;
        } else if (data.file) {
            if (data.file.type.startsWith('image/')) {
                contentHtml = `<div class="file-message">
                    <img src="${data.file.data}" alt="${escapeHtml(data.file.name)}" class="image-preview" onclick="openImageModal(this.src)">
                    <div>${escapeHtml(data.file.name)} (${formatFileSize(data.file.size)})</div>
                </div>`;
            } else {
                contentHtml = `<div class="file-message">
                    <a href="${data.file.data}" download="${escapeHtml(data.file.name)}" class="file-link">
                        📎 ${escapeHtml(data.file.name)} (${formatFileSize(data.file.size)})
                    </a>
                </div>`;
            }
        } else if (data.message) {
            contentHtml = `<div>${linkify(escapeHtml(data.message))}</div>`;
        }
        
        messageDiv.innerHTML = `
            <div class="message-time">${new Date().toLocaleTimeString()}</div>
            ${privateLabel}
            ${replyLabel}
            <span class="username" onclick="showUserProfile('${escapeHtml(data.username)}')">${escapeHtml(data.username)}</span>
            <span class="timestamp">${escapeHtml(data.timestamp || '')}</span>
            ${contentHtml}
            ${reactionsHtml}
            <div class="message-actions">
                <button class="reply-btn" onclick="replyTo('${escapeHtml(data.username)}', '${escapeHtml((data.message || data.file?.name || '').substring(0, 50))}')">Reply</button>
                <button class="react-btn" onclick="showReactionPicker(event, '${messageId}')">React</button>
                <button class="menu-btn" onclick="showMessageMenu(event, '${messageId}')">⋯</button>
            </div>
        `;
        messageDiv.dataset.messageId = messageId;
    } else {
        return;
    }
    
    messages.appendChild(messageDiv);
    
    // Auto-scroll if user is near bottom (adjusted for mobile)
    const scrollThreshold = isMobile ? 50 : 100;
    if (messages.scrollTop + messages.clientHeight >= messages.scrollHeight - scrollThreshold) {
        messages.scrollTop = messages.scrollHeight;
    }
    
    if (!isSystem && data.username !== username && notificationsEnabled) {
        showNotification(data.username, data.message || 'Sent a file');
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function createReactionsHtml(reactions, messageId) {
    if (!reactions || Object.keys(reactions).length === 0) return '';
    
    let html = '<div class="message-reactions">';
    for (const [emoji, users] of Object.entries(reactions)) {
        const isActive = users.includes(username) ? 'active' : '';
        html += `<span class="reaction-count ${isActive}" onclick="toggleReaction('${messageId}', '${emoji}')">
                    ${emoji} ${users.length}
                 </span>`;
    }
    html += '</div>';
    return html;
}

function showReactionPicker(event, messageId) {
    currentReactionMessage = messageId;
    reactionPicker.style.display = 'flex';
    
    if (isMobile) {
        // Center reaction picker on mobile
        reactionPicker.style.position = 'fixed';
        reactionPicker.style.left = '50%';
        reactionPicker.style.top = '50%';
        reactionPicker.style.transform = 'translate(-50%, -50%)';
    } else {
        reactionPicker.style.position = 'absolute';
        reactionPicker.style.left = event.pageX + 'px';
        reactionPicker.style.top = (event.pageY - 50) + 'px';
        reactionPicker.style.transform = 'none';
    }
}

function toggleReaction(messageId, emoji) {
    socket.emit('reaction', { messageId, emoji });
}

function toggleTheme() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    themeToggle.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('darkTheme', isDark);
}

function toggleNotifications() {
    if (!notificationsEnabled) {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                notificationsEnabled = true;
                notificationToggle.textContent = '🔕';
                showNotification('Notifications', 'Enabled successfully!');
            }
        });
    } else {
        notificationsEnabled = false;
        notificationToggle.textContent = '🔔';
    }
}

function showNotification(title, message) {
    if (notificationsEnabled && Notification.permission === 'granted') {
        new Notification(title, {
            body: message.substring(0, 100),
            icon: '/favicon.ico'
        });
    }
}

// Load theme preference
if (localStorage.getItem('darkTheme') === 'true') {
    document.body.classList.add('dark');
    themeToggle.textContent = '☀️';
}

// Auto-away after 5 minutes of inactivity
let inactivityTimer;
function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    if (userStatus === 'away') {
        userStatus = 'online';
        statusSelect.value = 'online';
        socket.emit('statusChange', { status: 'online' });
    }
    inactivityTimer = setTimeout(() => {
        if (userStatus === 'online') {
            userStatus = 'away';
            statusSelect.value = 'away';
            socket.emit('statusChange', { status: 'away' });
        }
    }, 300000); // 5 minutes
}

document.addEventListener('mousemove', resetInactivityTimer);
document.addEventListener('keypress', resetInactivityTimer);
resetInactivityTimer();

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function replyTo(user, messageText = '') {
    if (messageText) {
        replyingTo = { user, text: messageText };
        replyPreview.style.display = 'flex';
        document.getElementById('replyText').textContent = `Replying to ${user}: ${messageText.substring(0, 50)}...`;
        messageInput.focus();
    } else {
        messageInput.value = `/pm ${user} `;
        messageInput.focus();
    }
}

function cancelReplyMode() {
    replyingTo = null;
    replyPreview.style.display = 'none';
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) uploadFile(file);
}

function uploadFile(file) {
    if (file.size > 10 * 1024 * 1024) {
        alert('File too large. Max 10MB allowed.');
        return;
    }
    
    addMessage(`Uploading ${file.name}...`, true);
    
    const reader = new FileReader();
    reader.onload = (e) => {
        socket.emit('file', {
            name: file.name,
            type: file.type,
            size: file.size,
            data: e.target.result
        });
    };
    reader.readAsDataURL(file);
}

function searchMessages() {
    const query = searchInput.value.toLowerCase();
    const messageElements = document.querySelectorAll('.message:not(.system-message)');
    
    messageElements.forEach(msg => {
        const text = msg.textContent.toLowerCase();
        if (query && text.includes(query)) {
            msg.style.display = 'block';
            highlightText(msg, query);
        } else if (query) {
            msg.style.display = 'none';
        } else {
            msg.style.display = 'block';
            removeHighlight(msg);
        }
    });
}

function highlightText(element, query) {
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );
    
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
        textNodes.push(node);
    }
    
    textNodes.forEach(textNode => {
        const text = textNode.textContent;
        const regex = new RegExp(`(${query})`, 'gi');
        if (regex.test(text)) {
            const highlightedText = text.replace(regex, '<span class="search-highlight">$1</span>');
            const span = document.createElement('span');
            span.innerHTML = highlightedText;
            textNode.parentNode.replaceChild(span, textNode);
        }
    });
}

function removeHighlight(element) {
    const highlights = element.querySelectorAll('.search-highlight');
    highlights.forEach(highlight => {
        highlight.outerHTML = highlight.innerHTML;
    });
}

function updateStatus() {
    userStatus = statusSelect.value;
    socket.emit('statusChange', { status: userStatus });
    addMessage(`You are now ${userStatus}`, true);
}

function showUserProfile(username) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>👤 ${username}</h2>
            <p>Status: Online</p>
            <p>Joined: Today</p>
            <button onclick="this.closest('.modal').remove()">Close</button>
        </div>
    `;
    document.body.appendChild(modal);
}

function updateUserList(users) {
    userList.innerHTML = '';
    const userArray = Array.isArray(users) ? users : [];
    userCount.textContent = userArray.length;
    userArray.forEach(user => {
        const li = document.createElement('li');
        const userData = typeof user === 'object' ? user : { username: user, status: 'online' };
        const username = userData.username || 'Unknown';
        const status = userData.status || 'online';
        const lastSeen = userData.lastSeen || 'Just now';
        
        li.className = `user-${status}`;
        li.innerHTML = `
            <div>
                <div>${username}</div>
                <div class="last-seen">${lastSeen}</div>
            </div>
            <div class="user-actions">
                <button class="user-action-btn" onclick="startPrivateChat('${username}')">💬</button>
                <button class="user-action-btn" onclick="showUserProfile('${username}')">👤</button>
            </div>
        `;
        userList.appendChild(li);
    });
}

function startPrivateChat(username) {
    messageInput.value = `/pm ${username} `;
    messageInput.focus();
}

const typingUsers = new Set();

function updateTyping() {
    if (typingUsers.size > 0) {
        const users = Array.from(typingUsers);
        typing.innerHTML = `
            <span>${users.join(', ')} ${users.length === 1 ? 'is' : 'are'} typing</span>
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
    } else {
        typing.textContent = '';
    }
}

function toggleEmojiPicker() {
    const isVisible = emojiPicker.style.display === 'block';
    emojiPicker.style.display = isVisible ? 'none' : 'block';
    
    if (!isVisible && isMobile) {
        // Position emoji picker better on mobile
        emojiPicker.style.position = 'fixed';
        emojiPicker.style.bottom = '70px';
        emojiPicker.style.left = '10px';
        emojiPicker.style.right = '10px';
        emojiPicker.style.width = 'auto';
    }
}

function toggleSidebar() {
    if (isMobile) {
        const isOpen = sidebar.classList.contains('open');
        
        if (isOpen) {
            sidebar.classList.remove('open');
            removeSidebarOverlay();
        } else {
            sidebar.classList.add('open');
            createSidebarOverlay();
        }
    }
}

function createSidebarOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay show';
    overlay.id = 'sidebarOverlay';
    overlay.addEventListener('click', toggleSidebar);
    document.body.appendChild(overlay);
}

function removeSidebarOverlay() {
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) {
        overlay.remove();
    }
}

function insertEmoji(emoji) {
    const cursorPos = messageInput.selectionStart;
    const text = messageInput.value;
    messageInput.value = text.slice(0, cursorPos) + emoji + text.slice(cursorPos);
    messageInput.focus();
    messageInput.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
    emojiPicker.style.display = 'none';
}

function toggleVoiceRecording() {
    if (!isRecording) {
        startVoiceRecording();
    } else {
        stopVoiceRecording();
    }
}

function startVoiceRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            const audioChunks = [];
            
            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };
            
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                const reader = new FileReader();
                reader.onload = () => {
                    socket.emit('voice', {
                        data: reader.result,
                        duration: Math.round((Date.now() - recordingStart) / 1000)
                    });
                };
                reader.readAsDataURL(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };
            
            const recordingStart = Date.now();
            mediaRecorder.start();
            isRecording = true;
            voiceBtn.textContent = '⏹️';
            voiceBtn.style.background = '#e74c3c';
        })
        .catch(err => {
            alert('Microphone access denied');
        });
}

function stopVoiceRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        voiceBtn.textContent = '🎤';
        voiceBtn.style.background = '#f8f9fa';
    }
}

function playVoice(audioData) {
    const audio = new Audio(audioData);
    audio.play();
}

function openImageModal(src) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    const modalSize = isMobile ? '95%' : '90%';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: ${modalSize}; max-height: ${modalSize}; padding: ${isMobile ? '10px' : '20px'};">
            <img src="${src}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
            <button onclick="this.closest('.modal').remove()" style="position: absolute; top: ${isMobile ? '5px' : '10px'}; right: ${isMobile ? '5px' : '10px'}; padding: ${isMobile ? '5px 8px' : '8px 12px'}; font-size: ${isMobile ? '14px' : '16px'};">✕</button>
        </div>
    `;
    document.body.appendChild(modal);
}

function linkify(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}

function showMessageMenu(event, messageId) {
    const menu = document.createElement('div');
    menu.className = 'message-menu';
    menu.innerHTML = `
        <button onclick="copyMessage('${messageId}')">Copy</button>
        <button onclick="deleteMessage('${messageId}')">Delete</button>
        <button onclick="editMessage('${messageId}')">Edit</button>
    `;
    menu.style.display = 'block';
    
    if (isMobile) {
        // Position menu better on mobile
        menu.style.position = 'fixed';
        menu.style.bottom = '20px';
        menu.style.left = '50%';
        menu.style.transform = 'translateX(-50%)';
        menu.style.width = '200px';
        menu.style.textAlign = 'center';
    } else {
        menu.style.left = event.pageX + 'px';
        menu.style.top = event.pageY + 'px';
    }
    
    document.body.appendChild(menu);
    setTimeout(() => menu.remove(), 5000);
}

function scrollToBottom() {
    messages.scrollTop = messages.scrollHeight;
}

function markAllRead() {
    document.querySelectorAll('.message.unread').forEach(msg => {
        msg.classList.remove('unread');
    });
    unreadMessages = 0;
    updateTitle();
}

function exportChat() {
    const chatData = Array.from(document.querySelectorAll('.message')).map(msg => {
        return {
            username: msg.querySelector('.username')?.textContent || 'System',
            message: msg.textContent,
            timestamp: msg.querySelector('.timestamp')?.textContent || new Date().toISOString()
        };
    });
    
    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function updateTitle() {
    document.title = unreadMessages > 0 ? `(${unreadMessages}) Chat App` : 'Chat App';
}

// Connection status updates
socket.on('connect', () => {
    connectionStatus.className = 'connection-status connected';
    connectionStatus.textContent = '🟢 Connected';
});

socket.on('disconnect', () => {
    connectionStatus.className = 'connection-status disconnected';
    connectionStatus.textContent = '🔴 Disconnected';
});

socket.on('reconnecting', () => {
    connectionStatus.className = 'connection-status reconnecting';
    connectionStatus.textContent = '🟡 Reconnecting...';
});

socket.on('message', (data) => {
    addMessage(data);
});

socket.on('userJoined', (user) => {
    const username = typeof user === 'object' ? user.username || 'Unknown' : user;
    addMessage(`${username} joined the chat`, true);
});

socket.on('userLeft', (user) => {
    const username = typeof user === 'object' ? user.username || 'Unknown' : user;
    addMessage(`${username} left the chat`, true);
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

socket.on('messageHistory', (history) => {
    messages.innerHTML = '';
    history.forEach(msg => addMessage(msg));
});

socket.on('privateMessage', (data) => {
    addMessage(data);
});

socket.on('roomSwitched', (room) => {
    currentRoom = room;
    roomSelect.value = room;
    updateUsernameDisplay();
    messages.innerHTML = '';
    addMessage(`Switched to room: ${room}`, true);
});

socket.on('usernameChanged', (data) => {
    if (data && data.oldUsername && data.newUsername) {
        addMessage(`${data.oldUsername} changed their name to ${data.newUsername}`, true);
    }
});

socket.on('reaction', (data) => {
    const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (messageElement) {
        const existingReactions = messageElement.querySelector('.message-reactions');
        if (existingReactions) {
            existingReactions.remove();
        }
        
        if (data.reactions && Object.keys(data.reactions).length > 0) {
            const reactionsHtml = createReactionsHtml(data.reactions, data.messageId);
            const actionsDiv = messageElement.querySelector('.message-actions');
            actionsDiv.insertAdjacentHTML('beforebegin', reactionsHtml);
        }
    }
});

socket.on('file', (data) => {
    addMessage(data);
});

socket.on('statusUpdate', (data) => {
    const userElements = document.querySelectorAll('#userList li');
    userElements.forEach(li => {
        if (li.textContent === data.username) {
            li.className = `user-${data.status}`;
        }
    });
    addMessage(`${data.username} is now ${data.status}`, true);
});

socket.on('roomCreated', (data) => {
    addMessage(`Room '${data.room}' was created by ${data.username}`, true);
    const option = document.createElement('option');
    option.value = data.room;
    option.textContent = data.room;
    roomSelect.appendChild(option);
});

socket.on('voice', (data) => {
    addMessage(data);
});

// Focus management
window.addEventListener('focus', () => {
    markAllRead();
    lastActivity = Date.now();
});

window.addEventListener('blur', () => {
    lastActivity = Date.now();
});

// Keyboard shortcuts (disabled on mobile)
document.addEventListener('keydown', (e) => {
    if (!isMobile && (e.ctrlKey || e.metaKey)) {
        switch(e.key) {
            case 'k':
                e.preventDefault();
                searchInput.focus();
                break;
            case 'e':
                e.preventDefault();
                toggleEmojiPicker();
                break;
            case 's':
                e.preventDefault();
                exportChat();
                break;
        }
    }
    if (e.key === 'Escape') {
        emojiPicker.style.display = 'none';
        reactionPicker.style.display = 'none';
        if (isMobile && sidebar.classList.contains('open')) {
            toggleSidebar();
        }
    }
});

// Touch events for mobile
if ('ontouchstart' in window) {
    let touchStartY = 0;
    let touchEndY = 0;
    
    messages.addEventListener('touchstart', (e) => {
        touchStartY = e.changedTouches[0].screenY;
    });
    
    messages.addEventListener('touchend', (e) => {
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
    });
    
    function handleSwipe() {
        const swipeThreshold = 50;
        const diff = touchStartY - touchEndY;
        
        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                // Swipe up - scroll to bottom
                scrollToBottom();
            }
        }
    }
}

// Prevent zoom on double tap for iOS
document.addEventListener('touchend', (e) => {
    const now = new Date().getTime();
    const timeSince = now - lastTouchEnd;
    
    if (timeSince < 300 && timeSince > 0) {
        e.preventDefault();
    }
    
    lastTouchEnd = now;
});

let lastTouchEnd = 0;

socket.on('roomList', (rooms) => {
    const currentOptions = Array.from(roomSelect.options).map(opt => opt.value);
    const roomArray = Array.isArray(rooms) ? rooms : [];
    roomArray.forEach(room => {
        const roomName = typeof room === 'object' ? (room.name || room) : room;
        if (!currentOptions.includes(roomName)) {
            const option = document.createElement('option');
            option.value = roomName;
            option.textContent = roomName;
            roomSelect.appendChild(option);
        }
    });
});