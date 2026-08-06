const canvas = document.querySelector("#game-canvas");
const coordinates = document.querySelector("#game-coordinates");
const modeLabel = document.querySelector("#game-mode");
const blockButtons = [...document.querySelectorAll("[data-block]")];
const shaderToggle = document.querySelector("#shader-toggle");

const state = {
  playerX: 0,
  playerZ: 0,
  selectedBlock: "grass",
  dusk: false,
  pressed: new Set(),
  customBlocks: new Map(),
};

const colors = {
  grass: { top: "#5fae62", left: "#3c784d", right: "#2d5a3f", edge: "#87d275" },
  stone: { top: "#82948a", left: "#596860", right: "#435149", edge: "#a5b4aa" },
  water: { top: "#3eafb0", left: "#287d8b", right: "#1c5d70", edge: "#76dbd0" },
  dirt: { top: "#8a704e", left: "#604937", right: "#45352c", edge: "#b18c5f" },
};

const view = {
  dpr: 1,
  width: 0,
  height: 0,
  tileWidth: 54,
  tileHeight: 27,
  horizon: 0,
};

function hash(x, z) {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function terrainHeight(x, z) {
  const custom = state.customBlocks.get(`${x},${z}`);
  if (custom) return custom.height;
  const broad = Math.sin(x * 0.42) * 0.65 + Math.cos(z * 0.36) * 0.6;
  const detail = hash(Math.floor(x * 1.7), Math.floor(z * 1.7)) * 1.35;
  return Math.max(1, Math.min(4, Math.floor(1.75 + broad + detail)));
}

function terrainBlock(x, z) {
  const custom = state.customBlocks.get(`${x},${z}`);
  if (custom) return custom.type;
  const waterline = Math.sin(x * 0.31 + z * 0.2) > 0.82;
  if (waterline) return "water";
  if (hash(x + 5, z - 2) > 0.78) return "stone";
  return "grass";
}

function resize() {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  view.dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  view.width = Math.max(1, Math.floor(rect.width * view.dpr));
  view.height = Math.max(1, Math.floor(rect.height * view.dpr));
  if (canvas.width !== view.width || canvas.height !== view.height) {
    canvas.width = view.width;
    canvas.height = view.height;
  }
  view.tileWidth = Math.max(35, Math.min(66, view.width / 22));
  view.tileHeight = view.tileWidth * 0.5;
  view.horizon = view.height * 0.47;
}

function project(x, z, height = 0) {
  const relativeX = x - state.playerX;
  const relativeZ = z - state.playerZ;
  return {
    x: view.width * 0.5 + (relativeX - relativeZ) * view.tileWidth * 0.5,
    y: view.horizon + (relativeX + relativeZ) * view.tileHeight * 0.5 - height * view.tileHeight,
  };
}

function polygon(context, points, fill, stroke = null) {
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) context.lineTo(points[index].x, points[index].y);
  context.closePath();
  context.fillStyle = fill;
  context.fill();
  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = Math.max(0.7, view.dpr * 0.55);
    context.stroke();
  }
}

function drawSky(context) {
  const sky = context.createLinearGradient(0, 0, 0, view.height);
  if (state.dusk) {
    sky.addColorStop(0, "#241d4b");
    sky.addColorStop(0.45, "#a85f78");
    sky.addColorStop(1, "#ddab71");
  } else {
    sky.addColorStop(0, "#16495b");
    sky.addColorStop(0.44, "#6cb5ad");
    sky.addColorStop(1, "#b7d99f");
  }
  context.fillStyle = sky;
  context.fillRect(0, 0, view.width, view.height);

  const sunX = view.width * (state.dusk ? 0.72 : 0.75);
  const sunY = view.height * 0.2;
  const glow = context.createRadialGradient(sunX, sunY, 2, sunX, sunY, view.width * 0.22);
  glow.addColorStop(0, state.dusk ? "rgba(255, 205, 140, .42)" : "rgba(255, 237, 167, .35)");
  glow.addColorStop(1, "rgba(255, 226, 157, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, view.width, view.height * 0.65);
  context.fillStyle = state.dusk ? "#ffd094" : "#fff1b7";
  context.beginPath();
  context.arc(sunX, sunY, Math.max(11, view.width * 0.018), 0, Math.PI * 2);
  context.fill();

  context.globalAlpha = 0.13;
  for (let index = 0; index < 5; index += 1) {
    const cloudX = ((index * 247 + 80) % (view.width + 230)) - 115;
    const cloudY = view.height * (0.18 + (index % 3) * 0.06);
    context.fillStyle = "#eff8dc";
    context.fillRect(cloudX, cloudY, 120, 10);
    context.fillRect(cloudX + 24, cloudY - 7, 56, 17);
    context.fillRect(cloudX + 77, cloudY - 3, 42, 13);
  }
  context.globalAlpha = 1;
}

function drawCube(context, x, z, height, type) {
  const palette = colors[type] || colors.grass;
  const top = [
    project(x, z, height),
    project(x + 1, z, height),
    project(x + 1, z + 1, height),
    project(x, z + 1, height),
  ];
  const bottomRight = project(x + 1, z, 0);
  const bottomFront = project(x + 1, z + 1, 0);
  const bottomLeft = project(x, z + 1, 0);

  polygon(context, [top[1], top[2], bottomFront, bottomRight], palette.right, "rgba(4, 20, 14, .22)");
  polygon(context, [top[2], top[3], bottomLeft, bottomFront], palette.left, "rgba(4, 20, 14, .28)");
  polygon(context, top, palette.top, "rgba(219, 255, 209, .18)");

  if (type === "grass") {
    context.strokeStyle = palette.edge;
    context.globalAlpha = 0.48;
    context.lineWidth = Math.max(1, view.dpr);
    context.beginPath();
    context.moveTo(top[0].x + 3 * view.dpr, top[0].y + 2 * view.dpr);
    context.lineTo(top[1].x - 3 * view.dpr, top[1].y + 2 * view.dpr);
    context.stroke();
    context.globalAlpha = 1;
  }
}

function drawPlayer(context) {
  const ground = project(state.playerX + 0.5, state.playerZ + 0.5, terrainHeight(state.playerX, state.playerZ) + 0.05);
  const size = view.tileWidth * 0.18;
  context.fillStyle = state.dusk ? "#f7dba9" : "#d5ffda";
  context.strokeStyle = "rgba(5, 26, 16, .75)";
  context.lineWidth = Math.max(1, view.dpr);
  context.beginPath();
  context.moveTo(ground.x, ground.y - size * 1.6);
  context.lineTo(ground.x + size, ground.y - size * 0.35);
  context.lineTo(ground.x, ground.y + size * 0.2);
  context.lineTo(ground.x - size, ground.y - size * 0.35);
  context.closePath();
  context.fill();
  context.stroke();
}

function drawWorld() {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  // The logical dimensions keep the isometric math crisp on high-DPI screens.
  const logicalWidth = view.width / view.dpr;
  const logicalHeight = view.height / view.dpr;
  context.clearRect(0, 0, logicalWidth, logicalHeight);
  const oldWidth = view.width;
  const oldHeight = view.height;
  view.width = logicalWidth;
  view.height = logicalHeight;
  view.tileWidth /= view.dpr;
  view.tileHeight /= view.dpr;
  view.horizon /= view.dpr;

  drawSky(context);
  const radius = 11;
  const cells = [];
  for (let x = state.playerX - radius; x <= state.playerX + radius; x += 1) {
    for (let z = state.playerZ - radius; z <= state.playerZ + radius; z += 1) {
      cells.push({ x, z, order: x + z });
    }
  }
  cells.sort((a, b) => a.order - b.order);
  cells.forEach((cell) => drawCube(context, cell.x, cell.z, terrainHeight(cell.x, cell.z), terrainBlock(cell.x, cell.z)));
  drawPlayer(context);

  // Restore pixel dimensions used by the resize observer and Web APIs.
  view.width = oldWidth;
  view.height = oldHeight;
  view.tileWidth *= view.dpr;
  view.tileHeight *= view.dpr;
  view.horizon *= view.dpr;
}

function updateCoordinates() {
  if (coordinates) {
    const x = String(state.playerX).padStart(3, "0");
    const z = String(state.playerZ).padStart(3, "0");
    coordinates.textContent = `X: ${x}  Z: ${z}`;
  }
  if (modeLabel) {
    modeLabel.innerHTML = `<span class="mini-dot"></span> ${state.dusk ? "PBR DUSK" : "VIBRANT / DAY"}`;
  }
}

function movePlayer(dx, dz) {
  state.playerX += dx;
  state.playerZ += dz;
  updateCoordinates();
  drawWorld();
}

function changeBlock(delta) {
  const x = state.playerX + (delta > 0 ? 1 : -1);
  const z = state.playerZ;
  const key = `${x},${z}`;
  const currentHeight = terrainHeight(x, z);
  if (delta > 0) {
    state.customBlocks.set(key, { type: state.selectedBlock, height: Math.min(6, currentHeight + 1) });
  } else if (currentHeight > 1) {
    state.customBlocks.set(key, { type: terrainBlock(x, z), height: currentHeight - 1 });
  }
  drawWorld();
}

function handleKey(event) {
  const key = event.key.toLowerCase();
  const moves = {
    w: [0, -1],
    arrowup: [0, -1],
    s: [0, 1],
    arrowdown: [0, 1],
    a: [-1, 0],
    arrowleft: [-1, 0],
    d: [1, 0],
    arrowright: [1, 0],
  };
  if (moves[key]) {
    event.preventDefault();
    if (state.pressed.has(key)) return;
    state.pressed.add(key);
    movePlayer(...moves[key]);
  } else if (key === " ") {
    event.preventDefault();
    if (!state.pressed.has(key)) changeBlock(1);
    state.pressed.add(key);
  } else if (key === "q") {
    event.preventDefault();
    if (!state.pressed.has(key)) changeBlock(-1);
    state.pressed.add(key);
  }
}

function handleKeyUp(event) {
  state.pressed.delete(event.key.toLowerCase());
}

function init() {
  if (!canvas) return;
  const observer = new ResizeObserver(() => {
    resize();
    drawWorld();
  });
  observer.observe(canvas);
  window.addEventListener("keydown", handleKey, { passive: false });
  window.addEventListener("keyup", handleKeyUp);
  blockButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedBlock = button.dataset.block;
      blockButtons.forEach((item) => item.classList.toggle("is-selected", item === button));
    });
  });
  shaderToggle?.addEventListener("click", () => {
    state.dusk = !state.dusk;
    shaderToggle.textContent = state.dusk ? "Vibrant day" : "PBR dusk";
    drawWorld();
    updateCoordinates();
  });
  resize();
  updateCoordinates();
  drawWorld();
}

init();
