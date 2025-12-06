// Crypto Cocktail Club – Virtual Listening Bar (Interactive Script)

document.addEventListener("DOMContentLoaded", () => {
  // ---------- AUDIO PLAYER ----------
  const audio           = document.getElementById("bar-audio");
  const playBtn         = document.getElementById("play-btn");
  const prevBtn         = document.getElementById("prev-btn");
  const nextBtn         = document.getElementById("next-btn");
  const volumeSlider    = document.getElementById("volume-slider");
  const turntablePlatter= document.getElementById("turntablePlatter");
  const albumArt        = document.getElementById("albumArt");
  const playerEq        = document.getElementById("playerEq");
  const trackTitleEl    = document.getElementById("track-title");
  const trackArtistEl   = document.getElementById("track-artist");
  const trackDurationEl = document.getElementById("track-duration");
  const timeCurrentEl   = document.getElementById("time-current");
  const timeRemainingEl = document.getElementById("time-remaining");
  const timelineBar     = document.getElementById("timeline-bar");
  const timelineProgress= document.getElementById("timeline-progress");
  const vinylRow        = document.getElementById("vinylRow");
  const vinylButtons    = vinylRow ? Array.from(vinylRow.querySelectorAll(".vinyl-item")) : [];
  const dockTrackEl     = document.getElementById("dockTrack");

  if (!audio || !playBtn || !timelineBar || !timelineProgress) {
    console.warn("Core audio elements missing – player disabled.");
    return;
  }

  const tracks = [
    { title: "Toby’s Mix",        artist: "Toby",                             durationLabel: "58:24",  file: "audio/tobys-mix.mp3" },
    { title: "Gold Hour Spritz",  artist: "CCC – Summer Mix",                 durationLabel: "1:00:00", file: "audio/Summer mix.mp3" },
    { title: "Midnight Chrome",   artist: "Kartell Tribute – Roche Musique",  durationLabel: "1:00:00", file: "audio/Kartell Tribute Set - Roche Musique.mp3" },
    { title: "Poolside Mirage",   artist: "Solomun Boiler Room",             durationLabel: "1:00:00", file: "audio/Solomun Boiler Room DJ Set.mp3" },
    { title: "Khruangbin Live",   artist: "Pitchfork Live at Villain",       durationLabel: "1:00:00", file: "audio/Khruangbin at Villain _ Pitchfork Live.mp3" },
    { title: "Succession Beats",  artist: "Jsco Music",                     durationLabel: "1:00:00", file: "audio/Succession Beats - Jsco Music.mp3" }
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
    if (dockTrackEl) {
      dockTrackEl.textContent = `${track.title} — ${track.artist}`;
    }
  }

  function loadTrack(index) {
    const track = tracks[index];
    if (!track) return;
    currentTrackIndex = index;
    audio.src = track.file;
    if (trackTitleEl)    trackTitleEl.textContent = track.title;
    if (trackArtistEl)   trackArtistEl.textContent = track.artist;
    if (trackDurationEl) trackDurationEl.textContent = track.durationLabel;
    if (timeCurrentEl)   timeCurrentEl.textContent = "0:00";
    if (timeRemainingEl) timeRemainingEl.textContent = "-" + track.durationLabel;
    timelineProgress.style.width = "0%";
    updateDockTrack(track);
    // Highlight the active vinyl in the shelf
    vinylButtons.forEach(btn => {
      const idx = Number(btn.dataset.trackIndex || 0);
      btn.classList.toggle("is-active", idx === index);
    });
  }

  function updatePlayUI(playing) {
    isPlaying = playing;
    playBtn.textContent = playing ? "Pause" : "Play";
    if (turntablePlatter) turntablePlatter.classList.toggle("is-playing", playing);
    if (albumArt)         albumArt.classList.toggle("glow-active", playing);
    if (playerEq)         playerEq.classList.toggle("is-playing", playing);
  }

  function playCurrentTrack() {
    audio.play().then(() => {
      updatePlayUI(true);
    }).catch(err => {
      console.warn("Audio play blocked:", err);
    });
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

  // Animate vinyl flying from shelf to turntable
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
    flying.addEventListener("transitionend", () => {
      flying.remove();
      turntablePlatter.classList.add("platter-flash");
      setTimeout(() => turntablePlatter.classList.remove("platter-flash"), 260);
    }, { once: true });
  }

  // Initialize first track (without autoplay)
  loadTrack(0);
  if (volumeSlider) audio.volume = parseFloat(volumeSlider.value || "0.8");

  // Hook up player controls
  playBtn.addEventListener("click", togglePlay);
  if (prevBtn) prevBtn.addEventListener("click", playPrevTrack);
  if (nextBtn) nextBtn.addEventListener("click", playNextTrack);
  if (volumeSlider) {
    volumeSlider.addEventListener("input", e => {
      const v = parseFloat(e.target.value);
      audio.volume = isNaN(v) ? 0.8 : v;
    });
  }
  timelineBar.addEventListener("click", e => {
    const rect = timelineBar.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    if (!isFinite(pct) || pct < 0 || pct > 1) return;
    if (audio.duration) {
      audio.currentTime = pct * audio.duration;
    }
  });
  audio.addEventListener("timeupdate", () => {
    if (!audio.duration || !isFinite(audio.duration)) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    timelineProgress.style.width = `${pct}%`;
    if (timeCurrentEl)   timeCurrentEl.textContent = formatTime(audio.currentTime);
    if (timeRemainingEl) timeRemainingEl.textContent = "-" + formatTime(audio.duration - audio.currentTime);
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
  vinylButtons.forEach(btn => {
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
    themeButtons.forEach(b => {
      b.classList.toggle("is-active", b.dataset.theme === theme);
    });
    body.classList.remove("theme-base", "theme-gold", "theme-platinum");
    body.classList.add(`theme-${theme}`);
    // (No audio change on theme – purely visual)
  }
  themeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const theme = btn.dataset.theme || "base";
      setTheme(theme);
    });
  });
  // Initial theme
  setTheme("base");

  // ---------- BAR TV (Channels + Volume) ----------
  const tvVideo      = document.getElementById("barTvVideo");
  const tvInner      = document.getElementById("barTvInner");
  const tvChannelBtn = document.getElementById("barTvChannelBtn");
  const tvPlayBtn    = document.getElementById("barTvPlayBtn");
  const tvMuteBtn    = document.getElementById("barTvMuteBtn");
  const tvTitleEl    = document.getElementById("barTvTitle");
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
    tvVideo.muted = true; // keep muted so browsers allow autoplay
    tvVideo.src = ch.src;
    tvVideo.load();
    if (tvTitleEl) tvTitleEl.textContent = ch.title;
    tvVideo.play().then(() => {
      if (tvPlayBtn) tvPlayBtn.textContent = "⏸";
    }).catch(err => {
      console.warn("TV playback issue:", err);
      if (tvPlayBtn) tvPlayBtn.textContent = "▶";
    }).finally(() => {
      if (tvInner) tvInner.classList.remove("tv-fading");
    });
  }
  // Initial TV channel (already loaded as Bar Tape 01 from HTML src)
  if (tvVideo) {
    tvVideo.muted = true;
    tvVideo.play().then(() => {
      if (tvPlayBtn) tvPlayBtn.textContent = "⏸";
    }).catch(() => {
      if (tvPlayBtn) tvPlayBtn.textContent = "▶";
    });
  }
  if (tvChannelBtn) {
    tvChannelBtn.addEventListener("click", () => {
      tvIndex = (tvIndex + 1) % tvChannels.length;
      loadTvChannel(tvIndex);
    });
  }
  if (tvPlayBtn && tvVideo) {
    tvPlayBtn.addEventListener("click", () => {
      if (tvVideo.paused) {
        tvVideo.play().then(() => {
          tvPlayBtn.textContent = "⏸";
        }).catch(err => {
          console.warn("TV play blocked:", err);
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
      // If unmuting and volume is at 0, set a default volume
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
    tvVolumeSlider.addEventListener("input", e => {
      const v = parseFloat(e.target.value);
      if (!isFinite(v)) return;
      tvVideo.volume = v;
      tvVideo.muted = (v === 0);
      if (tvMuteBtn) {
        tvMuteBtn.textContent = tvVideo.muted ? "Sound: Off" : "Sound: On";
      }
    });
  }

  // ---------- BAR CHAT ----------
  const chatMessagesEl   = document.getElementById("chatMessages");
  const chatForm         = document.getElementById("chatForm");
  const chatNameInput    = document.getElementById("chatName");
  const chatMessageInput = document.getElementById("chatMessage");
  const chatInviteBtn    = document.getElementById("chatInviteBtn");
  const inviteFeedbackEl = document.getElementById("inviteFeedback");
  const CHAT_STORAGE_KEY = "ccc-bar-chat";

  function loadChatMessages() {
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data.slice(0, 100);
    } catch {
      return [];
    }
  }
  function saveChatMessages(messages) {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch { /* ignore */ }
  }
  function renderChatMessage(msg) {
    if (!chatMessagesEl) return;
    const container = document.createElement("div");
    container.className = "chat-message";
    const header = document.createElement("div");
    header.className = "chat-message-header";
    const nameEl = document.createElement("div");
    nameEl.className = "chat-message-name";
    nameEl.textContent = msg.name || "Guest";
    const timeEl = document.createElement("div");
    timeEl.className = "chat-message-time";
    timeEl.textContent = msg.timestamp;
    const bodyEl = document.createElement("div");
    bodyEl.className = "chat-message-body";
    bodyEl.textContent = msg.text;
    header.appendChild(nameEl);
    header.appendChild(timeEl);
    container.appendChild(header);
    container.appendChild(bodyEl);
    chatMessagesEl.appendChild(container);
  }
  function renderChat(messages) {
    if (!chatMessagesEl) return;
    chatMessagesEl.innerHTML = "";
    messages.forEach(renderChatMessage);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }

  let chatMessages = loadChatMessages();
  renderChat(chatMessages);

  function getCurrentTimestamp() {
    const now = new Date();
    const hh = now.getHours().toString().padStart(2, "0");
    const mm = now.getMinutes().toString().padStart(2, "0");
    return `${hh}:${mm}`;
  }

  if (chatForm) {
    chatForm.addEventListener("submit", e => {
      e.preventDefault();
      const name = (chatNameInput?.value || "Guest").trim().slice(0, 32);
      const text = (chatMessageInput?.value || "").trim().slice(0, 280);
      if (!text) return;
      const msg = { name, text, timestamp: getCurrentTimestamp() };
      chatMessages.push(msg);
      if (chatMessages.length > 100) {
        chatMessages = chatMessages.slice(-100);
      }
      saveChatMessages(chatMessages);
      renderChat(chatMessages);
      if (chatMessageInput) chatMessageInput.value = "";
    });
  }

  if (chatInviteBtn) {
    chatInviteBtn.addEventListener("click", async () => {
      const url = window.location.href;
      if (inviteFeedbackEl) inviteFeedbackEl.textContent = "";
      if (navigator.share) {
        try {
          await navigator.share({
            title: "Crypto Cocktail Club – Virtual Listening Bar",
            text: "Pull up a seat at the CCC bar.",
            url
          });
          if (inviteFeedbackEl) inviteFeedbackEl.textContent = "Invite sent from your device.";
        } catch {
          if (inviteFeedbackEl) inviteFeedbackEl.textContent = "Invite canceled.";
        }
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(url);
          if (inviteFeedbackEl) inviteFeedbackEl.textContent = "Link copied to clipboard.";
        } catch {
          if (inviteFeedbackEl) inviteFeedbackEl.textContent = url;
        }
      } else if (inviteFeedbackEl) {
        inviteFeedbackEl.textContent = url;
      }
    });
  }

  // ---------- REQUESTS QUEUE ----------
  const requestsListEl    = document.getElementById("requestsList");
  const requestsForm      = document.getElementById("requestsForm");
  const requestNameInput  = document.getElementById("requestName");
  const requestTrackInput = document.getElementById("requestTrack");
  const requestNoteInput  = document.getElementById("requestNote");
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
    } catch { /* ignore */ }
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

  let requests = loadRequests();
  renderRequests(requests);

  if (requestsForm) {
    requestsForm.addEventListener("submit", e => {
      e.preventDefault();
      const track = (requestTrackInput?.value || "").trim().slice(0, 80);
      if (!track) return;
      const name = (requestNameInput?.value || "Guest").trim().slice(0, 32);
      const note = (requestNoteInput?.value || "").trim().slice(0, 160);
      const req = { name, track, note, timestamp: getCurrentTimestamp() };
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
