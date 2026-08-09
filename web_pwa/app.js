// Lyrra PWA - Web Client with Supabase Realtime Sync
const SUPABASE_URL = "https://jzcnbbbzvsogkqkxdztm.supabase.co";
const SUPABASE_KEY = "sb_publishable_enIYe3gEaqUcHp78L-VCFQ_K8G2dWtA";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentChannel = null;
let currentRole = null; // 'HOST' or 'LISTENER'
let currentRoomCode = "";
let isPlaying = false;

// DOM Elements
const screenSetup = document.getElementById("screen-setup");
const screenRoom = document.getElementById("screen-room");
const btnCreateRoom = document.getElementById("btn-create-room");
const btnJoinRoom = document.getElementById("btn-join-room");
const btnLeaveRoom = document.getElementById("btn-leave-room");
const inputRoomCode = document.getElementById("input-room-code");
const displayRoomCode = document.getElementById("display-room-code");
const roomRoleTitle = document.getElementById("room-role-title");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const trackTitle = document.getElementById("track-title");
const trackArtist = document.getElementById("track-artist");
const hostControls = document.getElementById("host-controls");
const btnPlayPause = document.getElementById("btn-play-pause");

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(console.error);
}

// Show iOS Install Prompt Banner if on iOS Safari
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
if (isIOS && !isStandalone) {
  document.getElementById("ios-pwa-prompt").classList.remove("hidden");
}

// Generate random 6-character room code matching RoomCodeGenerator.kt
function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Event Listeners
btnCreateRoom.addEventListener("click", () => {
  const code = generateRoomCode();
  joinSession(code, "HOST");
});

btnJoinRoom.addEventListener("click", () => {
  const code = inputRoomCode.value.trim().toUpperCase();
  if (code.length === 6) {
    joinSession(code, "LISTENER");
  } else {
    alert("Please enter a valid 6-character room code.");
  }
});

btnLeaveRoom.addEventListener("click", leaveSession);

btnPlayPause.addEventListener("click", () => {
  if (currentRole !== "HOST") return;
  isPlaying = !isPlaying;
  btnPlayPause.textContent = isPlaying ? "⏸" : "▶";
  broadcastHostState();
});

function joinSession(roomCode, role) {
  currentRoomCode = roomCode;
  currentRole = role;

  displayRoomCode.textContent = roomCode;
  roomRoleTitle.textContent = role === "HOST" ? "HOST SESSION" : "LISTENER SESSION";
  
  if (role === "HOST") {
    hostControls.classList.remove("hidden");
  } else {
    hostControls.classList.add("hidden");
  }

  screenSetup.classList.add("hidden");
  screenRoom.classList.remove("hidden");

  // Subscribe to Supabase Realtime channel
  const topic = `realtime:${roomCode}`;
  currentChannel = supabase.channel(topic, {
    config: {
      broadcast: { ack: false, self: false },
      presence: { key: role === "HOST" ? "Host (Web)" : "Listener (Web)" }
    }
  });

  currentChannel
    .on('broadcast', { event: 'playback_sync' }, ({ payload }) => {
      if (currentRole === "LISTENER") {
        updateListenerUI(payload);
      }
    })
    .on('presence', { event: 'sync' }, () => {
      const state = currentChannel.presenceState();
      console.log("Presence members:", state);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        statusDot.classList.add("connected");
        statusText.textContent = `Connected (${role})`;
        
        // Track presence
        currentChannel.track({
          user: role === "HOST" ? "Host (Web)" : "Listener (Web)",
          online_at: new Date().toISOString()
        });
      } else {
        statusDot.classList.remove("connected");
        statusText.textContent = "Connecting...";
      }
    });
}

function broadcastHostState() {
  if (!currentChannel || currentRole !== "HOST") return;

  currentChannel.send({
    type: 'broadcast',
    event: 'playback_sync',
    payload: {
      track_id: "web-track-1",
      track_title: "Lyrra Stream",
      track_artist: "Live Sync",
      position_ms: 0,
      is_playing: isPlaying,
      source_type: "web",
      source_id: ""
    }
  });

  trackTitle.textContent = isPlaying ? "Playing: Lyrra Stream" : "Paused: Lyrra Stream";
  trackArtist.textContent = "Syncing to listeners...";
}

function updateListenerUI(payload) {
  trackTitle.textContent = payload.track_title || "Lyrra Stream";
  trackArtist.textContent = payload.track_artist || "Host playing";
  isPlaying = payload.is_playing;
  
  statusText.textContent = isPlaying ? "Connected - Sync Playing 🎵" : "Connected - Paused ⏸";
}

function leaveSession() {
  if (currentChannel) {
    supabase.removeChannel(currentChannel);
    currentChannel = null;
  }

  currentRole = null;
  currentRoomCode = "";
  isPlaying = false;

  statusDot.classList.remove("connected");
  statusText.textContent = "Disconnected";

  screenRoom.classList.add("hidden");
  screenSetup.classList.remove("hidden");
}
