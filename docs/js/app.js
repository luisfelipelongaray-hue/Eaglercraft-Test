const SETTINGS_KEY = "eaglercraft-test-shader-settings";
const DEFAULT_SETTINGS = {
  preset: 0,
  intensity: 72,
  pixelSize: 3,
  motion: true,
};

class ShaderScene {
  constructor(canvas, vertexSource, fragmentSource, options = {}) {
    this.canvas = canvas;
    this.vertexSource = vertexSource;
    this.fragmentSource = fragmentSource;
    this.preset = options.preset ?? 0;
    this.intensity = options.intensity ?? 0.72;
    this.pixelSize = options.pixelSize ?? 3;
    this.motion = options.motion ?? true;
    this.onFps = options.onFps || (() => {});
    this.startedAt = performance.now();
    this.frozenAt = 0;
    this.frames = 0;
    this.fpsStartedAt = performance.now();
    this.running = false;
    this.resizeObserver = null;

    this.gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: "high-performance",
    });

    if (!this.gl) {
      throw new Error("WebGL is not available");
    }

    this.program = this.createProgram(vertexSource, fragmentSource);
    this.positionLocation = this.gl.getAttribLocation(this.program, "a_position");
    this.uniforms = {
      resolution: this.gl.getUniformLocation(this.program, "u_resolution"),
      time: this.gl.getUniformLocation(this.program, "u_time"),
      intensity: this.gl.getUniformLocation(this.program, "u_intensity"),
      pixel: this.gl.getUniformLocation(this.program, "u_pixel"),
      preset: this.gl.getUniformLocation(this.program, "u_preset"),
    };

    const vertices = new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      -1, 1,
      1, -1,
      1, 1,
    ]);
    this.buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
    this.gl.useProgram(this.program);
    this.gl.enableVertexAttribArray(this.positionLocation);
    this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 0, 0);

    this.resize = this.resize.bind(this);
    this.render = this.render.bind(this);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  createShader(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const log = this.gl.getShaderInfoLog(shader) || "shader inválido";
      this.gl.deleteShader(shader);
      throw new Error(log);
    }
    return shader;
  }

  createProgram(vertexSource, fragmentSource) {
    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentSource);
    const program = this.gl.createProgram();
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);
    this.gl.deleteShader(vertexShader);
    this.gl.deleteShader(fragmentShader);
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const log = this.gl.getProgramInfoLog(program) || "programa inválido";
      this.gl.deleteProgram(program);
      throw new Error(log);
    }
    return program;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  setOptions(options = {}) {
    if (typeof options.preset === "number") this.preset = options.preset;
    if (typeof options.intensity === "number") this.intensity = options.intensity;
    if (typeof options.pixelSize === "number") this.pixelSize = options.pixelSize;
    if (typeof options.motion === "boolean") {
      if (this.motion && !options.motion) {
        this.frozenAt = (performance.now() - this.startedAt) / 1000;
      }
      if (!this.motion && options.motion) {
        this.startedAt = performance.now() - this.frozenAt * 1000;
      }
      this.motion = options.motion;
    }
  }

  start() {
    if (!this.running) {
      this.running = true;
      this.startedAt = performance.now() - this.frozenAt * 1000;
      requestAnimationFrame(this.render);
    }
  }

  render(now) {
    if (!this.running) return;
    const elapsed = this.motion ? (now - this.startedAt) / 1000 : this.frozenAt;
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uniforms.time, elapsed);
    gl.uniform1f(this.uniforms.intensity, this.intensity);
    gl.uniform1f(this.uniforms.pixel, this.pixelSize);
    gl.uniform1f(this.uniforms.preset, this.preset);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    this.frames += 1;
    if (now - this.fpsStartedAt >= 700) {
      const fps = Math.round((this.frames * 1000) / (now - this.fpsStartedAt));
      this.onFps(fps);
      this.frames = 0;
      this.fpsStartedAt = now;
    }
    requestAnimationFrame(this.render);
  }

  stop() {
    this.running = false;
    this.resizeObserver?.disconnect();
  }
}

function readSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    return { ...DEFAULT_SETTINGS, ...(stored && typeof stored === "object" ? stored : {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // A private browsing session may disable localStorage. The lab still works.
  }
}

function setRangeFill(input) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const value = Number(input.value);
  const percentage = ((value - min) / (max - min)) * 100;
  input.style.setProperty("--range", `${percentage}%`);
}

function initMenu() {
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector("#main-nav");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

function showWebglFallback() {
  const fallback = document.querySelector("#webgl-fallback");
  if (fallback) fallback.hidden = false;
}

async function loadShaderSources() {
  const [vertex, fragment] = await Promise.all([
    fetch("shaders/fullscreen.vert").then((response) => {
      if (!response.ok) throw new Error("Não foi possível carregar o vertex shader");
      return response.text();
    }),
    fetch("shaders/skyline-vibrant.frag").then((response) => {
      if (!response.ok) throw new Error("Não foi possível carregar o fragment shader");
      return response.text();
    }),
  ]);
  return { vertex, fragment };
}

function initShaderLab(sources) {
  const settings = readSettings();
  const heroCanvas = document.querySelector("#hero-canvas");
  const labCanvas = document.querySelector("#shader-canvas");
  const labFps = document.querySelector("#lab-fps");
  const heroFps = document.querySelector("#hero-fps");
  const rendererLabel = document.querySelector("#lab-renderer");
  const intensityInput = document.querySelector("#intensity");
  const pixelInput = document.querySelector("#pixel-size");
  const motionInput = document.querySelector("#motion-toggle");
  const intensityValue = document.querySelector("#intensity-value");
  const pixelValue = document.querySelector("#pixel-value");
  const saveStatus = document.querySelector("#save-status");
  const presetButtons = [...document.querySelectorAll("[data-preset]")];

  let heroScene;
  let labScene;
  try {
    if (heroCanvas) {
      heroScene = new ShaderScene(heroCanvas, sources.vertex, sources.fragment, {
        preset: 1,
        intensity: 0.82,
        pixelSize: 3,
        motion: true,
        onFps: (fps) => {
          if (heroFps) heroFps.textContent = String(fps).padStart(2, "0");
        },
      });
      heroScene.start();
    }
    if (labCanvas) {
      labScene = new ShaderScene(labCanvas, sources.vertex, sources.fragment, {
        preset: settings.preset,
        intensity: settings.intensity / 100,
        pixelSize: settings.pixelSize,
        motion: settings.motion,
        onFps: (fps) => {
          if (labFps) labFps.textContent = String(fps).padStart(2, "0");
        },
      });
      labScene.start();
    }
  } catch (error) {
    console.warn("Shader lab indisponível:", error);
    showWebglFallback();
    return;
  }

  if (rendererLabel && labScene?.gl) {
    const renderer = labScene.gl.getParameter(labScene.gl.RENDERER) || "WEBGL";
    rendererLabel.textContent = `WEBGL / ${renderer.slice(0, 20).toUpperCase()}`;
  }

  const updateControls = () => {
    if (!intensityInput || !pixelInput || !motionInput) return;
    intensityInput.value = String(settings.intensity);
    pixelInput.value = String(settings.pixelSize);
    motionInput.checked = settings.motion;
    if (intensityValue) intensityValue.textContent = `${settings.intensity}%`;
    if (pixelValue) pixelValue.textContent = `${settings.pixelSize} px`;
    setRangeFill(intensityInput);
    setRangeFill(pixelInput);
    presetButtons.forEach((button) => {
      button.classList.toggle("is-active", Number(button.dataset.preset) === settings.preset);
    });
  };

  const applySettings = (persist = true) => {
    labScene?.setOptions({
      preset: settings.preset,
      intensity: settings.intensity / 100,
      pixelSize: settings.pixelSize,
      motion: settings.motion,
    });
    updateControls();
    if (persist) {
      saveSettings(settings);
      if (saveStatus) {
        saveStatus.textContent = "salvo agora";
        window.clearTimeout(applySettings.statusTimer);
        applySettings.statusTimer = window.setTimeout(() => {
          saveStatus.textContent = "salvo localmente";
        }, 1300);
      }
    }
  };

  presetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      settings.preset = Number(button.dataset.preset);
      applySettings();
    });
  });

  intensityInput?.addEventListener("input", () => {
    settings.intensity = Number(intensityInput.value);
    applySettings();
  });

  pixelInput?.addEventListener("input", () => {
    settings.pixelSize = Number(pixelInput.value);
    applySettings();
  });

  motionInput?.addEventListener("change", () => {
    settings.motion = motionInput.checked;
    applySettings();
  });

  document.querySelector("#reset-controls")?.addEventListener("click", () => {
    Object.assign(settings, DEFAULT_SETTINGS);
    applySettings();
  });

  document.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement) return;
    const preset = Number(event.key) - 1;
    if (preset >= 0 && preset <= 3) {
      settings.preset = preset;
      applySettings();
    }
  });

  updateControls();
}

function initYear() {
  const year = document.querySelector("#year");
  if (year) year.textContent = String(new Date().getFullYear());
}

async function boot() {
  initMenu();
  initYear();
  try {
    const sources = await loadShaderSources();
    initShaderLab(sources);
  } catch (error) {
    console.warn("Não foi possível iniciar os shaders:", error);
    showWebglFallback();
  }
}

boot();
