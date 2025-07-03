const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

const users = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (username) => {
        users.set(socket.id, username);
        socket.broadcast.emit('userJoined', username);
        io.emit('userList', Array.from(users.values()));
    });

    socket.on('message', (data) => {
        const username = users.get(socket.id);
        io.emit('message', {
            username,
            message: data.message,
            timestamp: new Date().toLocaleTimeString()
        });
    });

    socket.on('typing', (data) => {
        const username = users.get(socket.id);
        socket.broadcast.emit('typing', { username, isTyping: data.isTyping });
    });

    socket.on('disconnect', () => {
        const username = users.get(socket.id);
        if (username) {
            users.delete(socket.id);
            socket.broadcast.emit('userLeft', username);
            io.emit('userList', Array.from(users.values()));
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Chat server running on http://localhost:${PORT}`);
});