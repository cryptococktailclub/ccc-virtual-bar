/* Element Hooks */
const audioEl = document.getElementById("bar-audio");
const trackTitle = document.getElementById("track-title");
const trackArtist = document.getElementById("track-artist");
const timelineBar = document.getElementById("timeline-bar");
const timelineProgress = document.getElementById("timeline-progress");
const timeCurrent = document.getElementById("time-current");
const timeRemaining = document.getElementById("time-remaining");
const dockTrack = document.getElementById("dockTrack");
const playBtn = document.getElementById("play-btn");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const volumeSlider = document.getElementById("volume-slider");
const platter = document.getElementById("turntablePlatter");
const playerEq = document.getElementById("playerEq");
const albumArt = document.getElementById("albumArt");
const tonearm = document.getElementById("tonearm");
const vinylRow = document.getElementById("vinylRow");
const vinylItems = document.querySelectorAll(".vinyl-item");
const barTvVideo = document.getElementById("barTvVideo");
const barTvChannelBtn = document.getElementById("barTvChannelBtn");
const barTvPlayBtn = document.getElementById("barTvPlayBtn");
const barTvMuteBtn = document.getElementById("barTvMuteBtn");
const themePills = document.querySelectorAll(".theme-pill");
const bartenderForm = document.getElementById("bartenderForm");
const bartenderInput = document.getElementById("bartenderInput");
const bartenderMessages = document.getElementById("bartenderMessages");
const mobileNavButton = document.getElementById("mobileNavButton");
const mobileNavDrawer = document.getElementById("mobileNavDrawer");
const mobileNavBackdrop = document.getElementById("mobileNavBackdrop");
const mobileNavClose = document.getElementById("mobileNavClose");
const stickyNav = document.getElementById("stickyNav");
const guestbookForm = document.getElementById("guestbookForm");
const guestbookName = document.getElementById("guestbookName");
const guestbookMessage = document.getElementById("guestbookMessage");
const guestbookList = document.getElementById("guestbookList");

/* Playlist (Audio Tracks) */
const playlists = [
  { title: "Toby’s Mix", artist: "Toby", url: "https://visionary-beignet-7d270e.netlify.app/audio/tobys-mix.mp3" },
  { title: "Gold Hour Spritz", artist: "CCC", url: "https://visionary-beignet-7d270e.netlify.app/audio/summer%20mix.mp3" },
  { title: "Midnight Chrome", artist: "CCC", url: "https://visionary-beignet-7d270e.netlify.app/audio/Kartell%20Tribute.mp3" },
  { title: "Poolside Mirage", artist: "Solomun", url: "https://visionary-beignet-7d270e.netlify.app/audio/solomun.mp3" },
  { title: "Khruangbin Live", artist: "Khruangbin", url: "https://visionary-beignet-7d270e.netlify.app/audio/Khruangbin.mp3" },
  { title: "Succession Beats", artist: "Jsco Music", url: "https://visionary-beignet-7d270e.netlify.app/audio/succession.mp3" }
];
let currentTrackIndex = 0;

/* Web Audio API Setup */
let audioCtx, sourceNode, analyser, gainNode;
let eqBars = document.querySelectorAll(".eq-bar");
let eqAnimating = false;
function initAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    sourceNode = audioCtx.createMediaElementSource(audioEl);
    analyser = audioCtx.createAnalyser();
    gainNode = audioCtx.createGain();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.8;
    // Connect audio nodes: source -> analyser (for data) and source -> gain -> destination (for output)
    sourceNode.connect(analyser);
    sourceNode.connect(gainNode);
    gainNode.connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

/* Load and display a track by index */
function loadTrack(index) {
  const track = playlists[index];
  currentTrackIndex = index;
  audioEl.src = track.url;
  trackTitle.textContent = track.title;
  trackArtist.textContent = track.artist;
  dockTrack.textContent = `${track.title} — ${track.artist}`;
  // Highlight active vinyl spine
  vinylItems.forEach(v => v.classList.remove("is-active"));
  vinylItems[index].classList.add("is-active");
  // Trigger album drop animation
  albumArt.classList.remove("album-drop");
  // force reflow to restart animation
  void albumArt.offsetWidth;
  albumArt.classList.add("album-drop");
}
loadTrack(0);

/* Audio Player Controls */
audioEl.addEventListener("loadedmetadata", () => {
  timeRemaining.textContent = "-" + formatTime(audioEl.duration);
});
audioEl.addEventListener("timeupdate", () => {
  if (audioEl.duration) {
    const percent = (audioEl.currentTime / audioEl.duration) * 100;
    timelineProgress.style.width = `${percent}%`;
    timeCurrent.textContent = formatTime(audioEl.currentTime);
    timeRemaining.textContent = "-" + formatTime(audioEl.duration - audioEl.currentTime);
  }
});
audioEl.addEventListener("ended", () => {
  // Auto-play next track on end
  const nextIndex = (currentTrackIndex + 1) % playlists.length;
  loadTrack(nextIndex);
  audioEl.play();
  togglePlayStateOn();
});
timelineBar.addEventListener("click", (e) => {
  const rect = timelineBar.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const ratio = clickX / rect.width;
  audioEl.currentTime = ratio * audioEl.duration;
});
function togglePlay() {
  if (audioEl.paused) {
    initAudioContext();
    audioEl.play();
    togglePlayStateOn();
  } else {
    audioEl.pause();
    playBtn.textContent = "Play";
    platter.classList.remove("playing");
    playerEq.classList.remove("playing");
    tonearm.classList.remove("on");
    tonearm.classList.add("off");
    eqAnimating = false;
  }
}
function togglePlayStateOn() {
  playBtn.textContent = "Pause";
  platter.classList.add("playing");
  playerEq.classList.add("playing");
  tonearm.classList.remove("off");
  tonearm.classList.add("on");
  // Start EQ bars animation loop if not already running
  if (!eqAnimating) {
    eqAnimating = true;
    requestAnimationFrame(eqLoop);
  }
}
playBtn.addEventListener("click", togglePlay);
prevBtn.addEventListener("click", () => {
  const prevIndex = (currentTrackIndex - 1 + playlists.length) % playlists.length;
  loadTrack(prevIndex);
  audioEl.play();
  togglePlayStateOn();
});
nextBtn.addEventListener("click", () => {
  const nextIndex = (currentTrackIndex + 1) % playlists.length;
  loadTrack(nextIndex);
  audioEl.play();
  togglePlayStateOn();
});
volumeSlider.addEventListener("input", () => {
  // Ensure audio context is initialized for volume control
  if (gainNode) {
    gainNode.gain.value = volumeSlider.value;
  } else {
    audioEl.volume = volumeSlider.value;
  }
});

/* Vinyl Shelf Interaction */
vinylItems.forEach((item, index) => {
  item.addEventListener("click", () => {
    loadTrack(index);
    audioEl.play();
    togglePlayStateOn();
  });
});

/* Helper: Time Formatter (mm:ss) */
function formatTime(seconds) {
  const m = Math.floor(seconds / 60) || 0;
  const s = Math.floor(seconds % 60) || 0;
  return `${m}:${s < 10 ? "0" + s : s}`;
}

/* Real-time Spectrum Analyzer Loop */
function eqLoop() {
  if (!eqAnimating || !analyser) return;
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(freqData);
  // Divide spectrum into 4 frequency bands (low to high)
  const bandCount = 4;
  const binsPerBand = Math.floor(freqData.length / bandCount);
  for (let i = 0; i < bandCount; i++) {
    // Average the values in this band
    let sum = 0;
    const start = i * binsPerBand;
    const end = start + binsPerBand;
    for (let j = start; j < end; j++) {
      sum += freqData[j];
    }
    const avg = sum / binsPerBand;
    // Normalize scale: map avg (0-255) to scaleY (0.2 to 1)
    const scale = 0.2 + (avg / 255) * 0.8;
    eqBars[i].style.transform = `scaleY(${scale})`;
  }
  requestAnimationFrame(eqLoop);
}

/* CRT TV Controls */
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
  // Flash effect on channel switch
  const tvAspect = document.querySelector(".bar-tv-aspect");
  tvAspect.classList.add("flash");
  setTimeout(() => tvAspect.classList.remove("flash"), 100);
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

/* Theme Switcher */
themePills.forEach(pill => {
  pill.addEventListener("click", () => {
    themePills.forEach(p => p.classList.remove("is-active"));
    pill.classList.add("is-active");
    const theme = pill.dataset.theme;
    document.body.className = `theme-${theme}`;
  });
});

/* Bar Bot (Netlify Function call) */
bartenderForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = bartenderInput.value.trim();
  if (!question) return;
  // Append user message
  appendUserMessage(question);
  // Append a "thinking" indicator message for the bot
  const thinkingMsg = appendBotMessage("...thinking...");
  // Send question to Netlify function
  try {
    const response = await fetch("/.netlify/functions/ccc-bartender", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question })
    });
    const data = await response.json();
    // Replace thinking message with actual answer (preserve any HTML formatting)
    thinkingMsg.innerHTML = `<strong>Bar Bot:</strong> ${data.answer}`;
  } catch (err) {
    thinkingMsg.innerHTML = `<strong>Bar Bot:</strong> Sorry, I couldn't get that.`;
  }
  bartenderInput.value = "";
  bartenderMessages.scrollTop = bartenderMessages.scrollHeight;
});
function appendBotMessage(text) {
  const div = document.createElement("div");
  div.className = "bartender-message bartender-message-bot";
  div.innerHTML = `<strong>Bar Bot:</strong> ${text}`;
  bartenderMessages.appendChild(div);
  bartenderMessages.scrollTop = bartenderMessages.scrollHeight;
  return div;
}
function appendUserMessage(text) {
  const div = document.createElement("div");
  div.className = "bartender-message bartender-message-user";
  div.innerHTML = `<strong>You:</strong> ${text}`;
  bartenderMessages.appendChild(div);
  bartenderMessages.scrollTop = bartenderMessages.scrollHeight;
}

/* Smooth Scroll Navigation */
document.querySelectorAll("[data-scroll-target]").forEach(btn => {
  btn.addEventListener("click", () => {
    const targetId = btn.dataset.scrollTarget;
    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth" });
    }
    mobileNavDrawer.classList.remove("open");
    mobileNavBackdrop.classList.remove("visible");
  });
});

/* Mobile Nav Drawer */
mobileNavButton.addEventListener("click", () => {
  mobileNavDrawer.classList.add("open");
  mobileNavBackdrop.classList.add("visible");
});
mobileNavClose.addEventListener("click", closeMobileNav);
mobileNavBackdrop.addEventListener("click", closeMobileNav);
function closeMobileNav() {
  mobileNavDrawer.classList.remove("open");
  mobileNavBackdrop.classList.remove("visible");
}

/* Sticky Header on Scroll */
window.addEventListener("scroll", () => {
  if (window.scrollY > 120) {
    stickyNav.classList.add("visible");
  } else {
    stickyNav.classList.remove("visible");
  }
});

/* Guestbook: Persistent Notes via LocalStorage */
let guestbookNotes = [];
// Load existing notes from localStorage
const savedNotes = localStorage.getItem("guestbookNotes");
if (savedNotes) {
  try {
    guestbookNotes = JSON.parse(savedNotes) || [];
  } catch {
    guestbookNotes = [];
  }
}
// Render any saved notes
guestbookNotes.forEach(note => {
  const li = document.createElement("li");
  li.className = "guestbook-note";
  li.innerHTML = `<p>${note.message}</p>` +
                 (note.name ? `<small>– ${note.name}</small>` : "") +
                 `<button class="delete-note" title="Remove note">×</button>`;
  guestbookList.appendChild(li);
});
// Handle new note submission
guestbookForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const nameVal = guestbookName.value.trim();
  const messageVal = guestbookMessage.value.trim();
  if (!messageVal) return;
  // Create note object and save to array
  const newNote = { name: nameVal, message: messageVal };
  guestbookNotes.push(newNote);
  localStorage.setItem("guestbookNotes", JSON.stringify(guestbookNotes));
  // Create and insert new note element with slip-in animation
  const li = document.createElement("li");
  li.className = "guestbook-note sliding";
  li.innerHTML = `<p>${messageVal}</p>` +
                 (nameVal ? `<small>– ${nameVal}</small>` : "") +
                 `<button class="delete-note" title="Remove note">×</button>`;
  guestbookList.appendChild(li);
  // Trigger slide-in animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      li.classList.remove("sliding");
    });
  });
  // Scroll to bottom to show the new note
  guestbookList.scrollTop = guestbookList.scrollHeight;
  // Clear form fields
  guestbookName.value = "";
  guestbookMessage.value = "";
});
// Handle note removal (event delegation for delete buttons)
guestbookList.addEventListener("click", (e) => {
  if (e.target.classList.contains("delete-note")) {
    const li = e.target.closest("li");
    if (!li) return;
    // Determine index of this note in the list
    const index = Array.from(guestbookList.children).indexOf(li);
    if (index >= 0) {
      // Remove from array and update storage
      guestbookNotes.splice(index, 1);
      localStorage.setItem("guestbookNotes", JSON.stringify(guestbookNotes));
    }
    // Animate slip-out then remove element
    li.classList.add("removing");
    setTimeout(() => {
      if (li.parentElement) {
        li.parentElement.removeChild(li);
      }
    }, 400);
  }
});
