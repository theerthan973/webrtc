const SIGNALING_URL = "https://webrtc-syec.onrender.com";

const socket = io(SIGNALING_URL, { reconnection: true });

const remoteAudio = document.getElementById("remoteAudio");
const statusDiv = document.getElementById("status");
const debugLog = document.getElementById("debugLog");

let peer;
let myId;

const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject"
    }
  ]
};

function log(msg) {
  statusDiv.textContent = msg;
  const d = document.createElement("div");
  d.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  debugLog.prepend(d);
}

socket.on("connect", () => log("Connected to server"));

socket.on("id", id => {
  myId = id;
  socket.emit("identify", "web");
  log("Waiting for Android…");
});

socket.on("android-client-ready", id => {
  log("Android connected");
});

socket.on("signal", async ({ from, signal }) => {
  if (!peer) {
    peer = new RTCPeerConnection(config);
    peer.addTransceiver("audio", { direction: "recvonly" });

    peer.ontrack = e => {
      remoteAudio.srcObject = new MediaStream([e.track]);
      remoteAudio.play().catch(()=>{});
      log("Receiving audio");
    };

    peer.onicecandidate = e => {
      if (e.candidate) {
        socket.emit("signal", {
          to: from,
          from: myId,
          signal: { candidate: e.candidate }
        });
      }
    };
  }

  if (signal.type === "offer") {
    await peer.setRemoteDescription(signal);
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    socket.emit("signal", {
      to: from,
      from: myId,
      signal: answer
    });

    log("Answer sent");
  }

  if (signal.candidate) {
    await peer.addIceCandidate(signal.candidate);
  }
});

socket.on("android-client-disconnected", () => {
  log("Android disconnected");
  if (peer) peer.close();
  peer = null;
  remoteAudio.srcObject = null;
});
