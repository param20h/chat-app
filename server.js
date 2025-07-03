const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

const users = new Map();
const messageHistory = [];
const rooms = new Map();
const messageReactions = new Map();
const userStatuses = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (data) => {
        if (data && data.username) {
            const username = data.username.toString().trim().substring(0, 20);
            const room = (data.room || 'general').toString().trim().substring(0, 20);
            const status = data.status || 'online';
            
            if (username && room) {
                users.set(socket.id, { username, room, status });
                socket.join(room);
                
                const roomHistory = messageHistory.filter(msg => msg.room === room).slice(-50);
                socket.emit('messageHistory', roomHistory);
                
                socket.to(room).emit('userJoined', username);
                io.to(room).emit('userList', getUsersInRoom(room));
                io.emit('roomList', Array.from(new Set(Array.from(users.values()).map(u => u.room))));
            }
        }
    });

    socket.on('message', (data) => {
        const user = users.get(socket.id);
        if (user && data && data.message) {
            const cleanMessage = data.message.toString().trim().substring(0, 500);
            if (cleanMessage) {
                const messageData = {
                    username: user.username,
                    message: cleanMessage,
                    timestamp: new Date().toLocaleTimeString(),
                    room: user.room,
                    id: Date.now() + Math.random(),
                    reactions: {},
                    replyTo: data.replyTo,
                    replyText: data.replyText
                };
                messageHistory.push(messageData);
                if (messageHistory.length > 1000) messageHistory.shift();
                io.to(user.room).emit('message', messageData);
            }
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
                    to: data.to
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

    socket.on('switchRoom', (newRoom) => {
        const user = users.get(socket.id);
        if (user) {
            socket.leave(user.room);
            socket.to(user.room).emit('userLeft', user.username);
            io.to(user.room).emit('userList', getUsersInRoom(user.room));
            
            user.room = newRoom;
            socket.join(newRoom);
            
            const roomHistory = messageHistory.filter(msg => msg.room === newRoom).slice(-50);
            socket.emit('messageHistory', roomHistory);
            socket.emit('roomSwitched', newRoom);
            
            socket.to(newRoom).emit('userJoined', user.username);
            io.to(newRoom).emit('userList', getUsersInRoom(newRoom));
        }
    });

    socket.on('usernameChange', (data) => {
        const user = users.get(socket.id);
        if (user && data && data.newUsername) {
            const newUsername = data.newUsername.toString().trim().substring(0, 20);
            if (newUsername && newUsername !== user.username) {
                const oldUsername = user.username;
                user.username = newUsername;
                io.to(user.room).emit('usernameChanged', { oldUsername, newUsername });
                io.to(user.room).emit('userList', getUsersInRoom(user.room));
            }
        }
    });

    socket.on('reaction', (data) => {
        const user = users.get(socket.id);
        if (user && data && data.messageId && data.emoji) {
            const message = messageHistory.find(msg => msg.id == data.messageId);
            if (message && message.room === user.room) {
                if (!message.reactions) message.reactions = {};
                if (!message.reactions[data.emoji]) message.reactions[data.emoji] = [];
                
                const userIndex = message.reactions[data.emoji].indexOf(user.username);
                if (userIndex > -1) {
                    message.reactions[data.emoji].splice(userIndex, 1);
                    if (message.reactions[data.emoji].length === 0) {
                        delete message.reactions[data.emoji];
                    }
                } else {
                    message.reactions[data.emoji].push(user.username);
                }
                
                io.to(user.room).emit('reaction', {
                    messageId: data.messageId,
                    reactions: message.reactions
                });
            }
        }
    });

    socket.on('file', (fileData) => {
        const user = users.get(socket.id);
        if (user && fileData) {
            const messageData = {
                username: user.username,
                timestamp: new Date().toLocaleTimeString(),
                room: user.room,
                id: Date.now() + Math.random(),
                file: {
                    name: fileData.name,
                    type: fileData.type,
                    size: fileData.size,
                    data: fileData.data
                },
                reactions: {}
            };
            messageHistory.push(messageData);
            if (messageHistory.length > 1000) messageHistory.shift();
            io.to(user.room).emit('file', messageData);
        }
    });

    socket.on('statusChange', (data) => {
        const user = users.get(socket.id);
        if (user && data && data.status) {
            user.status = data.status;
            userStatuses.set(socket.id, data.status);
            io.to(user.room).emit('statusUpdate', {
                username: user.username,
                status: data.status
            });
            io.to(user.room).emit('userList', getUsersInRoom(user.room));
        }
    });

    socket.on('createRoom', (data) => {
        const user = users.get(socket.id);
        if (user && data && data.room) {
            const roomName = data.room.toString().trim().substring(0, 20);
            if (roomName) {
                io.emit('roomCreated', { room: roomName, username: user.username });
                io.emit('roomList', Array.from(new Set([...Array.from(users.values()).map(u => u.room), roomName])));
            }
        }
    });

    socket.on('voice', (voiceData) => {
        const user = users.get(socket.id);
        if (user && voiceData) {
            const messageData = {
                username: user.username,
                timestamp: new Date().toLocaleTimeString(),
                room: user.room,
                id: Date.now() + Math.random(),
                voice: {
                    data: voiceData.data,
                    duration: voiceData.duration
                },
                reactions: {}
            };
            messageHistory.push(messageData);
            if (messageHistory.length > 1000) messageHistory.shift();
            io.to(user.room).emit('voice', messageData);
        }
    });

    socket.on('messageDelete', (data) => {
        const user = users.get(socket.id);
        if (user && data && data.messageId) {
            const messageIndex = messageHistory.findIndex(msg => msg.id == data.messageId && msg.username === user.username);
            if (messageIndex > -1) {
                messageHistory.splice(messageIndex, 1);
                io.to(user.room).emit('messageDeleted', { messageId: data.messageId });
            }
        }
    });

    socket.on('messageEdit', (data) => {
        const user = users.get(socket.id);
        if (user && data && data.messageId && data.newMessage) {
            const message = messageHistory.find(msg => msg.id == data.messageId && msg.username === user.username);
            if (message) {
                message.message = data.newMessage.toString().trim().substring(0, 500);
                message.edited = true;
                io.to(user.room).emit('messageEdited', {
                    messageId: data.messageId,
                    newMessage: message.message
                });
            }
        }
    });

    socket.on('disconnect', () => {
        const user = users.get(socket.id);
        if (user) {
            users.delete(socket.id);
            userStatuses.delete(socket.id);
            socket.to(user.room).emit('userLeft', user.username);
            io.to(user.room).emit('userList', getUsersInRoom(user.room));
            io.emit('roomList', Array.from(new Set(Array.from(users.values()).map(u => u.room))));
        }
        console.log('User disconnected:', socket.id);
    });
});

function getUsersInRoom(room) {
    return Array.from(users.values())
        .filter(user => user.room === room)
        .map(user => ({
            username: user.username,
            status: user.status || 'online'
        }));
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Chat server running on http://localhost:${PORT}`);
});