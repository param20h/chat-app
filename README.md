# Chat App

A feature-rich, real-time chat application built with Node.js, Express, and Socket.IO. Experience modern messaging with a beautiful, responsive interface and advanced features.

## ✨ Features

### **Core Messaging**
- 💬 Real-time messaging with WebSocket technology
- 👥 Multiple users support with unique usernames
- 🏠 Multiple chat rooms with password protection
- 💌 Private messaging system (`/pm username message`)
- ↩️ Reply to messages with quoted context
- ✏️ Message editing capabilities (edit your own messages)
- 😀 Message reactions with emoji picker (👍❤️😂😮😢🎉)

### **User Experience**
- 👤 User profiles with custom status and bio
- 🎨 User avatars with color coding based on username
- 📱 Mobile-responsive design with touch-friendly interface
- 🌙 Dark/Light theme toggle with persistent preferences
- 🔊 Sound notifications (toggle on/off)
- 💬 Message grouping for cleaner conversation flow
- ⌨️ Typing indicators showing who's currently typing

### **File Sharing**
- 📎 File upload and sharing (up to 10MB)
- 🖼️ Image preview with click-to-enlarge
- 📄 Document sharing (PDF, DOC, TXT, etc.)
- 🎵 Audio and video file support
- ⬇️ One-click file downloads
- 📊 File size and type indicators

### **Room Management**
- 🌍 Public rooms for open discussions
- 🔒 Password-protected private rooms
- 👑 Room ownership and creation
- 📋 Online user list with status indicators
- 🚪 Real-time join/leave notifications

### **Modern UI/UX**
- 🎨 Modern gradient design with smooth animations
- 📲 Responsive layout (desktop, tablet, mobile)
- ⚡ Smooth hover effects and transitions
- 🎯 Intuitive button placements and controls
- 🔄 Real-time updates without page refresh

## 🚀 Quick Start

### **Prerequisites**
- Node.js (v14 or higher)
- npm (comes with Node.js)

### **Installation**

1. **Clone the repository:**
```bash
git clone https://github.com/param20h/chat-app.git
cd chat-app
```

2. **Install dependencies:**
```bash
npm install
```

3. **Start the server:**
```bash
npm start
```

4. **Open your browser and go to:**
```
http://localhost:3002
```

## 🎮 How to Use

### **Getting Started**
1. 🏷️ **Enter your username** to join the chat (must be unique)
2. 💬 **Start chatting** with other users in real-time
3. 👥 **See who's online** in the sidebar with their status
4. ⌨️ **View typing indicators** when others are typing

### **Advanced Features**
- **🏠 Create Rooms**: Click "Create Room" to make public or private rooms
- **👤 Edit Profile**: Click the profile button (👤) to set status and bio
- **📎 Share Files**: Click the paperclip (📎) to upload and share files
- **💌 Private Messages**: Type `/pm username your message` for private chats
- **😀 React**: Click the reaction button to add emoji reactions
- **↩️ Reply**: Click reply to quote and respond to specific messages
- **🌙 Toggle Theme**: Switch between light and dark modes
- **🔊 Sound Control**: Enable/disable notification sounds

## 🛠️ Technologies Used

### **Backend**
- **Node.js** - JavaScript runtime environment
- **Express.js** - Web application framework
- **Socket.IO** - Real-time bidirectional event-based communication
- **Multer** - Middleware for handling file uploads

### **Frontend**
- **HTML5** - Modern markup with semantic elements
- **CSS3** - Advanced styling with CSS Grid, Flexbox, and custom properties
- **Vanilla JavaScript** - No frameworks, pure JavaScript for maximum performance
- **WebSocket** - Real-time communication protocol

### **Features & Libraries**
- **File Upload System** - Secure file handling with type validation
- **Responsive Design** - Mobile-first approach with CSS media queries
- **Local Storage** - Persistent user preferences (theme, sound settings)
- **Web Audio API** - Custom notification sounds

## 📁 Project Structure

```
chat-app/
├── public/                 # Static files served to clients
│   ├── uploads/           # User uploaded files
│   ├── index.html         # Main HTML page
│   ├── script.js          # Client-side JavaScript
│   └── style.css          # CSS styles and themes
├── server.js              # Main server file with Socket.IO
├── package.json           # Dependencies and scripts
├── .gitignore            # Git ignore patterns
└── README.md             # This file
```

## 🚀 Deployment

### **Local Development**
```bash
npm start
# Server runs on http://localhost:3002
```

### **Production Deployment**
The app can be deployed to platforms like:
- **Heroku** - Add `Procfile` with `web: node server.js`
- **Railway** - Automatic deployment from Git
- **DigitalOcean** - App Platform or Droplets
- **AWS** - Elastic Beanstalk or EC2

### **Environment Variables**
```bash
PORT=3002                  # Server port (default: 3002)
NODE_ENV=production        # Environment mode
```

## 🔧 Development

### **Adding New Features**
1. **Server-side**: Add Socket.IO event handlers in `server.js`
2. **Client-side**: Add event listeners and UI updates in `script.js`
3. **Styling**: Update themes and responsive design in `style.css`

### **File Upload Configuration**
- **Max file size**: 10MB (configurable in `server.js`)
- **Allowed types**: Images, documents, audio, video, archives
- **Storage**: Local filesystem (`public/uploads/`)

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🐛 Known Issues & Future Enhancements

### **Planned Features**
- 🔍 Message search and history
- 📞 Voice and video calling
- 🤖 Bot integration
- 🔐 End-to-end encryption
- 💾 Database persistence
- 📱 Mobile app (React Native)

### **Current Limitations**
- Messages are stored in memory (restart clears history)
- No user authentication system
- File storage is local (not cloud-based)

## 🙏 Acknowledgments

- **Socket.IO** - For excellent real-time communication
- **Express.js** - For robust web framework
- **Modern CSS** - For beautiful responsive design
- **Contributors** - Thank you for making this project better!

---

**⭐ Star this repository if you found it helpful!**

**🐛 Found a bug? [Create an issue](https://github.com/param20h/chat-app/issues)**

**💡 Have a suggestion? [Start a discussion](https://github.com/param20h/chat-app/discussions)**