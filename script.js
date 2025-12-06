{\rtf1\ansi\ansicpg1252\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 /* =========================================================\
   ELEMENT HOOKS\
========================================================= */\
const audioEl = document.getElementById("bar-audio");\
const trackTitle = document.getElementById("track-title");\
const trackArtist = document.getElementById("track-artist");\
const timelineBar = document.getElementById("timeline-bar");\
const timelineProgress = document.getElementById("timeline-progress");\
const timeCurrent = document.getElementById("time-current");\
const timeRemaining = document.getElementById("time-remaining");\
const dockTrack = document.getElementById("dockTrack");\
\
const playBtn = document.getElementById("play-btn");\
const prevBtn = document.getElementById("prev-btn");\
const nextBtn = document.getElementById("next-btn");\
const volumeSlider = document.getElementById("volume-slider");\
const platter = document.getElementById("turntablePlatter");\
const playerEq = document.getElementById("playerEq");\
const albumArt = document.getElementById("albumArt");\
\
const vinylRow = document.getElementById("vinylRow");\
const vinylItems = document.querySelectorAll(".vinyl-item");\
\
const barTvVideo = document.getElementById("barTvVideo");\
const barTvChannelBtn = document.getElementById("barTvChannelBtn");\
const barTvPlayBtn = document.getElementById("barTvPlayBtn");\
const barTvMuteBtn = document.getElementById("barTvMuteBtn");\
\
/* BAR BOT */\
const bartenderForm = document.getElementById("bartenderForm");\
const bartenderInput = document.getElementById("bartenderInput");\
const bartenderMessages = document.getElementById("bartenderMessages");\
\
/* MOBILE NAV */\
const mobileNavButton = document.getElementById("mobileNavButton");\
const mobileNavDrawer = document.getElementById("mobileNavDrawer");\
const mobileNavBackdrop = document.getElementById("mobileNavBackdrop");\
const mobileNavClose = document.getElementById("mobileNavClose");\
\
/* Sticky Nav */\
const stickyNav = document.getElementById("stickyNav");\
\
\
/* =========================================================\
   PLAYLISTS (Hosted Media URLs)\
========================================================= */\
const playlists = [\
  \{\
    title: "Toby\'92s Mix",\
    artist: "Toby",\
    url: "https://visionary-beignet-7d270e.netlify.app/audio/tobys-mix.mp3"\
  \},\
  \{\
    title: "Gold Hour Spritz",\
    artist: "CCC",\
    url: "https://visionary-beignet-7d270e.netlify.app/audio/summer%20mix.mp3"\
  \},\
  \{\
    title: "Midnight Chrome",\
    artist: "CCC",\
    url: "https://visionary-beignet-7d270e.netlify.app/audio/Kartell%20Tribute.mp3"\
  \},\
  \{\
    title: "Poolside Mirage",\
    artist: "Solomun",\
    url: "https://visionary-beignet-7d270e.netlify.app/audio/solomun.mp3"\
  \},\
  \{\
    title: "Khruangbin Live",\
    artist: "Khruangbin",\
    url: "https://visionary-beignet-7d270e.netlify.app/audio/Khruangbin.mp3"\
  \},\
  \{\
    title: "Succession Beats",\
    artist: "Jsco Music",\
    url: "https://visionary-beignet-7d270e.netlify.app/audio/succession.mp3"\
  \}\
];\
\
let currentTrackIndex = 0;\
\
\
/* =========================================================\
   LOAD TRACK\
========================================================= */\
function loadTrack(i) \{\
  const track = playlists[i];\
  currentTrackIndex = i;\
\
  audioEl.src = track.url;\
  trackTitle.textContent = track.title;\
  trackArtist.textContent = track.artist;\
  dockTrack.textContent = `$\{track.title\} \'97 $\{track.artist\}`;\
\
  // Highlight active vinyl\
  vinylItems.forEach(v => v.classList.remove("is-active"));\
  vinylItems[i].classList.add("is-active");\
\
  // Trigger vinyl drop animation\
  albumArt.classList.remove("album-drop");\
  void albumArt.offsetWidth; // force reflow\
  albumArt.classList.add("album-drop");\
\}\
\
loadTrack(0);\
\
\
/* =========================================================\
   AUDIO CONTROLS\
========================================================= */\
audioEl.addEventListener("loadedmetadata", () => \{\
  timeRemaining.textContent = "-" + formatTime(audioEl.duration);\
\});\
\
audioEl.addEventListener("timeupdate", () => \{\
  const percent = (audioEl.currentTime / audioEl.duration) * 100;\
  timelineProgress.style.width = `$\{percent\}%`;\
  timeCurrent.textContent = formatTime(audioEl.currentTime);\
  timeRemaining.textContent = "-" + formatTime(audioEl.duration - audioEl.currentTime);\
\});\
\
timelineBar.addEventListener("click", (e) => \{\
  const rect = timelineBar.getBoundingClientRect();\
  const ratio = (e.clientX - rect.left) / rect.width;\
  audioEl.currentTime = ratio * audioEl.duration;\
\});\
\
playBtn.addEventListener("click", togglePlay);\
\
function togglePlay() \{\
  if (audioEl.paused) \{\
    audioEl.play();\
    playBtn.textContent = "Pause";\
    platter.classList.add("playing");\
    playerEq.classList.add("playing");\
  \} else \{\
    audioEl.pause();\
    playBtn.textContent = "Play";\
    platter.classList.remove("playing");\
    playerEq.classList.remove("playing");\
  \}\
\}\
\
volumeSlider.addEventListener("input", () => \{\
  audioEl.volume = volumeSlider.value;\
\});\
\
prevBtn.addEventListener("click", () => \{\
  const next = (currentTrackIndex - 1 + playlists.length) % playlists.length;\
  loadTrack(next);\
  audioEl.play();\
  togglePlayStateOn();\
\});\
\
nextBtn.addEventListener("click", () => \{\
  const next = (currentTrackIndex + 1) % playlists.length;\
  loadTrack(next);\
  audioEl.play();\
  togglePlayStateOn();\
\});\
\
function togglePlayStateOn() \{\
  playBtn.textContent = "Pause";\
  platter.classList.add("playing");\
  playerEq.classList.add("playing");\
\}\
\
\
/* =========================================================\
   VINYL SHELF INTERACTION\
========================================================= */\
vinylItems.forEach((item, index) => \{\
  item.addEventListener("click", () => \{\
    loadTrack(index);\
    audioEl.play();\
    togglePlayStateOn();\
  \});\
\});\
\
\
/* =========================================================\
   TIME FORMATTER\
========================================================= */\
function formatTime(sec) \{\
  const m = Math.floor(sec / 60);\
  const s = Math.floor(sec % 60);\
  return `$\{m\}:$\{s < 10 ? "0" + s : s\}`;\
\}\
\
\
/* =========================================================\
   BAR TV CONTROLS\
========================================================= */\
const tvChannels = [\
  "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_01.mp4",\
  "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_02.mp4",\
  "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_03.mp4",\
  "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_09.mp4"\
];\
\
let tvIndex = 0;\
\
barTvChannelBtn.addEventListener("click", () => \{\
  tvIndex = (tvIndex + 1) % tvChannels.length;\
  barTvVideo.src = tvChannels[tvIndex];\
  barTvVideo.play();\
\});\
\
barTvPlayBtn.addEventListener("click", () => \{\
  if (barTvVideo.paused) \{\
    barTvVideo.play();\
    barTvPlayBtn.textContent = "\uc0\u9208 ";\
  \} else \{\
    barTvVideo.pause();\
    barTvPlayBtn.textContent = "\uc0\u9654 \u65038 ";\
  \}\
\});\
\
barTvMuteBtn.addEventListener("click", () => \{\
  barTvVideo.muted = !barTvVideo.muted;\
  barTvMuteBtn.textContent = barTvVideo.muted ? "Sound Off" : "Sound On";\
\});\
\
\
/* =========================================================\
   THEME TOGGLE\
========================================================= */\
const themePills = document.querySelectorAll(".theme-pill");\
\
themePills.forEach(pill => \{\
  pill.addEventListener("click", () => \{\
    themePills.forEach(p => p.classList.remove("is-active"));\
    pill.classList.add("is-active");\
    const theme = pill.dataset.theme;\
    document.body.className = `theme-$\{theme\}`;\
  \});\
\});\
\
\
/* =========================================================\
   BAR BOT \'97 NETLIFY FUNCTION CALL\
========================================================= */\
bartenderForm.addEventListener("submit", async (e) => \{\
  e.preventDefault();\
  const question = bartenderInput.value.trim();\
  if (!question) return;\
\
  appendBotMessage("\'85thinking\'85");\
\
  const response = await fetch("/.netlify/functions/ccc-bartender", \{\
    method: "POST",\
    headers: \{ "Content-Type": "application/json" \},\
    body: JSON.stringify(\{ question \})\
  \});\
\
  const data = await response.json();\
  appendBotMessage(data.answer);\
  bartenderInput.value = "";\
  bartenderMessages.scrollTop = bartenderMessages.scrollHeight;\
\});\
\
function appendBotMessage(text) \{\
  const div = document.createElement("div");\
  div.className = "bartender-message bartender-message-bot";\
  div.innerHTML = `<strong>Bar Bot:</strong> $\{text\}`;\
  bartenderMessages.appendChild(div);\
\}\
\
\
/* =========================================================\
   SMOOTH SCROLL NAVIGATION\
========================================================= */\
document.querySelectorAll("[data-scroll-target]").forEach(btn => \{\
  btn.addEventListener("click", () => \{\
    const id = btn.dataset.scrollTarget;\
    const el = document.getElementById(id);\
    if (el) el.scrollIntoView(\{ behavior: "smooth" \});\
    mobileNavDrawer.classList.remove("open");\
    mobileNavBackdrop.classList.remove("visible");\
  \});\
\});\
\
\
/* =========================================================\
   MOBILE NAV\
========================================================= */\
mobileNavButton.addEventListener("click", () => \{\
  mobileNavDrawer.classList.add("open");\
  mobileNavBackdrop.classList.add("visible");\
\});\
\
mobileNavClose.addEventListener("click", closeMobileNav);\
mobileNavBackdrop.addEventListener("click", closeMobileNav);\
\
function closeMobileNav() \{\
  mobileNavDrawer.classList.remove("open");\
  mobileNavBackdrop.classList.remove("visible");\
\}\
\
\
/* =========================================================\
   STICKY HEADER ACTIVATION\
========================================================= */\
window.addEventListener("scroll", () => \{\
  if (window.scrollY > 120) \{\
    stickyNav.classList.add("visible");\
  \} else \{\
    stickyNav.classList.remove("visible");\
  \}\
\});\
}