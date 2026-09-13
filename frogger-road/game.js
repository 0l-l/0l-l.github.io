/**
 * Frogger Road — Crossy Road-style game
 *
 * CAMERA: player sits at the NEAR edge of the screen (bottom-front of the iso
 * grid). "Forward" (↑) moves the frog deeper into the screen — away from the
 * viewer. This is the authentic Crossy Road feel.
 *
 * WORLD COORDS:
 *   col  — left/right  (0 = left edge)
 *   row  — depth        0 = player start, positive = farther from viewer
 *   h    — height above ground (0 = ground level)
 *
 * ISO PROJECTION (standard dimetric, matching Crossy Road):
 *   sx = cx + (col - HALF_COLS - (row - camRow)) * TILE * ISO_X
 *   sy = cy + (col - HALF_COLS + (row - camRow)) * TILE * ISO_Y  - h * TILE
 */
(function () {
  'use strict';

  // ── Canvas ────────────────────────────────────────────────────────────────
  const canvas = document.getElementById('canvas');
  const ctx    = canvas.getContext('2d');

  const TILE       = 52;          // logical pixels per tile
  const ISO_X      = 0.866;       // cos 30°
  const ISO_Y      = 0.5;         // sin 30°
  const COLS       = 9;
  const HALF_COLS  = 4;           // center column
  const VIS_ROWS   = 16;          // rows visible ahead of player

  // Canvas center — updated on resize
  let CX = 0, CY = 0;

  // ── Palette ───────────────────────────────────────────────────────────────
  const C = {
    // Terrain
    grassA:  '#4d8c5e', grassB:  '#3d7a4f', grassC:  '#5a9e60',
    roadA:   '#52526a', roadB:   '#44445a',
    waterA:  '#2875b0', waterB:  '#1e6498', waterC:  '#3385c0',
    safeEdge:'#3a6344',
    // Road markings
    dashLine:'#e8e07a',
    // Vehicles
    carRed:  '#e84a4a', carBlue: '#4a9ae8', carYellow:'#f0d050',
    carOrange:'#e8784a', carGreen:'#4abf60', carPurple:'#9b59b6',
    carGlass:'#a8d8f0',
    // Log
    logTop:  '#9b6b3e', logSide: '#7a4f2a', logDark: '#5a3a1e',
    // Tree
    trunkTop:'#8a6038', trunkL:  '#6a4828', trunkR:  '#4e3418',
    leafA:   '#2d6030', leafB:   '#1e4a20', leafC:   '#3a7a38',
    // Frog
    frogTop: '#6ed63a', frogL:   '#50a820', frogR:   '#3d8010',
    frogBelly:'#c0f050', frogEye:'#ffffff', frogPupil:'#111',
    frogMouth:'#2a6010',
    // UI
    shadow:  'rgba(0,0,0,0.3)',
    hitFlash:'#ff3333',
    drownBubble:'#88ccff',
  };

  // ── RNG ───────────────────────────────────────────────────────────────────
  let _seed = 1;
  function rng () {
    _seed ^= _seed << 13; _seed ^= _seed >> 17; _seed ^= _seed << 5;
    return (_seed >>> 0) / 0x100000000;
  }
  function rngF (a, b) { return a + rng() * (b - a); }
  function rngI (a, b) { return a + Math.floor(rng() * (b - a + 1)); }
  function rngPick (a) { return a[Math.floor(rng() * a.length)]; }
  function seedFor (n) { _seed = Math.abs(n * 1664525 + 1013904223) | 1; }

  // ── World ─────────────────────────────────────────────────────────────────
  // row 0 = player start; positive rows = deeper (further from viewer)
  // rows array: index i corresponds to world row i
  let world = [];   // world[rowIndex] = lane object
  let maxWorldRow = 0;

  function getLane (r) {
    if (r < 0) return null;
    while (r >= world.length) _extendWorld();
    return world[r];
  }

  function _extendWorld () {
    const r = world.length;
    world.push(_makeLane(r));
  }

  function _makeLane (r) {
    if (r === 0) return _safeLane(r, true);

    seedFor(r * 7919 + 2654435761);

    // Every 6th lane is a safe strip (except lane 0)
    if (r % 6 === 0) return _safeLane(r, false);

    const band = Math.floor(r / 6);
    const diff = Math.min(band * 0.12, 0.9);
    const t = rng();
    if (t < 0.52) return _roadLane(r, diff);
    if (t < 0.78) return _waterLane(r, diff);
    return _safeLane(r, false);
  }

  function _safeLane (r, isStart) {
    seedFor(r * 2654435761 + 12345);
    const color = rngPick([C.grassA, C.grassB, C.grassC]);
    const trees = [];
    if (!isStart) {
      for (let c = 0; c < COLS; c++) {
        if (rng() < 0.16) trees.push({ col: c, variant: rngI(0, 1) });
      }
    }
    return { type: 'safe', color, objs: trees, speed: 0, dir: 1 };
  }

  function _roadLane (r, diff) {
    seedFor(r * 2654435761 + 99991);
    const color = rngPick([C.roadA, C.roadB]);
    const dir   = rng() < 0.5 ? 1 : -1;
    const speed = rngF(2.5 + diff * 2.5, 4.0 + diff * 5.0);
    const count = rngI(1, 2 + Math.floor(diff * 3));
    const spacing = COLS / count;
    const cars = [];
    for (let i = 0; i < count; i++) {
      const w = rngI(1, 2 + (diff > 0.3 ? 1 : 0));
      cars.push({
        x:    i * spacing + rng() * spacing * 0.5,
        w,
        color: rngPick([C.carRed, C.carBlue, C.carYellow, C.carOrange, C.carGreen, C.carPurple]),
        type: rngI(0, 1),  // 0=car, 1=truck
      });
    }
    return { type: 'road', color, objs: cars, speed, dir };
  }

  function _waterLane (r, diff) {
    seedFor(r * 2654435761 + 77777);
    const color = rngPick([C.waterA, C.waterB, C.waterC]);
    const dir   = rng() < 0.5 ? 1 : -1;
    const speed = rngF(1.0 + diff * 1.2, 2.2 + diff * 2.0);
    const count = rngI(2, 3 + (diff > 0.4 ? 1 : 0));
    const spacing = COLS / count;
    const logs = [];
    for (let i = 0; i < count; i++) {
      logs.push({
        x: i * spacing + rng() * spacing * 0.25,
        w: rngF(1.3, 2.1),
      });
    }
    return { type: 'water', color, objs: logs, speed, dir };
  }

  // ── Projection ────────────────────────────────────────────────────────────
  // camRow is the world row that sits at the "camera center" screen position.
  // Player is always near the bottom; we shift CY up to leave the near
  // foreground visible.
  let camRow = 0;

  function proj (col, row, h) {
    // Relative position from camera center
    const dc = col - HALF_COLS;
    const dr = row - camRow;
    const sx = CX + (dc - dr) * TILE * ISO_X;
    const sy = CY + (dc + dr) * TILE * ISO_Y - h * TILE;
    return { x: sx, y: sy };
  }

  // ── Iso block primitives ──────────────────────────────────────────────────
  function _topFace (sx, sy, w, d, color) {
    const rx = w * TILE * ISO_X, lx = d * TILE * ISO_X;
    const ry = w * TILE * ISO_Y, ly = d * TILE * ISO_Y;
    ctx.beginPath();
    ctx.moveTo(sx,       sy);
    ctx.lineTo(sx + rx,  sy + ry);
    ctx.lineTo(sx + rx - lx, sy + ry + ly);
    ctx.lineTo(sx - lx,  sy + ly);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function _leftFace (sx, sy, w, h, color) {
    const rx = w * TILE * ISO_X, ry = w * TILE * ISO_Y;
    const ph = h * TILE;
    ctx.beginPath();
    ctx.moveTo(sx,       sy);
    ctx.lineTo(sx + rx,  sy + ry);
    ctx.lineTo(sx + rx,  sy + ry + ph);
    ctx.lineTo(sx,       sy + ph);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function _rightFace (sx, sy, d, h, color) {
    const lx = d * TILE * ISO_X, ly = d * TILE * ISO_Y;
    const ph = h * TILE;
    ctx.beginPath();
    ctx.moveTo(sx,       sy);
    ctx.lineTo(sx - lx,  sy + ly);
    ctx.lineTo(sx - lx,  sy + ly + ph);
    ctx.lineTo(sx,       sy + ph);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  /**
   * Draw a solid iso box.
   * @param {number} col, row, h   — world-space anchor (bottom-near-left corner)
   * @param {number} w, d, bh      — size in tile units (width, depth, box height)
   * @param {string} tc, lc, rc    — top / left / right face colors
   * @param {string} [stroke]      — optional outline color
   */
  function block (col, row, h, w, d, bh, tc, lc, rc, stroke) {
    const p = proj(col, row, h);

    // right face (far-right face in screen space)
    _rightFace(p.x + w * TILE * ISO_X, p.y + w * TILE * ISO_Y, d, bh, rc);
    // left face (near-left face)
    _leftFace(p.x, p.y, w, bh, lc);
    // top face
    const tp = proj(col, row, h + bh);
    _topFace(tp.x, tp.y, w, d, tc);

    if (stroke) {
      // Outline top face for clarity
      const rx = w * TILE * ISO_X, lx = d * TILE * ISO_X;
      const ry = w * TILE * ISO_Y, ly = d * TILE * ISO_Y;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(tp.x,        tp.y);
      ctx.lineTo(tp.x + rx,   tp.y + ry);
      ctx.lineTo(tp.x + rx - lx, tp.y + ry + ly);
      ctx.lineTo(tp.x - lx,   tp.y + ly);
      ctx.closePath();
      ctx.stroke();
    }
  }

  // Tint helpers
  function shade (hex, f) {
    const v = hex.startsWith('#') ? hex.slice(1) : hex;
    const r = parseInt(v.slice(0,2),16), g = parseInt(v.slice(2,4),16), b = parseInt(v.slice(4,6),16);
    return `rgb(${~~(r*f)},${~~(g*f)},${~~(b*f)})`;
  }

  // ── Terrain drawing ───────────────────────────────────────────────────────
  function drawLane (r) {
    const lane = getLane(r);
    if (!lane) return;

    const SLAB = 0.12; // slab thickness for ground tiles

    for (let c = 0; c < COLS; c++) {
      const tc = lane.color;
      const lc = shade(tc, 0.62);
      const rc = shade(tc, 0.48);
      block(c, r, 0, 1, 1, SLAB, tc, lc, rc);
    }

    // Lane-type edge stripe (makes lane type instantly readable)
    if (lane.type === 'road') {
      _drawRoadStripe(r);
      _drawRoadMarkings(r);
      for (const obj of lane.objs) drawCar(r, obj, lane.dir);
    }
    if (lane.type === 'water') {
      _drawWaterRipples(r, lane);
      for (const obj of lane.objs) drawLog(r, obj);
    }
    if (lane.type === 'safe') {
      for (const obj of lane.objs) drawTree(obj.col, r, obj.variant);
    }
  }

  function _drawRoadStripe (r) {
    // Thin yellow stripe along the far edge — visual cue for road danger
    const p = proj(0, r, 0.12);
    ctx.save();
    ctx.globalAlpha = 0.55;
    _topFace(p.x, p.y, COLS, 0.06, '#f8d840');
    ctx.restore();
  }

  function _drawRoadMarkings (r) {
    for (let c = 0; c < COLS; c++) {
      if ((c ^ r) % 2 === 1) continue;
      const p = proj(c + 0.28, r + 0.44, 0.13);
      ctx.save();
      ctx.globalAlpha = 0.6;
      _topFace(p.x, p.y, 0.44, 0.12, C.dashLine);
      ctx.restore();
    }
  }

  function _drawWaterRipples (r, lane) {
    const t = performance.now() * 0.0015;
    for (let c = 0; c < COLS; c++) {
      const a = 0.12 + 0.08 * Math.abs(Math.sin(c * 1.7 + r * 0.8 + t));
      const p = proj(c + 0.05, r + 0.3, 0.13);
      ctx.save();
      ctx.globalAlpha = a;
      _topFace(p.x, p.y, 0.9, 0.4, '#72baee');
      ctx.restore();
    }
  }

  // ── Car drawing ───────────────────────────────────────────────────────────
  function drawCar (r, car, dir) {
    const x = car.x, w = car.w, cc = car.color;
    const lc = shade(cc, 0.52), rc = shade(cc, 0.4), tc = cc;
    const BODY_H = 0.48, CAB_H = 0.36;

    // Body
    block(x + 0.06, r + 0.08, 0, w - 0.12, 0.84, BODY_H, tc, lc, rc,
          'rgba(0,0,0,0.25)');

    // Cab (only on car type 0)
    if (car.type === 0) {
      const cw = (w - 0.12) * 0.52;
      const co = (w - 0.12 - cw) / 2;
      block(x + 0.06 + co, r + 0.12, BODY_H,
            cw, 0.74, CAB_H,
            shade(cc, 1.12), shade(cc, 0.78), shade(cc, 0.62),
            'rgba(0,0,0,0.18)');

      // Windshield
      const wp = proj(x + 0.06 + co + cw * 0.15, r + 0.12 + 0.74 * 0.1, BODY_H + CAB_H);
      ctx.save();
      ctx.globalAlpha = 0.7;
      _topFace(wp.x, wp.y, cw * 0.7, 0.15, C.carGlass);
      ctx.restore();
    }

    // Wheels — flat dark squares on the ground face
    _drawWheels(x + 0.06, r + 0.08, w - 0.12);

    // Lights
    _drawLights(x, r, w, dir);
  }

  function _drawWheels (x, r, w) {
    const wheelColor = '#1a1a1a';
    const rimColor   = '#555';
    // Front-left wheel
    block(x + 0.04,     r + 0.72, 0, 0.22, 0.2, 0.14, rimColor, wheelColor, '#333');
    // Back-left wheel
    block(x + w - 0.26, r + 0.72, 0, 0.22, 0.2, 0.14, rimColor, wheelColor, '#333');
  }

  function _drawLights (x, r, w, dir) {
    // Headlights (front) and taillights (rear)
    const frontColor = '#ffffaa', rearColor = '#ff4444';
    const fCol = dir > 0 ? x + w - 0.12 : x + 0.06;
    const bCol = dir > 0 ? x + 0.06     : x + w - 0.12;

    const fp = proj(fCol, r + 0.14, 0.3);
    ctx.save(); ctx.globalAlpha = 0.9;
    ctx.fillStyle = frontColor;
    ctx.beginPath(); ctx.ellipse(fp.x, fp.y, TILE*0.065, TILE*0.04, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    const bp = proj(bCol, r + 0.14, 0.3);
    ctx.save(); ctx.globalAlpha = 0.85;
    ctx.fillStyle = rearColor;
    ctx.beginPath(); ctx.ellipse(bp.x, bp.y, TILE*0.055, TILE*0.035, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // ── Log drawing ───────────────────────────────────────────────────────────
  function drawLog (r, log) {
    const x = log.x, w = log.w;
    block(x, r + 0.1, 0, w, 0.8, 0.28,
          C.logTop, C.logSide, C.logDark, 'rgba(0,0,0,0.2)');

    // Bark rings
    const segments = Math.max(1, Math.floor(w));
    for (let i = 1; i < segments; i++) {
      const xPos = x + (w / segments) * i;
      const p = proj(xPos, r + 0.1, 0.28);
      ctx.save();
      ctx.globalAlpha = 0.22;
      _topFace(p.x, p.y, 0.06, 0.8, '#3a1e08');
      ctx.restore();
    }
  }

  // ── Tree drawing ──────────────────────────────────────────────────────────
  function drawTree (col, r, variant) {
    // Trunk
    block(col + 0.34, r + 0.22, 0, 0.32, 0.56, 0.38,
          C.trunkTop, C.trunkL, C.trunkR);

    const lA = C.leafA, lB = shade(C.leafA, 0.62), lC = shade(C.leafA, 0.48);
    const lA2 = C.leafC, lB2 = shade(C.leafC, 0.62), lC2 = shade(C.leafC, 0.48);

    if (variant === 0) {
      // Rounded stacked cubes
      block(col + 0.08, r + 0.08, 0.38, 0.84, 0.84, 0.52, lA,  lB,  lC,  'rgba(0,0,0,0.15)');
      block(col + 0.20, r + 0.18, 0.90, 0.60, 0.64, 0.46, lA2, lB2, lC2, 'rgba(0,0,0,0.12)');
      block(col + 0.33, r + 0.30, 1.36, 0.34, 0.40, 0.38, lA,  lB,  lC,  'rgba(0,0,0,0.10)');
    } else {
      // Wide pyramid
      block(col + 0.04, r + 0.04, 0.38, 0.92, 0.92, 0.44, lA,  lB,  lC,  'rgba(0,0,0,0.15)');
      block(col + 0.18, r + 0.14, 0.82, 0.64, 0.72, 0.40, lA2, lB2, lC2, 'rgba(0,0,0,0.12)');
      block(col + 0.34, r + 0.26, 1.22, 0.32, 0.48, 0.34, lA,  lB,  lC,  'rgba(0,0,0,0.10)');
    }
  }

  // ── Frog drawing ──────────────────────────────────────────────────────────
  // The frog is drawn with clearly distinct body + head blocks, visible eyes,
  // belly patch, and stubby feet — making it unambiguous against the terrain.
  function drawFrog (col, row, h, bodyColor, squish, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha ?? 1;

    const bw = 0.70, bd = 0.68, bh = 0.50;  // body
    const hw = 0.54, hd = 0.54, hh = 0.32;  // head

    const bc = bodyColor, bl = shade(bc, 0.60), br = shade(bc, 0.46);
    const hc = shade(bc, 1.08), hl = shade(bc, 0.68), hr = shade(bc, 0.52);

    const bCol = col + (1 - bw) / 2;
    const bRow = row + (1 - bd) / 2;

    // Ground shadow
    const sp = proj(col + 0.3, row + 0.35, 0);
    ctx.save();
    ctx.globalAlpha = (alpha ?? 1) * 0.3;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(sp.x, sp.y, TILE * 0.44 * (squish < 1 ? 1.2 : 1),
                             TILE * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Back feet (behind body)
    _drawFoot(col + 0.04,  row + 0.72, h, bc, bl, br);
    _drawFoot(col + 0.56,  row + 0.72, h, bc, bl, br);

    // Body
    block(bCol, bRow, h, bw, bd, bh * squish, bc, bl, br, 'rgba(0,0,0,0.22)');

    // Belly lighter patch on top face
    const bellP = proj(bCol + 0.1, bRow + 0.1, h + bh * squish);
    ctx.save();
    ctx.globalAlpha = (alpha ?? 1) * 0.55;
    _topFace(bellP.x, bellP.y, bw - 0.2, bd - 0.2, C.frogBelly);
    ctx.restore();

    // Head (slightly forward / toward viewer = lower row value)
    const hCol = col + (1 - hw) / 2;
    const hRow = row + (1 - hd) / 2 - 0.06;
    block(hCol, hRow, h + bh * squish, hw, hd, hh, hc, hl, hr, 'rgba(0,0,0,0.18)');

    // Eyes — bulging spheres on top of head
    const eyeH = h + bh * squish + hh + 0.06;
    _drawEyeBulge(col + 0.22, row + 0.19, eyeH);
    _drawEyeBulge(col + 0.55, row + 0.19, eyeH);

    // Mouth line
    const mP = proj(col + 0.26, row + 0.14, h + bh * squish + hh * 0.4);
    ctx.save();
    ctx.globalAlpha = (alpha ?? 1) * 0.55;
    _topFace(mP.x, mP.y, 0.20, 0.05, C.frogMouth);
    ctx.restore();

    // Front feet
    _drawFoot(col + 0.06,  row + 0.15, h, bc, bl, br);
    _drawFoot(col + 0.58,  row + 0.15, h, bc, bl, br);

    ctx.restore();
  }

  function _drawFoot (col, row, h, tc, lc, rc) {
    block(col, row, h, 0.28, 0.26, 0.12, tc, lc, rc);
  }

  function _drawEyeBulge (col, row, h) {
    // White ball
    const p = proj(col, row, h);
    ctx.save();
    ctx.fillStyle = C.frogEye;
    ctx.beginPath();
    ctx.arc(p.x, p.y, TILE * 0.11, 0, Math.PI * 2);
    ctx.fill();
    // Pupil
    ctx.fillStyle = C.frogPupil;
    ctx.beginPath();
    ctx.arc(p.x + TILE*0.025, p.y + TILE*0.02, TILE * 0.055, 0, Math.PI * 2);
    ctx.fill();
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(p.x - TILE*0.02, p.y - TILE*0.03, TILE * 0.025, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── State ─────────────────────────────────────────────────────────────────
  let state = 'start';
  let score = 0;
  let best  = parseInt(localStorage.getItem('fr_best') || '0', 10);

  // Player
  let player = { col: HALF_COLS, row: 0 };
  let alive   = true;

  // Jump
  const JUMP_DUR  = 0.16;
  let jumping     = false;
  let jumpT       = 0;
  let jumpFrom    = { col: 0, row: 0 };
  let jumpTo      = { col: 0, row: 0 };
  let jumpDir     = 0;  // facing direction for rendering

  // Death
  let deathTimer = 0;
  let deathKind  = 'hit';  // 'hit' | 'drown'
  let deathPos   = { col: 0, row: 0 };

  // ── Input ─────────────────────────────────────────────────────────────────
  let touchX0 = 0, touchY0 = 0;

  document.addEventListener('keydown', e => {
    const MAP = {
      'ArrowUp':'up','ArrowDown':'down','ArrowLeft':'left','ArrowRight':'right',
      'w':'up','s':'down','a':'left','d':'right',
    };
    if (!MAP[e.key]) return;
    e.preventDefault();
    if (state === 'playing') _tryJump(MAP[e.key]);
  });

  document.addEventListener('touchstart', e => {
    touchX0 = e.touches[0].clientX;
    touchY0 = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (state !== 'playing') return;
    const dx = e.changedTouches[0].clientX - touchX0;
    const dy = e.changedTouches[0].clientY - touchY0;
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
    if (Math.abs(dy) > Math.abs(dx)) {
      _tryJump(dy < 0 ? 'up' : 'down');
    } else {
      _tryJump(dx < 0 ? 'left' : 'right');
    }
  }, { passive: true });

  function _tryJump (dir) {
    if (jumping || !alive) return;

    let dc = 0, dr = 0;
    if (dir === 'up')    dr = 1;   // FORWARD = deeper into screen = +row
    if (dir === 'down')  dr = -1;  // BACKWARD
    if (dir === 'left')  dc = -1;
    if (dir === 'right') dc = 1;

    const nc = player.col + dc;
    const nr = player.row + dr;

    if (nc < 0 || nc >= COLS) return;
    if (nr < 0) return;  // can't go behind start

    // Block by trees
    const destLane = getLane(nr);
    if (destLane && destLane.type === 'safe') {
      for (const t of destLane.objs) {
        if (t.col === Math.round(nc)) return;
      }
    }

    jumpFrom     = { col: player.col, row: player.row };
    jumpTo       = { col: nc, row: nr };
    jumpDir      = dir;
    jumping      = true;
    jumpT        = 0;
  }

  // ── Update ────────────────────────────────────────────────────────────────
  function update (dt) {
    if (state !== 'playing') return;

    // Jump
    if (jumping) {
      jumpT += dt;
      const norm = Math.min(jumpT / JUMP_DUR, 1);
      if (norm >= 1) {
        player.col  = jumpTo.col;
        player.row  = jumpTo.row;
        jumping     = false;

        // Update score
        if (player.row > score) {
          score = player.row;
          _setScore(score);
        }
      }
    }

    // Move vehicles + logs
    const visStart = Math.max(0, Math.floor(camRow) - 2);
    const visEnd   = Math.floor(camRow) + VIS_ROWS + 2;
    for (let r = visStart; r <= visEnd; r++) {
      const lane = getLane(r);
      if (!lane) continue;
      if (lane.type !== 'road' && lane.type !== 'water') continue;
      for (const obj of lane.objs) {
        obj.x += lane.dir * lane.speed * dt;
        const span = COLS + (obj.w || 1) + 2;
        if (lane.dir > 0 && obj.x >  COLS + 1)       obj.x -= span;
        if (lane.dir < 0 && obj.x < -(obj.w || 1) - 1) obj.x += span;
      }
    }

    // Smooth camera — keep player about 1/3 up from bottom of visible area
    const targetCam = player.row - 2;
    camRow += (targetCam - camRow) * Math.min(dt * 7, 1);

    // Collisions
    if (alive && !jumping) _checkCollision();

    // Death timer
    if (!alive) {
      deathTimer += dt;
      if (deathTimer > 1.4) _showDead();
    }
  }

  function _checkCollision () {
    const lane = getLane(player.row);
    if (!lane) return;
    const pc = player.col + 0.18, pw = 0.64;

    if (lane.type === 'road') {
      for (const car of lane.objs) {
        if (pc < car.x + car.w - 0.05 && pc + pw > car.x + 0.05) {
          _die('hit'); return;
        }
      }
    }

    if (lane.type === 'water') {
      let onLog = false;
      for (const log of lane.objs) {
        if (pc < log.x + log.w && pc + pw > log.x) {
          onLog = true;
          // Ride log
          player.col += lane.dir * lane.speed * (1/60);
          player.col  = Math.max(0.1, Math.min(COLS - 1.1, player.col));
          break;
        }
      }
      if (!onLog) { _die('drown'); }
    }
  }

  function _die (kind) {
    alive      = false;
    deathKind  = kind;
    deathTimer = 0;
    deathPos   = { col: player.col, row: player.row };
    if (score > best) {
      best = score;
      localStorage.setItem('fr_best', best);
      document.getElementById('panel-best-val').textContent = best;
    }
  }

  function _showDead () {
    state = 'dead';
    const isHit = deathKind === 'hit';
    document.getElementById('dead-emoji').textContent  = isHit ? '💀' : '🌊';
    document.getElementById('dead-title').textContent  = isHit ? 'Squished' : 'Drowned';
    document.getElementById('final-score').textContent = score;
    document.getElementById('best-score').textContent  = 'Best: ' + best;
    document.getElementById('dead-overlay').classList.remove('hidden');
  }

  function _setScore (v) {
    document.getElementById('score-display').textContent      = v;
    document.getElementById('panel-score-val').textContent    = v;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render () {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0e1628');
    sky.addColorStop(1, '#1e2a50');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Draw lanes back-to-front.
    // "Back" = highest row number (deepest into screen) = appears at top of screen.
    // "Front" = row 0 (player start) = appears near bottom.
    const drawStart = Math.max(0, Math.floor(camRow) - 1);
    const drawEnd   = Math.floor(camRow) + VIS_ROWS + 2;

    for (let r = drawEnd; r >= drawStart; r--) {
      drawLane(r);
    }

    // Player
    _renderPlayer();
  }

  function _renderPlayer () {
    let rCol = player.col, rRow = player.row, rH = 0, squish = 1, alpha = 1;

    if (jumping) {
      const norm  = Math.min(jumpT / JUMP_DUR, 1);
      const ease  = norm < 0.5 ? 2*norm*norm : -1+(4-2*norm)*norm;
      rCol = jumpFrom.col + (jumpTo.col - jumpFrom.col) * ease;
      rRow = jumpFrom.row + (jumpTo.row - jumpFrom.row) * ease;
      const arc = Math.sin(Math.PI * norm);
      rH      = arc * 0.65;
      squish  = 1 + arc * 0.12;
    }

    if (!alive) {
      rCol  = deathPos.col;
      rRow  = deathPos.row;
      alpha = Math.max(0, 1 - deathTimer * 1.8);
      if (deathKind === 'hit') {
        squish = 0.35 + (1 - Math.min(deathTimer, 1)) * 0.65; // flatten
        const flash = Math.floor(deathTimer * 10) % 2 === 0;
        drawFrog(rCol, rRow, 0, flash ? C.hitFlash : C.frogTop, squish, alpha);
      } else {
        rH = -deathTimer * 0.35; // sink
        drawFrog(rCol, rRow, Math.max(rH, -0.4), C.frogTop, squish, alpha);
        // Bubbles
        _drawBubbles(rCol, rRow, deathTimer);
      }
      return;
    }

    drawFrog(rCol, rRow, rH, C.frogTop, squish, alpha);
  }

  function _drawBubbles (col, row, t) {
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI * 0.5 + t * 3;
      const bx = col + 0.4 + Math.cos(angle) * 0.3;
      const br = row + 0.4 + Math.sin(angle) * 0.2;
      const bh = t * 0.6 + i * 0.12;
      const p  = proj(bx, br, bh);
      ctx.save();
      ctx.globalAlpha = Math.max(0, 0.7 - t);
      ctx.strokeStyle = C.drownBubble;
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, TILE * 0.06 + i * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── Resize ────────────────────────────────────────────────────────────────
  function resize () {
    const area = document.getElementById('game-area');
    const W = area.clientWidth  || window.innerWidth;
    const H = area.clientHeight || window.innerHeight;
    canvas.width  = W;
    canvas.height = H;
    CX = W / 2;
    // Player sits roughly 28% up from bottom of screen
    CY = H * 0.72;
  }

  window.addEventListener('resize', resize);

  // ── Game lifecycle ────────────────────────────────────────────────────────
  function startGame () {
    score       = 0;
    player      = { col: HALF_COLS, row: 0 };
    alive       = true;
    jumping     = false;
    jumpT       = 0;
    deathTimer  = 0;
    camRow      = 0;
    world       = [];
    // Pre-build start rows
    for (let r = 0; r < VIS_ROWS + 4; r++) getLane(r);
    state = 'playing';
    _setScore(0);
    document.getElementById('panel-best-val').textContent = best;
    document.getElementById('start-overlay').classList.add('hidden');
    document.getElementById('dead-overlay').classList.add('hidden');
  }

  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('restart-btn').addEventListener('click', startGame);

  // ── Loop ──────────────────────────────────────────────────────────────────
  let last = 0;
  function loop (ts) {
    const dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  resize();
  document.getElementById('panel-best-val').textContent = best;
  // Pre-render start world so canvas isn't empty behind the overlay
  for (let r = 0; r < VIS_ROWS + 4; r++) getLane(r);
  requestAnimationFrame(loop);

})();
