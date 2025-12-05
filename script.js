// Crypto Cocktail Club – Virtual Listening Bar

document.addEventListener("DOMContentLoaded", () => {
  // ---------- AUDIO PLAYER ----------
  const audio = document.getElementById("bar-audio");
  const playBtn = document.getElementById("play-btn");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const volumeSlider = document.getElementById("volume-slider");
  const turntablePlatter = document.getElementById("turntablePlatter");
  const albumArt = document.getElementById("albumArt");
  const playerEq = document.getElementById("playerEq");

  const trackTitleEl = document.getElementById("track-title");
  const trackArtistEl = document.getElementById("track-artist");
  const trackDurationEl = document.getElementById("track-duration");
  const timeCurrentEl = document.getElementById("time-current");
  const timeRemainingEl = document.getElementById("time-remaining");
  const timelineBar = document.getElementById("timeline-bar");
  const timelineProgress = document.getElementById("timeline-progress");
  const dockTrackEl = document.getElementById("dockTrack");

  const vinylRow = document.getElementById("vinylRow");

  const tracks = [
    {
      title: "Toby’s Mix",
      artist: "Toby",
      durationLabel: "58:24",
      src: "https://visionary-beignet-7d270e.netlify.app/audio/tobys-mix.mp3"
    },
    {
      title: "Gold Hour Spritz",
      artist: "Summer Mix",
      durationLabel: "59:59",
      src: "https://visionary-beignet-7d270e.netlify.app/audio/Summer%20mix.mp3"
    },
    {
      title: "Midnight Chrome",
      artist: "Kartell Tribute – Roche Musique",
      durationLabel: "59:32",
      src: "https://visionary-beignet-7d270e.netlify.app/audio/Kartell%20Tribute%20Set%20-%20Roche%20Musique.mp3"
    },
    {
      title: "Poolside Mirage",
      artist: "Solomun Boiler Room",
      durationLabel: "59:45",
      src: "https://visionary-beignet-7d270e.netlify.app/audio/Solomun%20Boiler%20Room%20DJ%20Set.mp3"
    },
    {
      title: "Khruangbin Live",
      artist: "Pitchfork Live at Villain",
      durationLabel: "43:20",
      src: "https://visionary-beignet-7d270e.netlify.app/audio/Khruangbin%20at%20Villain%20_%20Pitchfork%20Live.mp3"
    },
    {
      title: "Succession Beats",
      artist: "Jsco Music",
      durationLabel: "59:05",
      src: "https://visionary-beignet-7d270e.netlify.app/audio/Succession%20Beats%20-%20Jsco%20Music%20.mp3"
    }
  ];

  let currentTrackIndex = 0;
  let isScrubbing = false;

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "0:00";
    const s = Math.max(0, Math.floor(seconds));
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  }

  function updatePlayUI(isPlaying) {
    if (!playBtn) return;
    playBtn.textContent = isPlaying ? "Pause" : "Play";

    if (turntablePlatter) {
      if (isPlaying) {
        turntablePlatter.classList.add("is-playing");
      } else {
        turntablePlatter.classList.remove("is-playing");
      }
    }

    if (playerEq) {
      if (isPlaying) {
        playerEq.classList.add("is-playing");
      } else {
        playerEq.classList.remove("is-playing");
      }
    }

    if (albumArt) {
      if (isPlaying) {
        albumArt.classList.add("glow-active");
      } else {
        albumArt.classList.remove("glow-active");
      }
    }
  }

  function updateTrackMeta(index) {
    const track = tracks[index];
    if (!track) return;
    if (trackTitleEl) trackTitleEl.textContent = track.title;
    if (trackArtistEl) trackArtistEl.textContent = track.artist;
    if (trackDurationEl) trackDurationEl.textContent = track.durationLabel;
    if (timeRemainingEl) timeRemainingEl.textContent = "-" + track.durationLabel;
    if (dockTrackEl) dockTrackEl.textContent = `${track.title} — ${track.artist}`;
  }

  function loadTrack(index) {
    if (!audio) return;
    const track = tracks[index];
    if (!track) return;

    currentTrackIndex = index;
    audio.src = track.src;
    updateTrackMeta(index);
    highlightVinyl(index);
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

  function playNextTrack() {
    const nextIndex = (currentTrackIndex + 1) % tracks.length;
    loadTrack(nextIndex);
    playCurrentTrack();
  }

  function playPrevTrack() {
    const prevIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
    loadTrack(prevIndex);
    playCurrentTrack();
  }

  if (audio && volumeSlider) {
    audio.volume = parseFloat(volumeSlider.value ?? "0.8");

    volumeSlider.addEventListener("input", () => {
      audio.volume = parseFloat(volumeSlider.value || "0.8");
    });
  }

  if (audio && playBtn) {
    playBtn.addEventListener("click", togglePlay);
  }
  if (audio && nextBtn) {
    nextBtn.addEventListener("click", playNextTrack);
  }
  if (audio && prevBtn) {
    prevBtn.addEventListener("click", playPrevTrack);
  }

  if (audio && timelineBar && timelineProgress && timeCurrentEl && timeRemainingEl) {
    timelineBar.addEventListener("click", (e) => {
      const rect = timelineBar.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      if (!Number.isFinite(ratio) || !audio.duration) return;
      audio.currentTime = ratio * audio.duration;
    });

    timelineBar.addEventListener("mousedown", (e) => {
      isScrubbing = true;
      const rect = timelineBar.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      if (audio.duration && Number.isFinite(ratio)) {
        audio.currentTime = Math.max(0, Math.min(audio.duration * ratio, audio.duration));
      }
    });

    window.addEventListener("mousemove", (e) => {
      if (!isScrubbing) return;
      const rect = timelineBar.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      if (audio.duration && Number.isFinite(ratio)) {
        audio.currentTime = Math.max(0, Math.min(audio.duration * ratio, audio.duration));
      }
    });

    window.addEventListener("mouseup", () => {
      if (isScrubbing) {
        isScrubbing = false;
      }
    });

    audio.addEventListener("timeupdate", () => {
      if (!audio.duration) return;
      const ratio = audio.currentTime / audio.duration;
      timelineProgress.style.width = `${ratio * 100}%`;
      timeCurrentEl.textContent = formatTime(audio.currentTime);
      timeRemainingEl.textContent = "-" + formatTime(audio.duration - audio.currentTime);
    });

    audio.addEventListener("ended", () => {
      playNextTrack();
    });
  }

  function animateVinylToTurntable(sourceButton) {
    if (!sourceButton || !turntablePlatter) return;

    const btnRect = sourceButton.getBoundingClientRect();
    const platterRect = turntablePlatter.getBoundingClientRect();

    const size = Math.min(btnRect.width, btnRect.height, 140);

    const startX = btnRect.left + btnRect.width / 2 - size / 2;
    const startY = btnRect.top + btnRect.height / 2 - size / 2;

    const endX = platterRect.left + platterRect.width / 2 - size / 2;
    const endY = platterRect.top + platterRect.height / 2 - size / 2;

    const flying = document.createElement("div");
    flying.className = "flying-vinyl";
    flying.style.width = `${size}px`;
    flying.style.height = `${size}px`;
    flying.style.left = `${startX}px`;
    flying.style.top = `${startY}px`;

    document.body.appendChild(flying);

    requestAnimationFrame(() => {
      flying.style.transform = `translate(${endX - startX}px, ${endY - startY}px) scale(0.6) rotate(540deg)`;
      flying.style.opacity = "0";
    });

    flying.addEventListener("transitionend", () => {
      flying.remove();
    });
  }

  function highlightVinyl(index) {
    if (!vinylRow) return;
    const buttons = Array.from(vinylRow.querySelectorAll(".vinyl-item"));

    buttons.forEach((btn, i) => {
      const isActive = i === index;

      btn.classList.toggle("is-active", isActive);
      btn.classList.remove("vinyl-landing");

      if (isActive) {
        void btn.offsetWidth; // reflow so animation can restart
        btn.classList.add("vinyl-landing");
      }
    });
  }

  if (vinylRow) {
    const vinylButtons = Array.from(vinylRow.querySelectorAll(".vinyl-item"));

    vinylButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.trackIndex || 0);
        animateVinylToTurntable(btn);
        loadTrack(idx);
        playCurrentTrack();
      });
    });
  }

  loadTrack(currentTrackIndex);

  // ---------- THEME TOGGLE (no logo swap) ----------
  const themeButtons = Array.from(document.querySelectorAll(".theme-pill"));
  const bodyEl = document.body;

  function setTheme(theme) {
    if (!bodyEl) return;

    bodyEl.classList.remove("theme-base", "theme-gold", "theme-platinum");

    switch (theme) {
      case "gold":
        bodyEl.classList.add("theme-gold");
        break;
      case "platinum":
        bodyEl.classList.add("theme-platinum");
        break;
      default:
        bodyEl.classList.add("theme-base");
    }

    themeButtons.forEach((b) => {
      b.classList.toggle("is-active", b.dataset.theme === theme);
    });
  }

  if (themeButtons.length) {
    themeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const theme = btn.dataset.theme || "base";
        setTheme(theme);
      });
    });
  }

  setTheme("base");

  // ---------- BAR TV ----------
  const tvVideo = document.getElementById("barTvVideo");
  const tvChannelBtn = document.getElementById("barTvChannelBtn");
  const tvPlayBtn = document.getElementById("barTvPlayBtn");
  const tvMuteBtn = document.getElementById("barTvMuteBtn");
  const tvVolumeSlider = document.getElementById("barTvVolume");
  const tvTitleEl = document.getElementById("barTvTitle");

  const tvChannels = [
    {
      title: "Bar Tape 01",
      src: "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_01.mp4"
    },
    {
      title: "Bar Tape 02",
      src: "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_02.mp4"
    },
    {
      title: "Bar Tape 03",
      src: "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_03.mp4"
    },
    {
      title: "Bar Tape 04",
      src: "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_04.mp4"
    },
    {
      title: "Bar Tape 05",
      src: "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_05.mp4"
    },
    {
      title: "Bar Tape 06",
      src: "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_06.mp4"
    },
    {
      title: "Bar Tape 07",
      src: "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_07.mp4"
    },
    {
      title: "Bar Tape 08",
      src: "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_08.mp4"
    },
    {
      title: "Bar Tape 09",
      src: "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_09.mp4"
    }
  ];

  let currentChannelIndex = 0;

  function loadChannel(index) {
    if (!tvVideo) return;
    const chan = tvChannels[index];
    if (!chan) return;
    currentChannelIndex = index;
    tvVideo.src = chan.src;
    if (tvTitleEl) tvTitleEl.textContent = chan.title;
    tvVideo.load();
    tvVideo
      .play()
      .then(() => {
        if (tvPlayBtn) tvPlayBtn.textContent = "⏸";
      })
      .catch(() => {
        if (tvPlayBtn) tvPlayBtn.textContent = "▶";
      });
  }

  if (tvVideo) {
    tvVideo.addEventListener("loadedmetadata", () => {
      if (tvPlayBtn) tvPlayBtn.textContent = tvVideo.paused ? "▶" : "⏸";
    });
  }

  if (tvChannelBtn) {
    tvChannelBtn.addEventListener("click", () => {
      const nextIndex = (currentChannelIndex + 1) % tvChannels.length;
      loadChannel(nextIndex);
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
      tvVideo.volume = v;
    });
  }

  if (tvVideo) {
    loadChannel(currentChannelIndex);
  }

  // ---------- BAR BOT (AI BARTENDER) ----------
  const bartenderForm = document.getElementById("bartenderForm");
  const bartenderInput = document.getElementById("bartenderInput");
  const bartenderMessages = document.getElementById("bartenderMessages");
  const bartenderResults = document.getElementById("bartenderResults");
  const bartenderChips = document.querySelectorAll(".bartender-chip");

  const BARTENDER_ENDPOINT = "/.netlify/functions/ccc-bartender";

  function appendBartenderMessage({ role, content }) {
    if (!bartenderMessages) return;

    const wrapper = document.createElement("div");
    wrapper.classList.add("bartender-message");
    wrapper.classList.add(
      role === "assistant" ? "bartender-message-bot" : "bartender-message-user"
    );

    const avatar = document.createElement("div");
    avatar.className = "bartender-avatar";

    const body = document.createElement("div");
    body.className = "bartender-message-body";
    body.innerText = content;

    wrapper.appendChild(avatar);
    wrapper.appendChild(body);
    bartenderMessages.appendChild(wrapper);
    bartenderMessages.scrollTop = bartenderMessages.scrollHeight;
  }

  function setBartenderTyping(isTyping) {
    if (!bartenderMessages) return;
    let typingEl = bartenderMessages.querySelector(".bartender-typing-row");
    if (isTyping) {
      if (!typingEl) {
        typingEl = document.createElement("div");
        typingEl.className = "bartender-typing-row";
        typingEl.innerHTML =
          '<div class="bartender-typing"><span>.</span><span>.</span><span>.</span></div>';
        bartenderMessages.appendChild(typingEl);
      }
    } else if (typingEl) {
      typingEl.remove();
    }
  }

  async function callBarBot(prompt) {
    appendBartenderMessage({ role: "user", content: prompt });
    setBartenderTyping(true);

    try {
      const res = await fetch(BARTENDER_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message: prompt })
      });

      if (!res.ok) {
        console.error("Bar Bot HTTP error", res.status, await res.text());
        appendBartenderMessage({
          role: "assistant",
          content:
            "I couldn’t reach the Bar Bot right now. Check your Netlify function and OpenAI key."
        });
        return;
      }

      const data = await res.json();
      const reply = data.reply || data.message || "Here’s a drink idea—for best results, ask again.";
      appendBartenderMessage({ role: "assistant", content: reply });
    } catch (err) {
      console.error("Bar Bot request failed", err);
      appendBartenderMessage({
        role: "assistant",
        content:
          "Something went wrong talking to the Bar Bot. Check your connection and Netlify logs."
      });
    } finally {
      setBartenderTyping(false);
    }
  }

  if (bartenderForm && bartenderInput && bartenderMessages) {
    bartenderForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const prompt = bartenderInput.value.trim();
      if (!prompt) return;
      bartenderInput.value = "";
      callBarBot(prompt);
    });
  }

  if (bartenderChips && bartenderChips.length) {
    bartenderChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const preset = chip.getAttribute("data-bartender-prompt");
        if (!preset) return;
        bartenderInput.value = preset;
        bartenderInput.focus();
      });
    });
  }

  // ---------- REQUESTS QUEUE ----------
  const requestsListEl = document.getElementById("requestsList");
  const requestsForm = document.getElementById("requestsForm");
  const requestNameInput = document.getElementById("requestName");
  const requestTrackInput = document.getElementById("requestTrack");
  const requestNoteInput = document.getElementById("requestNote");

  let requests = [];

  function renderRequests(list) {
    if (!requestsListEl) return;
    requestsListEl.innerHTML = "";

    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "request-item";
      empty.textContent = "No requests yet. Be the first to call a set.";
      requestsListEl.appendChild(empty);
      return;
    }

    list.forEach((req) => {
      const item = document.createElement("div");
      item.className = "request-item";

      const who = document.createElement("div");
      who.className = "request-who";
      who.textContent = req.name || "Guest";

      const what = document.createElement("div");
      what.className = "request-what";
      what.textContent = req.track;

      const note = document.createElement("div");
      note.className = "request-note";
      note.textContent = req.note || "";

      item.appendChild(who);
      item.appendChild(what);
      if (req.note) item.appendChild(note);

      requestsListEl.appendChild(item);
    });
  }

  function loadRequests() {
    try {
      const raw = localStorage.getItem("cccRequests");
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data;
    } catch {
      return [];
    }
  }

  function saveRequests(list) {
    try {
      localStorage.setItem("cccRequests", JSON.stringify(list));
    } catch {
      // ignore
    }
  }

  if (requestsListEl) {
    requests = loadRequests();
    renderRequests(requests);
  }

  if (requestsForm) {
    requestsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!requestTrackInput) return;

      const track = requestTrackInput.value.trim();
      if (!track) return;

      const name = requestNameInput ? requestNameInput.value.trim() : "";
      const note = requestNoteInput ? requestNoteInput.value.trim() : "";

      const req = {
        name,
        track,
        note,
        ts: Date.now()
      };

      requests.push(req);
      if (requests.length > 60) {
        requests = requests.slice(-60);
      }

      saveRequests(requests);
      renderRequests(requests);

      if (requestTrackInput) requestTrackInput.value = "";
      if (requestNoteInput) requestNoteInput.value = "";
    });
  }
});
