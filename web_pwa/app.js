// Lyrra Full Web PWA - Music Player & Listen Together Sync
const SUPABASE_URL = "https://jzcnbbbzvsogkqkxdztm.supabase.co";
const SUPABASE_KEY = "sb_publishable_enIYe3gEaqUcHp78L-VCFQ_K8G2dWtA";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Multi-instance Search & Stream API fallback list
const API_INSTANCES = [
  "https://api.piped.private.coffee",
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.tokhmi.xyz"
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

// Popular Tracks Data (with reliable iTunes fallback audio preview streams for Instant Play!)
const POPULAR_TRACKS = [
  {
    id: "hT_nvWreI6o",
    title: "Blinding Lights",
    artist: "The Weeknd",
    artwork: "https://i.ytimg.com/vi/hT_nvWreI6o/hqdefault.jpg",
    streamUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/4b/32/38/4b32386e-b6a8-a5b8-5b12-9c3f25c775ef/mzaf_16886470366472403662.plus.aac.p.m4a"
  },
  {
    id: "0V3wOYp214k",
    title: "Save Your Tears",
    artist: "The Weeknd",
    artwork: "https://i.ytimg.com/vi/0V3wOYp214k/hqdefault.jpg",
    streamUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/a3/37/10/a3371089-a9a3-5c79-e390-327c1a84f3e6/mzaf_14352777478051759600.plus.aac.p.m4a"
  },
  {
    id: "OPf0YbXqDm0",
    title: "Uptown Funk",
    artist: "Mark Ronson ft. Bruno Mars",
    artwork: "https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg",
    streamUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/ee/12/36/ee1236fb-893f-3619-7ebf-bc0c1d2e1c98/mzaf_3335275811776949987.plus.aac.p.m4a"
  },
  {
    id: "34Na4j8AVgA",
    title: "Starboy",
    artist: "The Weeknd ft. Daft Punk",
    artwork: "https://i.ytimg.com/vi/34Na4j8AVgA/hqdefault.jpg",
    streamUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/21/df/b5/21dfb5c4-0692-28df-29bb-132d72c1c3ae/mzaf_17296061329618174780.plus.aac.p.m4a"
  },
  {
    id: "fJ9rUzIMcZQ",
    title: "Bohemian Rhapsody",
    artist: "Queen",
    artwork: "https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg",
    streamUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/ce/68/eb/ce68eb2a-6058-29bf-bc49-383fb5ff52b8/mzaf_10344445831969448101.plus.aac.p.m4a"
  },
  {
    id: "kJQP7kiw5Fk",
    title: "Despacito",
    artist: "Luis Fonsi ft. Daddy Yankee",
    artwork: "https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg",
    streamUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/80/e5/22/80e52296-6e9f-7d13-68d7-56e6e22dfcfb/mzaf_17872658933230491873.plus.aac.p.m4a"
  }
];

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
  renderHomeGrid();
  setupNavigation();
  setupAudioPlayer();
  setupListenTogether();

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  }

  // iOS Safari Prompt
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
  if (isIOS && !isStandalone) {
    document.getElementById("ios-pwa-prompt").classList.remove("hidden");
  }
});

// Render Home Grid
function renderHomeGrid() {
  homeGrid.innerHTML = POPULAR_TRACKS.map(track => `
    <div class="track-card" onclick="playPopularTrack('${track.id}')">
      <img src="${track.artwork}" class="track-cover" alt="${escapeHtml(track.title)}" loading="lazy">
      <div class="track-card-title">${escapeHtml(track.title)}</div>
      <div class="track-card-artist">${escapeHtml(track.artist)}</div>
    </div>
  `).join("");
}

function playPopularTrack(id) {
  const track = POPULAR_TRACKS.find(t => t.id === id);
  if (!track) return;
  startAudioStream(track.id, track.title, track.artist, track.artwork, track.streamUrl);
}

// Navigation Tabs Setup
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

// Robust Music Search with iTunes + Piped API
async function performSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  searchResults.innerHTML = `<div class="empty-state">Searching for "${escapeHtml(query)}"...</div>`;

  try {
    // Search iTunes API first for guaranteed instant preview streams & artworks
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=15`);
    const data = await res.json();

    if (!data.results || data.results.length === 0) {
      searchResults.innerHTML = `<div class="empty-state">No songs found for "${escapeHtml(query)}"</div>`;
      return;
    }

    searchResults.innerHTML = data.results.map(item => `
      <div class="list-item" onclick="startAudioStream('${item.trackId}', '${escapeHtml(item.trackName)}', '${escapeHtml(item.artistName)}', '${item.artworkUrl100}', '${item.previewUrl}')">
        <img src="${item.artworkUrl100}" class="list-thumb" alt="art">
        <div class="list-info">
          <div class="track-card-title">${escapeHtml(item.trackName)}</div>
          <div class="track-card-artist">${escapeHtml(item.artistName)}</div>
        </div>
      </div>
    `).join("");
  } catch (err) {
    console.error("Search error:", err);
    searchResults.innerHTML = `<div class="empty-state">Search error. Please try again.</div>`;
  }
}

// Start Audio Stream
async function startAudioStream(id, title, artist, artwork, streamUrl, seekMs = 0) {
  currentTrack = { id, title, artist, artwork, streamUrl };

  playerTitle.textContent = title;
  playerArtist.textContent = artist;
  playerArt.src = artwork || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150";

  try {
    if (streamUrl) {
      audioElement.src = streamUrl;
    } else {
      // Fallback stream resolution
      audioElement.src = `https://pipedapi.kavin.rocks/streams/${id}`;
    }

    if (seekMs > 0) audioElement.currentTime = seekMs / 1000;

    await audioElement.play();
    isPlaying = true;
    btnPlayPause.textContent = "⏸";

    if (currentRole === "HOST") {
      broadcastHostState();
    }
  } catch (err) {
    console.error("Playback error:", err);
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
      source_id: currentTrack.id,
      stream_url: currentTrack.streamUrl || ""
    }
  });
}

function applySyncPayload(payload) {
  const trackId = payload.track_id;
  const isHostPlaying = payload.is_playing;
  const positionMs = payload.position_ms || 0;
  const streamUrl = payload.stream_url || "";

  if (!currentTrack || currentTrack.id !== trackId) {
    startAudioStream(trackId, payload.track_title, payload.track_artist, payload.track_image_url, streamUrl, positionMs);
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
