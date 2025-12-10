// ========== AUDIO PLAYER (Vinyl Shelf + Listening Room) ==========

const tracks = [
  {
    title: "Toby’s Mix",
    artist: "Toby",
    durationLabel: "58:24",
    file: "https://visionary-beignet-7d270e.netlify.app/audio/tobys-mix.mp3"
  },
  {
    title: "Gold Hour Spritz",
    artist: "Toby",
    durationLabel: "42:14",
    file: "https://visionary-beignet-7d270e.netlify.app/audio/gold-hour-spritz.mp3"
  },
  {
    title: "Midnight Chrome",
    artist: "Kartell",
    durationLabel: "55:01",
    file: "https://visionary-beignet-7d270e.netlify.app/audio/midnight-chrome.mp3"
  },
  {
    title: "Poolside Mirage",
    artist: "Solomun",
    durationLabel: "50:43",
    file: "https://visionary-beignet-7d270e.netlify.app/audio/poolside-mirage.mp3"
  },
  {
    title: "Khruangbin Live",
    artist: "Khruangbin",
    durationLabel: "49:02",
    file: "https://visionary-beignet-7d270e.netlify.app/audio/khruangbin-live.mp3"
  },
  {
    title: "Succession Beats",
    artist: "Jsco Music",
    durationLabel: "45:18",
    file: "https://visionary-beignet-7d270e.netlify.app/audio/succession-beats.mp3"
  }
];

let currentTrack = 0;
let isPlaying = false;
const audio = document.getElementById("bar-audio");

function loadTrack(index) {
  const track = tracks[index];
  document.getElementById("track-title").textContent = track.title;
  document.getElementById("track-artist").textContent = track.artist;
  document.getElementById("track-duration").textContent = track.durationLabel;
  document.getElementById("dockTrack").textContent = `${track.title} — ${track.artist}`;
  audio.src = track.file;
}

function playTrack() {
  audio.play();
  isPlaying = true;
  document.getElementById("play-btn").textContent = "Pause";
  document.getElementById("playerEq").classList.add("is-playing");
  document.getElementById("albumArt").classList.add("glow-active");
}

function pauseTrack() {
  audio.pause();
  isPlaying = false;
  document.getElementById("play-btn").textContent = "Play";
  document.getElementById("playerEq").classList.remove("is-playing");
  document.getElementById("albumArt").classList.remove("glow-active");
}

document.getElementById("play-btn").addEventListener("click", () => {
  isPlaying ? pauseTrack() : playTrack();
});

document.getElementById("prev-btn").addEventListener("click", () => {
  currentTrack = (currentTrack - 1 + tracks.length) % tracks.length;
  loadTrack(currentTrack);
  playTrack();
});

document.getElementById("next-btn").addEventListener("click", () => {
  currentTrack = (currentTrack + 1) % tracks.length;
  loadTrack(currentTrack);
  playTrack();
});

document.getElementById("volume-slider").addEventListener("input", (e) => {
  audio.volume = parseFloat(e.target.value);
});

document.querySelectorAll(".vinyl-item").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".vinyl-item").forEach((el) => el.classList.remove("is-active"));
    item.classList.add("is-active");
    currentTrack = parseInt(item.dataset.trackIndex);
    loadTrack(currentTrack);
    playTrack();
  });
});

audio.addEventListener("timeupdate", () => {
  const progress = (audio.currentTime / audio.duration) * 100;
  document.getElementById("timeline-progress").style.width = progress + "%";
  document.getElementById("time-current").textContent = formatTime(audio.currentTime);
  document.getElementById("time-remaining").textContent = "-" + formatTime(audio.duration - audio.currentTime);
});

function formatTime(sec) {
  const minutes = Math.floor(sec / 60);
  const seconds = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

loadTrack(currentTrack);

// ========== BAR TV (Video) ==========

const tvChannels = [
  {
    src: "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_01.mp4",
    title: "Bar Tape 01"
  },
  {
    src: "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_02.mp4",
    title: "Bar Tape 02"
  },
  {
    src: "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_03.mp4",
    title: "Bar Tape 03"
  },
  {
    src: "https://visionary-beignet-7d270e.netlify.app/video/bar_tape_04.mp4",
    title: "Bar Tape 04"
  }
];

let currentChannel = 0;
const videoEl = document.getElementById("barTvVideo");
const muteBtn = document.getElementById("barTvMuteBtn");

function loadChannel(index) {
  const channel = tvChannels[index];
  videoEl.src = channel.src;
  document.getElementById("barTvTitle").textContent = channel.title;
  videoEl.play();
}

document.getElementById("barTvChannelBtn").addEventListener("click", () => {
  currentChannel = (currentChannel + 1) % tvChannels.length;
  loadChannel(currentChannel);
});

document.getElementById("barTvPlayBtn").addEventListener("click", () => {
  if (videoEl.paused) {
    videoEl.play();
    document.getElementById("barTvPlayBtn").textContent = "⏸";
  } else {
    videoEl.pause();
    document.getElementById("barTvPlayBtn").textContent = "▶";
  }
});

muteBtn.addEventListener("click", () => {
  videoEl.muted = !videoEl.muted;
  muteBtn.textContent = videoEl.muted ? "Sound: Off" : "Sound: On";
});

document.getElementById("barTvVolume").addEventListener("input", (e) => {
  videoEl.volume = parseFloat(e.target.value);
});

loadChannel(currentChannel);