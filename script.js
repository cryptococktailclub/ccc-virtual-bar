/* ============================================================
   CRYPTO COCKTAIL CLUB — Virtual Bar Experience
   script.js v5 — Full Audio + Animation Engine
============================================================ */


/* ------------------------------------------------------------
   ELEMENT HOOKS
------------------------------------------------------------ */
const audioEl = document.getElementById("bar-audio");
const trackTitle = document.getElementById("track-title");
const trackArtist = document.getElementById("track-artist");

const timelineBar   = document.getElementById("timeline-bar");
const timelineProg  = document.getElementById("timeline-progress");
const timeCurrent   = document.getElementById("time-current");
const timeRemaining = document.getElementById("time-remaining");

const playBtn = document.getElementById("play-btn");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const volumeSlider = document.getElementById("volume-slider");

const platter = document.getElementById("turntablePlatter");
const tonearm = document.getElementById("tonearm");
const eqBars = document.querySelectorAll(".eq-bar");

const albumArt = document.getElementById("albumArt");

const vinylItems = document.querySelectorAll(".vinyl-item");

const barTvVideo = document.getElementById("barTvVideo");
const barTvChannelBtn = document.getElementById("barTvChannelBtn");
const barTvPlayBtn = document.getElementById("barTvPlayBtn");
const barTvMuteBtn = document.getElementById("barTvMuteBtn");
const barTvFrame = document.querySelector(".bar-tv-frame");

const bartenderForm = document.getElementById("bartenderForm");
const bartenderInput = document.getElementById("bartenderInput");
const bartenderMessages = document.getElementById("bartenderMessages");

const guestbookForm = document.getElementById("guestbookForm");
const guestbookList = document.getElementById("guestbookList");
const guestName = document.getElementById("guestName");
const guestNote = document.getElementById("guestNote");

const stickyNav = document.getElementById("stickyNav");

const mobileNavButton = document.getElementById("mobileNavButton");
const mobileDrawer = document.getElementById("mobileDrawer");
const mobileBackdrop = document.getElementById("mobileBackdrop");
const mobileClose = document.getElementById("mobileClose");

const dockTrack = document.getElementById("dockTrack");


/* ============================================================
   PLAYLISTS (Hosted Media URLs)
============================================================ */
const playlists = [
  {
    title: "Toby’s Mix",
    artist: "Toby",
    url: "https://visionary-beignet-7d270e.netlify.app/audio/tobys-mix.mp3"
  },
  {
    title: "Gold Hour Spritz",
    artist: "CCC",
    url: "https://visionary-beignet-7d270e.netlify.app/audio/summer%20mix.mp3"
  },
  {
    title: "Midnight Chrome",
    artist: "CCC",
    url: "https://visionary-beignet-7d270e.netlify.app/audio/Kartell%20Tribute%20Set%20-%20Roche%20Musique.mp3"
  },
  {
    title: "Poolside Mirage",
    artist: "Solomun",
    url: "https://visionary-beignet-7d270e.netlify.app/audio/Solomun%20Boiler%20Room%20DJ%20Set.mp3"
  },
  {
    title: "Khruangbin Live",
    artist: "Khruangbin",
    url: "https://visionary-beignet-7d270e.netlify.app/audio/Khruangbin%20at%20Villain.mp3"
  },
  {
    title: "Succession Beats",
    artist: "Jsco",
    url: "https://visionary-beignet-7d270e.netlify.app/audio/Succession%20Beats%20-%20Jsco%20Music.mp3"
  }
];

let currentTrack = 0;


/* ============================================================
   LOAD TRACK INTO PLAYER
============================================================ */
function loadTrack(i) {
  const t = playlists[i];
  currentTrack = i;

  audioEl.src = t.url;
  trackTitle.textContent = t.title;
  trackArtist.textContent = t.artist;
  dockTrack.textContent = `${t.title} — ${t.artist}`;

  vinylItems.forEach(v => v.classList.remove("is-active"));
  vinylItems[i].classList.add("is-active");

  triggerVinylAnimation();
}

loadTrack(0);


/* ============================================================
   HYBRID VINYL ANIMATION ENGINE
============================================================ */
function triggerVinylAnimation() {
  const isMobile = window.innerWidth <= 480;

  if (!isMobile) {
    // Desktop: slide → drop
    albumArt.classList.remove("vinyl-slide", "vinyl-drop");
    void albumArt.offsetWidth;
    albumArt.classList.add("vinyl-slide");

    setTimeout(() => {
      albumArt.classList.add("vinyl-drop");
    }, 350);
  } else {
    // Mobile: pulse only
    albumArt.classList.remove("vinyl-pulse");
    void albumArt.offsetWidth;
    albumArt.classList.add("vinyl-pulse");
  }
}


/* ============================================================
   NEEDLE ARM CONTROL
============================================================ */
function engageNeedle() {
  tonearm.classList.add("engaged");
}

function disengageNeedle() {
  tonearm.classList.remove("engaged");
}


/* ============================================================
   PLAY / PAUSE
============================================================ */
playBtn.addEventListener("click", togglePlay);

function togglePlay() {
  if (audioEl.paused) {
    audioEl.play();
    playBtn.textContent = "Pause";
    platter.classList.add("playing");
    engageNeedle();
  } else {
    audioEl.pause();
    playBtn.textContent = "Play";
    platter.classList.remove("playing");
    disengageNeedle();
  }
}


/* ============================================================
   NEXT / PREV
============================================================ */
prevBtn.addEventListener("click", () => {
  const p = (currentTrack - 1 + playlists.length) % playlists.length;
  loadTrack(p);
  audioEl.play();
  togglePlatterOn();
});

nextBtn.addEventListener("click", () => {
  const n = (currentTrack + 1) % playlists.length;
  loadTrack(n);
  audioEl.play();
  togglePlatterOn();
});

function togglePlatterOn() {
  playBtn.textContent = "Pause";
  platter.classList.add("playing");
  engageNeedle();
}


/* ============================================================
   VOLUME CONTROL
============================================================ */
volumeSlider.addEventListener("input", () => {
  audioEl.volume = volumeSlider.value;
});


/* ============================================================
   TIMELINE SCRUBBING
============================================================ */
audioEl.addEventListener("loadedmetadata", () => {
  timeRemaining.textContent = "-" + formatTime(audioEl.duration);
});

audioEl.addEventListener("timeupdate", () => {
  const pct = (audioEl.currentTime / audioEl.duration) * 100;
  timelineProg.style.width = pct + "%";

  timeCurrent.textContent = formatTime(audioEl.currentTime);
  timeRemaining.textContent = "-" + formatTime(audioEl.duration - audioEl.currentTime);
});

timelineBar.addEventListener("click", (e) => {
  const rect = timelineBar.getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  audioEl.currentTime = ratio * audioEl.duration;
});


function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? "0" + s : s}`;
}


/* ============================================================
   WEB AUDIO API — SPECTRUM ANALYZER
============================================================ */
let audioContext, analyser, dataArray, sourceNode;

function initAudioAnalyzer() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 64;

  dataArray = new Uint8Array(analyser.frequencyBinCount);

  sourceNode = audioContext.createMediaElementSource(audioEl);
  sourceNode.connect(analyser);
  analyser.connect(audioContext.destination);

  renderSpectrum();
}

function renderSpectrum() {
  requestAnimationFrame(renderSpectrum);
  analyser.getByteFrequencyData(dataArray);

  eqBars.forEach((bar, i) => {
    const v = dataArray[i] / 255;
    bar.style.height = (v * 100) + "%";
  });
}

document.addEventListener("click", () => {
  if (!audioContext) initAudioAnalyzer();
}, { once: true });


/* ============================================================
   VINYL SHELF — SELECT TRACK
============================================================ */
vinylItems.forEach((item, index) => {
  item.addEventListener("click", () => {
    loadTrack(index);
    audioEl.play();
    togglePlatterOn();
  });
});


/* ============================================================
   CRT TV CONTROLS
============================================================ */
const tvChannels = [
  "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_01.mp4",
  "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_02.mp4",
  "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_03.mp4",
  "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_09.mp4"
];
let tvIndex = 0;

barTvChannelBtn.addEventListener("click", () => {
  tvIndex = (tvIndex + 1) % tvChannels.length;
  barTvVideo.src = tvChannels[tvIndex];
  barTvVideo.play();

  flashCRT();
});

barTvPlayBtn.addEventListener("click", () => {
  if (barTvVideo.paused) {
    barTvVideo.play();
    barTvPlayBtn.textContent = "⏸";
  } else {
    barTvVideo.pause();
    barTvPlayBtn.textContent = "▶︎";
  }
});

barTvMuteBtn.addEventListener("click", () => {
  barTvVideo.muted = !barTvVideo.muted;
  barTvMuteBtn.textContent = barTvVideo.muted ? "Sound Off" : "Sound On";
});

function flashCRT() {
  barTvFrame.classList.add("flash");
  setTimeout(() => barTvFrame.classList.remove("flash"), 120);
}


/* ============================================================
   BAR BOT — NETLIFY FUNCTION
============================================================ */
bartenderForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const q = bartenderInput.value.trim();
  if (!q) return;

  appendBotMessage("…thinking…");

  const response = await fetch("/.netlify/functions/ccc-bartender", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: q })
  });

  const data = await response.json();
  appendBotMessage(data.answer);

  bartenderInput.value = "";
  bartenderMessages.scrollTop = bartenderMessages.scrollHeight;
});

function appendBotMessage(text) {
  const div = document.createElement("div");
  div.className = "bartender-message bartender-message-bot";
  div.innerHTML = `<strong>Bar Bot:</strong> ${text}`;
  bartenderMessages.appendChild(div);
}


/* ============================================================
   GUESTBOOK — LOCAL STORAGE
============================================================ */
function loadGuestbook() {
  const stored = JSON.parse(localStorage.getItem("ccc_guestbook") || "[]");
  stored.forEach(addGuestNoteToDOM);
}

function addGuestNoteToDOM(entry) {
  const div = document.createElement("div");
  div.className = "guest-note";
  div.innerHTML = `<strong>${entry.name}:</strong> ${entry.text}`;
  guestbookList.appendChild(div);
}

guestbookForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const name = guestName.value.trim() || "Guest";
  const text = guestNote.value.trim();
  if (!text) return;

  const entry = { name, text };
  addGuestNoteToDOM(entry);

  const stored = JSON.parse(localStorage.getItem("ccc_guestbook") || "[]");
  stored.push(entry);
  localStorage.setItem("ccc_guestbook", JSON.stringify(stored));

  guestName.value = "";
  guestNote.value = "";
});

loadGuestbook();


/* ============================================================
   SMOOTH SCROLL NAVIGATION
============================================================ */
document.querySelectorAll("[data-scroll]").forEach(btn => {
  btn.addEventListener("click", () => {
    const id = btn.dataset.scroll;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });

    mobileDrawer.classList.remove("open");
    mobileBackdrop.classList.remove("visible");
  });
});


/* ============================================================
   MOBILE NAV
============================================================ */
mobileNavButton.addEventListener("click", () => {
  mobileDrawer.classList.add("open");
  mobileBackdrop.classList.add("visible");
});

mobileClose.addEventListener("click", closeMobileNav);
mobileBackdrop.addEventListener("click", closeMobileNav);

function closeMobileNav() {
  mobileDrawer.classList.remove("open");
  mobileBackdrop.classList.remove("visible");
}


/* ============================================================
   STICKY HEADER
============================================================ */
window.addEventListener("scroll", () => {
  stickyNav.classList.toggle("visible", window.scrollY > 140);
});
