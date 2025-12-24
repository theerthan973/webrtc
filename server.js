const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, "public")));

app.get("*", (_, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

let webClient = null;
let androidClient = null;

io.on("connection", socket => {
  console.log("Connected:", socket.id);
  socket.emit("id", socket.id);

  socket.on("identify", type => {
    socket.clientType = type;

    if (type === "web") {
      webClient = socket.id;
      if (androidClient) {
        io.to(webClient).emit("android-client-ready", androidClient);
        io.to(androidClient).emit("web-client-ready", webClient);
      }
    }

    if (type === "android") {
      androidClient = socket.id;
      if (webClient) {
        io.to(androidClient).emit("web-client-ready", webClient);
        io.to(webClient).emit("android-client-ready", androidClient);
      }
    }
  });

  socket.on("signal", data => {
    if (data.to) {
      io.to(data.to).emit("signal", data);
    }
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);

    if (socket.id === androidClient) {
      androidClient = null;
      if (webClient) io.to(webClient).emit("android-client-disconnected");
    }

    if (socket.id === webClient) {
      webClient = null;
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log("Signaling server running on", PORT)
);
