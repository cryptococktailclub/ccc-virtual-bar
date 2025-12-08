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
   INITIALIZE FIRST TRACK
---------------------------------------------------------- */
loadTrack(0);

function loadTrack(index) {
  const track = AUDIO_TRACKS[index];
  currentTrackIndex = index;

  audio.src = track.file;

  trackTitleEl.textContent = track.title;
  trackArtistEl.textContent = track.artist;
  trackDurationEl.textContent = track.duration;

  dockTrackEl.textContent = `${track.title} — ${track.artist}`;

  vinylItems.forEach(btn => btn.classList.remove("is-active"));
  vinylItems[index].classList.add("is-active");
}

/* ----------------------------------------------------------
   PLAYBACK CONTROLS
---------------------------------------------------------- */
function playTrack() {
  audio.play();
  isPlaying = true;
  playBtn.textContent = "Pause";

  turntable.classList.add("is-playing");
  eqBars.classList.add("is-playing");
}

function pauseTrack() {
  audio.pause();
  isPlaying = false;
  playBtn.textContent = "Play";

  turntable.classList.remove("is-playing");
  eqBars.classList.remove("is-playing");
}

playBtn.onclick = () => (isPlaying ? pauseTrack() : playTrack());

prevBtn.onclick = () => {
  let index = currentTrackIndex - 1;
  if (index < 0) index = AUDIO_TRACKS.length - 1;
  loadTrack(index);
  playTrack();
};

nextBtn.onclick = () => {
  let index = (currentTrackIndex + 1) % AUDIO_TRACKS.length;
  loadTrack(index);
  playTrack();
};

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
audio.ontimeupdate = () => {
  const pct = (audio.currentTime / audio.duration) * 100;
  timelineProgress.style.width = `${pct}%`;

  timeCurrent.textContent = formatTime(audio.currentTime);
  timeRemaining.textContent = "-" + formatTime(audio.duration - audio.currentTime);
};

timelineBar.onclick = e => {
  const rect = timelineBar.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  audio.currentTime = pct * audio.duration;
};

/* Time formatting helper */
function formatTime(seconds) {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/* Volume */
volumeSlider.oninput = e => {
  audio.volume = Number(e.target.value);
};

/* ----------------------------------------------------------
   THEME SWITCHING
---------------------------------------------------------- */
themeButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    themeButtons.forEach(b => b.classList.remove("is-active"));
    btn.classList.add("is-active");

    document.body.className = `theme-${btn.dataset.theme}`;
  });
});

/* ----------------------------------------------------------
   BAR TV — RANDOM SHUFFLE MODE
---------------------------------------------------------- */
tvChannelBtn.onclick = () => {
  const random = Math.floor(Math.random() * VIDEO_TAPES.length);
  barTvVideo.src = VIDEO_TAPES[random];
  barTvVideo.play();
};

tvPlayBtn.onclick = () => {
  if (barTvVideo.paused) {
    barTvVideo.play();
    tvPlayBtn.textContent = "Pause";
  } else {
    barTvVideo.pause();
    tvPlayBtn.textContent = "Play";
  }
};

tvMuteBtn.onclick = () => {
  barTvVideo.muted = !barTvVideo.muted;
  tvMuteBtn.textContent = barTvVideo.muted ? "Sound On" : "Sound Off";
};

tvVolume.oninput = e => {
  barTvVideo.volume = Number(e.target.value);
};

/* ----------------------------------------------------------
   FLOATING HEADER BEHAVIOR
---------------------------------------------------------- */
window.addEventListener("scroll", () => {
  if (window.scrollY > 250) {
    topNav.classList.add("header-visible");
  } else {
    topNav.classList.remove("header-visible");
  }
});

/* ----------------------------------------------------------
   BAR BOT — NETLIFY FUNCTION
---------------------------------------------------------- */
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
    appendBotMessage(data.answer || "I’m having trouble processing that.");
  } catch (err) {
    removeTypingIndicator();
    appendBotMessage("Error reaching the back bar. Check the function logs.");
  }
});

/* Chat render helpers */
function appendUserMessage(text) {
  bartenderMessages.innerHTML += `
    <div class="bartender-message bartender-user">
      <div class="bartender-text-user">${text}</div>
    </div>
  `;
  bartenderMessages.scrollTop = bartenderMessages.scrollHeight;
}

function appendBotMessage(text) {
  bartenderMessages.innerHTML += `
    <div class="bartender-message bartender-bot">
      <div class="bartender-avatar"></div>
      <div class="bartender-text">${text}</div>
    </div>
  `;
  bartenderMessages.scrollTop = bartenderMessages.scrollHeight;
}

function appendTypingIndicator() {
  bartenderMessages.innerHTML += `
    <div class="typing" id="typingIndicator">Bar Bot is mixing…</div>
  `;
}

function removeTypingIndicator() {
  const el = document.getElementById("typingIndicator");
  if (el) el.remove();
}
