// Lyrra Full Web PWA - Music Player & Listen Together Sync
const SUPABASE_URL = "https://jzcnbbbzvsogkqkxdztm.supabase.co";
const SUPABASE_KEY = "sb_publishable_enIYe3gEaqUcHp78L-VCFQ_K8G2dWtA";

let supabase = null;
if (window.supabase) {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Invidious / Piped API Nodes
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
let currentRole = null;
let currentRoomCode = "";

// Popular Tracks Data
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

// DOM Load
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
    const prompt = document.getElementById("ios-pwa-prompt");
    if (prompt) prompt.classList.remove("hidden");
  }
});

// Render Home Grid
function renderHomeGrid() {
  const homeGrid = document.getElementById("home-grid");
  if (!homeGrid) return;

  homeGrid.innerHTML = POPULAR_TRACKS.map(track => `
    <div class="track-card" data-id="${track.id}">
      <img src="${track.artwork}" class="track-cover" alt="${escapeHtml(track.title)}" loading="lazy">
      <div class="track-card-title">${escapeHtml(track.title)}</div>
      <div class="track-card-artist">${escapeHtml(track.artist)}</div>
    </div>
  `).join("");

  homeGrid.querySelectorAll(".track-card").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.getAttribute("data-id");
      const track = POPULAR_TRACKS.find(t => t.id === id);
      if (track) {
        window.playYouTubeTrack(track.id, track.title, track.artist, track.artwork);
      }
    });
  });
}

// Navigation Tabs Setup
function setupNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  const tabPages = document.querySelectorAll(".tab-page");

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      const targetTab = item.getAttribute("data-tab");
      navItems.forEach(n => n.classList.remove("active"));
      tabPages.forEach(p => p.classList.add("hidden"));

      item.classList.add("active");
      const page = document.getElementById(targetTab);
      if (page) page.classList.remove("hidden");
      currentTab = targetTab;
    });
  });

  const btnSearchTrigger = document.getElementById("btn-search-trigger");
  const searchInput = document.getElementById("search-input");

  if (btnSearchTrigger) {
    btnSearchTrigger.addEventListener("click", performSearch);
  }
  if (searchInput) {
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") performSearch();
    });
  }
}

// Search YouTube Music via Invidious / iTunes
async function performSearch() {
  const searchInput = document.getElementById("search-input");
  const searchResults = document.getElementById("search-results");
  if (!searchInput || !searchResults) return;

  const query = searchInput.value.trim();
  if (!query) return;

  searchResults.innerHTML = `<div class="empty-state">Searching for "${escapeHtml(query)}"...</div>`;

  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=15`);
    const data = await res.json();

    if (!data.results || data.results.length === 0) {
      searchResults.innerHTML = `<div class="empty-state">No songs found for "${escapeHtml(query)}"</div>`;
      return;
    }

    searchResults.innerHTML = data.results.map(item => `
      <div class="list-item" data-id="${item.trackId}" data-title="${escapeHtml(item.trackName)}" data-artist="${escapeHtml(item.artistName)}" data-art="${item.artworkUrl100}" data-preview="${item.previewUrl}">
        <img src="${item.artworkUrl100}" class="list-thumb" alt="art">
        <div class="list-info">
          <div class="track-card-title">${escapeHtml(item.trackName)}</div>
          <div class="track-card-artist">${escapeHtml(item.artistName)}</div>
        </div>
      </div>
    `).join("");

    searchResults.querySelectorAll(".list-item").forEach(item => {
      item.addEventListener("click", () => {
        const id = item.getAttribute("data-id");
        const title = item.getAttribute("data-title");
        const artist = item.getAttribute("data-artist");
        const art = item.getAttribute("data-art");
        const preview = item.getAttribute("data-preview");
        window.playYouTubeTrack(id, title, artist, art, 0, preview);
      });
    });
  } catch (err) {
    console.error("Search error:", err);
    searchResults.innerHTML = `<div class="empty-state">Search error. Please try again.</div>`;
  }
}

// Global Play Function
window.playYouTubeTrack = async function(videoId, title, artist, artwork, seekMs = 0, previewUrl = null) {
  currentTrack = { id: videoId, title, artist, artwork };

  const playerTitle = document.getElementById("player-title");
  const playerArtist = document.getElementById("player-artist");
  const playerArt = document.getElementById("player-art");
  const audioElement = document.getElementById("audio-element");
  const btnPlayPause = document.getElementById("btn-play-pause");
  const statusText = document.getElementById("status-text");

  if (playerTitle) playerTitle.textContent = title;
  if (playerArtist) playerArtist.textContent = artist;
  if (playerArt) playerArt.src = artwork || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150";

  if (statusText) statusText.textContent = "Loading stream...";

  let audioUrl = previewUrl;

  if (!audioUrl) {
    for (const node of INVIDIOUS_NODES) {
      try {
        const res = await fetch(`${node}/api/v1/videos/${videoId}`);
        const data = await res.json();
        if (data.adaptiveFormats) {
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
  }

  if (audioUrl && audioElement) {
    audioElement.src = audioUrl;
    if (seekMs > 0) audioElement.currentTime = seekMs / 1000;

    try {
      await audioElement.play();
      isPlaying = true;
      if (btnPlayPause) btnPlayPause.textContent = "⏸";
      if (statusText) statusText.textContent = currentRole ? `Room ${currentRoomCode} (${currentRole})` : "Playing";

      if (currentRole === "HOST") {
        broadcastHostState();
      }
    } catch (err) {
      console.error("Audio play error:", err);
    }
  }
};

// Audio Controls
function setupAudioPlayer() {
  const btnPlayPause = document.getElementById("btn-play-pause");
  const audioElement = document.getElementById("audio-element");

  if (btnPlayPause && audioElement) {
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
}

// Listen Together Realtime Sync
function setupListenTogether() {
  const btnCreateRoom = document.getElementById("btn-create-room");
  const btnJoinRoom = document.getElementById("btn-join-room");
  const btnLeaveRoom = document.getElementById("btn-leave-room");
  const inputRoomCode = document.getElementById("input-room-code");

  if (btnCreateRoom) {
    btnCreateRoom.addEventListener("click", () => {
      const code = generateRoomCode();
      joinSession(code, "HOST");
    });
  }

  if (btnJoinRoom && inputRoomCode) {
    btnJoinRoom.addEventListener("click", () => {
      const code = inputRoomCode.value.trim().toUpperCase();
      if (code.length === 6) {
        joinSession(code, "LISTENER");
      } else {
        alert("Please enter a valid 6-character room code.");
      }
    });
  }

  if (btnLeaveRoom) {
    btnLeaveRoom.addEventListener("click", leaveSession);
  }
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

  const displayRoomCode = document.getElementById("display-room-code");
  const roomRoleBadge = document.getElementById("room-role-badge");
  const togetherSetup = document.getElementById("together-setup");
  const togetherActive = document.getElementById("together-active");
  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");

  if (displayRoomCode) displayRoomCode.textContent = roomCode;
  if (roomRoleBadge) roomRoleBadge.textContent = role;

  if (togetherSetup) togetherSetup.classList.add("hidden");
  if (togetherActive) togetherActive.classList.remove("hidden");

  if (!supabase) return;

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
      const presenceCount = document.getElementById("presence-count");
      if (presenceCount) presenceCount.textContent = `${count} member(s) connected`;
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        if (statusDot) statusDot.classList.add("connected");
        if (statusText) statusText.textContent = `Room ${roomCode} (${role})`;
        
        currentChannel.track({
          user: role === "HOST" ? "Host (Web)" : "Listener (Web)",
          online_at: new Date().toISOString()
        });

        if (role === "HOST" && currentTrack) {
          broadcastHostState();
        }
      } else {
        if (statusDot) statusDot.classList.remove("connected");
        if (statusText) statusText.textContent = "Connecting...";
      }
    });
}

function broadcastHostState() {
  if (!currentChannel || currentRole !== "HOST" || !currentTrack) return;
  const audioElement = document.getElementById("audio-element");

  currentChannel.send({
    type: 'broadcast',
    event: 'playback_sync',
    payload: {
      track_id: currentTrack.id,
      track_title: currentTrack.title,
      track_artist: currentTrack.artist,
      track_image_url: currentTrack.artwork || "",
      position_ms: audioElement ? Math.floor(audioElement.currentTime * 1000) : 0,
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
  const audioElement = document.getElementById("audio-element");
  const btnPlayPause = document.getElementById("btn-play-pause");

  if (!currentTrack || currentTrack.id !== trackId) {
    window.playYouTubeTrack(trackId, payload.track_title, payload.track_artist, payload.track_image_url, positionMs);
  } else if (audioElement) {
    const localMs = audioElement.currentTime * 1000;
    if (Math.abs(localMs - positionMs) > 2000) {
      audioElement.currentTime = positionMs / 1000;
    }

    if (isHostPlaying && audioElement.paused) {
      audioElement.play();
      isPlaying = true;
      if (btnPlayPause) btnPlayPause.textContent = "⏸";
    } else if (!isHostPlaying && !audioElement.paused) {
      audioElement.pause();
      isPlaying = false;
      if (btnPlayPause) btnPlayPause.textContent = "▶";
    }
  }
}

function leaveSession() {
  if (currentChannel && supabase) {
    supabase.removeChannel(currentChannel);
    currentChannel = null;
  }

  currentRole = null;
  currentRoomCode = "";

  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");
  const togetherActive = document.getElementById("together-active");
  const togetherSetup = document.getElementById("together-setup");

  if (statusDot) statusDot.classList.remove("connected");
  if (statusText) statusText.textContent = "Solo";

  if (togetherActive) togetherActive.classList.add("hidden");
  if (togetherSetup) togetherSetup.classList.remove("hidden");
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
