// ==========================
// MEDIA CONFIG
// ==========================

const MEDIA_BASE = "https://visionary-beignet-7d270e.netlify.app";

// Make sure these paths match the real files in visionary-beignet-7d270e
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
  {
    title: "Plant Shop Throwbacks",
    artist: "Lotso / Plant Bass",
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
// THEME TOGGLE (Base / Gold / Platinum)
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
  const tonearm = document.getElementById("tonearm"); // for needle animation
  const turntable = document.querySelector(".turntable"); // for "speaker drop" feel

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
    console.warn("CCC: Audio player not fully wired – missing core elements.");
    return;
  }

  let currentIndex = 0;
  const audio = new Audio();
  audio.preload = "metadata";

  // Visual state for playing
  function setPlayingVisual(isPlaying) {
    if (platter) platter.classList.toggle("is-playing", isPlaying);
    if (eq) eq.classList.toggle("is-playing", isPlaying);
    if (albumArt) albumArt.classList.toggle("glow-active", isPlaying);
    if (tonearm) tonearm.classList.toggle("is-engaged", isPlaying);
    if (turntable) turntable.classList.toggle("speaker-drop-active", isPlaying);
  }

  function loadTrack(index, autoPlay = false) {
    const track = AUDIO_TRACKS[index];
    if (!track) {
      console.warn("CCC: Invalid track index", index);
      return;
    }

    currentIndex = index;
    audio.src = track.src;
    audio.currentTime = 0;

    if (trackTitleEl) trackTitleEl.textContent = track.title;
    if (trackArtistEl) trackArtistEl.textContent = track.artist;
    if (trackDurationEl) trackDurationEl.textContent = track.durationText || "--:--";
    if (timeCurrent) timeCurrent.textContent = "0:00";
    if (timeRemaining) {
      timeRemaining.textContent = track.durationText ? `-${track.durationText}` : "-0:00";
    }
    if (timelineProgress) timelineProgress.style.width = "0%";
    if (dockTrack) dockTrack.textContent = `${track.title} — ${track.artist}`;

    // Vinyl highlight + tiny drop animation
    vinylRow.querySelectorAll(".vinyl-item").forEach((btn, idx) => {
      btn.classList.toggle("is-active", idx === index);
      if (idx === index) {
        btn.style.animation = "vinylLand 0.35s ease-out";
        setTimeout(() => {
          btn.style.animation = "";
        }, 400);
      }
    });

    if (autoPlay) {
      audio
        .play()
        .then(() => {
          if (playBtn) playBtn.textContent = "Pause";
          setPlayingVisual(true);
        })
        .catch((err) => {
          console.warn("CCC: Audio play blocked or failed", err);
          setPlayingVisual(false);
        });
    } else {
      if (playBtn) playBtn.textContent = "Play";
      setPlayingVisual(false);
    }
  }

  // Initial track
  loadTrack(0, false);

  // Click vinyl to load + play
  vinylRow.querySelectorAll(".vinyl-item").forEach((btn, idx) => {
    btn.addEventListener("click", () => {
      loadTrack(idx, true);
    });
  });

  // Play / pause
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

  // Prev / next
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      const nextIndex = (currentIndex - 1 + AUDIO_TRACKS.length) % AUDIO_TRACKS.length;
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
    if (timelineProgress) timelineProgress.style.width = `${pct}%`;
    if (timeCurrent) timeCurrent.textContent = formatTime(audio.currentTime);
    if (timeRemaining) {
      timeRemaining.textContent = `-${formatTime(audio.duration - audio.currentTime)}`;
    }
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
  const rewindBtn = document.getElementById("tvRewindBtn");
  const forwardBtn = document.getElementById("tvForwardBtn");

  if (!videoEl) {
    console.warn("CCC: Bar TV video element missing.");
    return;
  }

  let currentChannel = 0;

  function loadChannel(index, autoPlay = true) {
    if (!VIDEO_SOURCES || !VIDEO_SOURCES[index]) {
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

  // Channel change
  if (chBtn) {
    chBtn.addEventListener("click", () => {
      if (!VIDEO_SOURCES || !VIDEO_SOURCES.length) return;
      const nextIndex = (currentChannel + 1) % VIDEO_SOURCES.length;
      loadChannel(nextIndex, true);
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

      // If user raises volume from 0, unmute
      if (vol > 0 && videoEl.muted) {
        videoEl.muted = false;
        if (muteBtn) muteBtn.textContent = "Sound On";
      }
    });
  }

  // NEW: Rewind 10 seconds
  if (rewindBtn) {
    rewindBtn.addEventListener("click", () => {
      if (!isFinite(videoEl.duration)) return;
      const target = Math.max(0, videoEl.currentTime - 10);
      videoEl.currentTime = target;
    });
  }

  // NEW: Fast-forward 10 seconds
  if (forwardBtn) {
    forwardBtn.addEventListener("click", () => {
      if (!isFinite(videoEl.duration)) return;
      const target = Math.min(videoEl.duration, videoEl.currentTime + 10);
      videoEl.currentTime = target;
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
  const recipePanel = document.getElementById("bartenderRecipePanel");

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
    typingEl.innerHTML =
      '<div class="bartender-avatar"></div>' +
      '<div class="bartender-text"><span>.</span><span>.</span><span>.</span></div>';
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

    // Clear any previous warnings if you want, but keep previous recipes
    appendMessage(question, false);
    inputEl.value = "";
    showTyping();

    try {
      const res = await fetch(BARTENDER_FUNCTION_PATH || "/.netlify/functions/ccc-bartender", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          recipes: [], // server will fall back to full Milk & Honey DB
        }),
      });

      hideTyping();

      if (!res.ok) {
        appendMessage("Bar Bot is temporarily offline. Try again shortly.", true);
        console.error("CCC Bar Bot HTTP error:", res.status, await res.text());
        return;
      }

      const data = await res.json();
      let structured = data.structured || null;

      // Fallback: try to parse data.answer if structured is missing
      if (!structured && typeof data.answer === "string") {
        try {
          structured = JSON.parse(data.answer);
        } catch (err) {
          console.warn("CCC Bar Bot: could not parse JSON answer:", err);
        }
      }

      // Render recipe cards from structured JSON
      renderRecipeCards(structured);

      // Also summarize in the chat thread
      if (structured && structured.summary) {
        appendMessage(structured.summary, true);
      } else if (data.answer) {
        // fallback: if we somehow got plain text
        appendMessage(data.answer, true);
      } else {
        appendMessage("I had trouble formatting that recipe. Try asking in a slightly different way.", true);
      }
    } catch (err) {
      hideTyping();
      console.error("CCC Bar Bot error:", err);
      appendMessage(
        "I couldn’t reach the back bar AI right now. Please check the Netlify function and OpenAI key.",
        true
      );
    }
  });
}
