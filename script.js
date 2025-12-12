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
      void label.offsetWidth; // force reflow
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
    btn.addEventListener("click", () => {
      loadTrack(idx, true);
    });
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
// BAR BOT (CHAT + WIZARD)
// ==========================

function initBarBot() {
  const messagesEl = document.getElementById("bartenderMessages");
  const formEl = document.getElementById("bartenderForm");
  const inputEl = document.getElementById("bartenderInput");
  const recipePanel = document.getElementById("bartenderRecipePanel");
  const wizardEl = document.getElementById("bartenderWizard");

  if (!messagesEl || !formEl || !inputEl) {
    console.warn("CCC: Bar Bot elements missing; skipping AI bartender wiring.");
    return;
  }

  // ---- Chat helpers ----

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

  // Shared API call for wizard + free-text chat
  async function callBartenderAPI(payload, { showQuestionInChat = false } = {}) {
    const questionText = payload.question || "";

    if (showQuestionInChat && questionText) {
      appendMessage(questionText, false);
    }

    showTyping();

    try {
      const res = await fetch(BARTENDER_FUNCTION_PATH || "/.netlify/functions/ccc-bartender", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      hideTyping();

      if (!res.ok) {
        appendMessage("Bar Bot is temporarily offline. Try again shortly.", true);
        console.error("CCC Bar Bot HTTP error:", res.status, await res.text());
        return;
      }

      const data = await res.json();
      let structured = data.structured || null;

      // Fallback: backend sometimes returns JSON string in data.answer
      if (!structured && typeof data.answer === "string") {
        try {
          structured = JSON.parse(data.answer);
        } catch (err) {
          console.warn("CCC Bar Bot: could not parse JSON answer:", err);
        }
      }

      // Render recipe cards if provided
      if (structured) {
        renderRecipeCards(structured);
      }

      // Chat summary
      if (structured && structured.summary) {
        appendMessage(structured.summary, true);
      } else if (data.answer) {
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
  }

  // ---- Free-text chat submit ----

  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    const question = inputEl.value.trim();
    if (!question) return;

    inputEl.value = "";

    const payload = {
      mode: "chat",
      question,
      recipes: [], // legacy field; backend can ignore or use
    };

    callBartenderAPI(payload, { showQuestionInChat: true });
  });

  // ---- Wizard wiring (refactored) ----

  if (wizardEl) {
    const wizardSubmitBtn =
      wizardEl.querySelector("[data-wizard-submit]") ||
      wizardEl.querySelector("#wizardRecommendBtn") ||
      wizardEl.querySelector(".wizard-submit-btn");

    const wizardOptionGroups = wizardEl.querySelectorAll(".wizard-options");

    // Persistent state for wizard answers
    const wizardState = {
      style: null,   // "light_refreshing" | "spirit_forward"
      ice: null,     // "on_ice" | "no_ice"
      spirits: [],   // array of strings
    };

    function updateWizardCTA() {
      if (!wizardSubmitBtn) return;

      const ready =
        !!wizardState.style &&
        !!wizardState.ice &&
        Array.isArray(wizardState.spirits) &&
        wizardState.spirits.length > 0;

      wizardSubmitBtn.disabled = !ready;
    }

    function handleSingleChoice(questionKey, value, buttonEl, groupEl) {
      const allButtons = groupEl.querySelectorAll(".wizard-option");
      allButtons.forEach((b) => b.classList.remove("is-selected"));

      buttonEl.classList.add("is-selected");
      wizardState[questionKey] = value;
    }

    function handleMultiChoice(value, buttonEl) {
      const idx = wizardState.spirits.indexOf(value);
      if (idx >= 0) {
        wizardState.spirits.splice(idx, 1);
        buttonEl.classList.remove("is-selected");
      } else {
        wizardState.spirits.push(value);
        buttonEl.classList.add("is-selected");
      }
    }

    // Attach click handlers to all wizard-option buttons
    wizardOptionGroups.forEach((groupEl) => {
      const questionKey = groupEl.getAttribute("data-question");
      if (!questionKey) return;

      groupEl.querySelectorAll(".wizard-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          const value = btn.getAttribute("data-value");
          if (!value) return;

          if (questionKey === "style" || questionKey === "ice") {
            handleSingleChoice(questionKey, value, btn, groupEl);
          } else if (questionKey === "spirits") {
            handleMultiChoice(value, btn);
          }

          updateWizardCTA();
        });
      });
    });

    function buildWizardQuestionText() {
      const parts = [];

      if (wizardState.style === "light_refreshing") {
        parts.push("light & refreshing, shaken with juice");
      } else if (wizardState.style === "spirit_forward") {
        parts.push("spirit-forward and stirred");
      }

      if (wizardState.ice === "on_ice") {
        parts.push("served on ice");
      } else if (wizardState.ice === "no_ice") {
        parts.push("served up without ice");
      }

      if (wizardState.spirits.length) {
        parts.push(`featuring: ${wizardState.spirits.join(", ")}`);
      }

      if (!parts.length) {
        return "Recommend three cocktails based on my preferences.";
      }

      return `Recommend three cocktails that are ${parts.join(", ")}.`;
    }

        if (wizardSubmitBtn) {
      wizardSubmitBtn.addEventListener("click", () => {
        if (wizardSubmitBtn.disabled) return;

        // Pick a primary spirit for backend wizard filtering
        const primarySpirit =
          Array.isArray(wizardState.spirits) && wizardState.spirits.length
            ? wizardState.spirits[0]
            : "";

        // Build backend-compatible wizard text markers (backend parses these reliably)
        const questionText =
          `style: ${wizardState.style === "light_refreshing" ? "Light and Refreshing" : "Spirit Forward"}\n` +
          `icePreference: ${wizardState.ice === "no_ice" ? "No Ice" : "With Ice"}\n` +
          `spirit: ${primarySpirit}`;

        const payload = {
          mode: "wizard",
          question: questionText,

          // CRITICAL: backend expects this object + these key names
          wizard: {
            style: wizardState.style,          // "light_refreshing" | "spirit_forward"
            icePreference: wizardState.ice,    // "on_ice" | "no_ice"
            spirit: primarySpirit,             // e.g. "rum"
          },

          // Optional: keep for UI/debugging; backend can ignore
          wizard_preferences: { ...wizardState },
        };

        callBartenderAPI(payload, { showQuestionInChat: true });
      });
    }


    // Initial button state
    updateWizardCTA();
  }
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
