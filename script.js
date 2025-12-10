/* ==========================================================
   CCC — Virtual Bar Experience
   Full Functional Script.js
   ========================================================== */

/* ----------------------------------------------------------
   MEDIA PATHS
---------------------------------------------------------- */
const MEDIA_BASE = "https://visionary-beignet-7d270e.netlify.app";

const AUDIO_TRACKS = [
  {
    title: "Toby’s Mix",
    artist: "CCC",
    file: `${MEDIA_BASE}/audio/tobys-mix.mp3`,
    duration: "58:24"
  },
  {
    title: "Summer Mix",
    artist: "CCC",
    file: `${MEDIA_BASE}/audio/summer mix.mp3`,
    duration: "60:12"
  },
  {
    title: "Kartell Tribute",
    artist: "Roche Musique",
    file: `${MEDIA_BASE}/audio/kartell tribute set - roche musique.mp3`,
    duration: "52:18"
  },
  {
    title: "Solomun Boiler Room",
    artist: "Solomun",
    file: `${MEDIA_BASE}/audio/solomun boiler room dj set.mp3`,
    duration: "58:00"
  },
  {
    title: "Khruangbin Live",
    artist: "Pitchfork",
    file: `${MEDIA_BASE}/audio/khruangbin at villain _ pitchfork live.mp3`,
    duration: "47:42"
  },
  {
    title: "Succession Beats",
    artist: "JSCO",
    file: `${MEDIA_BASE}/audio/succession beats - jsco music .mp3`,
    duration: "55:50"
  }
];

const VIDEO_TAPES = [
  "bar_tape_01.mp4",
  "bar_tape_02.mp4",
  "bar_tape_03.mp4",
  "bar_tape_04.mp4",
  "bar_tape_05.mp4",
  "bar_tape_06.mp4",
  "bar_tape_07.mp4",
  "bar_tape_08.mp4",
  "bar_tape_09.mp4"
].map(file => `${MEDIA_BASE}/video/${file}`);

/* ----------------------------------------------------------
   DOM ELEMENTS
---------------------------------------------------------- */
const vinylItems = document.querySelectorAll(".vinyl-item");
const trackTitleEl = document.getElementById("track-title");
const trackArtistEl = document.getElementById("track-artist");
const trackDurationEl = document.getElementById("track-duration");
const dockTrackEl = document.getElementById("dockTrack");

const audio = new Audio();
audio.volume = 0.8;

const playBtn = document.getElementById("play-btn");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");

const timelineBar = document.getElementById("timeline-bar");
const timelineProgress = document.getElementById("timeline-progress");

const timeCurrent = document.getElementById("time-current");
const timeRemaining = document.getElementById("time-remaining");

const volumeSlider = document.getElementById("volume-slider");

const turntable = document.getElementById("turntablePlatter");
const eqBars = document.getElementById("playerEq");

const themeButtons = document.querySelectorAll(".theme-pill");

/* BAR TV */
const barTvVideo = document.getElementById("barTvVideo");
const tvChannelBtn = document.getElementById("tvChannelBtn");
const tvPlayBtn = document.getElementById("tvPlayBtn");
const tvMuteBtn = document.getElementById("tvMuteBtn");
const tvVolume = document.getElementById("tvVolume");

/* Bar Bot */
const bartenderForm = document.getElementById("bartenderForm");
const bartenderInput = document.getElementById("bartenderInput");
const bartenderMessages = document.getElementById("bartenderMessages");

/* Floating Header */
const topNav = document.getElementById("topNav");

/* ----------------------------------------------------------
   STATE
---------------------------------------------------------- */
let currentTrackIndex = 0;
let isPlaying = false;

/* ----------------------------------------------------------
   INITIALIZE
---------------------------------------------------------- */
if (vinylItems.length && trackTitleEl && trackArtistEl) {
  loadTrack(0);
}

/* ----------------------------------------------------------
   TRACK LOADING
---------------------------------------------------------- */
function loadTrack(index) {
  const track = AUDIO_TRACKS[index];
  if (!track) return;

  currentTrackIndex = index;
  audio.src = track.file;

  trackTitleEl.textContent = track.title;
  trackArtistEl.textContent = track.artist;
  trackDurationEl.textContent = track.duration;

  if (dockTrackEl) {
    dockTrackEl.textContent = `${track.title} — ${track.artist}`;
  }

  vinylItems.forEach(btn => btn.classList.remove("is-active"));
  if (vinylItems[index]) {
    vinylItems[index].classList.add("is-active");
  }
}

/* ----------------------------------------------------------
   PLAYBACK CONTROLS
---------------------------------------------------------- */
function playTrack() {
  audio
    .play()
    .then(() => {
      isPlaying = true;
      if (playBtn) playBtn.textContent = "Pause";
      if (turntable) turntable.classList.add("is-playing");
      if (eqBars) eqBars.classList.add("is-playing");
    })
    .catch(() => {
      // Autoplay block or error – leave UI as-is
    });
}

function pauseTrack() {
  audio.pause();
  isPlaying = false;
  if (playBtn) playBtn.textContent = "Play";
  if (turntable) turntable.classList.remove("is-playing");
  if (eqBars) eqBars.classList.remove("is-playing");
}

if (playBtn) {
  playBtn.addEventListener("click", () => {
    isPlaying ? pauseTrack() : playTrack();
  });
}

if (prevBtn) {
  prevBtn.addEventListener("click", () => {
    let index = currentTrackIndex - 1;
    if (index < 0) index = AUDIO_TRACKS.length - 1;
    loadTrack(index);
    playTrack();
  });
}

if (nextBtn) {
  nextBtn.addEventListener("click", () => {
    let index = (currentTrackIndex + 1) % AUDIO_TRACKS.length;
    loadTrack(index);
    playTrack();
  });
}

/* Vinyl selection */
vinylItems.forEach(btn => {
  btn.addEventListener("click", () => {
    const index = Number(btn.dataset.trackIndex);
    loadTrack(index);
    playTrack();
  });
});

/* ----------------------------------------------------------
   TIMELINE + PROGRESS
---------------------------------------------------------- */
audio.addEventListener("timeupdate", () => {
  if (!audio.duration || !timelineProgress) return;

  const pct = (audio.currentTime / audio.duration) * 100;
  timelineProgress.style.width = `${pct}%`;

  if (timeCurrent) timeCurrent.textContent = formatTime(audio.currentTime);
  if (timeRemaining) {
    timeRemaining.textContent = "-" + formatTime(audio.duration - audio.currentTime);
  }
});

if (timelineBar) {
  timelineBar.addEventListener("click", e => {
    if (!audio.duration) return;
    const rect = timelineBar.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * audio.duration;
  });
}

function formatTime(seconds) {
  if (!seconds || !Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

/* Volume */
if (volumeSlider) {
  volumeSlider.addEventListener("input", e => {
    audio.volume = Number(e.target.value);
  });
}

/* ----------------------------------------------------------
   THEME SWITCHING
---------------------------------------------------------- */
themeButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    themeButtons.forEach(b => b.classList.remove("is-active"));
    btn.classList.add("is-active");

    const theme = btn.dataset.theme || "base";
    document.body.className = `theme-${theme}`;
  });
});

/* ----------------------------------------------------------
   BAR TV — SHUFFLE / CONTROLS
---------------------------------------------------------- */
if (barTvVideo) {
  // Ensure default video is in list
  if (!barTvVideo.src) {
    barTvVideo.src = VIDEO_TAPES[0];
  }
}

if (tvChannelBtn && barTvVideo) {
  tvChannelBtn.addEventListener("click", () => {
    const random = Math.floor(Math.random() * VIDEO_TAPES.length);
    barTvVideo.src = VIDEO_TAPES[random];
    barTvVideo.play().catch(() => {});
  });
}

if (tvPlayBtn && barTvVideo) {
  tvPlayBtn.addEventListener("click", () => {
    if (barTvVideo.paused) {
      barTvVideo.play().catch(() => {});
      tvPlayBtn.textContent = "Pause";
    } else {
      barTvVideo.pause();
      tvPlayBtn.textContent = "Play";
    }
  });
}

if (tvMuteBtn && barTvVideo) {
  tvMuteBtn.addEventListener("click", () => {
    barTvVideo.muted = !barTvVideo.muted;
    tvMuteBtn.textContent = barTvVideo.muted ? "Sound On" : "Sound Off";
  });
}

if (tvVolume && barTvVideo) {
  tvVolume.addEventListener("input", e => {
    barTvVideo.volume = Number(e.target.value);
    if (barTvVideo.volume === 0) {
      barTvVideo.muted = true;
      tvMuteBtn && (tvMuteBtn.textContent = "Sound On");
    } else if (barTvVideo.muted) {
      barTvVideo.muted = false;
      tvMuteBtn && (tvMuteBtn.textContent = "Sound Off");
    }
  });
}

/* ----------------------------------------------------------
   FLOATING HEADER BEHAVIOR
---------------------------------------------------------- */
window.addEventListener("scroll", () => {
  if (!topNav) return;
  if (window.scrollY > 250) {
    topNav.classList.add("header-visible");
  } else {
    topNav.classList.remove("header-visible");
  }
});

/* ----------------------------------------------------------
   BAR BOT — NETLIFY FUNCTION
---------------------------------------------------------- */

if (bartenderForm && bartenderInput && bartenderMessages) {
  bartenderForm.addEventListener("submit", async e => {
    e.preventDefault();

    const text = bartenderInput.value.trim();
    if (!text) return;

    appendUserMessage(text);
    bartenderInput.value = "";
    appendTypingIndicator();

    try {
      const res = await fetch("/.netlify/functions/ccc-bartender", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text })
      });

      const data = await res.json();
      removeTypingIndicator();
      const answer =
        (data && data.answer) ||
        "I’m having trouble processing that, but we can try again.";
      appendBotMessage(answer);
    } catch (err) {
      removeTypingIndicator();
      appendBotMessage("Error reaching the back bar AI. Please try again in a moment.");
    }
  });
}

function appendUserMessage(text) {
  const msg = document.createElement("div");
  msg.className = "bartender-message bartender-user";

  const bubble = document.createElement("div");
  bubble.className = "bartender-text";
  bubble.textContent = text;

  msg.appendChild(bubble);
  bartenderMessages.appendChild(msg);
  scrollMessagesToBottom();
}

function appendBotMessage(text) {
  const msg = document.createElement("div");
  msg.className = "bartender-message bartender-bot";

  const avatar = document.createElement("div");
  avatar.className = "bartender-avatar";

  const bubble = document.createElement("div");
  bubble.className = "bartender-text";
  bubble.innerHTML = text.replace(/\n/g, "<br>");

  msg.appendChild(avatar);
  msg.appendChild(bubble);
  bartenderMessages.appendChild(msg);
  scrollMessagesToBottom();
}

function appendTypingIndicator() {
  const existing = bartenderMessages.querySelector(".bartender-typing");
  if (existing) return;

  const row = document.createElement("div");
  row.className = "bartender-message bartender-bot bartender-typing";

  const bubble = document.createElement("div");
  bubble.className = "bartender-text";
  bubble.textContent = "Bartender is thinking…";

  row.appendChild(bubble);
  bartenderMessages.appendChild(row);
  scrollMessagesToBottom();
}

function removeTypingIndicator() {
  const existing = bartenderMessages.querySelector(".bartender-typing");
  if (existing) existing.remove();
}

function scrollMessagesToBottom() {
  bartenderMessages.scrollTop = bartenderMessages.scrollHeight;
}
