// script.js – Crypto Cocktail Club Virtual Bar Experience

// ==========================
// MEDIA CONFIG
// ==========================

const MEDIA_BASE = "https://visionary-beignet-7d270e.netlify.app";

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
    artist: "Solomun`,
    durationText: "60:00",
    src: `${MEDIA_BASE}/audio/Solomun Boiler Room DJ Set.mp3`,
  },
  {
    title: "Khruangbin Live",
    artist: "Khruangbin`,
    durationText: "60:00",
    src: `${MEDIA_BASE}/audio/Khruangbin at Villain _ Pitchfork Live.mp3`,
  },
  {
    title: "Succession Beats",
    artist: "Jsco Music`,
    durationText: "60:00",
    src: `${MEDIA_BASE}/audio/Succession Beats - Jsco Music .mp3`,
  },
  {
    title: "Plant Shop Throwbacks",
    artist: "Lotso / Plant Bass`,
    durationText: "60:00",
    src: `${MEDIA_BASE}/audio/Love Song Edits & Throwbacks at Plant Shop  Lotso - Plant Bass.mp3`,
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
// THEME TOGGLE
// ==========================

function initThemeToggle() {
  const pills = document.querySelectorAll(".theme-pill");
  if (!pills.length) return;

  pills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const theme = pill.getAttribute("data-theme");
      if (!theme) return;

      document.body.classList.remove("theme-base", "theme-gold", "theme-platinum");
      document.body.classList.add(`theme-${theme}`);

      pills.forEach((p) => p.classList.remove("is-active"));
      pill.classList.add("is-active");
    });
  });
}

// ==========================
// AUDIO PLAYER + VINYL SHELF
// ==========================

function initAudioPlayer() {
  const vinylRow = document.getElementById("vinylRow");
  const albumArt = document.getElementById("albumArt");
  const platter = document.getElementById("turntablePlatter");
  const eq = document.getElementById("playerEq");
  const centerLabel = document.querySelector(".turntable-label"); // for ball drop

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

  if (
    !vinylRow ||
    !trackTitleEl ||
    !timelineBar ||
    !timelineProgress ||
    !playBtn
  ) {
    console.warn("CCC: Audio player not fully wired (missing core elements).");
    return;
  }

  let currentIndex = 0;
  const audio = new Audio();
  audio.preload = "metadata";

  // Visual state for playing / paused
  function setPlayingVisual(isPlaying) {
    if (platter) platter.classList.toggle("is-playing", isPlaying);
    if (eq) eq.classList.toggle("is-playing", isPlaying);
    if (albumArt) albumArt.classList.toggle("glow-active", isPlaying);
  }

  // Ball-drop label animation when a new record is selected
  function triggerLabelDrop() {
    if (!centerLabel) return;
    centerLabel.classList.remove("label-drop");
    // force reflow to restart animation
    // eslint-disable-next-line no-unused-expressions
    centerLabel.offsetWidth;
    centerLabel.classList.add("label-drop");
  }

  // Load a track and optionally autoplay
  function loadTrack(index, autoPlay = false) {
    if (!AUDIO_TRACKS[index]) {
      console.warn("CCC: Invalid track index", index);
      return;
    }

    currentIndex = index;
    const track = AUDIO_TRACKS[index];

    audio.src = track.src;
    audio.currentTime = 0;

    trackTitleEl.textContent = track.title;
    trackArtistEl.textContent = track.artist;
    trackDurationEl.textContent = track.durationText || "--:--";

    timeCurrent.textContent = "0:00";
    timeRemaining.textContent = track.durationText
      ? `-${track.durationText}`
      : "-0:00";
    timelineProgress.style.width = "0%";

    if (dockTrack) {
      dockTrack.textContent = `${track.title} — ${track.artist}`;
    }

    // Vinyl highlight + subtle shelf animation
    const vinylItems = vinylRow.querySelectorAll(".vinyl-item");
    vinylItems.forEach((btn, idx) => {
      btn.classList.toggle("is-active", idx === index);
      if (idx === index) {
        btn.style.animation = "vinylLand 0.35s ease-out";
        setTimeout(() => {
          btn.style.animation = "";
        }, 360);
      }
    });

    // Center label "ball drop"
    triggerLabelDrop();

    if (autoPlay) {
      audio
        .play()
        .then(() => {
          playBtn.textContent = "Pause";
          setPlayingVisual(true);
        })
        .catch((err) => {
          console.warn("CCC: Audio play blocked or failed", err);
          setPlayingVisual(false);
        });
    } else {
      playBtn.textContent = "Play";
      setPlayingVisual(false);
    }
  }

  // Initial load (no autoplay)
  loadTrack(0, false);

  // Vinyl selection
  vinylRow.querySelectorAll(".vinyl-item").forEach((btn, idx) => {
    btn.addEventListener("click", () => {
      loadTrack(idx, true);
    });
  });

  // Play / Pause control
  playBtn.addEventListener("click", () => {
    if (audio.paused) {
      audio
        .play()
        .then(() => {
          playBtn.textContent = "Pause";
          setPlayingVisual(true);
        })
        .catch((err) => {
          console.warn("CCC: Audio play blocked or failed", err);
          setPlayingVisual(false);
        });
    } else {
      audio.pause();
      playBtn.textContent = "Play";
      setPlayingVisual(false);
    }
  });

  // Prev / Next
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      const nextIndex =
        (currentIndex - 1 + AUDIO_TRACKS.length) % AUDIO_TRACKS.length;
      loadTrack(nextIndex, true);
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      const nextIndex = (currentIndex + 1) % AUDIO_TRACKS.length;
      loadTrack(nextIndex, true);
    });
  }

  // Volume
  if (volumeSlider) {
    audio.volume = parseFloat(volumeSlider.value);
    volumeSlider.addEventListener("input", () => {
      audio.volume = parseFloat(volumeSlider.value);
    });
  }

  // Timeline updates
  audio.addEventListener("timeupdate", () => {
    if (!audio.duration || !isFinite(audio.duration)) return;

    const pct = (audio.currentTime / audio.duration) * 100;
    timelineProgress.style.width = `${pct}%`;

    timeCurrent.textContent = formatTime(audio.currentTime);
    timeRemaining.textContent = `-${formatTime(
      audio.duration - audio.currentTime
    )}`;
  });

  // Seek
  timelineBar.addEventListener("click", (e) => {
    if (!audio.duration || !isFinite(audio.duration)) return;

    const rect = timelineBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = clickX / rect.width;
    audio.currentTime = pct * audio.duration;
  });

  // Autoplay next track
  audio.addEventListener("ended", () => {
    const nextIndex = (currentIndex + 1) % AUDIO_TRACKS.length;
    loadTrack(nextIndex, true);
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
  const tvAspect = document.querySelector(".bar-tv-aspect");

  if (!videoEl) {
    console.warn("CCC: Bar TV video element missing.");
    return;
  }

  let currentChannel = 0;

  function triggerTvGlitch() {
    if (!tvAspect) return;
    tvAspect.classList.add("tv-glitch");
    setTimeout(() => {
      tvAspect.classList.remove("tv-glitch");
    }, 220);
  }

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

  // Initial channel
  loadChannel(0, true);

  // Channel button
  if (chBtn) {
    chBtn.addEventListener("click", () => {
      const nextIndex = (currentChannel + 1) % VIDEO_SOURCES.length;
      loadChannel(nextIndex, true);
      triggerTvGlitch();
    });
  }

  // Play / Pause
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

  // Mute toggle
  if (muteBtn) {
    muteBtn.addEventListener("click", () => {
      videoEl.muted = !videoEl.muted;
      muteBtn.textContent = videoEl.muted ? "Sound Off" : "Sound On";
    });
  }

  // Volume slider
  if (volSlider) {
    videoEl.volume = parseFloat(volSlider.value);
    volSlider.addEventListener("input", () => {
      const vol = parseFloat(volSlider.value);
      videoEl.volume = vol;

      if (vol > 0 && videoEl.muted) {
        videoEl.muted = false;
        if (muteBtn) muteBtn.textContent = "Sound On";
      }
    });
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
    console.warn("CCC: Bar Bot DOM not present.");
    return;
  }

  function appendMessage(content, fromBot = false) {
    const row = document.createElement("div");
    row.className = `bartender-message ${
      fromBot ? "bartender-bot" : "bartender-user"
    }`;

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
    typingEl.className =
      "bartender-message bartender-bot bartender-typing";
    typingEl.innerHTML =
      '<div class="bartender-avatar"></div><div class="bartender-text">…</div>';
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
          recipes: [],
        }),
      });

      hideTyping();

      if (!res.ok) {
        console.error("CCC Bar Bot HTTP error:", res.status, await res.text());
        appendMessage(
          "Bar Bot is temporarily offline. Try again shortly.",
          true
        );
        return;
      }

      const data = await res.json();
      const answer =
        data.answer ||
        "I couldn't reach the back bar AI right now. Please try again.";
      appendMessage(answer, true);
    } catch (err) {
      hideTyping();
      console.error("CCC Bar Bot error:", err);
      appendMessage(
        "I couldn’t reach the back bar AI right now. Check the Netlify function and API key.",
        true
      );
    }
  });
}
