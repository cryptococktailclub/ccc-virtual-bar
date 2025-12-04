// Crypto Cocktail Club – Virtual Listening Bar + AI Bartender

document.addEventListener("DOMContentLoaded", () => {
  // ---------- AUDIO PLAYER (unchanged core) ----------
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

  const vinylRow = document.getElementById("vinylRow");
  const vinylButtons = vinylRow ? Array.from(vinylRow.querySelectorAll(".vinyl-item")) : [];
  const dockTrackEl = document.getElementById("dockTrack");

  if (!audio || !playBtn || !timelineBar || !timelineProgress) {
    console.warn("Core audio elements missing – player disabled.");
    return;
  }

  const tracks = [
    {
      title: "Toby’s Mix",
      artist: "Toby",
      durationLabel: "58:24",
      file: "audio/tobys-mix.mp3",
    },
    {
      title: "Gold Hour Spritz",
      artist: "CCC – Summer Mix",
      durationLabel: "1:00:00",
      file: "audio/Summer mix.mp3",
    },
    {
      title: "Midnight Chrome",
      artist: "Kartell Tribute – Roche Musique",
      durationLabel: "1:00:00",
      file: "audio/Kartell Tribute Set - Roche Musique.mp3",
    },
    {
      title: "Poolside Mirage",
      artist: "Solomun Boiler Room",
      durationLabel: "1:00:00",
      file: "audio/Solomun Boiler Room DJ Set.mp3",
    },
    {
      title: "Khruangbin – Pitchfork Live",
      artist: "Khruangbin",
      durationLabel: "1:00:00",
      file: "audio/Khruangbin at Villain _ Pitchfork Live.mp3",
    },
    {
      title: "Succession Beats",
      artist: "Jsco Music",
      durationLabel: "1:00:00",
      file: "audio/Succession Beats - Jsco Music .mp3",
    },
  ];

  let currentTrackIndex = 0;
  let isPlaying = false;

  function formatTime(seconds) {
    if (!isFinite(seconds)) return "0:00";
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  }

  function updateDockTrack(track) {
    if (dockTrackEl) dockTrackEl.textContent = `${track.title} — ${track.artist}`;
  }

  function loadTrack(index) {
    const track = tracks[index];
    if (!track) return;
    currentTrackIndex = index;
    audio.src = track.file;

    if (trackTitleEl) trackTitleEl.textContent = track.title;
    if (trackArtistEl) trackArtistEl.textContent = track.artist;
    if (trackDurationEl) trackDurationEl.textContent = track.durationLabel;
    if (timeCurrentEl) timeCurrentEl.textContent = "0:00";
    if (timeRemainingEl) timeRemainingEl.textContent = "-" + track.durationLabel;
    timelineProgress.style.width = "0%";
    updateDockTrack(track);

    vinylButtons.forEach((btn) => {
      const idx = Number(btn.dataset.trackIndex || 0);
      btn.classList.toggle("is-active", idx === index);
    });
  }

  function updatePlayUI(playing) {
    isPlaying = playing;
    playBtn.textContent = playing ? "Pause" : "Play";

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

  function playCurrentTrack() {
    audio
      .play()
      .then(() => updatePlayUI(true))
      .catch((err) => console.warn("Audio play blocked:", err));
  }

  function pauseCurrentTrack() {
    audio.pause();
    updatePlayUI(false);
  }

  function togglePlay() {
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

  // animate vinyl from shelf to turntable
  function animateVinylToTurntable(sourceButton) {
    if (!turntablePlatter || !sourceButton) return;

    const platterRect = turntablePlatter.getBoundingClientRect();
    const sourceRect = sourceButton.getBoundingClientRect();
    const size = Math.min(sourceRect.width, sourceRect.height, 140);

    const startX = sourceRect.left + sourceRect.width / 2 - size / 2;
    const startY = sourceRect.top + sourceRect.height / 2 - size / 2;
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
      const dx = endX - startX;
      const dy = endY - startY;
      flying.style.transform = `translate(${dx}px, ${dy}px) scale(0.95)`;
      flying.style.opacity = "1";
    });

    flying.addEventListener(
      "transitionend",
      () => {
        flying.remove();
        turntablePlatter.classList.add("platter-flash");
        setTimeout(() => turntablePlatter.classList.remove("platter-flash"), 260);
      },
      { once: true }
    );
  }

  loadTrack(0);
  if (volumeSlider) audio.volume = parseFloat(volumeSlider.value || "0.8");

  playBtn.addEventListener("click", togglePlay);
  if (prevBtn) prevBtn.addEventListener("click", playPrevTrack);
  if (nextBtn) nextBtn.addEventListener("click", playNextTrack);

  if (volumeSlider) {
    volumeSlider.addEventListener("input", (e) => {
      const v = parseFloat(e.target.value);
      audio.volume = isNaN(v) ? 0.8 : v;
    });
  }

  timelineBar.addEventListener("click", (e) => {
    const rect = timelineBar.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    if (!isFinite(pct) || pct < 0 || pct > 1) return;
    if (audio.duration) audio.currentTime = pct * audio.duration;
  });

  audio.addEventListener("timeupdate", () => {
    if (!audio.duration || !isFinite(audio.duration)) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    timelineProgress.style.width = `${pct}%`;
    if (timeCurrentEl) timeCurrentEl.textContent = formatTime(audio.currentTime);
    if (timeRemainingEl)
      timeRemainingEl.textContent = "-" + formatTime(audio.duration - audio.currentTime);
  });

  audio.addEventListener("ended", () => {
    updatePlayUI(false);
    playNextTrack();
  });

  audio.addEventListener("loadedmetadata", () => {
    if (audio.duration && isFinite(audio.duration) && trackDurationEl && timeRemainingEl) {
      const label = formatTime(audio.duration);
      trackDurationEl.textContent = label;
      timeRemainingEl.textContent = "-" + label;
    }
  });

  vinylButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.trackIndex || 0);
      animateVinylToTurntable(btn);
      loadTrack(idx);
      playCurrentTrack();
    });
  });

  // ---------- THEME TOGGLE (visual only) ----------
  const themeButtons = Array.from(document.querySelectorAll(".theme-pill[data-theme]"));
  const body = document.body;

  function setTheme(theme) {
    themeButtons.forEach((b) => b.classList.toggle("is-active", b.dataset.theme === theme));
    body.classList.remove("theme-base", "theme-gold", "theme-platinum");
    body.classList.add(`theme-${theme}`);
  }

  themeButtons.forEach((btn) => {
    btn.addEventListener("click", () => setTheme(btn.dataset.theme || "base"));
  });

  setTheme("base");

  // ---------- BAR TV ----------
  const tvVideo = document.getElementById("barTvVideo");
  const tvInner = document.getElementById("barTvInner");
  const tvChannelBtn = document.getElementById("barTvChannelBtn");
  const tvPlayBtn = document.getElementById("barTvPlayBtn");
  const tvMuteBtn = document.getElementById("barTvMuteBtn");
  const tvTitleEl = document.getElementById("barTvTitle");
  const tvVolumeSlider = document.getElementById("barTvVolume");

  const tvChannels = [
    { src: "video/bar_tape_01.mp4", title: "Bar Tape 01" },
    { src: "video/bar_tape_02.mp4", title: "Bar Tape 02" },
    { src: "video/bar_tape_03.mp4", title: "Bar Tape 03" },
    { src: "video/bar_tape_04.mp4", title: "Bar Tape 04" },
    { src: "video/bar_tape_05.mp4", title: "Bar Tape 05" },
    { src: "video/bar_tape_06.mp4", title: "Bar Tape 06" },
    { src: "video/bar_tape_07.mp4", title: "Bar Tape 07" },
    { src: "video/bar_tape_08.mp4", title: "Bar Tape 08" },
    { src: "video/bar_tape_09.mp4", title: "Bar Tape 09" }
  ];

  let tvIndex = 0;

  function loadTvChannel(index) {
    if (!tvVideo) return;
    const ch = tvChannels[index];
    if (!ch) return;
    if (tvInner) tvInner.classList.add("tv-fading");

    tvVideo.pause();
    tvVideo.muted = true;
    tvVideo.src = ch.src;
    tvVideo.load();

    if (tvTitleEl) tvTitleEl.textContent = ch.title;

    tvVideo
      .play()
      .then(() => {
        if (tvPlayBtn) tvPlayBtn.textContent = "⏸";
      })
      .catch((err) => {
        console.warn("TV playback issue:", err);
        if (tvPlayBtn) tvPlayBtn.textContent = "▶";
      })
      .finally(() => {
        if (tvInner) tvInner.classList.remove("tv-fading");
      });
  }

  if (tvVideo) {
    tvVideo.muted = true;
    tvVideo
      .play()
      .then(() => {
        if (tvPlayBtn) tvPlayBtn.textContent = "⏸";
      })
      .catch(() => {
        if (tvPlayBtn) tvPlayBtn.textContent = "▶";
      });
  }

  if (tvChannelBtn) tvChannelBtn.addEventListener("click", () => {
    tvIndex = (tvIndex + 1) % tvChannels.length;
    loadTvChannel(tvIndex);
  });

  if (tvPlayBtn && tvVideo) {
    tvPlayBtn.addEventListener("click", () => {
      if (tvVideo.paused) {
        tvVideo
          .play()
          .then(() => (tvPlayBtn.textContent = "⏸"))
          .catch((err) => console.warn("TV play blocked:", err));
      } else {
        tvVideo.pause();
        tvPlayBtn.textContent = "▶";
      }
    });
  }

  if (tvMuteBtn && tvVideo) {
    tvMuteBtn.addEventListener("click", () => {
      tvVideo.muted = !tvVideo.muted;

      if (!tvVideo.muted && tvVolumeSlider) {
        let v = parseFloat(tvVolumeSlider.value);
        if (!isFinite(v) || v === 0) {
          v = 0.5;
          tvVolumeSlider.value = String(v);
          tvVideo.volume = v;
        }
      }

      tvMuteBtn.textContent = tvVideo.muted ? "Sound: Off" : "Sound: On";
    });
  }

  if (tvVolumeSlider && tvVideo) {
    const initV = parseFloat(tvVolumeSlider.value || "0.5");
    tvVideo.volume = isFinite(initV) ? initV : 0.5;
    tvVideo.muted = initV === 0;

    tvVolumeSlider.addEventListener("input", (e) => {
      const v = parseFloat(e.target.value);
      if (!isFinite(v)) return;
      tvVideo.volume = v;
      tvVideo.muted = v === 0;
      if (tvMuteBtn) tvMuteBtn.textContent = tvVideo.muted ? "Sound: Off" : "Sound: On";
    });
  }

  // ---------- REQUESTS QUEUE (unchanged) ----------
  const requestsListEl = document.getElementById("requestsList");
  const requestsForm = document.getElementById("requestsForm");
  const requestNameInput = document.getElementById("requestName");
  const requestTrackInput = document.getElementById("requestTrack");
  const requestNoteInput = document.getElementById("requestNote");
  const REQUESTS_STORAGE_KEY = "ccc-requests-queue";

  function loadRequests() {
    try {
      const raw = localStorage.getItem(REQUESTS_STORAGE_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data.slice(-60);
    } catch {
      return [];
    }
  }

  function saveRequests(requests) {
    try {
      localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(requests));
    } catch {
      /* ignore */
    }
  }

  function renderRequest(req) {
    if (!requestsListEl) return;
    const item = document.createElement("div");
    item.className = "request-item";

    const header = document.createElement("div");
    header.className = "request-header";

    const title = document.createElement("div");
    title.className = "request-title";
    title.textContent = req.track || "Untitled request";

    const meta = document.createElement("div");
    meta.className = "request-meta";
    meta.textContent = `${req.name || "Guest"} · ${req.timestamp}`;

    header.appendChild(title);
    header.appendChild(meta);
    item.appendChild(header);

    if (req.note) {
      const noteEl = document.createElement("div");
      noteEl.className = "request-note";
      noteEl.textContent = req.note;
      item.appendChild(noteEl);
    }

    requestsListEl.appendChild(item);
  }

  function renderRequests(requests) {
    if (!requestsListEl) return;
    requestsListEl.innerHTML = "";
    requests.forEach(renderRequest);
    requestsListEl.scrollTop = requestsListEl.scrollHeight;
  }

  function getCurrentTimestamp() {
    const now = new Date();
    const hh = now.getHours().toString().padStart(2, "0");
    const mm = now.getMinutes().toString().padStart(2, "0");
    return `${hh}:${mm}`;
  }

  let requests = loadRequests();
  renderRequests(requests);

  if (requestsForm) {
    requestsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const track = (requestTrackInput?.value || "").trim().slice(0, 80);
      if (!track) return;

      const name = (requestNameInput?.value || "Guest").trim().slice(0, 32);
      const note = (requestNoteInput?.value || "").trim().slice(0, 160);

      const req = { name, track, note, timestamp: getCurrentTimestamp() };

      requests.push(req);
      if (requests.length > 60) requests = requests.slice(-60);

      saveRequests(requests);
      renderRequests(requests);

      if (requestTrackInput) requestTrackInput.value = "";
      if (requestNoteInput) requestNoteInput.value = "";
    });
  }

  // ---------- AI BARTENDER (NEW) ----------
  const bartenderResultsEl = document.getElementById("bartenderResults");
  const bartenderMessagesEl = document.getElementById("bartenderMessages");
  const bartenderForm = document.getElementById("bartenderForm");
  const bartenderInput = document.getElementById("bartenderInput");
  const bartenderChips = Array.from(
    document.querySelectorAll("[data-bartender-prompt]")
  );

  let recipes = [];

  async function loadRecipes() {
    try {
      const res = await fetch("recipes.json");
      if (!res.ok) throw new Error("Failed to load recipes.json");
      recipes = await res.json();
      renderRecipeSummary(recipes);
    } catch (err) {
      console.warn("Could not load recipes.json:", err);
      if (bartenderResultsEl) {
        bartenderResultsEl.textContent =
          "Could not load Milk & Honey specs. Check recipes.json placement.";
      }
    }
  }

  function renderRecipeSummary(all) {
    if (!bartenderResultsEl) return;
    bartenderResultsEl.innerHTML = "";
    if (!all || !all.length) {
      bartenderResultsEl.textContent = "No recipes loaded yet.";
      return;
    }
    const sample = all.slice(0, 18);
    sample.forEach((rec) => {
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = "bartender-result-pill";
      pill.innerHTML = `
        <span class="bartender-result-pill-name">${rec.name}</span>
        <span class="bartender-result-pill-meta">${rec.glass || ""}${
        rec.method ? " · " + rec.method : ""
      }</span>
      `;
      pill.addEventListener("click", () => {
        if (!bartenderInput) return;
        bartenderInput.value = `Show me the full Milk & Honey spec for "${rec.name}".`;
        bartenderInput.focus();
      });
      bartenderResultsEl.appendChild(pill);
    });
  }

  function appendMessage(role, text) {
    if (!bartenderMessagesEl) return;
    const wrapper = document.createElement("div");
    wrapper.className =
      "bartender-message " +
      (role === "user" ? "bartender-message-user" : "bartender-message-bot");

    const header = document.createElement("div");
    header.className = "bartender-message-header";

    const nameEl = document.createElement("span");
    nameEl.className = "bartender-name";
    nameEl.textContent = role === "user" ? "You" : "CCC Bartender";

    const timeEl = document.createElement("span");
    timeEl.className = "bartender-time";
    timeEl.textContent = getCurrentTimestamp();

    const body = document.createElement("div");
    body.className = "bartender-message-body";
    body.textContent = text;

    header.appendChild(nameEl);
    header.appendChild(timeEl);
    wrapper.appendChild(header);
    wrapper.appendChild(body);

    bartenderMessagesEl.appendChild(wrapper);
    bartenderMessagesEl.scrollTop = bartenderMessagesEl.scrollHeight;
  }

  function findRelevantRecipes(prompt) {
    if (!recipes || !recipes.length) return [];
    const q = prompt.toLowerCase();
    return recipes
      .filter((r) => {
        const nameMatch = r.name && r.name.toLowerCase().includes(q);
        const ingMatch =
          r.ingredients &&
          r.ingredients.some((i) =>
            (i.ingredient || "").toLowerCase().includes(q)
          );
        const catMatch =
          (r.category || "").toLowerCase().includes(q) ||
          (r.glass || "").toLowerCase().includes(q) ||
          (r.method || "").toLowerCase().includes(q);
        return nameMatch || ingMatch || catMatch;
      })
      .slice(0, 24);
  }

  async function askBartender(prompt) {
    if (!prompt.trim()) return;
    appendMessage("user", prompt);

    const relevant = findRelevantRecipes(prompt);
    const payload = {
      question: prompt,
      recipes: relevant,
    };

    appendMessage(
      "assistant",
      "Let me think through the Milk & Honey specs for that..."
    );

    try {
      const res = await fetch("/.netlify/functions/ccc-bartender", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        appendMessage(
          "assistant",
          "I couldn’t reach the back bar AI right now. Check your Netlify function and OpenAI key."
        );
        return;
      }

      const data = await res.json();
      const answer = data.answer || "I’m not sure how to answer that one.";
      appendMessage("assistant", answer);
    } catch (err) {
      console.error(err);
      appendMessage(
        "assistant",
        "The connection to the AI timed out. Try again in a moment."
      );
    }
  }

  if (bartenderForm && bartenderInput) {
    bartenderForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const value = bartenderInput.value.trim();
      bartenderInput.value = "";
      askBartender(value);
    });
  }

  bartenderChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const text = chip.getAttribute("data-bartender-prompt") || "";
      if (!bartenderInput) return;
      bartenderInput.value = text;
      bartenderInput.focus();
    });
  });

  loadRecipes();
});
