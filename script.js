// ===== CONFIG =====
const MEDIA_BASE = "https://visionary-beignet-7d270e.netlify.app";

// Audio playlists
const PLAYLISTS = [
  {
    title: "Toby’s Mix",
    artist: "Toby",
    file: "tobys-mix.mp3",
  },
  {
    title: "Gold Hour Spritz",
    artist: "CCC",
    file: "Summer mix.mp3",
  },
  {
    title: "Midnight Chrome",
    artist: "CCC",
    file: "Kartell Tribute Set - Roche Musique.mp3",
  },
  {
    title: "Poolside Mirage",
    artist: "Solomun",
    file: "Solomun Boiler Room DJ Set.mp3",
  },
  {
    title: "Khruangbin Live",
    artist: "Khruangbin",
    file: "Khruangbin at Villain _ Pitchfork Live.mp3",
  },
  {
    title: "Succession Beats",
    artist: "Jsco Music",
    file: "Succession Beats - Jsco Music .mp3",
  },
];

// Bar TV channels
const TV_CHANNELS = [
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

document.addEventListener("DOMContentLoaded", () => {
  // ===== DOM HOOKS (guarded) =====
  const body = document.body;

  // Audio / listening room
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
  const vinylItems = vinylRow
    ? Array.from(vinylRow.querySelectorAll(".vinyl-item"))
    : [];

  // Bar TV
  const barTvVideo = document.getElementById("barTvVideo");
  const barTvChannelBtn = document.getElementById("barTvChannelBtn");
  const barTvPlayBtn = document.getElementById("barTvPlayBtn");
  const barTvMuteBtn = document.getElementById("barTvMuteBtn");
  const barTvAspect = document.querySelector(".bar-tv-aspect");

  // Theme
  const themePills = Array.from(document.querySelectorAll(".theme-pill"));

  // Bar Bot
  const bartenderForm = document.getElementById("bartenderForm");
  const bartenderInput = document.getElementById("bartenderInput");
  const bartenderMessages = document.getElementById("bartenderMessages");

  // Mobile nav / sticky header
  const mobileNavButton = document.getElementById("mobileNavButton");
  const mobileNavDrawer = document.getElementById("mobileNavDrawer");
  const mobileNavBackdrop = document.getElementById("mobileNavBackdrop");
  const mobileNavClose = document.getElementById("mobileNavClose");
  const stickyNav = document.getElementById("stickyNav");

  // Guestbook
  const guestbookForm = document.getElementById("guestbookForm");
  const guestbookName = document.getElementById("guestbookName");
  const guestbookMessage = document.getElementById("guestbookMessage");
  const guestbookList = document.getElementById("guestbookList");

  // EQ bars
  const eqBars = playerEq ? Array.from(playerEq.querySelectorAll(".eq-bar")) : [];

  // ===== WEB AUDIO SETUP =====
  let audioCtx = null;
  let sourceNode = null;
  let analyser = null;
  let gainNode = null;
  let eqAnimating = false;
  let currentTrackIndex = 0;

  function initAudioContext() {
    if (!audioEl) return;
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      sourceNode = audioCtx.createMediaElementSource(audioEl);
      analyser = audioCtx.createAnalyser();
      gainNode = audioCtx.createGain();

      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;

      // source -> analyser (for data)
      sourceNode.connect(analyser);
      // source -> gain -> destination (for audio output)
      sourceNode.connect(gainNode);
      gainNode.connect(audioCtx.destination);
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  // ===== PLAYLIST + LISTENING ROOM =====
  function loadTrack(index) {
    if (!audioEl || !trackTitle || !trackArtist || !dockTrack) return;
    const track = PLAYLISTS[index];
    if (!track) return;

    currentTrackIndex = index;
    const encoded = encodeURIComponent(track.file);
    audioEl.src = `${MEDIA_BASE}/audio/${encoded}`;
    trackTitle.textContent = track.title;
    trackArtist.textContent = track.artist;
    dockTrack.textContent = `${track.title} — ${track.artist}`;

    // highlight vinyl
    vinylItems.forEach((v, i) => {
      if (i === index) v.classList.add("is-active");
      else v.classList.remove("is-active");
    });

    // trigger album drop
    if (albumArt) {
      albumArt.classList.remove("album-drop");
      void albumArt.offsetWidth; // reflow
      albumArt.classList.add("album-drop");
    }
  }

  if (audioEl) {
    // initial track
    loadTrack(0);

    audioEl.addEventListener("loadedmetadata", () => {
      if (!timeRemaining) return;
      timeRemaining.textContent = "-" + formatTime(audioEl.duration);
    });

    audioEl.addEventListener("timeupdate", () => {
      if (!timelineProgress || !timeCurrent || !timeRemaining) return;
      if (!audioEl.duration) return;

      const pct = (audioEl.currentTime / audioEl.duration) * 100;
      timelineProgress.style.width = `${pct}%`;
      timeCurrent.textContent = formatTime(audioEl.currentTime);
      timeRemaining.textContent = "-" + formatTime(audioEl.duration - audioEl.currentTime);
    });

    audioEl.addEventListener("ended", () => {
      const nextIndex = (currentTrackIndex + 1) % PLAYLISTS.length;
      loadTrack(nextIndex);
      audioEl.play().catch(() => {});
      setPlayingState(true);
    });
  }

  if (timelineBar && audioEl) {
    timelineBar.addEventListener("click", (e) => {
      if (!audioEl.duration) return;
      const rect = timelineBar.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      audioEl.currentTime = ratio * audioEl.duration;
    });
  }

  function setPlayingState(isPlaying) {
    if (!audioEl) return;
    if (playBtn) playBtn.textContent = isPlaying ? "Pause" : "Play";
    if (platter) platter.classList.toggle("playing", isPlaying);
    if (playerEq) playerEq.classList.toggle("playing", isPlaying);
    if (tonearm) {
      tonearm.classList.toggle("on", isPlaying);
      tonearm.classList.toggle("off", !isPlaying);
    }
    if (isPlaying && analyser && !eqAnimating) {
      eqAnimating = true;
      requestAnimationFrame(eqLoop);
    }
    if (!isPlaying) {
      eqAnimating = false;
      if (eqBars.length) {
        eqBars.forEach((bar) => (bar.style.transform = "scaleY(0.2)"));
      }
    }
  }

  if (playBtn && audioEl) {
    playBtn.addEventListener("click", () => {
      initAudioContext();
      if (audioEl.paused) {
        audioEl.play().catch(() => {});
        setPlayingState(true);
      } else {
        audioEl.pause();
        setPlayingState(false);
      }
    });
  }

  if (prevBtn && audioEl) {
    prevBtn.addEventListener("click", () => {
      const prevIdx =
        (currentTrackIndex - 1 + PLAYLISTS.length) % PLAYLISTS.length;
      loadTrack(prevIdx);
      initAudioContext();
      audioEl.play().catch(() => {});
      setPlayingState(true);
    });
  }

  if (nextBtn && audioEl) {
    nextBtn.addEventListener("click", () => {
      const nextIdx = (currentTrackIndex + 1) % PLAYLISTS.length;
      loadTrack(nextIdx);
      initAudioContext();
      audioEl.play().catch(() => {});
      setPlayingState(true);
    });
  }

  if (volumeSlider) {
    volumeSlider.addEventListener("input", () => {
      const v = parseFloat(volumeSlider.value);
      if (gainNode) {
        gainNode.gain.value = v;
      } else if (audioEl) {
        audioEl.volume = v;
      }
    });
  }

  // vinyl click → change track
  if (vinylItems.length && audioEl) {
    vinylItems.forEach((item, index) => {
      item.addEventListener("click", () => {
        loadTrack(index);
        initAudioContext();
        audioEl.play().catch(() => {});
        setPlayingState(true);
      });
    });
  }

  // EQ loop (FFT-driven)
  function eqLoop() {
    if (!eqAnimating || !analyser || !eqBars.length) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);

    const bands = 4;
    const binsPerBand = Math.floor(data.length / bands);

    for (let i = 0; i < bands; i++) {
      let sum = 0;
      const start = i * binsPerBand;
      const end = start + binsPerBand;
      for (let j = start; j < end; j++) sum += data[j];
      const avg = sum / binsPerBand;
      const scale = 0.2 + (avg / 255) * 0.8;
      eqBars[i].style.transform = `scaleY(${scale})`;
    }
    requestAnimationFrame(eqLoop);
  }

  function formatTime(sec) {
    sec = Math.max(0, sec || 0);
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" + s : s}`;
  }

  // ===== BAR TV CHANNEL LOGIC =====
  let tvIndex = 0;

  function setTvSource(index) {
    if (!barTvVideo) return;
    tvIndex = index;
    barTvVideo.src = TV_CHANNELS[tvIndex];
    barTvVideo.play().catch(() => {});
    if (barTvAspect) {
      barTvAspect.classList.add("flash");
      setTimeout(() => barTvAspect.classList.remove("flash"), 120);
    }
  }

  if (barTvVideo) {
    // ensure initial src
    setTvSource(0);
  }

  if (barTvChannelBtn) {
    barTvChannelBtn.addEventListener("click", () => {
      const next = (tvIndex + 1) % TV_CHANNELS.length;
      setTvSource(next);
    });
  }
  if (barTvPlayBtn && barTvVideo) {
    barTvPlayBtn.addEventListener("click", () => {
      if (barTvVideo.paused) {
        barTvVideo.play().catch(() => {});
        barTvPlayBtn.textContent = "⏸";
      } else {
        barTvVideo.pause();
        barTvPlayBtn.textContent = "▶︎";
      }
    });
  }
  if (barTvMuteBtn && barTvVideo) {
    barTvMuteBtn.addEventListener("click", () => {
      barTvVideo.muted = !barTvVideo.muted;
      barTvMuteBtn.textContent = barTvVideo.muted ? "Sound Off" : "Sound On";
    });
  }

  // ===== THEME ENGINE =====
  function setTheme(theme) {
    if (!body) return;
    body.classList.remove("theme-base", "theme-gold", "theme-platinum");
    body.classList.add(`theme-${theme}`);
  }

  themePills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const theme = pill.dataset.theme;
      themePills.forEach((p) => p.classList.remove("is-active"));
      pill.classList.add("is-active");
      setTheme(theme);
    });
  });

  // ensure default
  setTheme("base");

  // ===== BAR BOT (Netlify function) =====
  function appendBotMessage(text) {
    if (!bartenderMessages) return null;
    const div = document.createElement("div");
    div.className = "bartender-message bartender-message-bot";
    div.innerHTML = `<strong>Bar Bot:</strong> ${text}`;
    bartenderMessages.appendChild(div);
    bartenderMessages.scrollTop = bartenderMessages.scrollHeight;
    return div;
  }
  function appendUserMessage(text) {
    if (!bartenderMessages) return;
    const div = document.createElement("div");
    div.className = "bartender-message bartender-message-user";
    div.innerHTML = `<strong>You:</strong> ${text}`;
    bartenderMessages.appendChild(div);
    bartenderMessages.scrollTop = bartenderMessages.scrollHeight;
  }

  if (bartenderForm && bartenderInput) {
    bartenderForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const q = bartenderInput.value.trim();
      if (!q) return;
      appendUserMessage(q);
      bartenderInput.value = "";

      const thinking = appendBotMessage("…thinking…");

      try {
        const res = await fetch("/.netlify/functions/ccc-bartender", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q }),
        });
        const data = await res.json();
        const answer = data.answer || "I couldn’t parse that one—try again?";
        if (thinking) {
          thinking.innerHTML = `<strong>Bar Bot:</strong> ${answer}`;
        }
      } catch (err) {
        if (thinking) {
          thinking.innerHTML =
            "<strong>Bar Bot:</strong> I couldn’t reach the back bar AI right now.";
        }
      }
    });
  }

  // ===== SMOOTH SCROLL NAV (HEADER + MOBILE) =====
  document.querySelectorAll("[data-scroll-target]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.scrollTarget;
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ behavior: "smooth" });
      }
      closeMobileNav();
    });
  });

  if (mobileNavButton && mobileNavDrawer && mobileNavBackdrop) {
    mobileNavButton.addEventListener("click", () => {
      mobileNavDrawer.classList.add("open");
      mobileNavBackdrop.classList.add("visible");
    });
  }
  if (mobileNavClose && mobileNavDrawer && mobileNavBackdrop) {
    mobileNavClose.addEventListener("click", closeMobileNav);
  }
  if (mobileNavBackdrop && mobileNavDrawer && mobileNavBackdrop) {
    mobileNavBackdrop.addEventListener("click", closeMobileNav);
  }

  function closeMobileNav() {
    if (!mobileNavDrawer || !mobileNavBackdrop) return;
    mobileNavDrawer.classList.remove("open");
    mobileNavBackdrop.classList.remove("visible");
  }

  // Sticky header
  if (stickyNav) {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 120) stickyNav.classList.add("visible");
      else stickyNav.classList.remove("visible");
    });
  }

  // ===== GUESTBOOK (localStorage) =====
  let guestbookNotes = [];
  if (guestbookList) {
    const saved = localStorage.getItem("guestbookNotes");
    if (saved) {
      try {
        guestbookNotes = JSON.parse(saved) || [];
      } catch {
        guestbookNotes = [];
      }
    }
    // render existing
    guestbookNotes.forEach((note) => {
      const li = createGuestbookNoteElement(note);
      guestbookList.appendChild(li);
    });

    if (guestbookForm && guestbookMessage) {
      guestbookForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const msg = guestbookMessage.value.trim();
        const name = guestbookName ? guestbookName.value.trim() : "";
        if (!msg) return;

        const note = { message: msg, name };
        guestbookNotes.push(note);
        localStorage.setItem("guestbookNotes", JSON.stringify(guestbookNotes));

        const li = createGuestbookNoteElement(note, true);
        guestbookList.appendChild(li);
        guestbookList.scrollTop = guestbookList.scrollHeight;

        if (guestbookName) guestbookName.value = "";
        guestbookMessage.value = "";
      });
    }

    guestbookList.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.classList.contains("delete-note")) return;
      const li = target.closest(".guestbook-note");
      if (!li) return;
      const idx = Array.from(guestbookList.children).indexOf(li);
      if (idx >= 0) {
        guestbookNotes.splice(idx, 1);
        localStorage.setItem("guestbookNotes", JSON.stringify(guestbookNotes));
      }
      li.classList.add("removing");
      setTimeout(() => {
        if (li.parentElement) li.parentElement.removeChild(li);
      }, 350);
    });
  }

  function createGuestbookNoteElement(note, animate = false) {
    const li = document.createElement("li");
    li.className = "guestbook-note";
    if (animate) li.classList.add("sliding");
    li.innerHTML = `
      <p>${note.message}</p>
      ${note.name ? `<small>– ${note.name}</small>` : ""}
      <button class="delete-note" title="Remove note">×</button>
    `;
    if (animate) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => li.classList.remove("sliding"));
      });
    }
    return li;
  }
});
