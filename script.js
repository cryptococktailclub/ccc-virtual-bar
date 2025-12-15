// script.js – CCC Virtual Bar Experience (refactored wizard)

// ==========================
// MEDIA CONFIG
// ==========================

const MEDIA_BASE = "https://visionary-beignet-7d270e.netlify.app";

// Audio tracks served from Netlify
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

// Bar TV loop tapes
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
  const tonearm = document.getElementById("tonearm");
  const turntable = document.querySelector(".turntable");

  const trackTitleEl = document.getElementById("track-title");
  const trackArtistEl = document.getElementById("track-artist");
  const trackDurationEl = document.getElementById("track-duration");

  const timelineBar = document.getElementById("timeline-bar");
  const timelineProgress = document.getElementById("timeline-progress");
  const timeCurrent = document.getElementById("time-current");
  const timeRemaining = document.getElementById("time-remaining");

  // Disc overlay elements
  const trackDisc = document.getElementById("turntableTrackDisc");
  const trackDiscTitle = document.getElementById("trackDiscTitle");
  const trackDiscArtist = document.getElementById("trackDiscArtist");
  const trackDiscInner = trackDisc ? trackDisc.querySelector(".turntable-track-disc-inner") : null;

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

  function setPlayingVisual(isPlaying) {
    if (platter) platter.classList.toggle("is-playing", isPlaying);
    if (eq) eq.classList.toggle("is-playing", isPlaying);
    if (albumArt) albumArt.classList.toggle("glow-active", isPlaying);
    if (tonearm) tonearm.classList.toggle("is-engaged", isPlaying);
    if (turntable) turntable.classList.toggle("speaker-drop-active", isPlaying);

    // Disc wrapper: show while playing, fade when paused/stopped
    if (trackDisc) {
      if (isPlaying) {
        trackDisc.classList.add("is-visible");
        trackDisc.classList.remove("is-hidden");
      } else {
        trackDisc.classList.add("is-hidden");
      }
    }

    // Spin INNER disc so centering transform is not overwritten
    if (trackDiscInner) {
      trackDiscInner.classList.toggle("is-spinning", isPlaying);
    }
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

    // Track disc overlay update
    if (trackDisc) {
      if (trackDiscTitle) trackDiscTitle.textContent = track.title || "";
      if (trackDiscArtist) trackDiscArtist.textContent = track.artist || "";

      trackDisc.classList.add("is-visible");
      trackDisc.classList.remove("is-hidden");

      // “Land” micro animation on change (wrapper only)
      trackDisc.classList.remove("is-landing");
      void trackDisc.offsetWidth;
      trackDisc.classList.add("is-landing");
    }

    // highlight active vinyl + micro "drop"
    vinylRow.querySelectorAll(".vinyl-item").forEach((btn, idx) => {
      btn.classList.toggle("is-active", idx === index);
      if (idx === index) {
        btn.style.animation = "vinylLand 0.35s ease-out";
        setTimeout(() => {
          btn.style.animation = "";
        }, 400);
      }
    });

    // label "drop" animation for feedback
    const label = turntable ? turntable.querySelector(".turntable-label") : null;
    if (label) {
      label.classList.remove("label-drop");
      void label.offsetWidth;
      label.classList.add("label-drop");
    }

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

  // Initial track
  loadTrack(0, false);

  // Vinyl click
  vinylRow.querySelectorAll(".vinyl-item").forEach((btn, idx) => {
    btn.addEventListener("click", () => loadTrack(idx, true));
  });

  // Play / Pause
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
    if (timeRemaining) timeRemaining.textContent = `-${formatTime(audio.duration - audio.currentTime)}`;
  });

  // Seek
  timelineBar.addEventListener("click", (e) => {
    if (!audio.duration || !isFinite(audio.duration)) return;
    const rect = timelineBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    audio.currentTime = (clickX / rect.width) * audio.duration;
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
  const tvShell = document.querySelector(".bar-tv-aspect");

  if (!videoEl) {
    console.warn("CCC: Bar TV video element missing.");
    return;
  }

  let currentChannel = 0;

  function applyGlitch() {
    if (!tvShell) return;
    tvShell.classList.add("tv-glitch");
    setTimeout(() => {
      tvShell.classList.remove("tv-glitch");
    }, 220);
  }

  function loadChannel(index, autoPlay = true) {
    if (!VIDEO_SOURCES || !VIDEO_SOURCES[index]) {
      console.warn("CCC: Invalid video index", index);
      return;
    }

    currentChannel = index;
    videoEl.src = VIDEO_SOURCES[index];
    videoEl.load();
    applyGlitch();

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

      if (vol > 0 && videoEl.muted) {
        videoEl.muted = false;
        if (muteBtn) muteBtn.textContent = "Sound On";
      }
    });
  }

  // Rewind 10 seconds
  if (rewindBtn) {
    rewindBtn.addEventListener("click", () => {
      if (!isFinite(videoEl.duration)) return;
      videoEl.currentTime = Math.max(0, videoEl.currentTime - 10);
    });
  }

  // Fast-forward 10 seconds
  if (forwardBtn) {
    forwardBtn.addEventListener("click", () => {
      if (!isFinite(videoEl.duration)) return;
      videoEl.currentTime = Math.min(videoEl.duration, videoEl.currentTime + 10);
    });
  }
}

// ==========================
// BAR BOT (CHAT + WIZARD) — FIXED
// ==========================

function initBarBot() {
  // Prevent double-init (this was killing functionality)
  if (window.__cccBarBotInit) return;
  window.__cccBarBotInit = true;

  const messagesEl = document.getElementById("bartenderMessages");
  const formEl = document.getElementById("bartenderForm");
  const inputEl = document.getElementById("bartenderInput");
  const wizardEl = document.getElementById("bartenderWizard");

  if (!messagesEl || !formEl || !inputEl || !wizardEl) return;

  /* -------------------------
     CHAT
  ------------------------- */

  function appendMessage(content, fromBot = false) {
    const row = document.createElement("div");
    row.className = `bartender-message ${fromBot ? "bartender-bot" : "bartender-user"}`;
    if (fromBot) row.innerHTML = `<div class="bartender-avatar"></div>`;
    const text = document.createElement("div");
    text.className = "bartender-text";
    text.innerHTML = content;
    row.appendChild(text);
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function callBartenderAPI(payload) {
    appendMessage(payload.question || "Finding a cocktail…", false);
    try {
      const res = await fetch(BARTENDER_FUNCTION_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      const structured = data.structured || JSON.parse(data.answer || "{}");
      if (structured) renderRecipeCards(structured);
      appendMessage(structured?.summary || data.answer, true);
      return structured;
    } catch {
      appendMessage("Bar Bot is offline.", true);
      return null;
    }
  }

  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!inputEl.value.trim()) return;
    callBartenderAPI({ mode: "chat", question: inputEl.value.trim() });
    inputEl.value = "";
  });
// Wizard preferences (REQUIRED by backend)
const wizardState = {
  style: null,     // "light_refreshing" | "spirit_forward"
  ice: null,       // "on_ice" | "no_ice"
  spirits: [],     // array of strings
};

  /* -------------------------
     WIZARD STATE
  ------------------------- */

  let wizardHistory = [];
  let wizardHistoryPos = -1;
  let wizardExclude = [];

  const STORAGE_KEY = "ccc_wizard_session_v4";

  /* -------------------------
     EXISTING BUTTONS ONLY
  ------------------------- */

  const submitBtn = wizardEl.querySelector("[data-wizard-submit]");
  const prevBtn = wizardEl.querySelector("[data-wizard-prev]");
  const nextBtn = wizardEl.querySelector("[data-wizard-next]");
  const submitRow = wizardEl.querySelector(".wizard-submit-row");

  if (!submitBtn || !prevBtn || !nextBtn || !submitRow) {
    console.warn("CCC: Wizard buttons missing or miswired.");
    return;
  }

  /* -------------------------
     INDICATOR (CREATE ONCE)
  ------------------------- */

  let indicator = wizardEl.querySelector(".wizard-indicator");
  let crumbs = wizardEl.querySelector(".wizard-breadcrumbs");

  if (!indicator) {
    indicator = document.createElement("div");
    indicator.className = "wizard-indicator";
    submitRow.after(indicator);
  }

  if (!crumbs) {
    crumbs = document.createElement("div");
    crumbs.className = "wizard-breadcrumbs";
    indicator.after(crumbs);
  }

  function updateIndicator() {
    const total = wizardHistory.length;
    const current = total ? wizardHistoryPos + 1 : 0;

    indicator.textContent = `${current} of ${total}`;
    indicator.classList.remove("pulse");
    void indicator.offsetWidth;
    indicator.classList.add("pulse");

    crumbs.innerHTML = "";
    wizardHistory.forEach((_, i) => {
      const dot = document.createElement("span");
      dot.className = "wizard-dot" + (i === wizardHistoryPos ? " active" : "");
      dot.onclick = () => jumpTo(i);
      crumbs.appendChild(dot);
    });

    prevBtn.disabled = wizardHistoryPos <= 0;
    nextBtn.disabled = wizardHistoryPos >= wizardHistory.length - 1;
  }

  /* -------------------------
     NAVIGATION
  ------------------------- */

  function jumpTo(index) {
    if (!wizardHistory[index]) return;
    wizardHistoryPos = index;
    renderRecipeCards(wizardHistory[index].structured);
    updateIndicator();
    saveSession();
  }

  async function runWizard() {
    const structured = await callBartenderAPI({
      mode: "wizard",
      exclude: wizardExclude,
    });

    if (!structured) return;

    const name = structured?.recipes?.[0]?.name;
    if (name && wizardExclude.includes(name)) {
      appendMessage("You’ve seen all matching cocktails.", true);
      return;
    }

    if (name) wizardExclude.push(name);

    wizardHistory.push({ structured });
    wizardHistoryPos = wizardHistory.length - 1;

    updateIndicator();
    saveSession();
  }

  submitBtn.onclick = runWizard;
  prevBtn.onclick = () => jumpTo(wizardHistoryPos - 1);
  nextBtn.onclick = () => jumpTo(wizardHistoryPos + 1);

  /* -------------------------
     SESSION
  ------------------------- */

  function saveSession() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ wizardHistory, wizardHistoryPos, wizardExclude })
    );
  }

  function restoreSession() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      wizardHistory = data.wizardHistory || [];
      wizardHistoryPos = data.wizardHistoryPos ?? -1;
      wizardExclude = data.wizardExclude || [];
      if (wizardHistory[wizardHistoryPos]) {
        renderRecipeCards(wizardHistory[wizardHistoryPos].structured);
      }
      updateIndicator();
    } catch {}
  }

  restoreSession();
}

// ==========================
// RENDER RECIPE CARDS
// ==========================

function renderRecipeCards(structured) {
  const panel = document.getElementById("bartenderRecipePanel");
  if (!panel) return;

  panel.innerHTML = "";
  if (!structured) return;

  const { recipes, warnings, summary } = structured;

  if (Array.isArray(warnings) && warnings.length) {
    const warnDiv = document.createElement("div");
    warnDiv.className = "recipe-warning";
    warnDiv.textContent = warnings.join(" ");
    panel.appendChild(warnDiv);
  }

  if (!Array.isArray(recipes) || recipes.length === 0) {
    return;
  }

  recipes.forEach((r) => {
    const card = document.createElement("div");
    card.className = "recipe-card";

    // LEFT SIDE
    const main = document.createElement("div");
    main.className = "recipe-main";

    const headerRow = document.createElement("div");
    headerRow.className = "recipe-header-row";

    const nameEl = document.createElement("div");
    nameEl.className = "recipe-name";
    nameEl.textContent = r.name || "Untitled Cocktail";

    const tagEl = document.createElement("div");
    tagEl.className = "recipe-tag-pill";
    tagEl.textContent = "Milk & Honey Spec";

    headerRow.appendChild(nameEl);
    headerRow.appendChild(tagEl);
    main.appendChild(headerRow);

    if (r.description) {
      const summaryEl = document.createElement("p");
      summaryEl.className = "recipe-summary";
      summaryEl.textContent = r.description;
      main.appendChild(summaryEl);
    }

    const ingTitle = document.createElement("div");
    ingTitle.className = "recipe-ingredients-title";
    ingTitle.textContent = "Ingredients";
    main.appendChild(ingTitle);

    const ingList = document.createElement("ul");
    ingList.className = "recipe-ingredients";

    if (Array.isArray(r.ingredients)) {
      r.ingredients.forEach((ing) => {
        const li = document.createElement("li");

        const amt = document.createElement("span");
        amt.className = "recipe-ingredients-amount";
        amt.textContent = ing.amount || "";

        const ingName = document.createElement("span");
        ingName.className = "recipe-ingredients-ingredient";
        ingName.textContent = ing.ingredient || "";

        li.appendChild(amt);
        li.appendChild(ingName);
        ingList.appendChild(li);
      });
    }

    main.appendChild(ingList);

    // RIGHT SIDE
    const meta = document.createElement("div");
    meta.className = "recipe-meta";

    function addMetaRow(label, value) {
      if (!value) return;
      const row = document.createElement("div");
      row.className = "recipe-meta-row";

      const lbl = document.createElement("span");
      lbl.className = "recipe-meta-label";
      lbl.textContent = label;

      const val = document.createElement("span");
      val.className = "recipe-meta-value";
      val.textContent = value;

      row.appendChild(lbl);
      row.appendChild(val);
      meta.appendChild(row);
    }

    addMetaRow("Glass", r.glass);
    addMetaRow("Method", r.method);
    addMetaRow("Ice", r.ice);
    addMetaRow("Garnish", r.garnish);

    if (r.notes) {
      const notesEl = document.createElement("p");
      notesEl.className = "recipe-notes";
      notesEl.textContent = r.notes;
      meta.appendChild(notesEl);
    }

    card.appendChild(main);
    card.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "recipe-actions";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "recipe-copy-btn";
    copyBtn.textContent = "Copy spec";

    copyBtn.addEventListener("click", async () => {
      const text = buildRecipeText(r, summary);

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const temp = document.createElement("textarea");
          temp.value = text;
          document.body.appendChild(temp);
          temp.select();
          document.execCommand("copy");
          document.body.removeChild(temp);
        }

        const original = copyBtn.textContent;
        copyBtn.textContent = "Copied";
        copyBtn.classList.add("is-copied");
        setTimeout(() => {
          copyBtn.textContent = original;
          copyBtn.classList.remove("is-copied");
        }, 1500);
      } catch (err) {
        console.error("CCC: Failed to copy spec:", err);
        alert("Could not copy spec to clipboard. You can select and copy manually.");
      }
    });

    actions.appendChild(copyBtn);
    card.appendChild(actions);

    panel.appendChild(card);
  });
}

// ==========================
// BUILD PLAINTEXT SPEC FOR COPY
// ==========================

function buildRecipeText(recipe, summary) {
  if (!recipe) return "";

  const lines = [];

  if (recipe.name) {
    lines.push(recipe.name.toUpperCase());
    lines.push("");
  }

  const desc = summary || recipe.description;
  if (desc) {
    lines.push(desc);
    lines.push("");
  }

  lines.push("INGREDIENTS");
  if (Array.isArray(recipe.ingredients) && recipe.ingredients.length) {
    recipe.ingredients.forEach((ing) => {
      const amt = ing.amount || "";
      const name = ing.ingredient || "";
      lines.push(`- ${amt} ${name}`.trim());
    });
  } else {
    lines.push("- (no ingredients listed)");
  }
  lines.push("");

  lines.push("SPECS");
  if (recipe.glass) lines.push(`Glass: ${recipe.glass}`);
  if (recipe.method) lines.push(`Method: ${recipe.method}`);
  if (recipe.ice) lines.push(`Ice: ${recipe.ice}`);
  if (recipe.garnish) lines.push(`Garnish: ${recipe.garnish}`);
  lines.push("");

  if (recipe.notes) {
    lines.push("NOTES");
    lines.push(recipe.notes);
    lines.push("");
  }

  return lines.join("\n").trim();
}
