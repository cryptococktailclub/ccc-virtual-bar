// Crypto Cocktail Club – Virtual Bar Experience
// Matches: single-column layout (Hero → Vinyl Shelf → Listening Room → Bar Bot → Bar TV → Footer)

document.addEventListener("DOMContentLoaded", () => {
  // =========================
  // ELEMENT HOOKS
  // =========================
  const body = document.body;

  // Sticky header + hero
  const stickyNav = document.getElementById("stickyNav");
  const hero = document.getElementById("hero");
  const heroScrollTrigger = document.getElementById("heroScrollTrigger");

  // Nav / mobile nav
  const navButtons = document.querySelectorAll("[data-scroll-target]");
  const mobileNavButton = document.getElementById("mobileNavButton");
  const mobileNavDrawer = document.getElementById("mobileNavDrawer");
  const mobileNavBackdrop = document.getElementById("mobileNavBackdrop");
  const mobileNavClose = document.getElementById("mobileNavClose");

  // Vinyl / listening room
  const vinylRow = document.getElementById("vinylRow");
  const vinylItems = document.querySelectorAll(".vinyl-item");
  const albumArt = document.getElementById("albumArt");
  const turntablePlatter = document.getElementById("turntablePlatter");
  const playerEq = document.getElementById("playerEq");
  const volumeSlider = document.getElementById("volume-slider");
  const playBtn = document.getElementById("play-btn");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");

  const trackTitleEl = document.getElementById("track-title");
  const trackArtistEl = document.getElementById("track-artist");
  const trackDurationEl = document.getElementById("track-duration");
  const timeCurrentEl = document.getElementById("time-current");
  const timeRemainingEl = document.getElementById("time-remaining");
  const timelineBar = document.getElementById("timeline-bar");
  const timelineProgress = document.getElementById("timeline-progress");
  const dockTrack = document.getElementById("dockTrack");

  // Theme toggle
  const themeToggle = document.getElementById("themeToggle");
  const themePills = themeToggle
    ? themeToggle.querySelectorAll(".theme-pill")
    : [];

  // Audio element
  const audio = document.getElementById("bar-audio");

  // Bar TV
  const barTvVideo = document.getElementById("barTvVideo");
  const barTvChannelBtn = document.getElementById("barTvChannelBtn");
  const barTvPlayBtn = document.getElementById("barTvPlayBtn");
  const barTvMuteBtn = document.getElementById("barTvMuteBtn");
  const barTvVolume = document.getElementById("barTvVolume");
  const barTvTitle = document.getElementById("barTvTitle");

  // Bar Bot (AI bartender)
  const bartenderForm = document.getElementById("bartenderForm");
  const bartenderInput = document.getElementById("bartenderInput");
  const bartenderMessages = document.getElementById("bartenderMessages");
  const bartenderResults = document.getElementById("bartenderResults");
  const bartenderChips = document.querySelectorAll(".bartender-chip");

  // =========================
  // TRACK DATA
  // =========================
  const tracks = [
    {
      title: "Toby’s Mix",
      artist: "Toby",
      durationDisplay: "58:24",
      src: "https://visionary-beignet-7d270e.netlify.app/audio/tobys-mix.mp3",
    },
    {
      title: "Gold Hour Spritz",
      artist: "CCC Summer Set",
      durationDisplay: "60:00",
      src: "https://visionary-beignet-7d270e.netlify.app/audio/summer-mix.mp3",
    },
    {
      title: "Midnight Chrome",
      artist: "Kartell Tribute",
      durationDisplay: "59:30",
      src: "https://visionary-beignet-7d270e.netlify.app/audio/kartell-tribute.mp3",
    },
    {
      title: "Poolside Mirage",
      artist: "Solomun",
      durationDisplay: "60:00",
      src: "https://visionary-beignet-7d270e.netlify.app/audio/solomun-boiler.mp3",
    },
    {
      title: "Khruangbin Live",
      artist: "Pitchfork Live",
      durationDisplay: "47:00",
      src: "https://visionary-beignet-7d270e.netlify.app/audio/khruangbin-villain.mp3",
    },
    {
      title: "Succession Beats",
      artist: "Jsco Music",
      durationDisplay: "36:00",
      src: "https://visionary-beignet-7d270e.netlify.app/audio/succession-beats.mp3",
    },
  ];

  let currentTrackIndex = 0;
  let isPlaying = false;
  let lastKnownDuration = tracks[0]?.durationDisplay || "–:–";

  // =========================
  // UTILS
  // =========================

  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return "0:00";
    const s = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    const m = Math.floor(seconds / 60).toString();
    return `${m}:${s}`;
  }

  function scrollToSectionId(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const offset = 80; // leave room for sticky header
    const targetY = rect.top + window.scrollY - offset;
    window.scrollTo({ top: targetY, behavior: "smooth" });
  }

  // =========================
  // STICKY HEADER & HERO SCROLL
  // =========================

  function updateHeaderVisibility() {
    if (!stickyNav || !hero) return;
    const heroRect = hero.getBoundingClientRect();
    const threshold = 80;
    if (heroRect.bottom <= threshold) {
      stickyNav.classList.add("header-visible");
    } else {
      stickyNav.classList.remove("header-visible");
    }
  }

  window.addEventListener("scroll", updateHeaderVisibility, { passive: true });
  updateHeaderVisibility();

  if (heroScrollTrigger) {
    heroScrollTrigger.addEventListener("click", () => {
      scrollToSectionId("vinylShelfSection");
    });
  }

  // =========================
  // MOBILE NAV
  // =========================

  function openMobileNav() {
    if (!mobileNavDrawer || !mobileNavBackdrop) return;
    mobileNavDrawer.classList.add("open");
    mobileNavBackdrop.classList.add("visible");
  }

  function closeMobileNav() {
    if (!mobileNavDrawer || !mobileNavBackdrop) return;
    mobileNavDrawer.classList.remove("open");
    mobileNavBackdrop.classList.remove("visible");
  }

  if (mobileNavButton) {
    mobileNavButton.addEventListener("click", openMobileNav);
  }
  if (mobileNavClose) {
    mobileNavClose.addEventListener("click", closeMobileNav);
  }
  if (mobileNavBackdrop) {
    mobileNavBackdrop.addEventListener("click", closeMobileNav);
  }

  // Nav buttons -> smooth scroll
  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-scroll-target");
      if (target) {
        scrollToSectionId(target);
      }
      closeMobileNav();
    });
  });

  // =========================
  // THEME TOGGLE (Base / Gold / Platinum)
  // =========================

  function setTheme(theme) {
    body.classList.remove("theme-base", "theme-gold", "theme-platinum");
    body.classList.add(`theme-${theme}`);

    themePills.forEach((pill) => {
      const pillTheme = pill.getAttribute("data-theme");
      if (pillTheme === theme) {
        pill.classList.add("is-active");
      } else {
        pill.classList.remove("is-active");
      }
    });
  }

  if (themePills.length) {
    themePills.forEach((pill) => {
      pill.addEventListener("click", () => {
        const theme = pill.getAttribute("data-theme") || "base";
        setTheme(theme);
      });
    });
  }

  // Default theme
  setTheme("base");

  // =========================
  // AUDIO PLAYER (VINYL SHELF)
  // =========================

  function highlightActiveVinyl() {
    const buttons = document.querySelectorAll(".vinyl-item");
    buttons.forEach((btn) => {
      const idx = parseInt(btn.getAttribute("data-track-index") || "0", 10);
      if (idx === currentTrackIndex) {
        btn.classList.add("is-active");
      } else {
        btn.classList.remove("is-active");
      }
    });
  }

  function loadTrack(index) {
    const track = tracks[index];
    if (!track || !audio) return;

    currentTrackIndex = index;
    audio.src = track.src;
    trackTitleEl && (trackTitleEl.textContent = track.title);
    trackArtistEl && (trackArtistEl.textContent = track.artist);

    lastKnownDuration = track.durationDisplay || "–:–";
    if (trackDurationEl) trackDurationEl.textContent = lastKnownDuration;
    if (timeCurrentEl) timeCurrentEl.textContent = "0:00";
    if (timeRemainingEl) timeRemainingEl.textContent = `-${lastKnownDuration}`;
    if (timelineProgress) timelineProgress.style.width = "0%";
    if (dockTrack) dockTrack.textContent = `${track.title} — ${track.artist}`;

    highlightActiveVinyl();
  }

  function updatePlayUI(playing) {
    isPlaying = playing;
    if (playBtn) {
      playBtn.textContent = playing ? "Pause" : "Play";
    }
    if (turntablePlatter) {
      turntablePlatter.classList.toggle("is-playing", playing);
    }
    if (playerEq) {
      playerEq.classList.toggle("is-playing", playing);
    }
    if (albumArt) {
      albumArt.classList.toggle("glow-active", playing);
    }
  }

  function playCurrentTrack() {
    if (!audio) return;
    audio
      .play()
      .then(() => {
        updatePlayUI(true);
      })
      .catch((err) => {
        console.warn("Audio play blocked:", err);
      });
  }

  function pauseCurrentTrack() {
    if (!audio) return;
    audio.pause();
    updatePlayUI(false);
  }

  function togglePlay() {
    if (!audio) return;
    if (audio.paused) playCurrentTrack();
    else pauseCurrentTrack();
  }

  function playPrevTrack() {
    const newIndex =
      (currentTrackIndex - 1 + tracks.length) % tracks.length;
    loadTrack(newIndex);
    playCurrentTrack();
  }

  function playNextTrack() {
    const newIndex = (currentTrackIndex + 1) % tracks.length;
    loadTrack(newIndex);
    playCurrentTrack();
  }

  // Timeline updates
  if (audio) {
    audio.addEventListener("timeupdate", () => {
      if (!audio.duration || !timelineProgress) return;
      const ratio = audio.currentTime / audio.duration;
      timelineProgress.style.width = `${Math.min(100, ratio * 100)}%`;

      if (timeCurrentEl) timeCurrentEl.textContent = formatTime(audio.currentTime);
      if (timeRemainingEl) {
        const remaining = audio.duration - audio.currentTime;
        timeRemainingEl.textContent = `-${formatTime(remaining)}`;
      }
    });

    audio.addEventListener("loadedmetadata", () => {
      if (!audio.duration) return;
      if (trackDurationEl) trackDurationEl.textContent = formatTime(audio.duration);
      if (timeRemainingEl)
        timeRemainingEl.textContent = `-${formatTime(audio.duration)}`;
    });

    audio.addEventListener("ended", () => {
      playNextTrack();
    });
  }

  if (timelineBar && audio) {
    timelineBar.addEventListener("click", (e) => {
      const rect = timelineBar.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      if (!audio.duration) return;
      audio.currentTime = Math.max(0, Math.min(audio.duration * ratio, audio.duration));
    });
  }

  // Volume
  if (volumeSlider && audio) {
    volumeSlider.addEventListener("input", () => {
      audio.volume = parseFloat(volumeSlider.value);
    });
    audio.volume = parseFloat(volumeSlider.value || "0.8");
  }

  // Controls
  if (playBtn) {
    playBtn.addEventListener("click", togglePlay);
  }
  if (prevBtn) {
    prevBtn.addEventListener("click", playPrevTrack);
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", playNextTrack);
  }

  // Vinyl shelf click -> select track
  if (vinylRow) {
    vinylRow.addEventListener("click", (e) => {
      const btn = e.target.closest(".vinyl-item");
      if (!btn) return;
      const idxStr = btn.getAttribute("data-track-index") || "0";
      const idx = parseInt(idxStr, 10) || 0;
      loadTrack(idx);
      playCurrentTrack();

      // Extra: trigger album drop animation (in addition to inline script if present)
      if (albumArt) {
        albumArt.classList.remove("album-drop");
        void albumArt.offsetWidth;
        albumArt.classList.add("album-drop");
      }
    });
  }

  // Initialize first track
  if (tracks.length) {
    loadTrack(0);
  }

  // =========================
  // BAR TV
  // =========================

  const barTvChannels = [
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

  let barTvIndex = 0;
  let barTvIsPlaying = true;

  function loadBarTvChannel(index) {
    if (!barTvVideo) return;
    const ch = barTvChannels[index];
    if (!ch) return;

    barTvIndex = index;
    barTvVideo.src = ch.src;
    if (barTvTitle) barTvTitle.textContent = ch.title;

    barTvVideo
      .play()
      .then(() => {
        barTvIsPlaying = true;
        if (barTvPlayBtn) barTvPlayBtn.textContent = "⏸";
      })
      .catch((err) => {
        console.warn("Bar TV play blocked:", err);
      });
  }

  if (barTvVideo) {
    // Default volume
    if (barTvVolume) {
      barTvVideo.volume = parseFloat(barTvVolume.value || "0.5");
    }

    if (barTvChannelBtn) {
      barTvChannelBtn.addEventListener("click", () => {
        const nextIndex = (barTvIndex + 1) % barTvChannels.length;
        loadBarTvChannel(nextIndex);
      });
    }

    if (barTvPlayBtn) {
      barTvPlayBtn.addEventListener("click", () => {
        if (barTvVideo.paused) {
          barTvVideo
            .play()
            .then(() => {
              barTvIsPlaying = true;
              barTvPlayBtn.textContent = "⏸";
            })
            .catch((err) => console.warn("Bar TV play blocked:", err));
        } else {
          barTvVideo.pause();
          barTvIsPlaying = false;
          barTvPlayBtn.textContent = "▶";
        }
      });
    }

    if (barTvMuteBtn) {
      barTvMuteBtn.addEventListener("click", () => {
        barTvVideo.muted = !barTvVideo.muted;
        barTvMuteBtn.textContent = barTvVideo.muted ? "Sound: Off" : "Sound: On";
      });
    }

    if (barTvVolume) {
      barTvVolume.addEventListener("input", () => {
        barTvVideo.volume = parseFloat(barTvVolume.value);
        if (barTvVideo.volume === 0) {
          barTvVideo.muted = true;
          if (barTvMuteBtn) barTvMuteBtn.textContent = "Sound: Off";
        } else {
          barTvVideo.muted = false;
          if (barTvMuteBtn) barTvMuteBtn.textContent = "Sound: On";
        }
      });
    }

    // Initialize first channel label
    if (barTvTitle && barTvChannels[0]) {
      barTvTitle.textContent = barTvChannels[0].title;
    }
  }

  // =========================
  // BAR BOT (AI BARTENDER)
  // =========================

  // A very compact subset of Milk & Honey-style recipes for context
  const MH_RECIPES = [
    {
      name: "Gold Rush",
      category: "Whiskey Sour",
      glass: "Rocks",
      method: "Shake",
      ice: "Large cube",
      garnish: "Lemon twist",
      ingredients: [
        { amount: "2 oz", ingredient: "Bourbon" },
        { amount: "0.75 oz", ingredient: "Honey syrup (1:1)" },
        { amount: "0.75 oz", ingredient: "Fresh lemon juice" },
      ],
    },
    {
      name: "Penicillin",
      category: "Whiskey Sour",
      glass: "Rocks",
      method: "Shake, float",
      ice: "Cube or chunk",
      garnish: "Candied ginger",
      ingredients: [
        { amount: "2 oz", ingredient: "Blended Scotch" },
        { amount: "0.75 oz", ingredient: "Lemon juice" },
        { amount: "0.75 oz", ingredient: "Honey-ginger syrup" },
        { amount: "0.25 oz", ingredient: "Islay Scotch (float)" },
      ],
    },
    {
      name: "Daiquiri",
      category: "Rum Sour",
      glass: "Coupe",
      method: "Shake",
      ice: "Up (no ice)",
      garnish: "Lime wheel",
      ingredients: [
        { amount: "2 oz", ingredient: "White rum" },
        { amount: "0.75 oz", ingredient: "Lime juice" },
        { amount: "0.75 oz", ingredient: "Simple syrup" },
      ],
    },
  ];

  function appendBartenderMessage(role, text) {
    if (!bartenderMessages) return;
    const wrapper = document.createElement("div");
    wrapper.className =
      "bartender-message " +
      (role === "bot" ? "bartender-message-bot" : "bartender-message-user");

    if (role === "bot") {
      const avatar = document.createElement("div");
      avatar.className = "bartender-avatar";
      const bodyDiv = document.createElement("div");
      bodyDiv.className = "bartender-message-body";
      bodyDiv.innerHTML = text;
      wrapper.appendChild(avatar);
      wrapper.appendChild(bodyDiv);
    } else {
      const bodyDiv = document.createElement("div");
      bodyDiv.className = "bartender-message-body";
      bodyDiv.textContent = text;
      wrapper.appendChild(bodyDiv);
    }

    bartenderMessages.appendChild(wrapper);
    bartenderMessages.scrollTop = bartenderMessages.scrollHeight;
  }

  function showTypingIndicator() {
    if (!bartenderMessages) return;
    const el = document.createElement("div");
    el.className = "bartender-typing";
    el.dataset.typing = "true";
    el.innerHTML = `<span>.</span><span>.</span><span>.</span>`;
    bartenderMessages.appendChild(el);
    bartenderMessages.scrollTop = bartenderMessages.scrollHeight;
  }

  function clearTypingIndicator() {
    if (!bartenderMessages) return;
    const typingEls = bartenderMessages.querySelectorAll("[data-typing='true']");
    typingEls.forEach((el) => el.remove());
  }

  async function callBarBot(question) {
    appendBartenderMessage("user", question);
    showTypingIndicator();

    const payload = {
      question,
      recipes: MH_RECIPES, // small local subset
    };

    try {
      const res = await fetch("/.netlify/functions/ccc-bartender", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      clearTypingIndicator();

      if (!res.ok) {
        console.error("Bar Bot HTTP error:", res.status);
        appendBartenderMessage(
          "bot",
          "I couldn’t reach the back bar right now. Try again in a moment."
        );
        return;
      }

      const data = await res.json();
      console.log("Bar Bot response raw:", data);

      const answer = data.answer || "Here’s a drink idea, but the reply was empty.";
      appendBartenderMessage("bot", answer);
    } catch (err) {
      console.error("Bar Bot error:", err);
      clearTypingIndicator();
      appendBartenderMessage(
        "bot",
        "The bar’s connection is a little shaky. Please try again in a bit."
      );
    }
  }

  if (bartenderForm && bartenderInput) {
    bartenderForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const question = bartenderInput.value.trim();
      if (!question) return;
      bartenderInput.value = "";
      callBarBot(question);
    });
  }

  bartenderChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const prompt = chip.getAttribute("data-bartender-prompt") || "";
      if (!prompt) return;
      bartenderInput.value = prompt;
      bartenderInput.focus();
    });
  });
});
