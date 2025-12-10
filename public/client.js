const SIGNALING_URL = "https://webrtc-syec.onrender.com";

const socket = io(SIGNALING_URL, {
  reconnection: true,
  reconnectionAttempts: 15,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.5
});

const remoteVideo = document.getElementById("remoteVideo");
const statusDiv = document.getElementById("status");
const debugLog = document.getElementById("debugLog");
const retryButton = document.getElementById("retryButton");

let peer;
let myId;
let androidClientId;
let audioTrack = null;
let videoTrack = null;

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

// Socket events
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
  updateStatus("Android connected, waiting for video...");
});

socket.on("signal", async (data) => {
  const { from, signal } = data;
  logDebug(`Received signal: ${signal.type || "candidate"}`);

  if (!peer) {
    peer = new RTCPeerConnection(config);

    peer.addTransceiver("video", { direction: "recvonly" });
    peer.addTransceiver("audio", { direction: "recvonly" });

    peer.ontrack = (event) => {
      const track = event.track;
      if (track.kind === "audio") {
        audioTrack = track;
      } else if (track.kind === "video") {
        videoTrack = track;
      }

      if (videoTrack) {
        const stream = new MediaStream([videoTrack]);
        if (audioTrack) stream.addTrack(audioTrack);
        remoteVideo.srcObject = stream;
        remoteVideo.onloadedmetadata = () => {
          remoteVideo.play().catch((err) => {
            logDebug("Autoplay blocked, tap video to play");
            remoteVideo.setAttribute("controls", "true");
          });
        };
        updateStatus("Receiving video stream");
      }
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
      logDebug("Sent answer to Android");
    } else if (signal.candidate) {
      await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
      logDebug("ICE candidate added");
    }
  } catch (err) {
    logDebug(`Error in signal handler: ${err.message}`);
  }
});

socket.on("android-client-disconnected", () => {
  updateStatus("Android client disconnected");
  if (peer) {
    peer.close();
    peer = null;
  }
  remoteVideo.srcObject = null;
});

socket.on("error", (error) => {
  updateStatus(`Server error: ${error.message}`);
});

retryButton.addEventListener("click", reconnectSocket);

updateStatus("Connecting to server...");
logDebug("Web client initialized");
