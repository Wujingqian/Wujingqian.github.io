(() => {
  "use strict";

  const root = document.getElementById("jw-research-gallery");
  if (!root) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const state = { paused: false, eventView: "capture", match: "facades", agent: "ground" };
  const players = [];
  let updateSculpture = () => {};
  let refreshSculptureColors = () => {};

  const animationsAllowed = () => !state.paused && !reducedMotion.matches && !document.hidden;
  const pauseVideos = () => players.forEach((player) => player.pause());

  function updateMotion() {
    const stopped = state.paused || reducedMotion.matches;
    root.classList.toggle("motion-still", stopped || document.hidden);
    const button = root.querySelector(".motion-switch");
    if (button) {
      button.querySelector(".motion-pause").hidden = stopped;
      button.querySelector(".motion-play").hidden = !stopped;
      const label = reducedMotion.matches ? "Motion reduced by system setting" : stopped ? "Resume motion" : "Pause motion";
      button.setAttribute("aria-label", label);
      button.setAttribute("title", label);
      button.disabled = reducedMotion.matches;
    }
    if (stopped || document.hidden) pauseVideos();
    updateSculpture();
  }

  root.querySelector(".motion-switch")?.addEventListener("click", () => {
    state.paused = !state.paused;
    updateMotion();
  });

  function formatTime(seconds) {
    const value = Number.isFinite(seconds) ? Math.floor(seconds) : 0;
    return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  }

  for (const shell of root.querySelectorAll("[data-player]")) {
    const video = shell.querySelector("video");
    const button = shell.querySelector(".play-toggle");
    if (!video || !button) continue;
    const scrub = shell.querySelector("[data-scrub]");
    const readout = shell.querySelector(".time-readout");
    const name = shell.dataset.player === "dark" ? "Dark-EvGS scene" : "EventSpecPS capture";
    let pinned = false;
    let hovered = false;
    let pending = false;
    let generation = 0;
    let failed = false;
    const available = () => !failed && (shell.dataset.player !== "event" || state.eventView === "capture");

    function sync() {
      const playing = !video.paused || pending;
      button.querySelector(".play-glyph").hidden = playing;
      button.querySelector(".pause-glyph").hidden = !playing;
      button.querySelector(".play-text").textContent = failed
        ? "Unavailable"
        : playing
          ? "Pause"
          : shell.dataset.player === "dark"
            ? "Play scene"
            : "Play";
      button.setAttribute("aria-label", failed ? `${name} playback unavailable` : `${playing ? "Pause" : "Play"} ${name}`);
    }

    function pause() {
      generation += 1;
      pinned = false;
      pending = false;
      video.pause();
      sync();
    }

    function play(explicit = false) {
      if (!available() || document.hidden || (!explicit && !animationsAllowed())) return;
      for (const other of players) if (other.video !== video) other.pause();
      const attempt = ++generation;
      pending = true;
      video.muted = true;
      sync();
      Promise.resolve(video.play()).then(
        () => {
          if (attempt !== generation) return;
          pending = false;
          sync();
        },
        () => {
          if (attempt !== generation) return;
          pending = false;
          pinned = false;
          sync();
        }
      );
    }

    function updateTime() {
      if (scrub && Number.isFinite(video.duration) && video.duration > 0) {
        scrub.value = String((video.currentTime / video.duration) * 100);
      }
      if (readout) readout.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration || 6)}`;
    }

    video.muted = true;
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    video.addEventListener("timeupdate", updateTime);
    video.addEventListener("loadedmetadata", updateTime);
    video.addEventListener("error", () => {
      failed = true;
      pause();
      button.disabled = true;
      if (scrub) scrub.disabled = true;
    });
    shell.addEventListener("pointerenter", (event) => {
      if (!finePointer.matches || event.pointerType !== "mouse") return;
      hovered = true;
      play();
    });
    shell.addEventListener("pointerleave", () => {
      hovered = false;
      if (!pinned) pause();
    });
    button.addEventListener("click", () => {
      if (!video.paused || pending) {
        pause();
      } else {
        pinned = true;
        // Explicit video playback leaves the decorative-motion pause unchanged.
        play(true);
      }
    });
    scrub?.addEventListener("input", () => {
      pause();
      if (Number.isFinite(video.duration)) video.currentTime = (video.duration * Number(scrub.value)) / 100;
    });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) {
          hovered = false;
          pause();
        }
      }).observe(shell);
    }
    players.push({ video, pause, play, hovered: () => hovered });
    sync();
  }

  const eventShell = root.querySelector('[data-player="event"]');
  function selectEventView(value, animate = false) {
    state.eventView = ["capture", "normals", "reflectance"].includes(value) ? value : "capture";
    if (!eventShell) return;
    const player = players.find((item) => item.video === eventShell.querySelector("video"));
    player?.pause();
    for (const panel of eventShell.querySelectorAll("[data-view]")) {
      const active = panel.dataset.view === state.eventView;
      panel.hidden = !active;
      panel.classList.toggle("active", active);
      if (active && animate && animationsAllowed() && panel.animate) {
        panel.animate(
          [
            { opacity: 0.3, transform: "translateY(5px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 280, easing: "ease-out" }
        );
      }
    }
    for (const button of eventShell.querySelectorAll("[data-event-view]")) {
      button.setAttribute("aria-pressed", String(button.dataset.eventView === state.eventView));
    }
    eventShell.querySelector(".play-toggle").hidden = state.eventView !== "capture";
    const captions = {
      capture: "Illumination + masked events",
      normals: "Surface normals · Ground truth / Prediction",
      reflectance: "Reflectance · 8 channels + composite + reference",
    };
    const caption = eventShell.querySelector(".view-caption");
    caption.replaceChildren(document.createTextNode(captions[state.eventView]));
    if (state.eventView === "capture") {
      const note = document.createElement("small");
      note.textContent = "33× slower in source";
      caption.append(note);
      if (player?.hovered()) player.play();
    }
  }
  root.querySelector(".view-caption")?.setAttribute("aria-live", "polite");
  root.querySelectorAll("[data-event-view]").forEach((button) => {
    button.addEventListener("click", () => selectEventView(button.dataset.eventView, true));
  });

  const matchingImage = root.querySelector(".matching-image");
  function selectMatch(value, animate = false) {
    const validValue = ["facades", "mountain", "still"].includes(value) ? value : "facades";
    const selected = root.querySelector(`[data-match="${validValue}"]`);
    if (!selected || !matchingImage) return;
    state.match = validValue;
    const names = { facades: "Building façades", mountain: "Mountain scene", still: "Still life" };
    for (const button of root.querySelectorAll("[data-match]")) {
      const active = button === selected;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    matchingImage.src = selected.querySelector("img").src;
    matchingImage.alt = `Published SAMFeat ${names[state.match]} matching results, Figure 10(a)`;
    root.querySelector(".matching-name").textContent = names[state.match];
    if (animate && animationsAllowed() && matchingImage.animate) {
      matchingImage.animate(
        [
          { opacity: 0.3, transform: "scale(.985)" },
          { opacity: 1, transform: "scale(1)" },
        ],
        { duration: 320, easing: "ease-out" }
      );
    }
  }
  root.querySelector(".matching-name")?.setAttribute("aria-live", "polite");
  root.querySelectorAll("[data-match]").forEach((button) => {
    button.addEventListener("click", () => selectMatch(button.dataset.match, true));
  });

  const agentCopy = {
    ground: ["01 / UNDERSTAND INTENT", "Start with the person,\nthe purpose, and the context."],
    explore: ["02 / EXPLORE POSSIBILITIES", "Bring visual evidence\nand aesthetic expertise together."],
    decide: ["03 / MAKE A CHOICE", "Compare alternatives\nagainst meaningful criteria."],
    adapt: ["04 / LEARN PREFERENCES", "Let feedback shape\nthe next decision."],
  };
  function selectAgent(value) {
    state.agent = Object.hasOwn(agentCopy, value) ? value : "ground";
    for (const button of root.querySelectorAll("[data-agent]")) {
      const active = button.dataset.agent === state.agent;
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("active", active);
    }
    root.querySelector(".agent-stage-label").textContent = agentCopy[state.agent][0];
    const text = root.querySelector(".agent-description");
    text.textContent = agentCopy[state.agent][1];
    text.style.whiteSpace = "pre-line";
    const hue = { ground: 0, explore: 20, decide: -20, adapt: 40 }[state.agent];
    root.querySelector(".agent-core").style.filter = `hue-rotate(${hue}deg)`;
  }
  root.querySelectorAll("[data-agent]").forEach((button) => {
    button.addEventListener("click", () => selectAgent(button.dataset.agent));
  });

  root.querySelector(".appearance-button")?.addEventListener("click", () => {
    window.researchTheme?.toggle();
  });

  selectEventView("capture");
  selectMatch("facades");
  selectAgent("ground");

  // Controls remain usable if the decorative canvas or optional observers fail.
  function initSculpture() {
    const stage = root.querySelector(".light-sculpture");
    const canvas = stage?.querySelector("canvas");
    const context = canvas?.getContext("2d");
    if (!stage || !canvas || !context) return;
    let width = 1;
    let height = 1;
    let frame = 0;
    let last = 0;
    let angle = 0.28;
    let visible = true;
    let px = 0;
    let py = 0;
    let tx = 0;
    let ty = 0;
    let palette = [];
    const points = [];
    for (let i = 0; i < 112; i++) {
      for (let j = 0; j < 17; j++) {
        const u = (i / 112) * Math.PI * 2;
        const v = (j / 16 - 0.5) * 1.3;
        const radius = 1 + v * 0.35 * Math.cos(u * 1.5);
        points.push({
          x: radius * Math.cos(u),
          y: radius * Math.sin(u) * 0.82,
          z: v * 0.64 * Math.sin(u * 1.5) + 0.1 * Math.cos(u * 3),
          band: j,
        });
      }
    }

    function colors() {
      palette = [".tone-violet", ".tone-cyan", ".tone-rose"].map((selector) => getComputedStyle(root.querySelector(selector)).color);
    }

    function draw() {
      context.clearRect(0, 0, width, height);
      const ry = angle + px * 0.24;
      const rx = 0.9 + py * 0.22;
      const size = Math.min(width * 0.36, height * 0.39);
      const cy = Math.cos(ry);
      const sy = Math.sin(ry);
      const cx = Math.cos(rx);
      const sx = Math.sin(rx);
      const projected = points.map((point) => {
        const x = point.x * cy + point.z * sy;
        const z = -point.x * sy + point.z * cy;
        const y = point.y * cx - z * sx;
        const depth = point.y * sx + z * cx;
        const perspective = 3.8 / (3.8 + depth);
        return { x: width * 0.51 + x * size * perspective, y: height * 0.51 + y * size * perspective, z: depth, band: point.band };
      });
      context.lineWidth = 0.55;
      for (let i = 0; i < 111; i++) {
        for (let j = 0; j < 17; j += 4) {
          const a = projected[i * 17 + j];
          const b = projected[(i + 1) * 17 + j];
          context.globalAlpha = 0.12 + (1.4 - a.z) * 0.065;
          context.strokeStyle = palette[j < 6 ? 0 : j < 12 ? 1 : 2];
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.stroke();
        }
      }
      projected.sort((a, b) => b.z - a.z);
      for (const point of projected) {
        context.globalAlpha = 0.25 + (1.5 - point.z) * 0.22;
        context.fillStyle = palette[point.band < 6 ? 0 : point.band < 12 ? 1 : 2];
        context.beginPath();
        context.arc(point.x, point.y, Math.max(0.55, 1.15 - point.z * 0.32), 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    }

    function tick(time) {
      frame = 0;
      if (!animationsAllowed() || !visible) return;
      const elapsed = Math.min(time - last || 16, 50);
      last = time;
      angle += elapsed * 0.00013;
      px += (tx - px) * 0.07;
      py += (ty - py) * 0.07;
      draw();
      frame = requestAnimationFrame(tick);
    }

    function schedule() {
      if (animationsAllowed() && visible && !frame) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      } else if ((!animationsAllowed() || !visible) && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      draw();
    }

    function resize() {
      const box = stage.getBoundingClientRect();
      width = Math.max(box.width, 1);
      height = Math.max(box.height, 1);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      colors();
      draw();
    }

    stage.addEventListener("pointermove", (event) => {
      if (!finePointer.matches || !animationsAllowed()) return;
      const box = stage.getBoundingClientRect();
      tx = (event.clientX - box.left) / box.width - 0.5;
      ty = (event.clientY - box.top) / box.height - 0.5;
    });
    stage.addEventListener("pointerleave", () => {
      tx = 0;
      ty = 0;
    });
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(stage);
    else window.addEventListener("resize", resize, { passive: true });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        schedule();
      }).observe(stage);
    }
    resize();
    updateSculpture = schedule;
    refreshSculptureColors = () => {
      colors();
      draw();
    };
    schedule();
  }

  try {
    initSculpture();
  } catch {
    // The static spectral backdrop is the decorative fallback.
  }

  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      },
      { threshold: 0.08 }
    );
    root.querySelectorAll(".reveal").forEach((section) => revealObserver.observe(section));
    root.classList.add("motion-ready");
  }
  if ("MutationObserver" in window) {
    new MutationObserver(refreshSculptureColors).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style", "data-theme"],
    });
  }
  document.addEventListener("visibilitychange", updateMotion);
  reducedMotion.addEventListener("change", updateMotion);
  window.addEventListener("pagehide", pauseVideos);
  updateMotion();
})();
