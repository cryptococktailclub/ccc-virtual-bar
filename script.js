/* ============================================================
   CONFIG — MEDIA PATHS
============================================================ */

const MEDIA_BASE = "https://visionary-beignet-7d270e.netlify.app";

/* LISTENING ROOM PLAYLISTS */
const PLAYLISTS = [
  {
    title: "Analog Neon",
    artist: "Toby",
    duration: "58:24",
    src: `${MEDIA_BASE}/audio/analog_neon.mp3`
  },
  {
    title: "Gold Hour Spritz",
    artist: "CCC DJ",
    duration: "49:10",
    src: `${MEDIA_BASE}/audio/gold_hour_spritz.mp3`
  },
  {
    title: "Midnight Chrome",
    artist: "Kartell Tribute",
    duration: "61:02",
    src: `${MEDIA_BASE}/audio/midnight_chrome.mp3`
  },
  {
    title: "Poolside Mirage",
    artist: "Solomun",
    duration: "55:40",
    src: `${MEDIA_BASE}/audio/poolside_mirage.mp3`
  },
  {
    title: "Khruangbin Live",
    artist: "Pitchfork Live",
    duration: "44:32",
    src: `${MEDIA_BASE}/audio/Khruangbin at Villain _ Pitchfork Live.mp3`
  },
  {
    title: "Succession Beats",
    artist: "Jsco Music",
    duration: "39:21",
    src: `${MEDIA_BASE}/audio/Succession Beats - Jsco Music .mp3`
  }
];

/* BAR TV VIDEO ARCHIVE */
const BAR_TV_VIDEOS = [
  `${MEDIA_BASE}/video/bar_tape_01.mp4`,
  `${MEDIA_BASE}/video/bar_tape_02.mp4`,
  `${MEDIA_BASE}/video/bar_tape_03.mp4`,
  `${MEDIA_BASE}/video/bar_tape_04.mp4`,
  `${MEDIA_BASE}/video/bar_tape_05.mp4`,
  `${MEDIA_BASE}/video/bar_tape_06.mp4`,
  `${MEDIA_BASE}/video/bar_tape_07.mp4`,
  `${MEDIA_BASE}/video/bar_tape_08.mp4`,
  `${MEDIA_BASE}/video/bar_tape_09.mp4`
];


/* ============================================================
   HERO SCROLL HEADER
============================================================ */

const topNav = document.querySelector(".top-nav");

window.addEventListener("scroll", () => {
  if (window.scrollY > 160) {
    topNav.classList.add("visible");
  } else {
    topNav.classList.remove("visible");
  }
});


/* ============================================================
   BAR TV LOGIC
============================================================ */

const barTvVideo = document.getElementById("barTvVideo");
const barTvChannelBtn = document.getElementById("barTvChannelBtn");
const barTvPlayBtn = document.getElementById("barTvPlayBtn");
const barTvMuteBtn = document.getElementById("barTvMuteBtn");
const barTvVolume = document.getElementById("barTvVolume");

let barTvIndex = 0;

function loadBarTvVideo(index) {
  barTvVideo.src = BAR_TV_VIDEOS[index];
  barTvVideo.play();
}

barTvChannelBtn?.addEventListener("click", () => {
  barTvIndex = (barTvIndex + 1) % BAR_TV_VIDEOS.length;
  loadBarTvVideo(barTvIndex);
});

barTvPlayBtn?.addEventListener("click", () => {
  if (barTvVideo.paused) {
    barTvVideo.play();
    barTvPlayBtn.textContent = "⏸";
  } else {
    barTvVideo.pause();
    barTvPlayBtn.textContent = "▶";
  }
});

barTvMuteBtn?.addEventListener("click", () => {
  barTvVideo.muted = !barTvVideo.muted;
  barTvMuteBtn.textContent = barTvVideo.muted ? "Sound: Off" : "Sound: On";
});

barTvVolume?.addEventListener("input", (e) => {
  barTvVideo.volume = e.target.value;
});

// Initialize TV on load
loadBarTvVideo(0);


/* ============================================================
   VINYL SHELF → LISTENING ROOM ENGINE
============================================================ */

const vinylItems = document.querySelectorAll(".vinyl-item");
const audio = document.getElementById("bar-audio");
const trackTitle = document.getElementById("track-title");
const trackArtist = document.getElementById("track-artist");
const trackDuration = document.getElementById("track-duration");
const timelineBar = document.getElementById("timeline-bar");
const timelineProgress = document.getElementById("timeline-progress");
const timeCurrent = document.getElementById("time-current");
const timeRemaining = document.getElementById("time-remaining");
const playBtn = document.getElementById("play-btn");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const turntablePlatter = document.getElementById("turntablePlatter");
const albumArt = document.getElementById("albumArt");
const dockTrack = document.getElementById("dockTrack");

let currentTrack = 0;

function loadTrack(index) {
  const track = PLAYLISTS[index];

  audio.src = track.src;
  trackTitle.textContent = track.title;
  trackArtist.textContent = track.artist;
  trackDuration.textContent = track.duration;
  dockTrack.textContent = `${track.title} — ${track.artist}`;

  // Vinyl landing animation
  albumArt.style.animation = "vinylLand 0.8s ease";

  setTimeout(() => {
    albumArt.style.animation = "";
  }, 900);

  audio.play();
  playBtn.textContent = "Pause";
  turntablePlatter.classList.add("is-playing");
}

vinylItems.forEach((item) => {
  item.addEventListener("click", () => {
    const index = parseInt(item.dataset.trackIndex);
    currentTrack = index;
    loadTrack(currentTrack);

    vinylItems.forEach((v) => v.classList.remove("is-active"));
    item.classList.add("is-active");
  });
});

playBtn?.addEventListener("click", () => {
  if (audio.paused) {
    audio.play();
    playBtn.textContent = "Pause";
    turntablePlatter.classList.add("is-playing");
  } else {
    audio.pause();
    playBtn.textContent = "Play";
    turntablePlatter.classList.remove("is-playing");
  }
});

nextBtn?.addEventListener("click", () => {
  currentTrack = (currentTrack + 1) % PLAYLISTS.length;
  loadTrack(currentTrack);
});

prevBtn?.addEventListener("click", () => {
  currentTrack = (currentTrack - 1 + PLAYLISTS.length) % PLAYLISTS.length;
  loadTrack(currentTrack);
});

/* Timeline updates */
audio?.addEventListener("timeupdate", () => {
  if (!timelineBar) return;

  const progress = (audio.currentTime / audio.duration) * 100;
  timelineProgress.style.width = `${progress}%`;

  const current = Math.floor(audio.currentTime);
  const remain = Math.floor(audio.duration - audio.currentTime);

  timeCurrent.textContent = formatTime(current);
  timeRemaining.textContent = `-${formatTime(remain)}`;
});

function formatTime(sec) {
  if (!sec || isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}


/* ============================================================
   BAR BOT — AI BARTENDER
============================================================ */

const bartenderForm = document.getElementById("bartenderForm");
const bartenderInput = document.getElementById("bartenderInput");
const bartenderMessages = document.getElementById("bartenderMessages");

function appendBotMessage(text) {
  const msg = document.createElement("div");
  msg.className = "bartender-message bartender-message-bot";
  msg.innerHTML = `<div class="bartender-message-body">${text}</div>`;
  bartenderMessages.appendChild(msg);
  bartenderMessages.scrollTop = bartenderMessages.scrollHeight;
}

function appendUserMessage(text) {
  const msg = document.createElement("div");
  msg.className = "bartender-message bartender-message-user";
  msg.innerHTML = `<div class="bartender-message-body">${text}</div>`;
  bartenderMessages.appendChild(msg);
  bartenderMessages.scrollTop = bartenderMessages.scrollHeight;
}

bartenderForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userText = bartenderInput.value.trim();
  if (!userText) return;

  appendUserMessage(userText);
  bartenderInput.value = "";

  // Typing indicator
  appendBotMessage("<em>typing...</em>");

  const response = await fetch("/.netlify/functions/ccc-bartender", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: userText,
      recipes: [] // (optional dataset — you removed local DB)
    })
  });

  bartenderMessages.removeChild(bartenderMessages.lastChild);

  const data = await response.json();
  appendBotMessage(data.answer || "Sorry, I'm having trouble mixing that one.");
});


/* ============================================================
   END
============================================================ */
console.log("CCC Virtual Bar Experience JS Loaded.");
