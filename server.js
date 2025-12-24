const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static("public"));

const webClients = new Set();
const androidClients = new Set();

io.on("connection", socket => {
  socket.emit("id", socket.id);

  socket.on("identify", type => {
    if (type === "web") webClients.add(socket.id);
    if (type === "android") androidClients.add(socket.id);

    webClients.forEach(w => androidClients.forEach(a => {
      io.to(w).emit("android-client-ready", a);
      io.to(a).emit("web-client-ready", w);
    }));
  });

  socket.on("control", data => {
    io.to(data.to).emit("control", data);
  });

  socket.on("signal", data => {
    io.to(data.to).emit("signal", data);
  });

  socket.on("disconnect", () => {
    webClients.delete(socket.id);
    androidClients.delete(socket.id);
  });
});

server.listen(3000, () => console.log("Server running"));
