// Crypto Cocktail Club – Virtual Bar Experience
// Front-end interactions: hero, themes, audio, Bar TV, AI bartender, requests, mobile nav.

document.addEventListener("DOMContentLoaded", () => {
  // ---------- CONSTANTS ----------
  const MEDIA_BASE = "https://visionary-beignet-7d270e.netlify.app/";

  // ---------- HERO + HEADER ----------
  const hero = document.getElementById("ccc-hero");
  const header = document.getElementById("ccc-header");
  const scrollArrow = document.querySelector(".hero-scroll-indicator");

  function updateHeaderVisibility() {
    if (!hero || !header) return;
    const heroHeight = hero.offsetHeight || window.innerHeight;
    const threshold = heroHeight * 0.55;
    if (window.scrollY > threshold) {
      header.classList.add("header-visible");
    } else {
      header.classList.remove("header-visible");
    }
  }

  window.addEventListener("scroll", updateHeaderVisibility);
  window.addEventListener("resize", updateHeaderVisibility);
  updateHeaderVisibility();

  if (scrollArrow) {
    scrollArrow.addEventListener("click", () => {
      const layout = document.querySelector(".layout");
      if (layout) {
        layout.scrollIntoView({ behavior: "smooth" });
      }
    });
  }

  // ---------- MOBILE NAV DRAWER ----------
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const mobileDrawer = document.getElementById("mobileNavDrawer");
  const mobileBackdrop = document.getElementById("mobileNavBackdrop");
  const mobileCloseBtn = mobileDrawer ? mobileDrawer.querySelector(".mobile-nav-close") : null;

  function openMobileNav() {
    if (!mobileDrawer || !mobileBackdrop) return;
    mobileDrawer.classList.add("open");
    mobileBackdrop.classList.add("visible");
  }

  function closeMobileNav() {
    if (!mobileDrawer || !mobileBackdrop) return;
    mobileDrawer.classList.remove("open");
    mobileBackdrop.classList.remove("visible");
  }

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener("click", openMobileNav);
  }
  if (mobileBackdrop) {
    mobileBackdrop.addEventListener("click", closeMobileNav);
  }
  if (mobileCloseBtn) {
    mobileCloseBtn.addEventListener("click", closeMobileNav);
  }

  // ---------- THEME TOGGLER ----------
  const body = document.body;
  const themeButtons = Array.from(document.querySelectorAll(".theme-pill[data-theme]"));

  function setTheme(theme) {
    themeButtons.forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.theme === theme);
    });
    body.classList.remove("theme-base", "theme-gold", "theme-platinum");
    body.classList.add(`theme-${theme}`);
  }

  themeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const theme = btn.dataset.theme || "base";
      setTheme(theme);
    });
  });

  // Default theme
  if (
    !body.classList.contains("theme-base") &&
    !body.classList.contains("theme-gold") &&
    !body.classList.contains("theme-platinum")
  ) {
    setTheme("base");
  }

  // ---------- AUDIO PLAYER / VINYL ----------
  const audio = document.getElementById("bar-audio");
  const playBtn = document.getElementById("play-btn");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const volumeSlider = document.getElementById("volume-slider");
  const turntablePlatter = document.getElementById("turntablePlatter");
  const albumArt = document.getElementById("albumArt");
  const playerEq = document.getElementById("playerEq");
  const dockTrackEl = document.getElementById("dockTrack");

  const trackTitleEl = document.getElementById("track-title");
  const trackArtistEl = document.getElementById("track-artist");
  const trackDurationEl = document.getElementById("track-duration");
  const timeCurrentEl = document.getElementById("time-current");
  const timeRemainingEl = document.getElementById("time-remaining");
  const timelineBar = document.getElementById("timeline-bar");
  const timelineProgress = document.getElementById("timeline-progress");

  const vinylRow = document.getElementById("vinylRow");

  const tracks = [
    {
      title: "Toby’s Mix",
      artist: "Toby",
      durationLabel: "58:24",
      file: MEDIA_BASE + "audio/tobys-mix.mp3",
    },
    {
      title: "Gold Hour Spritz",
      artist: "CCC – Summer Mix",
      durationLabel: "1:00:00",
      file: MEDIA_BASE + "audio/Summer mix.mp3",
    },
    {
      title: "Midnight Chrome",
      artist: "Kartell Tribute – Roche Musique",
      durationLabel: "1:00:00",
      file: MEDIA_BASE + "audio/Kartell Tribute Set - Roche Musique.mp3",
    },
    {
      title: "Poolside Mirage",
      artist: "Solomun Boiler Room",
      durationLabel: "1:00:00",
      file: MEDIA_BASE + "audio/Solomun Boiler Room DJ Set.mp3",
    },
    {
      title: "Khruangbin Live",
      artist: "Pitchfork Live at Villain",
      durationLabel: "1:00:00",
      file: MEDIA_BASE + "audio/Khruangbin at Villain _ Pitchfork Live.mp3",
    },
    {
      title: "Succession Beats",
      artist: "Jsco Music",
      durationLabel: "1:00:00",
      file: MEDIA_BASE + "audio/Succession Beats - Jsco Music .mp3",
    },
  ];

  let currentTrackIndex = 0;
  let isPlaying = false;
  let timelineDragging = false;

  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return "0:00";
    const s = Math.floor(seconds);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  }

  function updateDockTrack(track) {
    if (dockTrackEl) {
      dockTrackEl.textContent = `${track.title} — ${track.artist}`;
    }
  }

  function updateNowPlayingDisplay(track) {
    if (trackTitleEl) trackTitleEl.textContent = track.title;
    if (trackArtistEl) trackArtistEl.textContent = track.artist;
    if (trackDurationEl) trackDurationEl.textContent = track.durationLabel;
    updateDockTrack(track);
  }

  function setPlayingState(playing) {
    isPlaying = playing;
    if (playBtn) {
      playBtn.textContent = playing ? "Pause" : "Play";
    }
    if (turntablePlatter) {
      turntablePlatter.classList.toggle("is-playing", playing);
    }
    if (albumArt) {
      albumArt.classList.toggle("glow-active", playing);
    }
    if (playerEq) {
      playerEq.classList.toggle("is-playing", playing);
    }
  }

  function loadTrack(index) {
    if (!audio) return;
    const clampedIndex = ((index % tracks.length) + tracks.length) % tracks.length;
    currentTrackIndex = clampedIndex;
    const track = tracks[clampedIndex];
    audio.src = track.file;
    updateNowPlayingDisplay(track);
  }

  function playCurrentTrack() {
    if (!audio) return;
    audio
      .play()
      .then(() => {
        setPlayingState(true);
      })
      .catch(() => {
        setPlayingState(false);
      });
  }

  function pauseCurrentTrack() {
    if (!audio) return;
    audio.pause();
    setPlayingState(false);
  }

  if (volumeSlider && audio) {
    audio.volume = parseFloat(volumeSlider.value || "0.8");
    volumeSlider.addEventListener("input", () => {
      const v = parseFloat(volumeSlider.value || "0.8");
      audio.volume = isNaN(v) ? 0.8 : v;
    });
  }

  if (playBtn) {
    playBtn.addEventListener("click", () => {
      if (!audio) return;
      if (audio.paused) {
        playCurrentTrack();
      } else {
        pauseCurrentTrack();
      }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      loadTrack(currentTrackIndex - 1);
      playCurrentTrack();
      highlightVinyl(currentTrackIndex);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      loadTrack(currentTrackIndex + 1);
      playCurrentTrack();
      highlightVinyl(currentTrackIndex);
    });
  }

  if (timelineBar && audio) {
    const handleSeek = (clientX) => {
      const rect = timelineBar.getBoundingClientRect();
      const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      if (!isFinite(ratio) || !audio.duration) return;
      audio.currentTime = ratio * audio.duration;
    };

    timelineBar.addEventListener("click", (e) => {
      handleSeek(e.clientX);
    });

    timelineBar.addEventListener("mousedown", (e) => {
      timelineDragging = true;
      handleSeek(e.clientX);
    });

    window.addEventListener("mousemove", (e) => {
      if (timelineDragging) {
        handleSeek(e.clientX);
      }
    });
    window.addEventListener("mouseup", () => {
      timelineDragging = false;
    });
  }

  if (audio) {
    audio.addEventListener("timeupdate", () => {
      if (!audio.duration || !timelineProgress) return;
      const progress = (audio.currentTime / audio.duration) * 100;
      timelineProgress.style.width = `${progress}%`;

      if (timeCurrentEl) timeCurrentEl.textContent = formatTime(audio.currentTime);
      if (timeRemainingEl)
        timeRemainingEl.textContent = `-${formatTime(audio.duration - audio.currentTime)}`;
    });

    audio.addEventListener("play", () => setPlayingState(true));
    audio.addEventListener("pause", () => setPlayingState(false));
    audio.addEventListener("ended", () => {
      // auto-advance to next track
      loadTrack(currentTrackIndex + 1);
      playCurrentTrack();
      highlightVinyl(currentTrackIndex);
    });
  }

  function highlightVinyl(index) {
  if (!vinylRow) return;
  const buttons = Array.from(vinylRow.querySelectorAll(".vinyl-item"));

  buttons.forEach((btn, i) => {
    const isActive = i === index;

    // toggle "is-active" for glow / styling
    btn.classList.toggle("is-active", isActive);

    // reset landing class so we can re-trigger animation
    btn.classList.remove("vinyl-landing");

    if (isActive) {
      // force a reflow so the animation can restart
      // (Safari / Chrome both need this sometimes)
      void btn.offsetWidth;
      btn.classList.add("vinyl-landing");
    }
  });
}


  if (vinylRow) {
    vinylRow.addEventListener("click", (e) => {
      const target = e.target.closest(".vinyl-item");
      if (!target) return;
      const idxStr = target.getAttribute("data-track-index");
      const idx = idxStr ? parseInt(idxStr, 10) : 0;
      if (!Number.isNaN(idx)) {
        loadTrack(idx);
        playCurrentTrack();
        highlightVinyl(idx);
      }
    });
  }

  // Initialize first track
  if (tracks.length > 0) {
    loadTrack(0);
    highlightVinyl(0);
  }

  // ---------- BAR TV ----------
  const tvVideo = document.getElementById("barTvVideo");
  const tvChannelBtn = document.getElementById("barTvChannelBtn");
  const tvPlayBtn = document.getElementById("barTvPlayBtn");
  const tvMuteBtn = document.getElementById("barTvMuteBtn");
  const tvVolumeSlider = document.getElementById("barTvVolume");
  const tvInner = document.getElementById("barTvInner");
  const tvTitleEl = document.getElementById("barTvTitle");

  const tvChannels = [
    { src: MEDIA_BASE + "video/bar_tape_01.mp4", title: "Bar Tape 01" },
    { src: MEDIA_BASE + "video/bar_tape_02.mp4", title: "Bar Tape 02" },
    { src: MEDIA_BASE + "video/bar_tape_03.mp4", title: "Bar Tape 03" },
    { src: MEDIA_BASE + "video/bar_tape_04.mp4", title: "Bar Tape 04" },
    { src: MEDIA_BASE + "video/bar_tape_05.mp4", title: "Bar Tape 05" },
    { src: MEDIA_BASE + "video/bar_tape_06.mp4", title: "Bar Tape 06" },
    { src: MEDIA_BASE + "video/bar_tape_07.mp4", title: "Bar Tape 07" },
    { src: MEDIA_BASE + "video/bar_tape_08.mp4", title: "Bar Tape 08" },
    { src: MEDIA_BASE + "video/bar_tape_09.mp4", title: "Bar Tape 09" },
  ];

  let tvIndex = 0;

  function loadTvChannel(index) {
    if (!tvVideo || !tvInner) return;
    const clamped = ((index % tvChannels.length) + tvChannels.length) % tvChannels.length;
    tvIndex = clamped;
    const ch = tvChannels[clamped];
    tvInner.classList.add("tv-fading");
    tvVideo.src = ch.src;
    tvVideo
      .play()
      .then(() => {
        if (tvPlayBtn) tvPlayBtn.textContent = "⏸";
      })
      .catch(() => {
        if (tvPlayBtn) tvPlayBtn.textContent = "▶";
      })
      .finally(() => {
        tvInner.classList.remove("tv-fading");
      });

    if (tvTitleEl) tvTitleEl.textContent = ch.title;
  }

  if (tvChannelBtn) {
    tvChannelBtn.addEventListener("click", () => {
      loadTvChannel(tvIndex + 1);
    });
  }

  if (tvPlayBtn && tvVideo) {
    tvPlayBtn.addEventListener("click", () => {
      if (tvVideo.paused) {
        tvVideo
          .play()
          .then(() => {
            tvPlayBtn.textContent = "⏸";
          })
          .catch(() => {
            tvPlayBtn.textContent = "▶";
          });
      } else {
        tvVideo.pause();
        tvPlayBtn.textContent = "▶";
      }
    });
  }

  if (tvMuteBtn && tvVideo) {
    tvMuteBtn.addEventListener("click", () => {
      tvVideo.muted = !tvVideo.muted;
      tvMuteBtn.textContent = tvVideo.muted ? "Sound: Off" : "Sound: On";
    });
  }

  if (tvVolumeSlider && tvVideo) {
    tvVideo.volume = parseFloat(tvVolumeSlider.value || "0.5");
    tvVolumeSlider.addEventListener("input", () => {
      const v = parseFloat(tvVolumeSlider.value || "0.5");
      tvVideo.volume = isNaN(v) ? 0.5 : v;
      tvVideo.muted = v === 0;
      if (tvMuteBtn) {
        tvMuteBtn.textContent = tvVideo.muted ? "Sound: Off" : "Sound: On";
      }
    });
  }

  // Initialize TV
  if (tvChannels.length > 0) {
    loadTvChannel(0);
  }

  // ---------- REQUESTS QUEUE ----------
  const requestsListEl = document.getElementById("requestsList");
  const requestsForm = document.getElementById("requestsForm");
  const requestNameInput = document.getElementById("requestName");
  const requestTrackInput = document.getElementById("requestTrack");
  const requestNoteInput = document.getElementById("requestNote");

  const REQUESTS_KEY = "cccRequests";

  function loadRequests() {
    try {
      const stored = localStorage.getItem(REQUESTS_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveRequests(list) {
    try {
      localStorage.setItem(REQUESTS_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  }

  function renderRequests(list) {
    if (!requestsListEl) return;
    requestsListEl.innerHTML = "";
    if (!list.length) {
      const empty = document.createElement("div");
      empty.textContent = "No requests yet. Be the first to set the mood.";
      empty.style.color = "var(--text-muted)";
      empty.style.fontSize = "0.78rem";
      requestsListEl.appendChild(empty);
      return;
    }

    list.forEach((req) => {
      const item = document.createElement("div");
      item.className = "request-item";
      const who = req.name ? `${req.name} · ` : "";
      const note = req.note ? ` — ${req.note}` : "";
      item.textContent = `${who}${req.track}${note}`;
      requestsListEl.appendChild(item);
    });
  }

  let requests = loadRequests();
  renderRequests(requests);

  if (requestsForm) {
    requestsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const trackVal = requestTrackInput ? requestTrackInput.value.trim() : "";
      if (!trackVal) return;
      const nameVal = requestNameInput ? requestNameInput.value.trim() : "";
      const noteVal = requestNoteInput ? requestNoteInput.value.trim() : "";

      const entry = {
        name: nameVal,
        track: trackVal,
        note: noteVal,
        ts: Date.now(),
      };
      requests.push(entry);
      if (requests.length > 60) {
        requests = requests.slice(-60);
      }
      saveRequests(requests);
      renderRequests(requests);

      if (requestTrackInput) requestTrackInput.value = "";
      if (requestNoteInput) requestNoteInput.value = "";
    });
  }

  // ---------- AI BARTENDER ----------
  const bartenderForm = document.getElementById("bartenderForm");
  const bartenderInput = document.getElementById("bartenderInput");
  const bartenderMessages = document.getElementById("bartenderMessages");
  const bartenderResults = document.getElementById("bartenderResults");
  const bartenderChips = Array.from(document.querySelectorAll(".bartender-chip"));

  function appendBartenderMessage(content, isBot = false) {
    if (!bartenderMessages) return;
    const wrapper = document.createElement("div");
    wrapper.className = "bartender-message";

    if (isBot) {
      wrapper.classList.add("bartender-message-bot");
      const avatar = document.createElement("div");
      avatar.className = "bartender-avatar";
      wrapper.appendChild(avatar);
    } else {
      const spacer = document.createElement("div");
      spacer.style.width = "26px";
      wrapper.appendChild(spacer);
    }

    const bodyDiv = document.createElement("div");
    bodyDiv.className = "bartender-message-body";
    bodyDiv.innerHTML = content;
    wrapper.appendChild(bodyDiv);

    bartenderMessages.appendChild(wrapper);
    bartenderMessages.scrollTop = bartenderMessages.scrollHeight;
  }

  let typingEl = null;

  function showTyping() {
    if (!bartenderMessages) return;
    if (typingEl) return;
    typingEl = document.createElement("div");
    typingEl.className = "bartender-typing";
    typingEl.innerHTML = `CCC Bartender is mixing<span>.</span><span>.</span><span>.</span>`;
    bartenderMessages.appendChild(typingEl);
    bartenderMessages.scrollTop = bartenderMessages.scrollHeight;
  }

  function hideTyping() {
    if (typingEl && bartenderMessages) {
      bartenderMessages.removeChild(typingEl);
    }
    typingEl = null;
  }

  async function sendToBartender(prompt) {
    showTyping();
    try {
      const res = await fetch("/.netlify/functions/ccc-bartender", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: prompt }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const reply = data && (data.reply || data.message || data.text);
      hideTyping();
      if (reply) {
        appendBartenderMessage(reply, true);
      } else {
        appendBartenderMessage(
          "I couldn't quite parse that reply from the back bar. Try again in a moment.",
          true
        );
      }
    } catch (err) {
      console.error("Bartender error:", err);
      hideTyping();
      appendBartenderMessage(
        "I couldn’t reach the back bar AI right now. Check your Netlify function and OpenAI key.",
        true
      );
    }
  }

  if (bartenderForm) {
    bartenderForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!bartenderInput) return;
      const val = bartenderInput.value.trim();
      if (!val) return;
      appendBartenderMessage(val, false);
      bartenderInput.value = "";
      sendToBartender(val);
    });
  }

  bartenderChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const prompt = chip.getAttribute("data-bartender-prompt") || chip.textContent || "";
      if (!prompt) return;
      appendBartenderMessage(prompt, false);
      sendToBartender(prompt);
    });
  });
});
