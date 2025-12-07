/* ============================================================
   GLOBAL TRACK DATA (MATCHING YOUR MEDIA HOST)
   ============================================================ */

const TRACKS = [
  {
    title: "Toby’s Mix",
    artist: "CCC",
    duration: "58:24",
    src: "https://visionary-beignet-7d270e.netlify.app/audio/tobys_mix.mp3",
    cover: "https://visionary-beignet-7d270e.netlify.app/covers/cover_base.png"
  },
  {
    title: "Gold Hour Spritz",
    artist: "CCC",
    duration: "42:18",
    src: "https://visionary-beignet-7d270e.netlify.app/audio/gold_hour.mp3",
    cover: "https://visionary-beignet-7d270e.netlify.app/covers/cover_gold.png"
  },
  {
    title: "Midnight Chrome",
    artist: "Kartell",
    duration: "50:03",
    src: "https://visionary-beignet-7d270e.netlify.app/audio/midnight_chrome.mp3",
    cover: "https://visionary-beignet-7d270e.netlify.app/covers/cover_platinum.png"
  },
  {
    title: "Poolside Mirage",
    artist: "Solomun",
    duration: "63:54",
    src: "https://visionary-beignet-7d270e.netlify.app/audio/poolside.mp3",
    cover: "https://visionary-beignet-7d270e.netlify.app/covers/cover_pool.png"
  },
  {
    title: "Khruangbin Live",
    artist: "Khruangbin",
    duration: "55:22",
    src: "https://visionary-beignet-7d270e.netlify.app/audio/khruangbin.mp3",
    cover: "https://visionary-beignet-7d270e.netlify.app/covers/cover_khru.png"
  },
  {
    title: "Succession Beats",
    artist: "Jsco",
    duration: "39:40",
    src: "https://visionary-beignet-7d270e.netlify.app/audio/succession_beats.mp3",
    cover: "https://visionary-beignet-7d270e.netlify.app/covers/cover_succession.png"
  }
];


/* ============================================================
   ELEMENT HOOKS
   ============================================================ */

const vinylRow = document.getElementById("vinylRow");
const albumArt = document.getElementById("albumArt");
const turntablePlatter = document.getElementById("turntablePlatter");
const playerEq = document.getElementById("playerEq");

const audio = new Audio();
audio.volume = 0.8;

const timelineBar = document.getElementById("timeline-bar");
const timelineProgress = document.getElementById("timeline-progress");

const trackTitle = document.getElementById("track-title");
const trackArtist = document.getElementById("track-artist");
const trackDuration = document.getElementById("track-duration");
const timeCurrent = document.getElementById("time-current");
const timeRemaining = document.getElementById("time-remaining");
const dockTrack = document.getElementById("dockTrack");

const playBtn = document.getElementById("play-btn");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const volumeSlider = document.getElementById("volume-slider");

let currentTrackIndex = 0;


/* ============================================================
   LOAD TRACK
   ============================================================ */

function loadTrack(index) {
  const track = TRACKS[index];
  currentTrackIndex = index;

  audio.src = track.src;

  trackTitle.textContent = track.title;
  trackArtist.textContent = track.artist;
  trackDuration.textContent = track.duration;
  dockTrack.textContent = `${track.title} — ${track.artist}`;

  albumArt.innerHTML = `<img src="${track.cover}" class="album-logo" />`;

  document.querySelectorAll(".vinyl-item").forEach(btn =>
    btn.classList.remove("is-active")
  );
  document.querySelector(`[data-track-index="${index}"]`).classList.add("is-active");

  triggerVinylDrop();
}

function triggerVinylDrop() {
  albumArt.style.animation = "vinylDrop 0.6s ease-out";
  setTimeout(() => (albumArt.style.animation = ""), 700);
}

/* Vinyl drop animation injected into DOM */
const vinylDropKeyframes = document.createElement("style");
vinylDropKeyframes.innerHTML = `
@keyframes vinylDrop {
  0% { transform: translateY(-40px) scale(0.95); opacity: 0; }
  60% { transform: translateY(6px) scale(1.03); opacity: 1; }
  100% { transform: translateY(0) scale(1); }
}`;
document.head.appendChild(vinylDropKeyframes);


/* ============================================================
   PLAYBACK CONTROLS
   ============================================================ */

function playTrack() {
  audio.play();
  playBtn.textContent = "Pause";
  turntablePlatter.classList.add("is-playing");
  playerEq.classList.add("is-playing");
}

function pauseTrack() {
  audio.pause();
  playBtn.textContent = "Play";
  turntablePlatter.classList.remove("is-playing");
  playerEq.classList.remove("is-playing");
}

playBtn.addEventListener("click", () => {
  audio.paused ? playTrack() : pauseTrack();
});

prevBtn.addEventListener("click", () => {
  let i = currentTrackIndex - 1;
  if (i < 0) i = TRACKS.length - 1;
  loadTrack(i);
  playTrack();
});

nextBtn.addEventListener("click", () => {
  let i = (currentTrackIndex + 1) % TRACKS.length;
  loadTrack(i);
  playTrack();
});

volumeSlider.addEventListener("input", () => {
  audio.volume = volumeSlider.value;
});

/* Timeline update */
audio.addEventListener("timeupdate", () => {
  const progress = (audio.currentTime / audio.duration) * 100;
  timelineProgress.style.width = `${progress}%`;

  timeCurrent.textContent = formatTime(audio.currentTime);
  timeRemaining.textContent = `-${formatTime(audio.duration - audio.currentTime)}`;
});

/* Timeline click-to-scrub */
timelineBar.addEventListener("click", (e) => {
  const rect = timelineBar.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  audio.currentTime = percent * audio.duration;
});

/* Time formatting helper */
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}


/* ============================================================
   VINYL SHELF INTERACTION
   ============================================================ */

vinylRow.addEventListener("click", (e) => {
  const btn = e.target.closest(".vinyl-item");
  if (!btn) return;

  const index = Number(btn.dataset.trackIndex);
  loadTrack(index);
  playTrack();
});


/* ============================================================
   THEME SWITCHING
   ============================================================ */

document.querySelectorAll(".theme-pill").forEach(btn =>
  btn.addEventListener("click", () => {
    document.querySelectorAll(".theme-pill").forEach(b => b.classList.remove("is-active"));
    btn.classList.add("is-active");

    document.body.className = `theme-${btn.dataset.theme}`;
  })
);


/* ============================================================
   FLOATING HEADER
   ============================================================ */

const topNav = document.getElementById("topNav");
window.addEventListener("scroll", () => {
  if (window.scrollY > 200) topNav.classList.add("visible");
  else topNav.classList.remove("visible");
});


/* ============================================================
   BAR TV CONTROLS
   ============================================================ */

const tvVideo = document.getElementById("barTvVideo");
const tvChannelBtn = document.getElementById("tvChannelBtn");
const tvPlayBtn = document.getElementById("tvPlayBtn");
const tvMuteBtn = document.getElementById("tvMuteBtn");
const tvVolume = document.getElementById("tvVolume");

const TV_CHANNELS = [
  "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_01.mp4",
  "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_02.mp4",
  "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_03.mp4"
];

let currentChannel = 0;

tvChannelBtn.addEventListener("click", () => {
  currentChannel = (currentChannel + 1) % TV_CHANNELS.length;
  tvVideo.src = TV_CHANNELS[currentChannel];
  tvVideo.play();
});

tvPlayBtn.addEventListener("click", () => {
  if (tvVideo.paused) {
    tvVideo.play();
    tvPlayBtn.textContent = "Pause";
  } else {
    tvVideo.pause();
    tvPlayBtn.textContent = "Play";
  }
});

tvMuteBtn.addEventListener("click", () => {
  tvVideo.muted = !tvVideo.muted;
  tvMuteBtn.textContent = tvVideo.muted ? "Sound On" : "Sound Off";
});

tvVolume.addEventListener("input", () => {
  tvVideo.volume = tvVolume.value;
  if (tvVideo.volume > 0) tvVideo.muted = false;
});


/* ============================================================
   BAR BOT API
   ============================================================ */

const bartenderForm = document.getElementById("bartenderForm");
const bartenderInput = document.getElementById("bartenderInput");
const bartenderMessages = document.getElementById("bartenderMessages");

function addBotMessage(text) {
  bartenderMessages.innerHTML += `
    <div class="bartender-message">
      <div class="bartender-avatar"></div>
      <div class="bartender-text">${text}</div>
    </div>`;
  bartenderMessages.scrollTop = bartenderMessages.scrollHeight;
}

bartenderForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = bartenderInput.value.trim();
  if (!message) return;

  bartenderMessages.innerHTML += `
    <div class="bartender-message">
      <div class="bartender-text">${message}</div>
    </div>`;
  bartenderMessages.scrollTop = bartenderMessages.scrollHeight;

  bartenderInput.value = "";

  addBotMessage("Mixing that up…");

  const res = await fetch("/.netlify/functions/ccc-bartender", {
    method: "POST",
    body: JSON.stringify({ question: message, recipes: [] })
  });

  const data = await res.json();
  addBotMessage(data.answer || "I couldn't find a match for that.");
});


/* ============================================================
   INITIAL LOAD
   ============================================================ */

loadTrack(0);
