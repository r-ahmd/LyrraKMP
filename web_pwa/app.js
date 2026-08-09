// Lyrra PWA - InnerTube YouTube Music Engine & Supabase Realtime Sync
const SUPABASE_URL = "https://jzcnbbbzvsogkqkxdztm.supabase.co";
const SUPABASE_KEY = "sb_publishable_enIYe3gEaqUcHp78L-VCFQ_K8G2dWtA";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Reliable InnerTube / Invidious CORS Proxy Endpoints for Full Song Streams
const INVIDIOUS_NODES = [
  "https://invidious.nerdvpn.de",
  "https://inv.tux.pizza",
  "https://invidious.projectsegfau.lt"
];

// State
let currentTab = "tab-home";
let currentTrack = null;
let isPlaying = false;
let currentChannel = null;
let currentRole = null; // 'HOST' or 'LISTENER'
let currentRoomCode = "";

// DOM Elements
const navItems = document.querySelectorAll(".nav-item");
const tabPages = document.querySelectorAll(".tab-page");

const homeGrid = document.getElementById("home-grid");
const searchInput = document.getElementById("search-input");
const btnSearchTrigger = document.getElementById("btn-search-trigger");
const searchResults = document.getElementById("search-results");

const audioElement = document.getElementById("audio-element");
const playerArt = document.getElementById("player-art");
const playerTitle = document.getElementById("player-title");
const playerArtist = document.getElementById("player-artist");
const btnPlayPause = document.getElementById("btn-play-pause");

const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");

const togetherSetup = document.getElementById("together-setup");
const togetherActive = document.getElementById("together-active");
const btnCreateRoom = document.getElementById("btn-create-room");
const btnJoinRoom = document.getElementById("btn-join-room");
const btnLeaveRoom = document.getElementById("btn-leave-room");
const inputRoomCode = document.getElementById("input-room-code");
const displayRoomCode = document.getElementById("display-room-code");
const roomRoleBadge = document.getElementById("room-role-badge");
const presenceCount = document.getElementById("presence-count");

// Popular / Trending YouTube Music Tracks
const POPULAR_TRACKS = [
  {
    id: "hT_nvWreI6o",
    title: "Blinding Lights",
    artist: "The Weeknd",
    artwork: "https://i.ytimg.com/vi/hT_nvWreI6o/hqdefault.jpg"
  },
  {
    id: "0V3wOYp214k",
    title: "Save Your Tears",
    artist: "The Weeknd",
    artwork: "https://i.ytimg.com/vi/0V3wOYp214k/hqdefault.jpg"
  },
  {
    id: "OPf0YbXqDm0",
    title: "Uptown Funk",
    artist: "Mark Ronson ft. Bruno Mars",
    artwork: "https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg"
  },
  {
    id: "34Na4j8AVgA",
    title: "Starboy",
    artist: "The Weeknd ft. Daft Punk",
    artwork: "https://i.ytimg.com/vi/34Na4j8AVgA/hqdefault.jpg"
  },
  {
    id: "fJ9rUzIMcZQ",
    title: "Bohemian Rhapsody",
    artist: "Queen",
    artwork: "https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg"
  },
  {
    id: "kJQP7kiw5Fk",
    title: "Despacito",
    artist: "Luis Fonsi ft. Daddy Yankee",
    artwork: "https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg"
  }
];

// App Init
document.addEventListener("DOMContentLoaded", () => {
  renderHomeGrid();
  setupNavigation();
  setupAudioPlayer();
  setupListenTogether();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  }

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
  if (isIOS && !isStandalone) {
    document.getElementById("ios-pwa-prompt").classList.remove("hidden");
  }
});

function renderHomeGrid() {
  homeGrid.innerHTML = POPULAR_TRACKS.map(track => `
    <div class="track-card" onclick="playYouTubeTrack('${track.id}', '${escapeHtml(track.title)}', '${escapeHtml(track.artist)}', '${track.artwork}')">
      <img src="${track.artwork}" class="track-cover" alt="${escapeHtml(track.title)}" loading="lazy">
      <div class="track-card-title">${escapeHtml(track.title)}</div>
      <div class="track-card-artist">${escapeHtml(track.artist)}</div>
    </div>
  `).join("");
}

function setupNavigation() {
  navItems.forEach(item => {
    item.addEventListener("click", () => {
      const targetTab = item.getAttribute("data-tab");
      navItems.forEach(n => n.classList.remove("active"));
      tabPages.forEach(p => p.classList.add("hidden"));

      item.classList.add("active");
      document.getElementById(targetTab).classList.remove("hidden");
      currentTab = targetTab;
    });
  });

  btnSearchTrigger.addEventListener("click", performSearch);
  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") performSearch();
  });
}

// Search YouTube Music via InnerTube/Invidious Engine
async function performSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  searchResults.innerHTML = `<div class="empty-state">Searching YouTube Music for "${escapeHtml(query)}"...</div>`;

  let items = null;
  for (const node of INVIDIOUS_NODES) {
    try {
      const res = await fetch(`${node}/api/v1/search?q=${encodeURIComponent(query)}&type=video`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        items = data;
        break;
      }
    } catch (e) {
      console.warn("Node failed, trying next node:", node);
    }
  }

  if (!items) {
    searchResults.innerHTML = `<div class="empty-state">No songs found. Please try another search term.</div>`;
    return;
  }

  searchResults.innerHTML = items.slice(0, 15).map(item => {
    const art = item.videoThumbnails ? item.videoThumbnails[0].url : `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`;
    return `
      <div class="list-item" onclick="playYouTubeTrack('${item.videoId}', '${escapeHtml(item.title)}', '${escapeHtml(item.author)}', '${art}')">
        <img src="${art}" class="list-thumb" alt="art">
        <div class="list-info">
          <div class="track-card-title">${escapeHtml(item.title)}</div>
          <div class="track-card-artist">${escapeHtml(item.author)}</div>
        </div>
      </div>
    `;
  }).join("");
}

// Play Full YouTube Song Audio Stream
async function playYouTubeTrack(videoId, title, artist, artwork, seekMs = 0) {
  currentTrack = { id: videoId, title, artist, artwork };

  playerTitle.textContent = title;
  playerArtist.textContent = artist;
  playerArt.src = artwork || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  statusText.textContent = "Loading stream...";

  let audioUrl = null;
  for (const node of INVIDIOUS_NODES) {
    try {
      const res = await fetch(`${node}/api/v1/videos/${videoId}`);
      const data = await res.json();
      if (data.adaptiveFormats) {
        // Find best audio stream format (webm or m4a)
        const audioFormat = data.adaptiveFormats.find(f => f.type && f.type.startsWith("audio/"));
        if (audioFormat && audioFormat.url) {
          audioUrl = audioFormat.url;
          break;
        }
      }
    } catch (e) {
      console.warn("Stream resolution failed on node:", node);
    }
  }

  if (audioUrl) {
    audioElement.src = audioUrl;
    if (seekMs > 0) audioElement.currentTime = seekMs / 1000;

    try {
      await audioElement.play();
      isPlaying = true;
      btnPlayPause.textContent = "⏸";
      statusText.textContent = currentRole ? `Room ${currentRoomCode} (${currentRole})` : "Playing";

      if (currentRole === "HOST") {
        broadcastHostState();
      }
    } catch (err) {
      console.error("Audio play error:", err);
    }
  } else {
    alert("Unable to load full audio stream for this track. Try another song.");
  }
}

// Audio Player Controls
function setupAudioPlayer() {
  btnPlayPause.addEventListener("click", () => {
    if (!audioElement.src) return;

    if (isPlaying) {
      audioElement.pause();
      isPlaying = false;
      btnPlayPause.textContent = "▶";
    } else {
      audioElement.play();
      isPlaying = true;
      btnPlayPause.textContent = "⏸";
    }

    if (currentRole === "HOST") {
      broadcastHostState();
    }
  });

  audioElement.addEventListener("ended", () => {
    isPlaying = false;
    btnPlayPause.textContent = "▶";
    if (currentRole === "HOST") broadcastHostState();
  });
}

// Listen Together Realtime Sync
function setupListenTogether() {
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
}

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function joinSession(roomCode, role) {
  currentRoomCode = roomCode;
  currentRole = role;

  displayRoomCode.textContent = roomCode;
  roomRoleBadge.textContent = role;

  togetherSetup.classList.add("hidden");
  togetherActive.classList.remove("hidden");

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
        applySyncPayload(payload);
      }
    })
    .on('presence', { event: 'sync' }, () => {
      const state = currentChannel.presenceState();
      const count = Object.keys(state).length;
      presenceCount.textContent = `${count} member(s) connected`;
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        statusDot.classList.add("connected");
        statusText.textContent = `Room ${roomCode} (${role})`;
        
        currentChannel.track({
          user: role === "HOST" ? "Host (Web)" : "Listener (Web)",
          online_at: new Date().toISOString()
        });

        if (role === "HOST" && currentTrack) {
          broadcastHostState();
        }
      } else {
        statusDot.classList.remove("connected");
        statusText.textContent = "Connecting...";
      }
    });
}

function broadcastHostState() {
  if (!currentChannel || currentRole !== "HOST" || !currentTrack) return;

  currentChannel.send({
    type: 'broadcast',
    event: 'playback_sync',
    payload: {
      track_id: currentTrack.id,
      track_title: currentTrack.title,
      track_artist: currentTrack.artist,
      track_image_url: currentTrack.artwork || "",
      position_ms: Math.floor(audioElement.currentTime * 1000),
      is_playing: isPlaying,
      source_type: "yt",
      source_id: currentTrack.id
    }
  });
}

function applySyncPayload(payload) {
  const trackId = payload.track_id;
  const isHostPlaying = payload.is_playing;
  const positionMs = payload.position_ms || 0;

  if (!currentTrack || currentTrack.id !== trackId) {
    playYouTubeTrack(trackId, payload.track_title, payload.track_artist, payload.track_image_url, positionMs);
  } else {
    const localMs = audioElement.currentTime * 1000;
    if (Math.abs(localMs - positionMs) > 2000) {
      audioElement.currentTime = positionMs / 1000;
    }

    if (isHostPlaying && audioElement.paused) {
      audioElement.play();
      isPlaying = true;
      btnPlayPause.textContent = "⏸";
    } else if (!isHostPlaying && !audioElement.paused) {
      audioElement.pause();
      isPlaying = false;
      btnPlayPause.textContent = "▶";
    }
  }
}

function leaveSession() {
  if (currentChannel) {
    supabase.removeChannel(currentChannel);
    currentChannel = null;
  }

  currentRole = null;
  currentRoomCode = "";

  statusDot.classList.remove("connected");
  statusText.textContent = "Solo";

  togetherActive.classList.add("hidden");
  togetherSetup.classList.remove("hidden");
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
