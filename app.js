class RectCell {
  constructor() {
    this.w = 0;
    this.h = 0;
    this.WK = false;
    this.HK = false;
    this.L = -1000;
    this.R = -1000;
    this.T = -1000;
    this.B = -1000;
    this.drawn = false;
    this.discovered = false;
  }
}

const presets = {
  classic: [
    [0, 1, 10, 20],
    [1, 1, 12, 16],
    [0, 0, 9, 14],
    [1, 0, 13, 13],
    [0, -1, 8, 9],
    [1, -1, 3, 10],
  ],
  square: [
    [0, 1, 5, 5],
    [1, 1, 2, 2],
    [0, 0, 3, 3],
    [1, 0, 4, 4],
    [0, -1, 10, 10],
    [1, -1, 9, 9],
  ],
};

const presetSelect = document.getElementById("presetSelect");
const downloadBtn = document.getElementById("downloadBtn");
const statusNode = document.getElementById("status");
const canvas = document.getElementById("tilingCanvas");
const ctx = canvas.getContext("2d");
const cxInput = document.getElementById("cxInput");
const gridWidthInput = document.getElementById("gridWidthInput");
const autoControls = document.querySelectorAll("[data-auto-control='true']");
let regenerateTimer = null;

const type1Neighbors = [
  {
    dx: 1,
    dy: 0,
    nextType: 2,
    sides: (neighbor, source) => [source.T, source.L + neighbor.w, source.T - neighbor.h, source.R],
  },
  {
    dx: 0,
    dy: 1,
    nextType: 2,
    sides: (neighbor, source) => [source.T + neighbor.h, source.L + neighbor.w, source.T, source.L],
  },
  {
    dx: 0,
    dy: -1,
    nextType: 2,
    sides: (neighbor, source) => [source.B, source.R, source.B - neighbor.h, source.R - neighbor.w],
  },
  {
    dx: -1,
    dy: 0,
    nextType: 2,
    sides: (neighbor, source) => [source.B + neighbor.h, source.L, source.B, source.L - neighbor.w],
  },
];

const type2Neighbors = [
  {
    dx: 1,
    dy: 0,
    nextType: 1,
    sides: (neighbor, source) => [source.B + neighbor.h, source.R + neighbor.w, source.B, source.R],
  },
  {
    dx: 0,
    dy: 1,
    nextType: 1,
    sides: (neighbor, source) => [source.T + neighbor.h, source.R, source.T, source.R - neighbor.w],
  },
  {
    dx: 0,
    dy: -1,
    nextType: 1,
    sides: (neighbor, source) => [source.B, source.L + neighbor.w, source.B - neighbor.h, source.L],
  },
  {
    dx: -1,
    dy: 0,
    nextType: 1,
    sides: (neighbor, source) => [source.T, source.L, source.T - neighbor.h, source.L - neighbor.w],
  },
];

downloadBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = "tiling.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});

cxInput.addEventListener("change", () => {
  const cx = Number(cxInput.value);
  if (!Number.isFinite(cx) || cx < 8) return;
  const proposed = Math.max(4, cx - 4);
  const even = proposed - (proposed % 2);
  gridWidthInput.value = even;
  requestGenerate();
});

autoControls.forEach((control) => {
  const eventName =
    control.type === "checkbox" || control.tagName === "SELECT" ? "change" : "input";
  control.addEventListener(eventName, () => {
    requestGenerate();
  });
});

generateFromUI();

function requestGenerate() {
  clearTimeout(regenerateTimer);
  regenerateTimer = setTimeout(() => {
    regenerateTimer = null;
    generateFromUI();
  }, 120);
}

function generateFromUI() {
  status("");
  try {
    const config = readConfig();
    const seed = getActiveSeedRects();
    const { rectangles, iterations } = generateTiling(config, seed);
    drawRectangles(rectangles, config);
    status(`Generated ${rectangles.length} rectangles in ${iterations} iterations.`);
  } catch (err) {
    console.error(err);
    status(err.message || String(err));
  }
}

function status(message) {
  statusNode.textContent = message;
}
function getActiveSeedRects() {
  const preset = presets[presetSelect.value];
  if (!preset || !preset.length) {
    throw new Error("Selected preset has no rectangles defined.");
  }
  return preset.map(([x, y, w, h]) => {
    if (w <= 0 || h <= 0) {
      throw new Error("Preset rectangles must have positive width and height.");
    }
    return { x, y, w, h };
  });
}

function readConfig() {
  const cx = Number(document.getElementById("cxInput").value);
  const gridWidth = Number(document.getElementById("gridWidthInput").value);
  const maxSide = Number(document.getElementById("maxSideInput").value);
  const edge = Number(document.getElementById("edgeInput").value);
  const maxIterations = Number(document.getElementById("iterationsInput").value);
  const canvasSize = Number(document.getElementById("canvasSizeInput").value);
  const colourIn = document.getElementById("colourCheckbox").checked;
  const labelTiling = document.getElementById("labelCheckbox").checked;

  if (cx % 4 !== 0) {
    throw new Error("cx must be a multiple of 4.");
  }
  if (gridWidth % 2 !== 0) {
    throw new Error("Grid width must be even.");
  }
  if (gridWidth >= cx) {
    throw new Error("Grid width must be smaller than cx.");
  }

  return {
    cx,
    cy: cx,
    gridWidth,
    H: gridWidth / 2,
    TILH: gridWidth / 2 - 1,
    maxSide,
    edgeWidth: edge,
    colourIn,
    labelTiling,
    maxIterations,
    canvasSize,
    maxDim: 2 * cx,
  };
}

function generateTiling(config, seedRects) {
  const state = createState(config);
  seedRects.forEach((rect) => enterSize(state, rect));
  let iterations = 0;
  while (iterations < config.maxIterations) {
    const progress = extrapolate(state);
    if (!progress) break;
    iterations += 1;
  }
  if (iterations === config.maxIterations) {
    console.warn("Reached iteration limit; tiling may be incomplete.");
  }

  const center = getCell(state, config.cx, config.cy);
  if (!center.WK || !center.HK) {
    throw new Error("Central rectangle lacks both dimensions; check seeds.");
  }
  setSides(center, center.h, center.w, 0, 0);

  const rectangles = traverseRectangles(state);
  if (!rectangles.length) {
    throw new Error("No drawable rectangles were found; adjust parameters.");
  }
  return { rectangles, iterations };
}

function createState(config) {
  const grid = Array.from({ length: config.maxDim }, () =>
    Array.from({ length: config.maxDim }, () => new RectCell())
  );
  return {
    ...config,
    grid,
  };
}

function enterSize(state, rect) {
  const target = getCell(state, state.cx + rect.x, state.cy + rect.y);
  if (!target) {
    throw new Error(`Seed rectangle at offset (${rect.x}, ${rect.y}) is outside the grid.`);
  }
  target.w = rect.w;
  target.h = rect.h;
  target.WK = true;
  target.HK = true;
}

function traverseRectangles(state) {
  const rectangles = [];
  const center = getCell(state, state.cx, state.cy);
  if (!center) {
    return rectangles;
  }
  center.discovered = true;
  const stack = [{ type: 1, x: state.cx, y: state.cy, nextIdx: 0, entered: false }];

  while (stack.length) {
    const frame = stack.pop();
    if (!withinBounds(state, frame.x, frame.y)) {
      continue;
    }
    const cell = getCell(state, frame.x, frame.y);
    if (!cell) {
      continue;
    }

    if (!frame.entered) {
      if (!cell.drawn && cell.h > 0 && cell.w > 0) {
        drawCell(rectangles, cell, state);
        cell.drawn = true;
      }
      frame.entered = true;
    }

    const neighbors = frame.type === 1 ? type1Neighbors : type2Neighbors;
    if (frame.nextIdx >= neighbors.length) {
      continue;
    }

    const def = neighbors[frame.nextIdx];
    frame.nextIdx += 1;
    stack.push(frame);

    const nx = frame.x + def.dx;
    const ny = frame.y + def.dy;
    if (!withinBounds(state, nx, ny)) {
      continue;
    }
    const neighbor = getCell(state, nx, ny);
    if (!neighbor || neighbor.drawn || neighbor.discovered || neighbor.h <= 0 || neighbor.w <= 0) {
      continue;
    }
    if (neighbor.L <= -1000 || neighbor.R <= -1000 || neighbor.T <= -1000 || neighbor.B <= -1000) {
      const [T, R, B, L] = def.sides(neighbor, cell);
      setSides(neighbor, T, R, B, L);
    }
    neighbor.discovered = true;
    stack.push({ type: def.nextType, x: nx, y: ny, nextIdx: 0, entered: false });
  }

  return rectangles;
}

function extrapolate(state) {
  const { grid, cx, cy, H } = state;
  let infoAdded = false;
  for (let i = cx - H; i < cx + H; i += 1) {
    for (let j = cy - H; j < cy + H; j += 1) {
      const cell = grid[i]?.[j];
      if (!cell) continue;
      if (cell.WK) {
        for (const u of [-1, 1]) {
          for (const v of [-1, 1]) {
            infoAdded = extrapolateWidths(grid, i, j, u, v) || infoAdded;
          }
        }
      }
      if (cell.HK) {
        for (const u of [-1, 1]) {
          for (const v of [-1, 1]) {
            infoAdded = extrapolateHeights(grid, i, j, u, v) || infoAdded;
          }
        }
      }
    }
  }
  for (let i = cx - H; i <= cx + H; i += 1) {
    for (let k = cy - H; k <= cy + H; k += 2) {
      const j = k + (i & 1);
      infoAdded = checkHLine(grid, i, j) || infoAdded;
    }
  }
  for (let i = cx - H; i <= cx + H; i += 1) {
    for (let k = cy - H + 1; k <= cy + H; k += 2) {
      const j = k + (i & 1);
      infoAdded = checkVLine(grid, i, j) || infoAdded;
    }
  }
  return infoAdded;
}

function extrapolateWidths(grid, i, j, xoff, yoff) {
  const center = grid[i]?.[j];
  const opp = grid[i - xoff]?.[j - yoff];
  const next = grid[i + xoff]?.[j + yoff];
  if (!center || !opp || !next) return false;
  if (opp.WK && !next.WK) {
    next.w = center.w - opp.w + center.w;
    next.WK = true;
    return true;
  }
  return false;
}

function extrapolateHeights(grid, i, j, xoff, yoff) {
  const center = grid[i]?.[j];
  const opp = grid[i - xoff]?.[j - yoff];
  const next = grid[i + xoff]?.[j + yoff];
  if (!center || !opp || !next) return false;
  if (opp.HK && !next.HK) {
    next.h = center.h - opp.h + center.h;
    next.HK = true;
    return true;
  }
  return false;
}

function checkHLine(grid, i, j) {
  const a = grid[i]?.[j + 1];
  const b = grid[i + 1]?.[j + 1];
  const c = grid[i]?.[j];
  const d = grid[i + 1]?.[j];
  if (!a || !b || !c || !d) return false;
  let changed = false;
  if (c.WK && a.WK && b.WK && !d.WK) {
    d.w = a.w + b.w - c.w;
    d.WK = true;
    changed = true;
  }
  if (d.WK && a.WK && b.WK && !c.WK) {
    c.w = a.w + b.w - d.w;
    c.WK = true;
    changed = true;
  }
  if (a.WK && c.WK && d.WK && !b.WK) {
    b.w = c.w + d.w - a.w;
    b.WK = true;
    changed = true;
  }
  if (b.WK && c.WK && d.WK && !a.WK) {
    a.w = c.w + d.w - b.w;
    a.WK = true;
    changed = true;
  }
  return changed;
}

function checkVLine(grid, i, j) {
  const a = grid[i]?.[j + 1];
  const b = grid[i]?.[j];
  const c = grid[i + 1]?.[j + 1];
  const d = grid[i + 1]?.[j];
  if (!a || !b || !c || !d) return false;
  let changed = false;
  if (c.HK && a.HK && b.HK && !d.HK) {
    d.h = a.h + b.h - c.h;
    d.HK = true;
    changed = true;
  }
  if (d.HK && a.HK && b.HK && !c.HK) {
    c.h = a.h + b.h - d.h;
    c.HK = true;
    changed = true;
  }
  if (a.HK && c.HK && d.HK && !b.HK) {
    b.h = c.h + d.h - a.h;
    b.HK = true;
    changed = true;
  }
  if (b.HK && c.HK && d.HK && !a.HK) {
    a.h = c.h + d.h - b.h;
    a.HK = true;
    changed = true;
  }
  return changed;
}

function drawCell(rectangles, cell, state) {
  rectangles.push({
    L: cell.L,
    R: cell.R,
    T: cell.T,
    B: cell.B,
    w: cell.w,
    h: cell.h,
    fill: state.colourIn
      ? colourRect(cell, state.maxSide)
      : "#ffffff",
  });
}

function withinBounds(state, x, y) {
  return (
    x <= state.cx + state.TILH &&
    x >= state.cx - state.TILH &&
    y <= state.cy + state.TILH &&
    y >= state.cy - state.TILH
  );
}

function setSides(cell, T, R, B, L) {
  cell.T = T;
  cell.R = R;
  cell.B = B;
  cell.L = L;
}

function getCell(state, x, y) {
  if (x < 0 || y < 0 || x >= state.maxDim || y >= state.maxDim) return null;
  return state.grid[x]?.[y] ?? null;
}

function colourRect(cell, maxSide) {
  const fw = Math.abs(cell.w);
  const fh = Math.abs(cell.h);
  const colour = (dim) => {
    const value = Math.round(255 - (dim * 255) / maxSide);
    return clamp(value, 0, 255);
  };
  const red = clamp(Math.round((255 * fw * fh) / (maxSide * maxSide)), 0, 255);
  const green = colour(fw);
  const blue = colour(fh);
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

function toHex(num) {
  return num.toString(16).padStart(2, "0");
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function drawRectangles(rectangles, config) {
  canvas.width = config.canvasSize;
  canvas.height = config.canvasSize;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.fillStyle = "#f6f8ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const padding = 30;
  const bounds = rectangles.reduce(
    (acc, rect) => ({
      minX: Math.min(acc.minX, rect.L),
      maxX: Math.max(acc.maxX, rect.R),
      minY: Math.min(acc.minY, rect.B),
      maxY: Math.max(acc.maxY, rect.T),
    }),
    {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
    }
  );

  const width = bounds.maxX - bounds.minX || 1;
  const height = bounds.maxY - bounds.minY || 1;
  const scale = Math.min(
    (canvas.width - padding * 2) / width,
    (canvas.height - padding * 2) / height
  );

  rectangles.forEach((rect) => {
    const x = padding + (rect.L - bounds.minX) * scale;
    const y = padding + (bounds.maxY - rect.T) * scale;
    const rectWidth = (rect.R - rect.L) * scale;
    const rectHeight = (rect.T - rect.B) * scale;
    if (config.colourIn) {
      ctx.fillStyle = rect.fill;
      ctx.fillRect(x, y, rectWidth, rectHeight);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, y, rectWidth, rectHeight);
    }
    ctx.lineWidth = config.edgeWidth;
    ctx.strokeStyle = "#000000";
    ctx.strokeRect(x, y, rectWidth, rectHeight);
    if (config.labelTiling) {
      ctx.fillStyle = "#111";
      ctx.font = `${Math.max(12, rectHeight / 5)}px "JetBrains Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${rect.w},${rect.h}`, x + rectWidth / 2, y + rectHeight / 2);
    }
  });
  ctx.restore();
}
