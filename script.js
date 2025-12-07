/* ======================================================
   GLOBAL ELEMENT HELPERS
   ====================================================== */
const qs = (s) => document.querySelector(s);
const qsa = (s) => document.querySelectorAll(s);

/* ======================================================
   FLOATING NAV ON SCROLL
   ====================================================== */
const topNav = qs(".top-nav");

window.addEventListener("scroll", () => {
  if (window.scrollY > window.innerHeight * 0.65) {
    topNav.classList.add("visible");
  } else {
    topNav.classList.remove("visible");
  }
});

/* ======================================================
   VINYL SHELF → LISTENING ROOM
   ====================================================== */

// --- Vinyl Data ---
// You can extend this easily.
const albums = [
  {
    id: "album1",
    title: "NYC Loft Classics",
    artist: "Crypto Cocktail Club",
    track: "Loft Intro",
    duration: 198,
    cover: "https://visionary-beignet-7d270e.netlify.app/album1.png",
    audio: "https://visionary-beignet-7d270e.netlify.app/audio1.mp3",
  },
  {
    id: "album2",
    title: "Midnight Pour",
    artist: "CCC Hi-Fi",
    track: "Stirred Not Shaken",
    duration: 214,
    cover: "https://visionary-beignet-7d270e.netlify.app/album2.png",
    audio: "https://visionary-beignet-7d270e.netlify.app/audio2.mp3",
  }
];

let currentAlbum = null;

const vinylItems = qsa(".vinyl-item");
const albumArt = qs(".album-art");
const albumLogo = qs(".album-logo");
const platter = qs(".turntable-platter");
const eqBars = qsa(".eq-bar");
const trackTitle = qs("#track-title");
const trackArtist = qs("#track-artist");
const trackDurationLabel = qs(".track-duration");
const timelineProgress = qs(".timeline-progress");
const audio = new Audio();
let isPlaying = false;
let timelineInterval = null;

/* ======================================================
   SELECT VINYL
   ====================================================== */
vinylItems.forEach((item) => {
  item.addEventListener("click", () => {
    const albumId = item.dataset.album;
    const album = albums.find((a) => a.id === albumId);
    if (!album) return;

    // Activate UI
    vinylItems.forEach((v) => v.classList.remove("is-active"));
    item.classList.add("is-active");

    // Set album
    currentAlbum = album;

    // Set cover art
    albumLogo.src = album.cover;

    // Vinyl landing animation
    albumArt.style.animation = "vinylLand 0.8s ease-out";

    setTimeout(() => {
      albumArt.style.animation = "";
    }, 900);

    // Load audio
    audio.src = album.audio;
    audio.currentTime = 0;

    // Update labels
    trackTitle.textContent = album.title;
    trackArtist.textContent = album.artist;
    trackDurationLabel.textContent = formatTime(album.duration);

    // Auto-play new selection
    startPlayback();
  });
});

/* ======================================================
   PLAYER CONTROLS
   ====================================================== */
qs(".play-btn").addEventListener("click", () => {
  if (!currentAlbum) return;
  isPlaying ? pausePlayback() : startPlayback();
});

qs("#volume-slider").addEventListener("input", (e) => {
  audio.volume = e.target.value;
});

/* ======================================================
   PLAYBACK FUNCTIONS
   ====================================================== */
function startPlayback() {
  isPlaying = true;
  audio.play();

  platter.classList.add("is-playing");
  qs(".player-eq").classList.add("is-playing");

  if (timelineInterval) clearInterval(timelineInterval);
  timelineInterval = setInterval(updateTimeline, 200);
}

function pausePlayback() {
  isPlaying = false;
  audio.pause();

  platter.classList.remove("is-playing");
  qs(".player-eq").classList.remove("is-playing");

  if (timelineInterval) clearInterval(timelineInterval);
}

function updateTimeline() {
  if (!currentAlbum) return;

  const pct = (audio.currentTime / currentAlbum.duration) * 100;
  timelineProgress.style.width = pct + "%";

  if (pct >= 100) pausePlayback();
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/* ======================================================
   BAR BOT — AI BARTENDER
   ====================================================== */
const bartenderMessages = qs(".bartender-messages");
const bartenderInput = qs(".bartender-input");
const bartenderForm = qs(".bartender-form");

bartenderForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userText = bartenderInput.value.trim();
  if (!userText) return;

  addBartenderMessage("user", userText);
  bartenderInput.value = "";

  addTypingIndicator();

  // Call Netlify function
  const res = await fetch("/.netlify/functions/ccc-bartender", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: userText,
      recipes: [] // You can add filtered Milk & Honey data here
    })
  });

  removeTypingIndicator();

  const data = await res.json();
  addBartenderMessage("bot", data.answer || "I’m here behind the bar if you need anything.");
});

function addBartenderMessage(who, text) {
  const div = document.createElement("div");
  div.className = "bartender-message";

  div.innerHTML = `
    <div class="bartender-avatar"></div>
    <div class="bartender-text">${text.replace(/\n/g, "<br>")}</div>
  `;

  bartenderMessages.appendChild(div);
  bartenderMessages.scrollTop = bartenderMessages.scrollHeight;
}

function addTypingIndicator() {
  const div = document.createElement("div");
  div.className = "bartender-message typing";
  div.innerHTML = `
    <div class="bartender-avatar"></div>
    <div class="bartender-text"><em>typing...</em></div>
  `;
  bartenderMessages.appendChild(div);
}

function removeTypingIndicator() {
  const typingNode = qs(".bartender-message.typing");
  if (typingNode) typingNode.remove();
}

/* ======================================================
   BAR TV — VIDEO PLAYER (4×3)
   ====================================================== */
const barTV = qs(".bar-tv-aspect video");
const btnPlay = qs("#tv-play");
const btnMute = qs("#tv-mute");
const btnChannel = qs("#tv-channel");

let channels = [
  "https://visionary-beignet-7d270e.netlify.app/bar1.mp4",
  "https://visionary-beignet-7d270e.netlify.app/bar2.mp4",
  "https://visionary-beignet-7d270e.netlify.app/bar3.mp4"
];

let currentChannel = 0;

btnPlay.addEventListener("click", () => {
  if (barTV.paused) {
    barTV.play();
    btnPlay.textContent = "Pause";
  } else {
    barTV.pause();
    btnPlay.textContent = "Play";
  }
});

btnMute.addEventListener("click", () => {
  barTV.muted = !barTV.muted;
  btnMute.textContent = barTV.muted ? "Unmute" : "Mute";
});

btnChannel.addEventListener("click", () => {
  currentChannel = (currentChannel + 1) % channels.length;
  barTV.src = channels[currentChannel];
  barTV.play();
  btnPlay.textContent = "Pause";
});

/* ======================================================
   THEME SWITCHING (Listening Room)
   ====================================================== */
qsa(".theme-pill").forEach((btn) => {
  btn.addEventListener("click", () => {
    qsa(".theme-pill").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");

    const theme = btn.dataset.theme;
    document.body.className = "";
    document.body.classList.add(`theme-${theme}`);
  });
});
