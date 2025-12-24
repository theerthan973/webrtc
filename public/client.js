const SIGNALING_URL = "https://webrtc-syec.onrender.com";
const socket = io(SIGNALING_URL);

let peer;
let myId;
let androidId;

const remoteAudio = document.getElementById("remoteAudio");
const status = document.getElementById("status");

const rtcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

socket.on("connect", () => {
  status.textContent = "Connected";
});

socket.on("id", id => {
  myId = id;
  socket.emit("identify", "web");
});

socket.on("android-client-ready", id => {
  androidId = id;
  status.textContent = "Android connected";
});

document.getElementById("startBtn").onclick = () => {
  socket.emit("control", { to: androidId, action: "START_STREAM" });
};

socket.on("signal", async ({ from, signal }) => {
  if (!peer) {
    peer = new RTCPeerConnection(rtcConfig);
    peer.addTransceiver("audio", { direction: "recvonly" });

    peer.ontrack = e => {
      remoteAudio.srcObject = new MediaStream([e.track]);
      status.textContent = "Receiving audio";
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
  } else if (signal.candidate) {
    await peer.addIceCandidate(signal.candidate);
  }
});
