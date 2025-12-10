document.addEventListener("DOMContentLoaded", () => {

/* ==========================================================
   CCC — Virtual Bar Experience
   Fully Repaired + Crash-Proof script.js
========================================================== */

/* ----------------------------------------------------------
   MEDIA PATHS
---------------------------------------------------------- */
const MEDIA_BASE = "https://visionary-beignet-7d270e.netlify.app";

const AUDIO_TRACKS = [
  { title: "Toby’s Mix", artist: "CCC", file: `${MEDIA_BASE}/audio/tobys-mix.mp3`, duration: "58:24" },
  { title: "Summer Mix", artist: "CCC", file: `${MEDIA_BASE}/audio/summer mix.mp3`, duration: "60:12" },
  { title: "Kartell Tribute", artist: "Roche Musique", file: `${MEDIA_BASE}/audio/kartell tribute set - roche musique.mp3`, duration: "52:18" },
  { title: "Solomun Boiler Room", artist: "Solomun", file: `${MEDIA_BASE}/audio/solomun boiler room dj set.mp3`, duration: "58:00" },
  { title: "Khruangbin Live", artist: "Pitchfork", file: `${MEDIA_BASE}/audio/khruangbin at villain _ pitchfork live.mp3`, duration: "47:42" },
  { title: "Succession Beats", artist: "JSCO", file: `${MEDIA_BASE}/audio/succession beats - jsco music .mp3`, duration: "55:50" }
];

const VIDEO_TAPES = [
  "bar_tape_01.mp4", "bar_tape_02.mp4", "bar_tape_03.mp4",
  "bar_tape_04.mp4", "bar_tape_05.mp4", "bar_tape_06.mp4",
  "bar_tape_07.mp4", "bar_tape_08.mp4", "bar_tape_09.mp4"
].map(v => `${MEDIA_BASE}/video/${v}`);

/* ----------------------------------------------------------
   DOM ELEMENTS — NOW SAFE
---------------------------------------------------------- */
const vinylItems = document.querySelectorAll(".vinyl-item");

const trackTitle = document.getElementById("track-title");
const trackArtist = document.getElementById("track-artist");
const trackDuration = document.getElementById("track-duration");
const dockTrack = document.getElementById("dockTrack");

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

/* Bar TV */
const barTvVideo = document.getElementById("barTvVideo");
const tvChannelBtn = document.getElementById("tvChannelBtn");
const tvPlayBtn = document.getElementById("tvPlayBtn");
const tvMuteBtn = document.getElementById("tvMuteBtn");
const tvVolume = document.getElementById("tvVolume");

/* Bar Bot */
const bartenderForm = document.getElementById("bartenderForm");
const bartenderInput = document.getElementById("bartenderInput");
const bartenderMessages = document.getElementById("bartenderMessages");

/* Floating header */
const topNav = document.getElementById("topNav");

/* AUDIO ENGINE */
const audio = new Audio();
audio.volume = 0.8;

let currentTrackIndex = 0;
let isPlaying = false;

/* ----------------------------------------------------------
   TRACK LOADER
---------------------------------------------------------- */
function loadTrack(i) {
  const track = AUDIO_TRACKS[i];

  audio.src = track.file;

  trackTitle.textContent = track.title;
  trackArtist.textContent = track.artist;
  trackDuration.textContent = track.duration;
  dockTrack.textContent = `${track.title} — ${track.artist}`;

  vinylItems.forEach(v => v.classList.remove("is-active"));
  vinylItems[i].classList.add("is-active");

  currentTrackIndex = i;
}

/* Initialize */
loadTrack(0);

/* ----------------------------------------------------------
   PLAYBACK
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

playBtn.addEventListener("click", () => isPlaying ? pauseTrack() : playTrack());

prevBtn.addEventListener("click", () => {
  const i = currentTrackIndex - 1 < 0 ? AUDIO_TRACKS.length - 1 : currentTrackIndex - 1;
  loadTrack(i);
  playTrack();
});

nextBtn.addEventListener("click", () => {
  const i = (currentTrackIndex + 1) % AUDIO_TRACKS.length;
  loadTrack(i);
  playTrack();
});

/* Vinyl click */
vinylItems.forEach(btn => {
  btn.addEventListener("click", () => {
    loadTrack(Number(btn.dataset.trackIndex));
    playTrack();
  });
});

/* ----------------------------------------------------------
   TIMELINE + PROGRESS
---------------------------------------------------------- */
audio.addEventListener("timeupdate", () => {
  if (!audio.duration) return;
  const pct = (audio.currentTime / audio.duration) * 100;
  timelineProgress.style.width = pct + "%";

  timeCurrent.textContent = format(audio.currentTime);
  timeRemaining.textContent = "-" + format(audio.duration - audio.currentTime);
});

timelineBar.addEventListener("click", e => {
  const r = timelineBar.getBoundingClientRect();
  const pct = (e.clientX - r.left) / r.width;
  audio.currentTime = pct * audio.duration;
});

/* formatter */
function format(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

/* Volume */
volumeSlider.addEventListener("input", e => {
  audio.volume = Number(e.target.value);
});

/* ----------------------------------------------------------
   THEME SWITCH
---------------------------------------------------------- */
themeButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    themeButtons.forEach(b => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    document.body.className = `theme-${btn.dataset.theme}`;
  });
});

/* ----------------------------------------------------------
   BAR TV
---------------------------------------------------------- */
tvChannelBtn.addEventListener("click", () => {
  const i = Math.floor(Math.random() * VIDEO_TAPES.length);
  barTvVideo.src = VIDEO_TAPES[i];
  barTvVideo.play();
});

tvPlayBtn.addEventListener("click", () => {
  if (barTvVideo.paused) {
    barTvVideo.play();
    tvPlayBtn.textContent = "Pause";
  } else {
    barTvVideo.pause();
    tvPlayBtn.textContent = "Play";
  }
});

tvMuteBtn.addEventListener("click", () => {
  barTvVideo.muted = !barTvVideo.muted;
  tvMuteBtn.textContent = barTvVideo.muted ? "Sound On" : "Sound Off";
});

tvVolume.addEventListener("input", e => {
  barTvVideo.volume = Number(e.target.value);
});

/* ----------------------------------------------------------
   FLOATING HEADER
---------------------------------------------------------- */
window.addEventListener("scroll", () => {
  if (window.scrollY > 240) topNav.classList.add("header-visible");
  else topNav.classList.remove("header-visible");
});

/* ----------------------------------------------------------
   BAR BOT
---------------------------------------------------------- */
bartenderForm.addEventListener("submit", async e => {
  e.preventDefault();

  const text = bartenderInput.value.trim();
  if (!text) return;

  appendUser(text);
  bartenderInput.value = "";

  appendTyping();

  try {
    const res = await fetch("/.netlify/functions/ccc-bartender", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: text })
    });

    const data = await res.json();
    removeTyping();
    appendBot(data.answer || "I couldn’t parse a structured reply.");
  } catch (err) {
    removeTyping();
    appendBot("Error reaching the back bar.");
  }
});

/* Chat helpers */
function appendUser(t) {
  bartenderMessages.innerHTML += `
    <div class="bartender-message bartender-user"><div>${t}</div></div>
  `;
  scrollBot();
}

function appendBot(t) {
  bartenderMessages.innerHTML += `
    <div class="bartender-message bartender-bot">
      <div class="bartender-avatar"></div>
      <div>${t}</div>
    </div>
  `;
  scrollBot();
}

function appendTyping() {
  bartenderMessages.innerHTML += `<div id="typing">Bar Bot is mixing…</div>`;
  scrollBot();
}

function removeTyping() {
  const el = document.getElementById("typing");
  if (el) el.remove();
}

function scrollBot() {
  bartenderMessages.scrollTop = bartenderMessages.scrollHeight;
}

}); // END DOMContentLoaded
