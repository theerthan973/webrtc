const SIGNALING_URL = "https://webrtc-syec.onrender.com";

const socket = io(SIGNALING_URL, {
  reconnection: true,
  reconnectionAttempts: 15,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.5
});

const remoteAudio = document.getElementById("remoteAudio");
const statusDiv = document.getElementById("status");
const debugLog = document.getElementById("debugLog");
const retryButton = document.getElementById("retryButton");

let peer;
let myId;
let androidClientId;

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

/* ---------------- STATUS + LOG ---------------- */

function updateStatus(msg) {
  console.log(msg);
  statusDiv.textContent = msg;
  logDebug(msg);
}

function logDebug(message) {
  const div = document.createElement("div");
  div.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  debugLog.prepend(div);
  while (debugLog.children.length > 50) {
    debugLog.removeChild(debugLog.lastChild);
  }
}

function reconnectSocket() {
  updateStatus("Reconnecting to server...");
  socket.connect();
}

/* ---------------- SOCKET EVENTS ---------------- */

socket.on("connect", () => {
  updateStatus("Connected to signaling server");
});

socket.on("connect_error", (error) => {
  updateStatus(`Socket error: ${error.message}`);
});

socket.on("id", (id) => {
  myId = id;
  logDebug(`My socket id: ${myId}`);
  socket.emit("identify", "web");
  socket.emit("web-client-ready", myId);
  updateStatus("Waiting for Android device...");
});

socket.on("android-client-ready", (id) => {
  androidClientId = id;
  logDebug(`Android client ready: ${id}`);
  updateStatus("Android connected, waiting for audio...");
});

/* ---------------- SIGNALING ---------------- */

socket.on("signal", async (data) => {
  const { from, signal } = data;
  logDebug(`Received signal: ${signal.type || "candidate"}`);

  if (!peer) {
    peer = new RTCPeerConnection(config);

    // ✅ AUDIO ONLY
    peer.addTransceiver("audio", { direction: "recvonly" });

    peer.ontrack = (event) => {
      const stream = new MediaStream([event.track]);
      remoteAudio.srcObject = stream;
      remoteAudio.play().catch(() => {
        remoteAudio.controls = true;
      });
      updateStatus("Receiving audio stream");
    };

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("signal", {
          to: from,
          from: myId,
          signal: { candidate: e.candidate }
        });
      }
    };

    peer.oniceconnectionstatechange = () => {
      logDebug(`ICE state: ${peer.iceConnectionState}`);
    };
  }

  try {
    if (signal.type === "offer") {
      await peer.setRemoteDescription(new RTCSessionDescription(signal));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      socket.emit("signal", {
        to: from,
        from: myId,
        signal: { type: "answer", sdp: answer.sdp }
      });

      logDebug("Sent audio answer");
    } else if (signal.candidate) {
      await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
      logDebug("ICE candidate added");
    }
  } catch (err) {
    logDebug(`Signal error: ${err.message}`);
  }
});

/* ---------------- DISCONNECT ---------------- */

socket.on("android-client-disconnected", () => {
  updateStatus("Android client disconnected");
  if (peer) {
    peer.close();
    peer = null;
  }
  remoteAudio.srcObject = null;
});

socket.on("error", (error) => {
  updateStatus(`Server error: ${error.message}`);
});

retryButton.addEventListener("click", reconnectSocket);

updateStatus("Connecting to server...");
logDebug("Web audio client initialized");
