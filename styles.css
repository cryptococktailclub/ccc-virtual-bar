document.addEventListener("DOMContentLoaded", () => {
  /* ==========================================================
     CCC – Virtual Bar Experience
     script.js (clean, DOM-safe, fully wired)
  ========================================================== */

  const MEDIA_BASE = "https://visionary-beignet-7d270e.netlify.app";

  /* -----------------------------
     AUDIO TRACKS & VIDEO TAPES
  ----------------------------- */

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
      file: `${MEDIA_BASE}/audio/Summer%20mix.mp3`,
      duration: "60:12"
    },
    {
      title: "Kartell Tribute",
      artist: "Roche Musique",
      file: `${MEDIA_BASE}/audio/Kartell%20Tribute%20Set%20-%20Roche%20Musique.mp3`,
      duration: "52:18"
    },
    {
      title: "Solomun Boiler Room",
      artist: "Solomun",
      file: `${MEDIA_BASE}/audio/Solomun%20Boiler%20Room%20DJ%20Set.mp3`,
      duration: "58:00"
    },
    {
      title: "Khruangbin Live",
      artist: "Pitchfork",
      file: `${MEDIA_BASE}/audio/Khruangbin%20at%20Villain%20_%20Pitchfork%20Live.mp3`,
      duration: "47:42"
    },
    {
      title: "Succession Beats",
      artist: "JSCO",
      file: `${MEDIA_BASE}/audio/Succession%20Beats%20-%20Jsco%20Music%20.mp3`,
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
  ].map(name => `${MEDIA_BASE}/video/${name}`);

  /* -----------------------------
     DOM ELEMENTS
  ----------------------------- */

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

  const turntablePlatter = document.getElementById("turntablePlatter");
  const playerEq = document.getElementById("playerEq");

  const themeButtons = document.querySelectorAll(".theme-pill");

  const barTvVideo = document.getElementById("barTvVideo");
  const tvChannelBtn = document.getElementById("tvChannelBtn");
  const tvPlayBtn = document.getElementById("tvPlayBtn");
  const tvMuteBtn = document.getElementById("tvMuteBtn");
  const tvVolume = document.getElementById("tvVolume");

  const bartenderForm = document.getElementById("bartenderForm");
  const bartenderInput = document.getElementById("bartenderInput");
  const bartenderMessages = document.getElementById("bartenderMessages");

  const topNav = document.getElementById("topNav");

  /* -----------------------------
     AUDIO ENGINE
  ----------------------------- */

  const audio = new Audio();
  audio.volume = 0.8;

  let currentTrackIndex = 0;
  let isPlaying = false;

  function loadTrack(index) {
    const track = AUDIO_TRACKS[index];
    if (!track) return;

    audio.src = track.file;
    currentTrackIndex = index;

    // Update UI
    trackTitle.textContent = track.title;
    trackArtist.textContent = track.artist;
    trackDuration.textContent = track.duration;
    dockTrack.textContent = `${track.title} — ${track.artist}`;

    // Vinyl active state
    vinylItems.forEach(btn => btn.classList.remove("is-active"));
    const activeBtn = document.querySelector(`.vinyl-item[data-track-index="${index}"]`);
    if (activeBtn) activeBtn.classList.add("is-active");
  }

  function playTrack() {
    if (!audio.src) loadTrack(currentTrackIndex);
    audio.play().catch(() => {});
    isPlaying = true;
    playBtn.textContent = "Pause";
    turntablePlatter.classList.add("is-playing");
    playerEq.classList.add("is-playing");
  }

  function pauseTrack() {
    audio.pause();
    isPlaying = false;
    playBtn.textContent = "Play";
    turntablePlatter.classList.remove("is-playing");
    playerEq.classList.remove("is-playing");
  }

  // Initial load
  loadTrack(0);

  /* Controls */

  playBtn.addEventListener("click", () => {
    isPlaying ? pauseTrack() : playTrack();
  });

  prevBtn.addEventListener("click", () => {
    const nextIndex = currentTrackIndex - 1 < 0 ? AUDIO_TRACKS.length - 1 : currentTrackIndex - 1;
    loadTrack(nextIndex);
    playTrack();
  });

  nextBtn.addEventListener("click", () => {
    const nextIndex = (currentTrackIndex + 1) % AUDIO_TRACKS.length;
    loadTrack(nextIndex);
    playTrack();
  });

  vinylItems.forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.trackIndex);
      loadTrack(idx);
      playTrack();
    });
  });

  /* Timeline */

  audio.addEventListener("timeupdate", () => {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    timelineProgress.style.width = `${pct}%`;

    timeCurrent.textContent = formatTime(audio.currentTime);
    timeRemaining.textContent = "-" + formatTime(audio.duration - audio.currentTime);
  });

  timelineBar.addEventListener("click", evt => {
    if (!audio.duration) return;
    const rect = timelineBar.getBoundingClientRect();
    const pct = (evt.clientX - rect.left) / rect.width;
    audio.currentTime = pct * audio.duration;
  });

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  /* Volume */

  volumeSlider.addEventListener("input", e => {
    audio.volume = Number(e.target.value);
  });

  /* -----------------------------
     THEMES
  ----------------------------- */

  themeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const theme = btn.dataset.theme;
      themeButtons.forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      document.body.className = `theme-${theme}`;
    });
  });

  /* -----------------------------
     BAR TV
  ----------------------------- */

  function randomTapeUrl() {
    const index = Math.floor(Math.random() * VIDEO_TAPES.length);
    return VIDEO_TAPES[index];
  }

  // Ensure Bar TV has a tape
  if (barTvVideo) {
    barTvVideo.src = VIDEO_TAPES[0];
    barTvVideo.muted = true;
    barTvVideo.play().catch(() => {});
  }

  tvChannelBtn.addEventListener("click", () => {
    if (!barTvVideo) return;
    barTvVideo.src = randomTapeUrl();
    barTvVideo.play().catch(() => {});
    tvPlayBtn.textContent = "Pause";
  });

  tvPlayBtn.addEventListener("click", () => {
    if (!barTvVideo) return;
    if (barTvVideo.paused) {
      barTvVideo.play().catch(() => {});
      tvPlayBtn.textContent = "Pause";
    } else {
      barTvVideo.pause();
      tvPlayBtn.textContent = "Play";
    }
  });

  tvMuteBtn.addEventListener("click", () => {
    if (!barTvVideo) return;
    barTvVideo.muted = !barTvVideo.muted;
    tvMuteBtn.textContent = barTvVideo.muted ? "Sound On" : "Sound Off";
  });

  tvVolume.addEventListener("input", e => {
    if (!barTvVideo) return;
    barTvVideo.volume = Number(e.target.value);
  });

  /* -----------------------------
     FLOATING HEADER
  ----------------------------- */

  window.addEventListener("scroll", () => {
    if (!topNav) return;
    if (window.scrollY > 240) {
      topNav.classList.add("header-visible");
    } else {
      topNav.classList.remove("header-visible");
    }
  });

  /* -----------------------------
     BAR BOT
  ----------------------------- */

  function appendMessage(type, text) {
    if (!bartenderMessages) return;

    if (type === "user") {
      const div = document.createElement("div");
      div.className = "bartender-message bartender-user";
      div.innerHTML = `<div class="bartender-text-user">${escapeHtml(text)}</div>`;
      bartenderMessages.appendChild(div);
    } else if (type === "bot") {
      const div = document.createElement("div");
      div.className = "bartender-message bartender-bot";
      div.innerHTML = `
        <div class="bartender-avatar"></div>
        <div class="bartender-text">${text}</div>
      `;
      bartenderMessages.appendChild(div);
    }

    bartenderMessages.scrollTop = bartenderMessages.scrollHeight;
  }

  function appendTyping() {
    if (!bartenderMessages) return;
    const div = document.createElement("div");
    div.id = "typingIndicator";
    div.className = "typing";
    div.textContent = "Bar Bot is thinking…";
    bartenderMessages.appendChild(div);
    bartenderMessages.scrollTop = bartenderMessages.scrollHeight;
  }

  function removeTyping() {
    const el = document.getElementById("typingIndicator");
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  if (bartenderForm) {
    bartenderForm.addEventListener("submit", async e => {
      e.preventDefault();
      const question = bartenderInput.value.trim();
      if (!question) return;

      appendMessage("user", question);
      bartenderInput.value = "";
      appendTyping();

      try {
        const res = await fetch("/.netlify/functions/ccc-bartender", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question })
        });

        const data = await res.json();
        removeTyping();

        if (data && data.answer) {
          appendMessage("bot", data.answer);
        } else {
          appendMessage("bot", "Here’s a drink idea—but I couldn’t parse a structured reply from the function.");
        }
      } catch (err) {
        removeTyping();
        appendMessage("bot", "I couldn’t reach the back bar AI right now. Check your Netlify function and OpenAI key.");
      }
    });
  }
});
