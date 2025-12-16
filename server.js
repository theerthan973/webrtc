const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

/* ---------------- STATIC FILES ---------------- */

const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

/* ---------------- CLIENT TRACKING ---------------- */

const webClients = new Set();
const androidClients = new Set();

/* ---------------- SOCKET LOGIC ---------------- */

io.on('connection', socket => {
  console.log(`Client connected: ${socket.id}`);
  socket.emit('id', socket.id);

  socket.on('identify', type => {
    console.log(`${socket.id} identified as ${type}`);

    if (type === 'web') {
      webClients.add(socket.id);
      androidClients.forEach(androidId => {
        io.to(androidId).emit('web-client-ready', socket.id);
        io.to(socket.id).emit('android-client-ready', androidId);
      });
    }

    if (type === 'android') {
      androidClients.add(socket.id);
      webClients.forEach(webId => {
        io.to(webId).emit('android-client-ready', socket.id);
        socket.emit('web-client-ready', webId);
      });
    }

    console.log(`Web: ${webClients.size}, Android: ${androidClients.size}`);
  });

  /* -------- WebRTC SIGNALING (AUDIO ONLY) -------- */

  socket.on('signal', data => {
    const { to } = data;
    if (to && io.sockets.sockets.get(to)) {
      io.to(to).emit('signal', data);
    }
  });

  /* ---------------- DISCONNECT ---------------- */

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);

    if (webClients.delete(socket.id)) {
      androidClients.forEach(id =>
        io.to(id).emit('web-client-disconnected', socket.id)
      );
    }

    if (androidClients.delete(socket.id)) {
      webClients.forEach(id =>
        io.to(id).emit('android-client-disconnected', socket.id)
      );
    }

    console.log(`Web: ${webClients.size}, Android: ${androidClients.size}`);
  });
});

/* ---------------- SERVER START ---------------- */

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Audio signaling server running on port ${PORT}`);
});
