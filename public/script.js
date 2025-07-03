const socket = io();
let username = '';
let typingTimer;

const loginModal = document.getElementById('loginModal');
const usernameInput = document.getElementById('usernameInput');
const joinBtn = document.getElementById('joinBtn');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const messages = document.getElementById('messages');
const userList = document.getElementById('userList');
const usernameDisplay = document.getElementById('username-display');
const typing = document.getElementById('typing');

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

function joinChat() {
    const name = usernameInput.value.trim();
    if (name) {
        username = name;
        socket.emit('join', username);
        loginModal.style.display = 'none';
        messageInput.disabled = false;
        sendBtn.disabled = false;
        usernameDisplay.textContent = `Welcome, ${username}!`;
        messageInput.focus();
    }
}

function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        socket.emit('message', { message });
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

function addMessage(data, isSystem = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = isSystem ? 'message system-message' : 'message';
    
    if (isSystem) {
        messageDiv.textContent = data;
    } else {
        messageDiv.innerHTML = `
            <span class="username">${data.username}</span>
            <span class="timestamp">${data.timestamp}</span>
            <div>${data.message}</div>
        `;
    }
    
    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
}

function updateUserList(users) {
    userList.innerHTML = '';
    users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = user;
        userList.appendChild(li);
    });
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

socket.on('message', (data) => {
    addMessage(data);
});

socket.on('userJoined', (user) => {
    addMessage(`${user} joined the chat`, true);
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