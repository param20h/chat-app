const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow images, documents, and some common file types
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|mp4|mp3/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use(express.json());

const users = new Map();
const messageHistory = [];
const rooms = new Map();
const activeUsernames = new Set();
const roomPasswords = new Map();
const userProfiles = new Map(); // Store user profiles

// Initialize general room
rooms.set('general', {
    name: 'general',
    owner: 'system',
    hasPassword: false,
    users: new Set()
});

// File upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const fileInfo = {
            filename: req.file.filename,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            url: `/uploads/${req.file.filename}`
        };
        
        res.json({ success: true, file: fileInfo });
    } catch (error) {
        res.status(500).json({ error: 'Upload failed: ' + error.message });
    }
});

// User profile endpoints
app.post('/profile/:username', (req, res) => {
    try {
        const { username } = req.params;
        const { status, bio, avatar } = req.body;
        
        if (!activeUsernames.has(username.toLowerCase())) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        userProfiles.set(username.toLowerCase(), {
            username,
            status: status || 'online',
            bio: bio || '',
            avatar: avatar || '',
            lastSeen: new Date(),
            joinedAt: userProfiles.get(username.toLowerCase())?.joinedAt || new Date()
        });
        
        // Find the user's current room and broadcast to that room
        const userSocket = Array.from(users.entries()).find(([id, user]) => user.username === username);
        if (userSocket) {
            const userRoom = userSocket[1].room;
            // Broadcast updated user list to the room
            io.to(userRoom).emit('userList', getUsersInRoom(userRoom));
            // Also emit profile update event
            io.to(userRoom).emit('profileUpdated', {
                username,
                profile: userProfiles.get(username.toLowerCase())
            });
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Profile update failed: ' + error.message });
    }
});

app.get('/profile/:username', (req, res) => {
    try {
        const { username } = req.params;
        const profile = userProfiles.get(username.toLowerCase());
        
        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }
        
        res.json(profile);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get profile: ' + error.message });
    }
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('checkUsername', (data) => {
        if (data && data.username) {
            const username = data.username.toString().trim().substring(0, 20);
            const available = !activeUsernames.has(username.toLowerCase());
            socket.emit('usernameCheck', { username, available });
        }
    });

    socket.on('join', (data) => {
        if (data && data.username) {
            const username = data.username.toString().trim().substring(0, 20);
            const room = (data.room || 'general').toString().trim().substring(0, 20);
            
            if (username && room && !activeUsernames.has(username.toLowerCase())) {
                activeUsernames.add(username.toLowerCase());
                users.set(socket.id, { username, room });
                socket.join(room);
                
                // Create user profile if it doesn't exist
                if (!userProfiles.has(username.toLowerCase())) {
                    userProfiles.set(username.toLowerCase(), {
                        username,
                        status: 'online',
                        bio: '',
                        avatar: '',
                        lastSeen: new Date(),
                        joinedAt: new Date()
                    });
                } else {
                    // Update status to online
                    const profile = userProfiles.get(username.toLowerCase());
                    profile.status = 'online';
                    profile.lastSeen = new Date();
                }
                
                // Add user to room
                if (rooms.has(room)) {
                    rooms.get(room).users.add(username);
                }
                
                socket.to(room).emit('userJoined', username);
                io.to(room).emit('userList', getUsersInRoom(room));
                socket.emit('roomList', getRoomList());
                
                // Send user their profile
                socket.emit('profileData', userProfiles.get(username.toLowerCase()));
            }
        }
    });

    socket.on('message', (data) => {
        const user = users.get(socket.id);
        if (user && data && (data.message || data.file)) {
            const cleanMessage = data.message ? data.message.toString().trim().substring(0, 500) : '';
            
            const messageData = {
                username: user.username,
                message: cleanMessage,
                timestamp: new Date().toLocaleTimeString(),
                room: user.room,
                id: Date.now() + Math.random(),
                replyTo: data.replyTo || null,
                reactions: {}
            };
            
            // Include file data if present
            if (data.file) {
                messageData.file = {
                    url: data.file.url,
                    name: data.file.name,
                    type: data.file.type,
                    size: data.file.size
                };
            }
            
            messageHistory.push(messageData);
            if (messageHistory.length > 1000) messageHistory.shift();
            io.to(user.room).emit('message', messageData);
        }
    });

    socket.on('privateMessage', (data) => {
        const sender = users.get(socket.id);
        const recipient = Array.from(users.entries()).find(([id, user]) => user.username === data.to);
        if (sender && recipient && data && data.message) {
            const cleanMessage = data.message.toString().trim().substring(0, 500);
            if (cleanMessage) {
                const messageData = {
                    username: sender.username,
                    message: cleanMessage,
                    timestamp: new Date().toLocaleTimeString(),
                    private: true,
                    to: data.to,
                    replyTo: data.replyTo || null
                };
                socket.emit('privateMessage', messageData);
                io.to(recipient[0]).emit('privateMessage', messageData);
            }
        }
    });

    socket.on('typing', (data) => {
        const user = users.get(socket.id);
        if (user) {
            socket.to(user.room).emit('typing', { username: user.username, isTyping: data.isTyping });
        }
    });

    socket.on('switchRoom', (data) => {
        const user = users.get(socket.id);
        if (user && data && data.room) {
            const newRoom = data.room.toString().trim();
            const password = data.password;
            
            // Check if room exists
            if (!rooms.has(newRoom)) {
                socket.emit('roomError', { message: 'Room does not exist', type: 'not_found' });
                return;
            }
            
            const roomData = rooms.get(newRoom);
            
            // Check password for protected rooms
            if (roomData.hasPassword && newRoom !== 'general') {
                const correctPassword = roomPasswords.get(newRoom);
                if (!password || password !== correctPassword) {
                    socket.emit('roomError', { 
                        message: 'Wrong password', 
                        type: 'wrong_password',
                        room: newRoom 
                    });
                    return;
                }
            }
            
            // Leave current room
            socket.leave(user.room);
            if (rooms.has(user.room)) {
                rooms.get(user.room).users.delete(user.username);
            }
            socket.to(user.room).emit('userLeft', user.username);
            io.to(user.room).emit('userList', getUsersInRoom(user.room));
            
            // Join new room
            user.room = newRoom;
            socket.join(newRoom);
            roomData.users.add(user.username);
            
            // Clean chat when switching rooms - no history
            socket.emit('roomSwitched', { success: true, room: newRoom });
            
            socket.to(newRoom).emit('userJoined', user.username);
            io.to(newRoom).emit('userList', getUsersInRoom(newRoom));
        }
    });

    socket.on('createRoom', (data) => {
        const user = users.get(socket.id);
        if (user && data && data.room) {
            const roomName = data.room.toString().trim().substring(0, 20);
            const password = data.password;
            const owner = data.owner || user.username;
            
            if (roomName && !rooms.has(roomName) && roomName !== 'general') {
                // Create new room
                rooms.set(roomName, {
                    name: roomName,
                    owner: owner,
                    hasPassword: !!password,
                    users: new Set()
                });
                
                if (password) {
                    roomPasswords.set(roomName, password);
                }
                
                io.emit('roomCreated', { 
                    room: roomName, 
                    owner: owner,
                    hasPassword: !!password 
                });
                io.emit('roomList', getRoomList());
            } else {
                socket.emit('roomError', { message: 'Room already exists or invalid name' });
            }
        }
    });

    socket.on('disconnect', () => {
        const user = users.get(socket.id);
        if (user) {
            activeUsernames.delete(user.username.toLowerCase());
            users.delete(socket.id);
            
            // Update user profile status
            if (userProfiles.has(user.username.toLowerCase())) {
                const profile = userProfiles.get(user.username.toLowerCase());
                profile.status = 'offline';
                profile.lastSeen = new Date();
            }
            
            // Remove from room
            if (rooms.has(user.room)) {
                rooms.get(user.room).users.delete(user.username);
            }
            
            socket.to(user.room).emit('userLeft', user.username);
            io.to(user.room).emit('userList', getUsersInRoom(user.room));
        }
        console.log('User disconnected:', socket.id);
    });

    socket.on('editMessage', (data) => {
        const user = users.get(socket.id);
        if (user && data && data.messageId && data.newMessage) {
            // Find the message in history
            const message = messageHistory.find(msg => 
                msg.id == data.messageId && 
                msg.username === user.username && 
                msg.room === user.room
            );
            
            if (message) {
                const cleanMessage = data.newMessage.toString().trim().substring(0, 500);
                message.message = cleanMessage;
                message.edited = true;
                
                // Broadcast edit to room
                io.to(user.room).emit('messageEdited', {
                    messageId: data.messageId,
                    newMessage: cleanMessage
                });
            }
        }
    });

    socket.on('reaction', (data) => {
        const user = users.get(socket.id);
        if (user && data && data.messageId && data.emoji) {
            // Find the message in history
            const message = messageHistory.find(msg => msg.id == data.messageId && msg.room === user.room);
            if (message) {
                if (!message.reactions) message.reactions = {};
                if (!message.reactions[data.emoji]) message.reactions[data.emoji] = [];
                
                const userIndex = message.reactions[data.emoji].indexOf(user.username);
                if (userIndex > -1) {
                    // Remove reaction
                    message.reactions[data.emoji].splice(userIndex, 1);
                    if (message.reactions[data.emoji].length === 0) {
                        delete message.reactions[data.emoji];
                    }
                } else {
                    // Add reaction
                    message.reactions[data.emoji].push(user.username);
                }
                
                // Broadcast updated reactions to room
                io.to(user.room).emit('reaction', {
                    messageId: data.messageId,
                    reactions: message.reactions
                });
            }
        }
    });
});

function getUsersInRoom(room) {
    return Array.from(users.values())
        .filter(user => user.room === room)
        .map(user => {
            const profile = userProfiles.get(user.username.toLowerCase()) || {};
            return {
                username: user.username,
                status: profile.status || 'online',
                bio: profile.bio || '',
                avatar: profile.avatar || ''
            };
        });
}

function getRoomList() {
    return Array.from(rooms.values()).map(room => ({
        name: room.name,
        owner: room.owner,
        hasPassword: room.hasPassword,
        userCount: room.users.size
    }));
}

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
    console.log(`Chat server running on http://localhost:${PORT}`);
});