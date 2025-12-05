document.addEventListener("DOMContentLoaded", () => {
  /* =========================
     THEME TOGGLE
     ========================= */
  const body = document.body;
  const themeButtons = document.querySelectorAll(".theme-pill");

  function setTheme(theme) {
    body.classList.remove("theme-base", "theme-gold", "theme-platinum");
    body.classList.add(`theme-${theme}`);
  }

  themeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      themeButtons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const theme = btn.dataset.theme || "base";
      setTheme(theme);
    });
  });

  /* =========================
     STICKY HEADER AFTER HERO
     ========================= */
  const header = document.getElementById("mainHeader");
  const hero = document.querySelector(".ccc-hero");
  const mobileNavButton = document.getElementById("mobileNavButton");
  const mobileNavDrawer = document.getElementById("mobileNavDrawer");
  const mobileNavBackdrop = document.getElementById("mobileNavBackdrop");
  const mobileNavClose = document.getElementById("mobileNavClose");

  function updateHeaderVisibility() {
    if (!hero || !header) return;
    const threshold = hero.offsetHeight * 0.6;
    if (window.scrollY > threshold) {
      header.classList.add("header-visible");
    } else {
      header.classList.remove("header-visible");
    }
  }

  updateHeaderVisibility();
  window.addEventListener("scroll", updateHeaderVisibility);

  if (mobileNavButton && mobileNavDrawer && mobileNavBackdrop && mobileNavClose) {
    const openMobileNav = () => {
      mobileNavDrawer.classList.add("open");
      mobileNavBackdrop.classList.add("visible");
    };
    const closeMobileNav = () => {
      mobileNavDrawer.classList.remove("open");
      mobileNavBackdrop.classList.remove("visible");
    };
    mobileNavButton.addEventListener("click", openMobileNav);
    mobileNavClose.addEventListener("click", closeMobileNav);
    mobileNavBackdrop.addEventListener("click", closeMobileNav);
  }

  /* =========================
     AUDIO PLAYER + VINYL SHELF
     ========================= */
  const audio = document.getElementById("bar-audio");
  const trackTitleEl = document.getElementById("track-title");
  const trackArtistEl = document.getElementById("track-artist");
  const trackDurationEl = document.getElementById("track-duration");
  const playBtn = document.getElementById("play-btn");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const volumeSlider = document.getElementById("volume-slider");
  const timelineBar = document.getElementById("timeline-bar");
  const timelineProgress = document.getElementById("timeline-progress");
  const timeCurrentEl = document.getElementById("time-current");
  const timeRemainingEl = document.getElementById("time-remaining");
  const dockTrackEl = document.getElementById("dockTrack");
  const turntablePlatter = document.getElementById("turntablePlatter");
  const albumArt = document.getElementById("albumArt");
  const playerEq = document.getElementById("playerEq");
  const vinylRow = document.getElementById("vinylRow");
  const vinylItems = vinylRow ? vinylRow.querySelectorAll(".vinyl-item") : [];

  // NOTE: keep URLs matching your Netlify media bucket
  const TRACKS = [
    {
      title: "Toby’s Mix",
      artist: "Toby",
      duration: "58:24",
      src: "https://visionary-beignet-7d270e.netlify.app/audio/tobys-mix.mp3",
    },
    {
      title: "Gold Hour Spritz",
      artist: "Summer Mix",
      duration: "59:10",
      src: "https://visionary-beignet-7d270e.netlify.app/audio/summer_mix.mp3",
    },
    {
      title: "Midnight Chrome",
      artist: "Kartell Tribute – Roche Musique",
      duration: "60:02",
      src: "https://visionary-beignet-7d270e.netlify.app/audio/kartell_tribute.mp3",
    },
    {
      title: "Poolside Mirage",
      artist: "Solomun Boiler Room",
      duration: "59:45",
      src: "https://visionary-beignet-7d270e.netlify.app/audio/solomun_boiler_room.mp3",
    },
    {
      title: "Khruangbin Live",
      artist: "Pitchfork Live at Villain",
      duration: "47:30",
      src: "https://visionary-beignet-7d270e.netlify.app/audio/khruangbin_live.mp3",
    },
    {
      title: "Succession Beats",
      artist: "Jsco Music",
      duration: "42:12",
      src: "https://visionary-beignet-7d270e.netlify.app/audio/succession_beats.mp3",
    },
  ];

  let currentTrackIndex = 0;
  let isDraggingTimeline = false;

  function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const s = Math.floor(seconds);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  }

  function setActiveVinyl(index) {
    vinylItems.forEach((item, i) => {
      if (i === index) {
        item.classList.add("is-active");
        // subtle bounce animation
        item.style.animation = "none";
        void item.offsetWidth;
        item.style.animation = "vinylLand 0.45s ease-out";
      } else {
        item.classList.remove("is-active");
        item.style.animation = "none";
      }
    });
  }

  // record "drop" animation for platter
  function triggerVinylDrop() {
    if (!turntablePlatter) return;
    turntablePlatter.classList.remove("drop-in");
    // force reflow
    void turntablePlatter.offsetWidth;
    turntablePlatter.classList.add("drop-in");
  }

  function updateDockTrack(track) {
    if (!dockTrackEl || !track) return;
    dockTrackEl.textContent = `${track.title} — ${track.artist}`;
  }

  function loadTrack(index, { autoplay = false } = {}) {
    const track = TRACKS[index];
    if (!track || !audio) return;

    currentTrackIndex = index;
    audio.src = track.src;
    audio.load();

    if (trackTitleEl) trackTitleEl.textContent = track.title;
    if (trackArtistEl) trackArtistEl.textContent = track.artist;
    if (trackDurationEl) trackDurationEl.textContent = track.duration;
    if (timeCurrentEl) timeCurrentEl.textContent = "0:00";
    if (timeRemainingEl) timeRemainingEl.textContent = `-${track.duration}`;
    if (timelineProgress) timelineProgress.style.width = "0%";

    setActiveVinyl(index);
    updateDockTrack(track);
    triggerVinylDrop();

    if (autoplay) {
      playAudio();
    } else {
      pauseAudio();
    }
  }

  function setPlayingState(isPlaying) {
    if (playBtn) playBtn.textContent = isPlaying ? "Pause" : "Play";
    if (turntablePlatter) {
      if (isPlaying) turntablePlatter.classList.add("is-playing");
      else turntablePlatter.classList.remove("is-playing");
    }
    if (playerEq) {
      if (isPlaying) playerEq.classList.add("is-playing");
      else playerEq.classList.remove("is-playing");
    }
    if (albumArt) {
      if (isPlaying) albumArt.classList.add("glow-active");
      else albumArt.classList.remove("glow-active");
    }
  }

  function playAudio() {
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

  function pauseAudio() {
    if (!audio) return;
    audio.pause();
    setPlayingState(false);
  }

  if (playBtn) {
    playBtn.addEventListener("click", () => {
      if (!audio) return;
      if (audio.paused) playAudio();
      else pauseAudio();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      const nextIndex = (currentTrackIndex - 1 + TRACKS.length) % TRACKS.length;
      loadTrack(nextIndex, { autoplay: true });
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      const nextIndex = (currentTrackIndex + 1) % TRACKS.length;
      loadTrack(nextIndex, { autoplay: true });
    });
  }

  if (volumeSlider && audio) {
    audio.volume = parseFloat(volumeSlider.value || "0.8");
    volumeSlider.addEventListener("input", () => {
      audio.volume = parseFloat(volumeSlider.value);
    });
  }

  if (audio) {
    audio.addEventListener("timeupdate", () => {
      if (isDraggingTimeline) return;
      const current = audio.currentTime;
      const duration = audio.duration || 0;
      if (timeCurrentEl) timeCurrentEl.textContent = formatTime(current);
      if (timeRemainingEl) timeRemainingEl.textContent = `-${formatTime(duration - current)}`;
      if (timelineProgress && duration > 0) {
        const pct = (current / duration) * 100;
        timelineProgress.style.width = `${pct}%`;
      }
    });

    audio.addEventListener("ended", () => {
      const nextIndex = (currentTrackIndex + 1) % TRACKS.length;
      loadTrack(nextIndex, { autoplay: true });
    });
  }

  if (timelineBar && audio) {
    const seek = (event) => {
      const rect = timelineBar.getBoundingClientRect();
      const ratio = Math.min(Math.max(0, event.clientX - rect.left), rect.width) / rect.width;
      const duration = audio.duration || 0;
      audio.currentTime = ratio * duration;
    };

    timelineBar.addEventListener("mousedown", (e) => {
      isDraggingTimeline = true;
      seek(e);
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDraggingTimeline) return;
      seek(e);
    });

    window.addEventListener("mouseup", () => {
      if (isDraggingTimeline) {
        isDraggingTimeline = false;
      }
    });
  }

  // Vinyl click → load track + drop animation
  vinylItems.forEach((item, index) => {
    item.addEventListener("click", () => {
      loadTrack(index, { autoplay: true });
    });
  });

  // initial track
  loadTrack(currentTrackIndex, { autoplay: false });

  /* =========================
     BAR TV
     ========================= */
  const barTvVideo = document.getElementById("barTvVideo");
  const barTvChannelBtn = document.getElementById("barTvChannelBtn");
  const barTvPlayBtn = document.getElementById("barTvPlayBtn");
  const barTvMuteBtn = document.getElementById("barTvMuteBtn");
  const barTvVolume = document.getElementById("barTvVolume");
  const barTvTitle = document.getElementById("barTvTitle");

  const BAR_TAPES = [
    {
      title: "Bar Tape 01",
      src: "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_01.mp4",
    },
    {
      title: "Bar Tape 02",
      src: "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_02.mp4",
    },
    {
      title: "Bar Tape 03",
      src: "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_03.mp4",
    },
    {
      title: "Bar Tape 04",
      src: "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_04.mp4",
    },
    {
      title: "Bar Tape 05",
      src: "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_05.mp4",
    },
    {
      title: "Bar Tape 06",
      src: "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_06.mp4",
    },
    {
      title: "Bar Tape 07",
      src: "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_07.mp4",
    },
    {
      title: "Bar Tape 08",
      src: "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_08.mp4",
    },
    {
      title: "Bar Tape 09",
      src: "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_09.mp4",
    },
  ];

  let currentBarTapeIndex = 0;

  function loadBarTape(index) {
    if (!barTvVideo) return;
    const tape = BAR_TAPES[index];
    if (!tape) return;

    currentBarTapeIndex = index;
    barTvVideo.src = tape.src;
    barTvVideo.load();
    barTvVideo.play().catch(() => {});
    if (barTvTitle) barTvTitle.textContent = tape.title;
    if (barTvPlayBtn) barTvPlayBtn.textContent = "⏸";
  }

  if (barTvChannelBtn) {
    barTvChannelBtn.addEventListener("click", () => {
      const nextIndex = (currentBarTapeIndex + 1) % BAR_TAPES.length;
      loadBarTape(nextIndex);
    });
  }

  if (barTvPlayBtn && barTvVideo) {
    barTvPlayBtn.addEventListener("click", () => {
      if (barTvVideo.paused) {
        barTvVideo.play().catch(() => {});
        barTvPlayBtn.textContent = "⏸";
      } else {
        barTvVideo.pause();
        barTvPlayBtn.textContent = "▶";
      }
    });
  }

  if (barTvMuteBtn && barTvVideo) {
    barTvMuteBtn.addEventListener("click", () => {
      barTvVideo.muted = !barTvVideo.muted;
      barTvMuteBtn.textContent = barTvVideo.muted ? "Sound: Off" : "Sound: On";
    });
  }

  if (barTvVolume && barTvVideo) {
    barTvVideo.volume = parseFloat(barTvVolume.value || "0.5");
    barTvVolume.addEventListener("input", () => {
      barTvVideo.volume = parseFloat(barTvVolume.value);
    });
  }

  // initial tape
  loadBarTape(currentBarTapeIndex);

  /* =========================
     REQUEST QUEUE
     ========================= */
  const requestsForm = document.getElementById("requestsForm");
  const requestsList = document.getElementById("requestsList");
  const requestNameInput = document.getElementById("requestName");
  const requestTrackInput = document.getElementById("requestTrack");
  const requestNoteInput = document.getElementById("requestNote");

  function renderRequests() {
    if (!requestsList) return;
    const saved = JSON.parse(localStorage.getItem("cccRequests") || "[]");
    requestsList.innerHTML = "";
    saved.forEach((req) => {
      const div = document.createElement("div");
      div.className = "request-item";
      div.innerHTML = `
        <strong>${req.track}</strong>
        <div>${req.name || "Guest"}</div>
        ${req.note ? `<div>${req.note}</div>` : ""}
      `;
      requestsList.appendChild(div);
    });
  }

  if (requestsForm) {
    requestsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = requestNameInput?.value.trim() || "";
      const track = requestTrackInput?.value.trim() || "";
      const note = requestNoteInput?.value.trim() || "";
      if (!track) return;
      const saved = JSON.parse(localStorage.getItem("cccRequests") || "[]");
      saved.unshift({
        name,
        track,
        note,
        ts: Date.now(),
      });
      localStorage.setItem("cccRequests", JSON.stringify(saved.slice(0, 40)));
      if (requestTrackInput) requestTrackInput.value = "";
      if (requestNoteInput) requestNoteInput.value = "";
      renderRequests();
    });
  }

  renderRequests();

  /* =========================
     BAR BOT (AI BARTENDER)
     ========================= */
  const bartenderForm = document.getElementById("bartenderForm");
  const bartenderInput = document.getElementById("bartenderInput");
  const bartenderMessages = document.getElementById("bartenderMessages");
  const bartenderResults = document.getElementById("bartenderResults");
  const bartenderChips = document.querySelectorAll(".bartender-chip");

  // very lightweight recipe metadata stub (full data comes from server / PDF extraction)
  const MH_RECIPES = [
    { name: "Gold Rush", category: "whiskey sour", glass: "rocks", method: "shake" },
    { name: "Penicillin", category: "scotch sour", glass: "rocks", method: "shake" },
    { name: "Paper Plane", category: "whiskey sour", glass: "coupe", method: "shake" },
  ];

  function appendBartenderMessage({ from, text }) {
    if (!bartenderMessages) return;
    const wrap = document.createElement("div");
    wrap.className = "bartender-message";

    const avatar = document.createElement("div");
    avatar.className = "bartender-avatar";

    const body = document.createElement("div");
    body.className = "bartender-message-body";

    if (from === "bot") {
      wrap.classList.add("bartender-message-bot");
    } else {
      wrap.classList.add("bartender-message-user");
    }

    if (from === "bot") {
      body.innerHTML = text;
      wrap.appendChild(avatar);
      wrap.appendChild(body);
    } else {
      body.textContent = text;
      wrap.appendChild(body);
    }

    bartenderMessages.appendChild(wrap);
    bartenderMessages.scrollTop = bartenderMessages.scrollHeight;
  }

  function setTyping(isTyping) {
    if (!bartenderMessages) return;
    let el = bartenderMessages.querySelector(".bartender-typing");
    if (isTyping && !el) {
      el = document.createElement("div");
      el.className = "bartender-typing";
      el.innerHTML = `<span>.</span><span>.</span><span>.</span>`;
      bartenderMessages.appendChild(el);
      bartenderMessages.scrollTop = bartenderMessages.scrollHeight;
    } else if (!isTyping && el) {
      el.remove();
    }
  }

  async function askBartender(question) {
    if (!question) return;
    appendBartenderMessage({ from: "user", text: question });
    setTyping(true);

    try {
      // send a small subset of recipes; server has full text
      const response = await fetch("/.netlify/functions/ccc-bartender", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          recipes: MH_RECIPES,
        }),
      });

      if (!response.ok) {
        appendBartenderMessage({
          from: "bot",
          text:
            "I couldn’t reach the back bar AI right now. Check your Netlify function and OpenAI key.",
        });
        return;
      }

      const data = await response.json();
      const answer = data.answer || "";
      appendBartenderMessage({ from: "bot", text: answer });
    } catch (err) {
      appendBartenderMessage({
        from: "bot",
        text: "Looks like there’s a connection issue. Try again in a moment.",
      });
    } finally {
      setTyping(false);
    }
  }

  if (bartenderForm && bartenderInput) {
    bartenderForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = bartenderInput.value.trim();
      if (!q) return;
      bartenderInput.value = "";
      askBartender(q);
    });
  }

  bartenderChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const prompt = chip.getAttribute("data-bartender-prompt");
      if (!prompt) return;
      askBartender(prompt);
    });
  });

  // simple local "results" panel example (shows the stubbed recipes)
  if (bartenderResults) {
    bartenderResults.innerHTML = MH_RECIPES.map((r) => `<div>${r.name}</div>`).join("");
  }
});
