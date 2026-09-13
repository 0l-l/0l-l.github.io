/**
 * Frogger Road — a Crossy Road-style game
 * Pseudo-3D isometric view, chunky block rendering on Canvas 2D.
 *
 * Architecture:
 *   - Isometric projection (Crossy Road's exact camera angle)
 *   - Painter's algorithm for depth sorting
 *   - Procedural lane generation (grass / road / water)
 *   - Camera smoothly follows the player forward
 */

(function () {
  'use strict';

  // ─── Canvas & sizing ────────────────────────────────────────────────────────
  const canvas = document.getElementById('canvas');
  const ctx    = canvas.getContext('2d');

  // Tile unit in logical pixels before iso-projection
  const TILE = 48;
  // Crossy Road's camera: 30° elevation, rotated 45° — but we use
  // a "dimetric" approximation that feels exactly like the game.
  // x′ = (x - z) * cos30  ≈ (x - z) * 0.866
  // y′ = (x + z) * sin30  - y     (y = block height in world)
  // We bake simpler constants that produce the right look.
  const ISO_X = 0.866;  // cos 30°
  const ISO_Y = 0.5;    // sin 30°  (for x,z contribution to screen y)
  const ISO_H = 1.0;    // vertical compression for height

  // World grid dimensions
  const COLS        = 9;   // how many tiles wide
  const HALF_COLS   = Math.floor(COLS / 2);
  const VISIBLE_ROWS = 14; // how many rows visible at once

  // ─── State ──────────────────────────────────────────────────────────────────
  let state     = 'start';  // 'start' | 'playing' | 'dead'
  let score     = 0;
  let best      = parseInt(localStorage.getItem('fr_best') || '0', 10);
  let frameId   = null;
  let lastTime  = 0;

  // ─── World ──────────────────────────────────────────────────────────────────
  // Each row: { type, color, objs:[], speed, dir }
  // type: 'grass' | 'road' | 'water' | 'safe'
  let rows  = [];
  let camRow = 0; // camera center row (world coords, floats for smooth scroll)

  // ─── Player ─────────────────────────────────────────────────────────────────
  let player = { col: HALF_COLS, row: 0, dy: 0, anim: 0 };
  let playerAlive = true;

  // Jump animation
  const JUMP_DUR   = 0.18; // seconds
  let jumping      = false;
  let jumpProgress = 0;
  let jumpFrom     = { col: 0, row: 0 };
  let jumpTo       = { col: 0, row: 0 };

  // Death animation
  let deathTimer = 0;
  let deathType  = 'hit'; // 'hit' | 'drown'

  // ─── Input ──────────────────────────────────────────────────────────────────
  const keys    = {};
  let touchStartX = 0, touchStartY = 0;

  // ─── Palette ────────────────────────────────────────────────────────────────
  const PAL = {
    grass:      ['#4a7c59','#3d6b4a','#56904a'],
    grassDark:  ['#3a6347','#2f5238'],
    tree:       ['#2d5a27','#1e3f1a'],
    treeTrunk:  '#7a5c3a',
    road:       ['#4a4a5a','#3d3d4a'],
    roadLine:   '#e8e07a',
    water:      ['#2a6fa8','#1e5a8a','#3380b8'],
    lilypad:    '#3a8a3a',
    lily:       '#e87070',
    safe:       ['#5a7a4a','#4a6a3a'],
    car1:       '#e84a4a',
    car2:       '#4a9ae8',
    car3:       '#e8c84a',
    car4:       '#e8784a',
    log:        '#8b5e3c',
    logDark:    '#6b4a2a',
    player:     '#a8e84a',
    playerDark: '#78b822',
    playerEye:  '#1a1a1a',
    playerBelly:'#c8f870',
    shadow:     'rgba(0,0,0,0.25)',
    deathFlash: '#ff4444',
  };

  // ─── Seeded RNG (for deterministic lane generation) ─────────────────────────
  let rngSeed = 0;
  function rng () {
    rngSeed ^= rngSeed << 13;
    rngSeed ^= rngSeed >> 17;
    rngSeed ^= rngSeed << 5;
    return (rngSeed >>> 0) / 4294967296;
  }
  function rngRange (min, max) { return min + rng() * (max - min); }
  function rngInt (min, max) { return Math.floor(rngRange(min, max + 1)); }
  function rngPick (arr) { return arr[Math.floor(rng() * arr.length)]; }

  // ─── Lane generation ────────────────────────────────────────────────────────
  function makeRow (rowIndex) {
    // Row 0 = starting safe zone
    if (rowIndex === 0) return safeLane(rowIndex, true);

    // Pattern: groups of lanes separated by safe strips
    const band = Math.floor(Math.abs(rowIndex) / 6);
    const pos  = Math.abs(rowIndex) % 6;

    if (pos === 0) return safeLane(rowIndex, false);

    const difficulty = Math.min(band * 0.15, 1.0);
    const r = rng();
    if (r < 0.5) return roadLane(rowIndex, difficulty);
    if (r < 0.78) return waterLane(rowIndex, difficulty);
    return safeLane(rowIndex, false);
  }

  function safeLane (rowIndex, isStart) {
    rngSeed = Math.abs(rowIndex * 2654435761) | 1;
    const col = rngPick(PAL.grass);
    const trees = [];
    if (!isStart) {
      for (let c = 0; c < COLS; c++) {
        if (rng() < 0.18) {
          trees.push({ col: c, variant: rngInt(0, 1) });
        }
      }
    }
    return { type: 'safe', color: col, objs: trees, speed: 0, dir: 1 };
  }

  function roadLane (rowIndex, diff) {
    rngSeed = Math.abs(rowIndex * 2654435761 + 999) | 1;
    const col  = rngPick(PAL.road);
    const dir  = rng() < 0.5 ? 1 : -1;
    const speed = rngRange(2.0 + diff * 3.0, 4.5 + diff * 5.5);
    const carCount = rngInt(1, 3 + Math.floor(diff * 3));
    const cars = [];
    const spacing = COLS / carCount;
    for (let i = 0; i < carCount; i++) {
      const baseX = i * spacing + rng() * spacing * 0.4;
      const width = rngInt(1, 3);
      cars.push({
        x:    baseX,
        w:    width,
        col:  rngPick([PAL.car1, PAL.car2, PAL.car3, PAL.car4]),
        type: rngInt(0, 2), // 0=car, 1=truck, 2=bus
      });
    }
    return { type: 'road', color: col, objs: cars, speed, dir };
  }

  function waterLane (rowIndex, diff) {
    rngSeed = Math.abs(rowIndex * 2654435761 + 1337) | 1;
    const col  = rngPick(PAL.water);
    const dir  = rng() < 0.5 ? 1 : -1;
    const speed = rngRange(1.2 + diff * 1.5, 2.8 + diff * 2.5);
    const logCount = rngInt(2, 4);
    const logs = [];
    const spacing = COLS / logCount;
    for (let i = 0; i < logCount; i++) {
      const baseX = i * spacing + rng() * spacing * 0.3;
      logs.push({
        x:   baseX,
        w:   rngRange(1.2, 2.2),
        col: PAL.log,
      });
    }
    return { type: 'water', color: col, objs: logs, speed, dir };
  }

  // ─── World initialisation ────────────────────────────────────────────────────
  function initWorld () {
    rngSeed = Date.now() | 1;
    rows = [];
    for (let r = -2; r < VISIBLE_ROWS + 4; r++) {
      rows.push(makeRow(r));
    }
  }

  // ─── extend world ahead of player ───────────────────────────────────────────
  function extendWorld () {
    const minRow = Math.floor(camRow) - VISIBLE_ROWS;
    const maxRow = Math.floor(camRow) + VISIBLE_ROWS + 4;
    while (rows.length + (-2) < maxRow + 4) {
      const nextR = rows.length + (-2);
      rows.push(makeRow(nextR));
    }
  }

  function getRow (r) {
    const idx = r + 2; // rows[0] = row -2
    if (idx < 0 || idx >= rows.length) return null;
    return rows[idx];
  }

  // ─── Iso projection ─────────────────────────────────────────────────────────
  // World → screen.  World coords: col (x), row (z), height (y)
  // Screen origin is the center of the canvas.
  let cx = 0, cy = 0; // canvas center, updated on resize

  function toScreen (col, row, height) {
    // Offset col to center the grid
    const wx = (col - HALF_COLS) * TILE;
    const wz = row * TILE;
    const wy = height * TILE;
    const sx = (wx - wz) * ISO_X;
    const sy = (wx + wz) * ISO_Y - wy * ISO_H;
    return { x: cx + sx, y: cy + sy };
  }

  // Project accounting for camera (camRow offsets wz)
  function proj (col, row, height) {
    return toScreen(col, row - camRow, height);
  }

  // ─── Drawing helpers ─────────────────────────────────────────────────────────
  function isoTileTop (sx, sy, w, d, color) {
    // Top face of a tile w=width, d=depth (both in tile units)
    const hw = w * TILE * ISO_X;
    const hd = d * TILE * ISO_X;
    const hy = w * TILE * ISO_Y;
    const dy2 = d * TILE * ISO_Y;
    ctx.beginPath();
    ctx.moveTo(sx,      sy);
    ctx.lineTo(sx + hw, sy + hy);
    ctx.lineTo(sx + hw - hd, sy + hy + dy2);
    ctx.lineTo(sx - hd, sy + dy2);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function isoTileLeft (sx, sy, w, h, color) {
    // Left face (front-left)
    const hw = w * TILE * ISO_X;
    const hy = w * TILE * ISO_Y;
    const ph = h * TILE * ISO_H;
    ctx.beginPath();
    ctx.moveTo(sx,      sy);
    ctx.lineTo(sx + hw, sy + hy);
    ctx.lineTo(sx + hw, sy + hy + ph);
    ctx.lineTo(sx,      sy + ph);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function isoTileRight (sx, sy, d, h, color) {
    // Right face (front-right)
    const hd = d * TILE * ISO_X;
    const dy2 = d * TILE * ISO_Y;
    const ph = h * TILE * ISO_H;
    ctx.beginPath();
    ctx.moveTo(sx,      sy);
    ctx.lineTo(sx - hd, sy + dy2);
    ctx.lineTo(sx - hd, sy + dy2 + ph);
    ctx.lineTo(sx,      sy + ph);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawBlock (col, row, height, w, d, h, topColor, leftColor, rightColor) {
    // Draw a solid iso box.  col/row are bottom-front-left in world coords.
    // w=cols, d=rows, h=height (all in tile units)
    const p = proj(col, row, height);
    const sx = p.x, sy = p.y;

    // right face
    isoTileRight(sx + w * TILE * ISO_X, sy + w * TILE * ISO_Y, d, h * TILE / TILE, rightColor);
    // left face
    isoTileLeft(sx, sy, w, h * TILE / TILE, leftColor);
    // top face
    const topP = proj(col, row, height + h);
    isoTileTop(topP.x, topP.y, w, d, topColor);
  }

  // Shade a base color darker for side faces
  function shadeHex (hex, factor) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
  }

  // ─── Scene rendering ─────────────────────────────────────────────────────────
  function drawScene (dt) {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1a1a2e');
    sky.addColorStop(1, '#2a2a4e');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Determine draw range: rows from camRow-2 to camRow+VISIBLE_ROWS
    const drawStart = Math.floor(camRow) - 2;
    const drawEnd   = Math.floor(camRow) + VISIBLE_ROWS;

    // Draw from back to front (painter's algorithm in iso view)
    for (let r = drawEnd; r >= drawStart; r--) {
      drawRow(r, dt);
    }

    // Draw player (on top of terrain)
    drawPlayer(dt);
  }

  // ─── Row drawing ─────────────────────────────────────────────────────────────
  function drawRow (r, dt) {
    const row = getRow(r);
    if (!row) return;

    // Ground tile for each column
    for (let c = 0; c < COLS; c++) {
      const p = proj(c, r, 0);
      const topCol  = row.color;
      const leftCol = shadeHex(topCol, 0.65);
      const rightCol= shadeHex(topCol, 0.5);

      isoTileTop(p.x, p.y, 1, 1, topCol);
      // Side faces (only draw for front rows)
      const pBot = proj(c, r, -0.15);
      isoTileLeft(pBot.x, pBot.y, 1, 0.15, leftCol);
      isoTileRight(pBot.x + TILE * ISO_X, pBot.y + TILE * ISO_Y, 1, 0.15, rightCol);
    }

    if (row.type === 'road') drawRoadMarkings(r);
    if (row.type === 'water') drawWaterRow(r, dt, row);
    if (row.type === 'safe')  drawSafeDecor(r, row);

    // Draw cars on road
    if (row.type === 'road') {
      for (const car of row.objs) {
        drawCar(r, car);
      }
    }

    // Draw logs on water
    if (row.type === 'water') {
      for (const log of row.objs) {
        drawLog(r, log);
      }
    }
  }

  function drawRoadMarkings (r) {
    // Dashed center lines
    for (let c = 0; c < COLS; c++) {
      if ((c + r) % 2 === 0) continue;
      const p = proj(c + 0.3, r + 0.45, 0.01);
      ctx.save();
      ctx.globalAlpha = 0.55;
      isoTileTop(p.x, p.y, 0.4, 0.1, PAL.roadLine);
      ctx.restore();
    }
  }

  function drawWaterRow (r, dt, row) {
    // Ripple overlay — tiny shimmer tiles
    for (let c = 0; c < COLS; c++) {
      const wave = Math.sin(c * 1.4 + r * 0.9 + Date.now() * 0.002) * 0.07;
      const rippleCol = row.objs.length % 2 === 0 ? '#3a80be' : '#2476a0';
      const p = proj(c + 0.1, r + 0.35, 0.01 + wave * 0.05);
      ctx.save();
      ctx.globalAlpha = 0.2 + Math.abs(wave) * 1.5;
      isoTileTop(p.x, p.y, 0.8, 0.3, rippleCol);
      ctx.restore();
    }
  }

  function drawSafeDecor (r, row) {
    for (const tree of row.objs) {
      drawTree(tree.col, r, tree.variant);
    }
  }

  // ─── Car drawing ─────────────────────────────────────────────────────────────
  function drawCar (r, car) {
    const col = car.x;
    const w   = car.w;
    const topCol   = car.col;
    const leftCol  = shadeHex(topCol, 0.55);
    const rightCol = shadeHex(topCol, 0.42);

    // Body (tall block, slightly narrower than tile)
    const bx = col + 0.05;
    drawBlock(bx, r + 0.1, 0, w - 0.1, 0.8, 0.5, topCol, leftCol, rightCol);

    // Cab (slightly smaller block on top for car)
    if (car.type === 0) {
      const cabW = (w - 0.1) * 0.55;
      const cabOff = (w - 0.1 - cabW) / 2;
      const cLight  = lightenHex(topCol, 1.15);
      const cMid    = shadeHex(topCol, 0.8);
      const cDark   = shadeHex(topCol, 0.6);
      drawBlock(bx + cabOff, r + 0.15, 0.5, cabW, 0.7, 0.38, cLight, cMid, cDark);
    }

    // Wheels (dark circles-ish)
    drawWheel(bx + 0.15, r + 0.75, 0);
    drawWheel(bx + w - 0.35, r + 0.75, 0);

    // Headlights
    drawHeadlight(bx + 0.05, r + 0.88, car.dir > 0);
    drawHeadlight(bx + w - 0.25, r + 0.88, car.dir > 0);
  }

  function lightenHex (hex, factor) { return shadeHex(hex, factor); }

  function drawWheel (col, row, height) {
    const p = proj(col, row, height);
    ctx.save();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, TILE * 0.13, TILE * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHeadlight (col, row, isFront) {
    const p = proj(col, row, 0.35);
    ctx.save();
    ctx.fillStyle = isFront ? '#ffffaa' : '#ff6666';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, TILE * 0.06, TILE * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ─── Log drawing ─────────────────────────────────────────────────────────────
  function drawLog (r, log) {
    const col = log.x;
    const w   = log.w;
    const topCol   = PAL.log;
    const leftCol  = PAL.logDark;
    const rightCol = shadeHex(PAL.logDark, 0.8);

    drawBlock(col, r + 0.1, 0, w, 0.8, 0.3, topCol, leftCol, rightCol);

    // Wood grain lines
    for (let i = 0; i <= Math.floor(w); i++) {
      const p = proj(col + i * 0.5, r + 0.1, 0.3);
      ctx.save();
      ctx.globalAlpha = 0.2;
      isoTileTop(p.x, p.y, 0.05, 0.8, '#5a3a1a');
      ctx.restore();
    }
  }

  // ─── Tree drawing ─────────────────────────────────────────────────────────────
  function drawTree (col, row, variant) {
    const trunkTop  = shadeHex(PAL.treeTrunk, 0.75);
    const trunkLeft = shadeHex(PAL.treeTrunk, 0.55);
    const trunkRight= shadeHex(PAL.treeTrunk, 0.45);
    drawBlock(col + 0.3, row + 0.2, 0, 0.4, 0.6, 0.4, PAL.treeTrunk, trunkLeft, trunkRight);

    const tc  = PAL.tree[variant % PAL.tree.length];
    const tl  = shadeHex(tc, 0.65);
    const tr2 = shadeHex(tc, 0.5);

    if (variant === 0) {
      // Round-ish tree: stacked 3 blocks
      drawBlock(col + 0.1, row + 0.1, 0.4, 0.8, 0.8, 0.55, tc, tl, tr2);
      drawBlock(col + 0.2, row + 0.2, 0.95, 0.6, 0.6, 0.5, tc, tl, tr2);
      drawBlock(col + 0.3, row + 0.3, 1.4, 0.4, 0.4, 0.4, tc, tl, tr2);
    } else {
      // Blocky pyramid
      drawBlock(col + 0.05, row + 0.05, 0.4, 0.9, 0.9, 0.45, tc, tl, tr2);
      drawBlock(col + 0.2,  row + 0.15, 0.85, 0.6, 0.7, 0.4, tc, tl, tr2);
      drawBlock(col + 0.35, row + 0.3,  1.25, 0.3, 0.4, 0.35, tc, tl, tr2);
    }
  }

  // ─── Player drawing ──────────────────────────────────────────────────────────
  function drawPlayer (dt) {
    let renderCol = player.col;
    let renderRow = player.row;
    let renderH   = 0;
    let squishY   = 1; // vertical scale for squish effect

    if (jumping) {
      const t = jumpProgress / JUMP_DUR;
      const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t; // ease in-out
      renderCol = jumpFrom.col + (jumpTo.col - jumpFrom.col) * ease;
      renderRow = jumpFrom.row + (jumpTo.row - jumpFrom.row) * ease;
      // Arc height
      const arc = Math.sin(Math.PI * t);
      renderH = arc * 0.7;
      squishY = 1 + arc * 0.15;
    }

    if (!playerAlive) {
      if (deathType === 'hit') {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - deathTimer * 2);
        const flash = (Math.floor(deathTimer * 12) % 2 === 0);
        const bc = flash ? PAL.deathFlash : PAL.player;
        drawFrog(renderCol, renderRow, renderH, squishY, bc);
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - deathTimer * 2.5);
        drawFrog(renderCol, renderRow, renderH - deathTimer * 0.4, squishY, PAL.player);
        ctx.restore();
      }
      return;
    }

    drawFrog(renderCol, renderRow, renderH, squishY, PAL.player);
  }

  function drawFrog (col, row, height, squishY, bodyColor) {
    const p = proj(col, row, height);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(1, squishY);

    const S = TILE * 0.82; // frog size scale
    const dark = shadeHex(PAL.playerDark, 0.85);

    // Shadow on ground
    const gp = proj(col, row, 0);
    ctx.save();
    ctx.resetTransform();
    ctx.fillStyle = PAL.shadow;
    ctx.beginPath();
    ctx.ellipse(gp.x, gp.y + TILE * 0.05, S * 0.45, S * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Body — main cube using iso helper, but from center
    const bodyW = 0.7, bodyD = 0.7, bodyH = 0.55;
    const bp = proj(col + (1 - bodyW) / 2, row + (1 - bodyD) / 2, height);
    const tc   = bodyColor;
    const lc   = shadeHex(bodyColor, 0.65);
    const rc   = shadeHex(bodyColor, 0.5);
    ctx.restore();
    drawBlock(col + (1 - bodyW) / 2, row + (1 - bodyD) / 2, height, bodyW, bodyD, bodyH, tc, lc, rc);

    // Head block (smaller, on top-front)
    const hW = 0.55, hD = 0.55, hH = 0.35;
    drawBlock(col + (1 - hW) / 2, row + (1 - hD) / 2 - 0.08, height + bodyH, hW, hD, hH, tc, lc, rc);

    // Eyes (two white dots with pupils)
    const eyeBaseH = height + bodyH + hH + 0.05;
    drawEye(col + 0.24, row + 0.18, eyeBaseH);
    drawEye(col + 0.58, row + 0.18, eyeBaseH);

    // Belly lighter patch
    const bellP = proj(col + 0.22, row + 0.28, height);
    ctx.save();
    ctx.globalAlpha = 0.55;
    isoTileTop(bellP.x, bellP.y, 0.56, 0.44, PAL.playerBelly);
    ctx.restore();
  }

  function drawEye (col, row, height) {
    const ep = proj(col, row, height);
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ep.x, ep.y, TILE * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.playerEye;
    ctx.beginPath();
    ctx.arc(ep.x + TILE * 0.02, ep.y + TILE * 0.01, TILE * 0.045, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ─── Input handling ──────────────────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d',' '].includes(e.key)) return;
    e.preventDefault();
    keys[e.key] = true;

    if (state !== 'playing') return;
    handleMove(e.key);
  });

  document.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (state !== 'playing') return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    if (adx < 10 && ady < 10) return;
    if (ady > adx) {
      handleMove(dy < 0 ? 'ArrowUp' : 'ArrowDown');
    } else {
      handleMove(dx < 0 ? 'ArrowLeft' : 'ArrowRight');
    }
  }, { passive: true });

  function handleMove (key) {
    if (jumping || !playerAlive) return;
    let dc = 0, dr = 0;
    if (key === 'ArrowUp'    || key === 'w') dr = -1;
    if (key === 'ArrowDown'  || key === 's') dr =  1;
    if (key === 'ArrowLeft'  || key === 'a') dc = -1;
    if (key === 'ArrowRight' || key === 'd') dc =  1;
    if (dc === 0 && dr === 0) return;

    const nc = player.col + dc;
    const nr = player.row + dr;
    if (nc < 0 || nc >= COLS) return; // wall

    // If moving forward, check for trees blocking
    const destRow = getRow(nr);
    if (destRow && destRow.type === 'safe') {
      for (const tree of destRow.objs) {
        if (tree.col === nc) return; // blocked by tree
      }
    }

    jumpFrom = { col: player.col, row: player.row };
    jumpTo   = { col: nc, row: nr };
    jumping  = true;
    jumpProgress = 0;
  }

  // ─── Game update ─────────────────────────────────────────────────────────────
  function update (dt) {
    if (state !== 'playing') return;

    // Update jump animation
    if (jumping) {
      jumpProgress += dt;
      if (jumpProgress >= JUMP_DUR) {
        jumpProgress = JUMP_DUR;
        player.col = jumpTo.col;
        player.row = jumpTo.row;
        jumping = false;

        // Score: moving forward (lower row = further forward)
        const prev = score;
        if (player.row < -score) {
          score = -player.row;
          document.getElementById('score-display').textContent = score;
        }
        // Prevent going backward past start
        if (player.row > 0) {
          player.row = 0;
          jumpTo.row = 0;
        }
      }
    }

    // Move cars and logs
    const visStart = Math.floor(camRow) - 4;
    const visEnd   = Math.floor(camRow) + VISIBLE_ROWS + 2;
    for (let r = visStart; r <= visEnd; r++) {
      const row = getRow(r);
      if (!row) continue;
      if (row.type === 'road' || row.type === 'water') {
        for (const obj of row.objs) {
          obj.x += row.dir * row.speed * dt;
          // Wrap around
          const wrapW = COLS + (obj.w || 1);
          if (row.dir > 0 && obj.x > COLS + 1)   obj.x -= wrapW;
          if (row.dir < 0 && obj.x < -(obj.w || 1) - 1) obj.x += wrapW;
        }
      }
    }

    // Smooth camera follow
    const targetCam = player.row + 2;
    camRow += (targetCam - camRow) * Math.min(dt * 8, 1);

    extendWorld();
    checkCollisions();
  }

  // ─── Collision detection ─────────────────────────────────────────────────────
  function checkCollisions () {
    if (!playerAlive || jumping) return;

    const row = getRow(player.row);
    if (!row) return;

    const pc = player.col + 0.15;
    const pw = 0.7;

    if (row.type === 'road') {
      for (const car of row.objs) {
        const carL = car.x + 0.05;
        const carR = car.x + car.w - 0.05;
        if (pc < carR && pc + pw > carL) {
          killPlayer('hit');
          return;
        }
      }
    }

    if (row.type === 'water') {
      let onLog = false;
      for (const log of row.objs) {
        const logL = log.x;
        const logR = log.x + log.w;
        if (pc < logR && pc + pw > logL) {
          onLog = true;
          // Ride the log
          player.col += row.dir * row.speed * (1 / 60); // approximate
          player.col = Math.max(0, Math.min(COLS - 1, player.col));
          break;
        }
      }
      if (!onLog) {
        killPlayer('drown');
      }
    }
  }

  function killPlayer (type) {
    playerAlive = false;
    deathType   = type;
    deathTimer  = 0;
    if (score > best) {
      best = score;
      localStorage.setItem('fr_best', best);
    }
    setTimeout(showDeadScreen, 1200);
  }

  // ─── Death animation ──────────────────────────────────────────────────────────
  function updateDeath (dt) {
    if (!playerAlive) deathTimer += dt;
  }

  // ─── Resize ──────────────────────────────────────────────────────────────────
  function resize () {
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width  = w;
    canvas.height = h;
    cx = w / 2;
    cy = h * 0.62; // camera horizon sits above center to show more foreground
  }

  window.addEventListener('resize', resize);

  // ─── Main loop ───────────────────────────────────────────────────────────────
  function loop (ts) {
    const dt = Math.min((ts - lastTime) / 1000, 0.05); // cap at 50ms
    lastTime = ts;
    update(dt);
    updateDeath(dt);
    drawScene(dt);
    frameId = requestAnimationFrame(loop);
  }

  // ─── Game lifecycle ──────────────────────────────────────────────────────────
  function startGame () {
    score = 0;
    document.getElementById('score-display').textContent = '0';
    player = { col: HALF_COLS, row: 0, dy: 0, anim: 0 };
    playerAlive = true;
    jumping      = false;
    jumpProgress = 0;
    deathTimer   = 0;
    camRow       = 2;
    initWorld();
    state = 'playing';

    document.getElementById('start-overlay').classList.add('hidden');
    document.getElementById('dead-overlay').classList.add('hidden');
  }

  function showDeadScreen () {
    state = 'dead';
    document.getElementById('final-score').textContent = 'Score: ' + score;
    document.getElementById('best-score').textContent  = 'Best: '  + best;
    document.getElementById('dead-overlay').classList.remove('hidden');
  }

  // UI buttons
  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('restart-btn').addEventListener('click', startGame);

  // ─── Boot ────────────────────────────────────────────────────────────────────
  resize();
  initWorld();
  lastTime = performance.now();
  frameId  = requestAnimationFrame(loop);

})();
