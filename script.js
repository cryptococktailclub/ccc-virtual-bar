// script.js – CCC Virtual Bar Experience
// Fully wired for the current one-column layout

// ==========================
// MEDIA CONFIG
// ==========================

const MEDIA_BASE = "https://visionary-beignet-7d270e.netlify.app";

// Adjust these filenames if your Netlify media paths differ.
const AUDIO_TRACKS = [
  {
    title: "Analog Neon",
    artist: "Toby",
    durationText: "58:24",
    src: `${MEDIA_BASE}/audio/tobys-mix.mp3`,
  },
  {
    title: "Gold Hour Spritz",
    artist: "CCC",
    durationText: "60:00",
    src: `${MEDIA_BASE}/audio/Summer mix.mp3`,
  },
  {
    title: "Midnight Chrome",
    artist: "Kartell Tribute",
    durationText: "60:00",
    src: `${MEDIA_BASE}/audio/Kartell Tribute Set - Roche Musique.mp3`,
  },
  {
    title: "Poolside Mirage",
    artist: "Solomun",
    durationText: "60:00",
    src: `${MEDIA_BASE}/audio/Solomun Boiler Room DJ Set.mp3`,
  },
  {
    title: "Khruangbin Live",
    artist: "Khruangbin",
    durationText: "60:00",
    src: `${MEDIA_BASE}/audio/Khruangbin at Villain _ Pitchfork Live.mp3`,
  },
  {
    title: "Succession Beats",
    artist: "Jsco Music",
    durationText: "60:00",
    src: `${MEDIA_BASE}/audio/Succession Beats - Jsco Music .mp3`,
  },
];

const VIDEO_SOURCES = [
  `${MEDIA_BASE}/video/bar_tape_01.mp4`,
  `${MEDIA_BASE}/video/bar_tape_02.mp4`,
  `${MEDIA_BASE}/video/bar_tape_03.mp4`,
  `${MEDIA_BASE}/video/bar_tape_04.mp4`,
  `${MEDIA_BASE}/video/bar_tape_05.mp4`,
  `${MEDIA_BASE}/video/bar_tape_06.mp4`,
  `${MEDIA_BASE}/video/bar_tape_07.mp4`,
  `${MEDIA_BASE}/video/bar_tape_08.mp4`,
  `${MEDIA_BASE}/video/bar_tape_09.mp4`,
];

// Netlify function endpoint for Bar Bot
const BARTENDER_FUNCTION_PATH = "/.netlify/functions/ccc-bartender";

// ==========================
// UTILITIES
// ==========================

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function safeQuery(selector) {
  const el = document.querySelector(selector);
  if (!el) {
    console.warn("CCC: Missing element:", selector);
  }
  return el;
}

// ==========================
// MAIN INIT
// ==========================

document.addEventListener("DOMContentLoaded", () => {
  initFloatingHeader();
  initThemeToggle();
  initAudioPlayer();
  initBarTV();
  initBarBot();
});

// ==========================
// FLOATING HEADER
// ==========================

function initFloatingHeader() {
  const header = document.getElementById("topNav");
  const hero = document.querySelector(".hero");
  if (!header || !hero) return;

  function handleScroll() {
    const trigger = hero.offsetHeight * 0.6;
    if (window.scrollY > trigger) {
      header.classList.add("header-visible");
    } else {
      header.classList.remove("header-visible");
    }
  }

  window.addEventListener("scroll", handleScroll);
  handleScroll();
}

// ==========================
// THEME TOGGLE (Base / Gold / Platinum)
// ==========================

function initThemeToggle() {
  const pills = document.querySelectorAll(".theme-pill");
  if (!pills.length) return;

  pills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const theme = pill.getAttribute("data-theme");
      if (!theme) return;

      // body theme
      document.body.classList.remove("theme-base", "theme-gold", "theme-platinum");
      document.body.classList.add(`theme-${theme}`);

      // pill UI
      pills.forEach((p) => p.classList.remove("is-active"));
      pill.classList.add("is-active");
    });
  });
}

// ==========================
// AUDIO PLAYER + VINYL SHELF (FULLY FIXED)
// ==========================

function initAudioPlayer() {
  // DOM references
  const vinylRow = document.getElementById("vinylRow");
  const albumArt = document.getElementById("albumArt");
  const platter = document.getElementById("turntablePlatter");
  const eq = document.getElementById("playerEq");
  const tonearm = document.getElementById("tonearm");

  const trackTitleEl = document.getElementById("track-title");
  const trackArtistEl = document.getElementById("track-artist");
  const trackDurationEl = document.getElementById("track-duration");
  const timelineBar = document.getElementById("timeline-bar");
  const timelineProgress = document.getElementById("timeline-progress");
  const timeCurrent = document.getElementById("time-current");
  const timeRemaining = document.getElementById("time-remaining");

  const prevBtn = document.getElementById("prev-btn");
  const playBtn = document.getElementById("play-btn");
  const nextBtn = document.getElementById("next-btn");
  const volumeSlider = document.getElementById("volume-slider");
  const dockTrack = document.getElementById("dockTrack");

  if (!vinylRow || !playBtn || !timelineBar) {
    console.warn("CCC: Audio player not fully wired.");
    return;
  }

  let currentIndex = 0;
  const audio = new Audio();
  audio.preload = "metadata";

  // Visual updates
  function setPlayingVisual(isPlaying) {
    platter?.classList.toggle("is-playing", isPlaying);
    eq?.classList.toggle("is-playing", isPlaying);
    albumArt?.classList.toggle("glow-active", isPlaying);
    tonearm?.classList.toggle("is-engaged", isPlaying);
  }

  // Load a track
  function loadTrack(index, autoPlay = false) {
    if (!AUDIO_TRACKS[index]) return;

    currentIndex = index;
    const track = AUDIO_TRACKS[index];

    audio.src = track.src;
    audio.currentTime = 0;

    trackTitleEl.textContent = track.title;
    trackArtistEl.textContent = track.artist;
    trackDurationEl.textContent = track.durationText;
    timeCurrent.textContent = "0:00";
    timeRemaining.textContent = `-${track.durationText}`;
    timelineProgress.style.width = "0%";

    dockTrack.textContent = `${track.title} — ${track.artist}`;

    // highlight vinyl
    vinylRow.querySelectorAll(".vinyl-item").forEach((btn, idx) => {
      btn.classList.toggle("is-active", idx === index);
      if (idx === index) {
        btn.style.animation = "vinylLand 0.35s ease-out";
        setTimeout(() => (btn.style.animation = ""), 400);
      }
    });

    if (autoPlay) {
      audio.play()
        .then(() => {
          playBtn.textContent = "Pause";
          setPlayingVisual(true);
        })
        .catch(err => {
          console.warn("CCC: play blocked", err);
          setPlayingVisual(false);
        });
    } else {
      playBtn.textContent = "Play";
      setPlayingVisual(false);
    }
  }

  // Initialize
  loadTrack(0, false);

  // Vinyl click
  vinylRow.querySelectorAll(".vinyl-item").forEach((btn, idx) => {
    btn.addEventListener("click", () => loadTrack(idx, true));
  });

  // Play / Pause
  playBtn.addEventListener("click", () => {
    if (audio.paused) {
      audio.play()
        .then(() => {
          playBtn.textContent = "Pause";
          setPlayingVisual(true);
        })
        .catch(err => console.warn("CCC: play blocked", err));
    } else {
      audio.pause();
      playBtn.textContent = "Play";
      setPlayingVisual(false);
    }
  });

  // Prev / Next
  prevBtn?.addEventListener("click", () => {
    loadTrack((currentIndex - 1 + AUDIO_TRACKS.length) % AUDIO_TRACKS.length, true);
  });

  nextBtn?.addEventListener("click", () => {
    loadTrack((currentIndex + 1) % AUDIO_TRACKS.length, true);
  });

  // Volume
  if (volumeSlider) {
    audio.volume = parseFloat(volumeSlider.value);
    volumeSlider.addEventListener("input", () => {
      audio.volume = parseFloat(volumeSlider.value);
    });
  }

  // Timeline sync
  audio.addEventListener("timeupdate", () => {
    if (!audio.duration) return;

    const pct = (audio.currentTime / audio.duration) * 100;
    timelineProgress.style.width = `${pct}%`;
    timeCurrent.textContent = formatTime(audio.currentTime);
    timeRemaining.textContent = `-${formatTime(audio.duration - audio.currentTime)}`;
  });

  // Seek
  timelineBar.addEventListener("click", e => {
    if (!audio.duration) return;
    const rect = timelineBar.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * audio.duration;
  });

  // Autoplay next
  audio.addEventListener("ended", () => {
    loadTrack((currentIndex + 1) % AUDIO_TRACKS.length, true);
  });
}


// ==========================
// BAR TV
// ==========================

function initBarTV() {
  const videoEl = document.getElementById("barTvVideo");
  const chBtn = document.getElementById("tvChannelBtn");
  const playBtn = document.getElementById("tvPlayBtn");
  const muteBtn = document.getElementById("tvMuteBtn");
  const volSlider = document.getElementById("tvVolume");

  if (!videoEl) {
    console.warn("CCC: Bar TV video element missing.");
    return;
  }

  let currentChannel = 0;

  function loadChannel(index, autoPlay = true) {
    if (!VIDEO_SOURCES[index]) {
      console.warn("CCC: Invalid video index", index);
      return;
    }
    currentChannel = index;
    videoEl.src = VIDEO_SOURCES[index];
    videoEl.load();

    if (autoPlay) {
      const playPromise = videoEl.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise.catch((err) => {
          console.warn("CCC: Video autoplay blocked or failed", err);
        });
      }
      if (playBtn) playBtn.textContent = "Pause";
    } else {
      if (playBtn) playBtn.textContent = "Play";
    }
  }

  // initial channel
  loadChannel(0, true);

  if (chBtn) {
    chBtn.addEventListener("click", () => {
      const nextIndex = (currentChannel + 1) % VIDEO_SOURCES.length;
      loadChannel(nextIndex, true);
    });
  }

  if (playBtn) {
    playBtn.addEventListener("click", () => {
      if (videoEl.paused) {
        videoEl
          .play()
          .then(() => {
            playBtn.textContent = "Pause";
          })
          .catch((err) => {
            console.warn("CCC: Video play blocked or failed", err);
          });
      } else {
        videoEl.pause();
        playBtn.textContent = "Play";
      }
    });
  }

  if (muteBtn) {
    muteBtn.addEventListener("click", () => {
      videoEl.muted = !videoEl.muted;
      muteBtn.textContent = videoEl.muted ? "Sound Off" : "Sound On";
    });
  }

  if (volSlider) {
    volSlider.addEventListener("input", () => {
      const vol = parseFloat(volSlider.value);
      videoEl.volume = vol;
      // If user moves volume above 0, unmute
      if (vol > 0 && videoEl.muted) {
        videoEl.muted = false;
        if (muteBtn) muteBtn.textContent = "Sound On";
      }
    });
    videoEl.volume = parseFloat(volSlider.value);
  }
}

// ==========================
// BAR BOT (AI BARTENDER)
// ==========================

function initBarBot() {
  const messagesEl = document.getElementById("bartenderMessages");
  const formEl = document.getElementById("bartenderForm");
  const inputEl = document.getElementById("bartenderInput");

  if (!messagesEl || !formEl || !inputEl) {
    console.warn("CCC: Bar Bot elements missing; skipping AI bartender wiring.");
    return;
  }

  function appendMessage(content, fromBot = false) {
    const row = document.createElement("div");
    row.className = `bartender-message ${fromBot ? "bartender-bot" : "bartender-user"}`;

    if (fromBot) {
      const avatar = document.createElement("div");
      avatar.className = "bartender-avatar";
      row.appendChild(avatar);
    }

    const text = document.createElement("div");
    text.className = "bartender-text";
    text.innerHTML = content;
    row.appendChild(text);

    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  let typingEl = null;
  function showTyping() {
    typingEl = document.createElement("div");
    typingEl.className = "bartender-message bartender-bot bartender-typing";
    typingEl.innerHTML = '<div class="bartender-avatar"></div><div class="bartender-text">…</div>';
    messagesEl.appendChild(typingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    if (typingEl && typingEl.parentNode) {
      typingEl.parentNode.removeChild(typingEl);
    }
    typingEl = null;
  }

  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const question = inputEl.value.trim();
    if (!question) return;

    appendMessage(question, false);
    inputEl.value = "";
    showTyping();

    try {
      const res = await fetch(BARTENDER_FUNCTION_PATH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          recipes: [], // we already have M&H logic server-side; or you can pass subset here
        }),
      });

      hideTyping();

      if (!res.ok) {
        appendMessage("Bar Bot is temporarily offline. Try again shortly.", true);
        console.error("CCC Bar Bot HTTP error:", res.status, await res.text());
        return;
      }

      const data = await res.json();
      const answer = data.answer || "I couldn't reach the back bar AI right now.";
      appendMessage(answer, true);
    } catch (err) {
      hideTyping();
      console.error("CCC Bar Bot error:", err);
      appendMessage("I couldn’t reach the back bar AI right now. Check the Netlify function and API key.", true);
    }
  });
}
