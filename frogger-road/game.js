/**
 * Frogger Road — Crossy Road-correct oblique camera
 *
 * PROJECTION — matches the screenshot exactly:
 *   • Lanes are HORIZONTAL bands across the screen (cars drive left↔right)
 *   • "Forward" (deeper into world) moves UP on screen
 *   • Camera is oblique: depth axis tilts UP at ~26° from horizontal
 *     so a tile at depth d and column c maps to:
 *       sx = originX + c * TW - d * DEPTH_X
 *       sy = originY            - d * DEPTH_Y  - h * BLOCK_H
 *     where TW = tile pixel width, DEPTH_X/Y is the depth-step vector
 *
 *   Result: lanes look like horizontal shelves receding toward the top,
 *   just like the real Crossy Road screenshot.
 *
 * WORLD COORDS:
 *   col  — 0..COLS-1, left→right
 *   row  — 0 = player start (near), increases going FORWARD (away from viewer)
 *   h    — block height above ground (tile units)
 */
(function () {
  'use strict';

  const canvas = document.getElementById('canvas');
  const ctx    = canvas.getContext('2d');

  // ── Projection constants ──────────────────────────────────────────────────
  // TW  = width of one tile on screen (horizontal)
  // DX  = how far left  one depth-step shifts the tile (oblique depth axis)
  // DY  = how far up    one depth-step shifts the tile
  // BH  = pixel height of one block-height unit
  // SH  = pixel height of the visible side slab of a tile (the "depth face")
  const TW   = 72;   // tile width px
  const DX   = 14;   // depth horizontal offset per row (leftward lean)
  const DY   = 42;   // depth vertical offset per row   (upward recession)
  const BH   = 52;   // pixels per height unit
  const SH   = 14;   // side slab height (thickness of a ground tile)

  // Grid
  const COLS      = 13;
  const HALF_COLS = 6;
  const VIS_ROWS  = 14;

  // Canvas projection origin (bottom-left of the near row, updated on resize)
  // originX = screen X of column 0, row 0
  // originY = screen Y of ground level, row 0
  let OX = 0, OY = 0;

  // ── Palette ───────────────────────────────────────────────────────────────
  const C = {
    grassA:'#6bbf3e', grassB:'#5aaa2e', grassC:'#78d040',
    grassSide:'#4a8a22',
    roadA:'#666677',  roadB:'#555566',  roadSide:'#333344',
    roadLine:'#f0e050',
    waterA:'#3abde8', waterB:'#28a8d4', waterC:'#4ecff0',
    waterSide:'#1890b8',
    waterFoam:'#c8f0ff',
    logTop:'#a0623a',  logSide:'#7a4525', logDark:'#5a3018',
    trunkTop:'#8a5830',trunkSide:'#6a4020',trunkDark:'#4a2c10',
    leafA:'#5ab828',   leafB:'#4aa018',  leafC:'#3a8810',
    leafSide:'#2e7010',leafDark:'#1e5008',
    carRed:'#e83030',   carRedSide:'#b01818',
    carBlue:'#3080e8',  carBlueSide:'#1860b8',
    carYellow:'#f0cc20',carYellowSide:'#c0a010',
    carOrange:'#e86020',carOrangeSide:'#b84010',
    carGreen:'#30c050', carGreenSide:'#1a9030',
    carWhite:'#e8e8e8', carWhiteSide:'#b0b0b0',
    carGlass:'#90c8e8',
    carTyre:'#1a1a1a',  carTyreSide:'#0a0a0a',
    frogBody:'#78cc28',  frogSide:'#50a010', frogDark:'#3a7808',
    frogBelly:'#c8f050', frogEye:'#ffffff',  frogPupil:'#111111',
    frogMouth:'#2a7008',
    shadow:'rgba(0,0,0,0.22)',
    hitFlash:'#ff2020',
    outline:'rgba(0,0,0,0.30)',
  };

  const CAR_COLORS = [
    [C.carRed,    C.carRedSide],
    [C.carBlue,   C.carBlueSide],
    [C.carYellow, C.carYellowSide],
    [C.carOrange, C.carOrangeSide],
    [C.carGreen,  C.carGreenSide],
    [C.carWhite,  C.carWhiteSide],
  ];

  // ── RNG ───────────────────────────────────────────────────────────────────
  let _s = 1;
  function rng () { _s ^= _s<<13; _s ^= _s>>17; _s ^= _s<<5; return (_s>>>0)/0x100000000; }
  function rf (a,b) { return a+rng()*(b-a); }
  function ri (a,b) { return a+Math.floor(rng()*(b-a+1)); }
  function rp (a)   { return a[Math.floor(rng()*a.length)]; }
  function seed (n) { _s = Math.abs((n*1664525+1013904223)|0) || 1; }

  // ── Projection helpers ────────────────────────────────────────────────────
  /**
   * World → screen.
   * col: 0-based column
   * row: depth (0 = near, increases forward)
   * h:   height in tile units (0 = ground)
   */
  function proj (col, row, h) {
    const rel = row - camRow;  // relative depth from camera
    const sx  = OX + col * TW - rel * DX;
    const sy  = OY              - rel * DY - h * BH;
    return { x: sx, y: sy };
  }

  // ── Block drawing ─────────────────────────────────────────────────────────
  /**
   * Draw one solid block (oblique-projection "box").
   *   col, row, h  = world position (bottom-near corner)
   *   w            = width in columns
   *   bh           = block height in tile units
   *   topC, sideC  = top-face and near-side face colors
   *   [outlineC]   = optional stroke on top face
   */
  function drawBlock (col, row, h, w, bh, topC, sideC, outlineC) {
    const p  = proj(col,     row, h);
    const p2 = proj(col + w, row, h);
    const pt = proj(col,     row, h + bh);
    const p2t= proj(col + w, row, h + bh);

    const sideH = bh * BH;

    // Near (bottom) side face — the "depth slab" visible on front edge
    ctx.beginPath();
    ctx.moveTo(p.x,  p.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p2.x, p2.y - sideH);
    ctx.lineTo(p.x,  p.y  - sideH);
    ctx.closePath();
    ctx.fillStyle = sideC;
    ctx.fill();

    // Top face — a parallelogram (depth-axis leans upper-left)
    const depthW = w * DX;  // how far left the far edge is
    const depthH = w * 0;   // y change across width = 0 (horizontal lanes)
    // Actually top face: near-left=pt, near-right=p2t, far-right=p2t shifted by depth, far-left=pt shifted by depth
    // Since lanes run horizontally, the depth offset is per-row, and within one row
    // the top face is just a rectangle shifted by the row's depth offset.
    // For a block of width w at row `row`: near edge at row, far edge at row+1
    const pfar  = proj(col,     row + 1, h + bh);
    const p2far = proj(col + w, row + 1, h + bh);

    ctx.beginPath();
    ctx.moveTo(pt.x,   pt.y);
    ctx.lineTo(p2t.x,  p2t.y);
    ctx.lineTo(p2far.x,p2far.y);
    ctx.lineTo(pfar.x, pfar.y);
    ctx.closePath();
    ctx.fillStyle = topC;
    ctx.fill();

    if (outlineC) {
      ctx.strokeStyle = outlineC;
      ctx.lineWidth   = 1.0;
      ctx.stroke();
    }
  }

  /**
   * Draw a ground tile (thin slab, depth=1 row).
   */
  function drawTile (col, row, topC, sideC) {
    drawBlock(col, row, 0, 1, SH / BH, topC, sideC, null);
  }

  // ── World ─────────────────────────────────────────────────────────────────
  let world = [];

  function getLane (r) {
    if (r < 0) return null;
    while (r >= world.length) world.push(_makeLane(world.length));
    return world[r];
  }

  function _makeLane (r) {
    if (r === 0) return _safeLane(r, true);
    seed(r * 7919 + 2654435761);
    if (r % 6 === 0) return _safeLane(r, false);
    const diff = Math.min(Math.floor(r/6) * 0.12, 0.9);
    const t = rng();
    if (t < 0.52) return _roadLane(r, diff);
    if (t < 0.78) return _waterLane(r, diff);
    return _safeLane(r, false);
  }

  function _safeLane (r, isStart) {
    seed(r * 2654435761 + 12345);
    const color = rp([C.grassA, C.grassB, C.grassC]);
    const trees = [];
    if (!isStart) {
      for (let c = 0; c < COLS; c++) {
        if (rng() < 0.14) trees.push({ col: c, variant: ri(0,1) });
      }
    }
    return { type:'safe', color, side:C.grassSide, objs:trees, speed:0, dir:1 };
  }

  function _roadLane (r, diff) {
    seed(r * 2654435761 + 99991);
    const [tc, sc] = rng()<0.5 ? [C.roadA,C.roadB] : [C.roadB,C.roadA];
    const dir   = rng()<0.5 ? 1 : -1;
    const speed = rf(2.5 + diff*2.5, 4.5 + diff*5.0);
    const count = ri(1, 2 + Math.floor(diff*3));
    const spacing = COLS / count;
    const cars = [];
    for (let i=0; i<count; i++) {
      const w = ri(1, 2 + (diff>0.3?1:0));
      const ci = ri(0, CAR_COLORS.length-1);
      cars.push({ x: i*spacing + rng()*spacing*0.5, w, ci, type: ri(0,1) });
    }
    return { type:'road', color:tc, side:C.roadSide, objs:cars, speed, dir };
  }

  function _waterLane (r, diff) {
    seed(r * 2654435761 + 77777);
    const color = rp([C.waterA, C.waterB, C.waterC]);
    const dir   = rng()<0.5 ? 1 : -1;
    const speed = rf(1.0+diff*1.2, 2.2+diff*2.0);
    const count = ri(2, 3+(diff>0.4?1:0));
    const spacing = COLS / count;
    const logs = [];
    for (let i=0; i<count; i++) {
      logs.push({ x: i*spacing + rng()*spacing*0.25, w: rf(1.4,2.2) });
    }
    return { type:'water', color, side:C.waterSide, objs:logs, speed, dir };
  }

  // ── Terrain rendering ─────────────────────────────────────────────────────
  function renderLane (r) {
    const lane = getLane(r);
    if (!lane) return;

    // Ground tiles
    for (let c = 0; c < COLS; c++) {
      drawTile(c, r, lane.color, lane.side);
    }

    if (lane.type === 'road') {
      _renderRoadMarkings(r);
      for (const car of lane.objs) renderCar(r, car, lane.dir);
    }
    if (lane.type === 'water') {
      _renderWaterShimmer(r);
      for (const log of lane.objs) renderLog(r, log);
    }
    if (lane.type === 'safe') {
      for (const tree of lane.objs) renderTree(tree.col, r, tree.variant);
    }
  }

  function _renderRoadMarkings (r) {
    // White dashes at the center of each tile
    for (let c = 0; c < COLS; c++) {
      if ((c + r) % 2 === 0) continue;
      const p  = proj(c + 0.22, r, SH/BH + 0.01);
      const p2 = proj(c + 0.78, r, SH/BH + 0.01);
      const pf = proj(c + 0.22, r+1, SH/BH + 0.01);
      ctx.save();
      ctx.globalAlpha = 0.65;
      ctx.strokeStyle = C.roadLine;
      ctx.lineWidth   = 3;
      ctx.beginPath();
      ctx.moveTo((p.x+pf.x)*0.5, (p.y+pf.y)*0.5 + 2);
      ctx.lineTo((p2.x+proj(c+0.78,r+1,SH/BH+0.01).x)*0.5, (p2.y+proj(c+0.78,r+1,SH/BH+0.01).y)*0.5 + 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function _renderWaterShimmer (r) {
    const t = performance.now() * 0.001;
    for (let c=0; c<COLS; c++) {
      const alpha = 0.12 + 0.09*Math.abs(Math.sin(c*1.9+r*0.7+t));
      const p   = proj(c+0.1, r+0.15, SH/BH+0.005);
      const p2  = proj(c+0.9, r+0.15, SH/BH+0.005);
      const pf  = proj(c+0.1, r+0.85, SH/BH+0.005);
      const p2f = proj(c+0.9, r+0.85, SH/BH+0.005);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = C.waterFoam;
      ctx.beginPath();
      ctx.moveTo(p.x,p.y); ctx.lineTo(p2.x,p2.y); ctx.lineTo(p2f.x,p2f.y); ctx.lineTo(pf.x,pf.y);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  // ── Car rendering ─────────────────────────────────────────────────────────
  function renderCar (r, car, dir) {
    const [topC, sideC] = CAR_COLORS[car.ci % CAR_COLORS.length];
    const x = car.x, w = car.w;
    const groundH = SH/BH;

    // Body block
    const BODY_H = 0.58;
    drawBlock(x+0.06, r, groundH, w-0.12, BODY_H, topC, sideC, C.outline);

    // Cab (for car type 0)
    if (car.type === 0) {
      const cw = (w-0.12)*0.52, co=(w-0.12-cw)/2;
      drawBlock(x+0.06+co, r+0.05, groundH+BODY_H,
                cw, 0.40,
                _mix(topC,'#ffffff',0.15), _mix(sideC,'#000000',0.1),
                C.outline);
      // windshield
      _drawWindshield(x+0.06+co, r, groundH+BODY_H, cw, dir);
    }

    // Wheels
    _drawCarWheels(x, r, w, groundH);
  }

  function _mix (hex, hex2, t) {
    const parse = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
    const [r1,g1,b1] = parse(hex), [r2,g2,b2] = parse(hex2);
    return `rgb(${~~(r1+(r2-r1)*t)},${~~(g1+(g2-g1)*t)},${~~(b1+(b2-b1)*t)})`;
  }

  function _drawWindshield (col, row, h, w, dir) {
    // Glass quad on the front face of the cab
    const frontRow = dir > 0 ? row : row + 0.9;
    const p  = proj(col+0.08,  frontRow, h+0.05);
    const p2 = proj(col+w-0.08,frontRow, h+0.05);
    const pt = proj(col+0.08,  frontRow, h+0.33);
    const p2t= proj(col+w-0.08,frontRow, h+0.33);
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle   = C.carGlass;
    ctx.beginPath();
    ctx.moveTo(p.x,p.y); ctx.lineTo(p2.x,p2.y); ctx.lineTo(p2t.x,p2t.y); ctx.lineTo(pt.x,pt.y);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function _drawCarWheels (x, r, w, groundH) {
    const WHEEL_H = 0.18, WHEEL_W = 0.22;
    // Front axle wheels
    drawBlock(x+0.08,     r+0.78, groundH-WHEEL_H, WHEEL_W, WHEEL_H, C.carTyre, C.carTyreSide);
    // Rear axle wheels
    drawBlock(x+w-0.30,   r+0.78, groundH-WHEEL_H, WHEEL_W, WHEEL_H, C.carTyre, C.carTyreSide);
  }

  // ── Log rendering ─────────────────────────────────────────────────────────
  function renderLog (r, log) {
    const groundH = SH/BH;
    drawBlock(log.x, r+0.08, groundH, log.w, 0.30, C.logTop, C.logSide, C.outline);

    // Bark rings
    const segs = Math.max(1, Math.round(log.w));
    for (let i=1; i<segs; i++) {
      const xp = log.x + (log.w/segs)*i;
      const p  = proj(xp, r+0.08, groundH+0.30);
      const pf = proj(xp, r+0.08+1, groundH+0.30);
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = C.logDark;
      ctx.lineWidth   = 2;
      ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(pf.x,pf.y); ctx.stroke();
      ctx.restore();
    }
  }

  // ── Tree rendering ────────────────────────────────────────────────────────
  function renderTree (col, row, variant) {
    const groundH = SH/BH;
    // Trunk
    drawBlock(col+0.36, row+0.18, groundH, 0.28, 0.42, C.trunkTop, C.trunkSide, C.outline);

    const layers = variant===0 ?
      [{x:0.08,z:0.06,w:0.84,d:0.88,h:0.55},{x:0.20,z:0.16,w:0.60,d:0.68,h:0.48},{x:0.34,z:0.28,w:0.32,d:0.44,h:0.42}] :
      [{x:0.05,z:0.04,w:0.90,d:0.92,h:0.50},{x:0.18,z:0.14,w:0.64,d:0.72,h:0.44},{x:0.34,z:0.26,w:0.32,d:0.48,h:0.38}];

    const leafColors  = [C.leafA, C.leafC, C.leafB];
    const sideColors  = [C.leafSide, C.leafSide, C.leafDark];

    for (let i=0; i<layers.length; i++) {
      const ly = layers[i];
      const baseH = groundH + 0.42 + i*0.44;
      drawBlock(col+ly.x, row+ly.z, baseH, ly.w, ly.h, leafColors[i], sideColors[i], C.outline);
    }
  }

  // ── Frog rendering ────────────────────────────────────────────────────────
  function renderFrog (col, row, h, bodyColor, squish, alpha) {
    ctx.save();
    if (alpha != null) ctx.globalAlpha = alpha;

    const groundH = SH/BH;
    const base    = groundH + h;

    // Shadow
    const sp  = proj(col+0.1,  row+0.9, 0);
    const sp2 = proj(col+0.9,  row+0.9, 0);
    const spf = proj(col+0.1,  row+1.5, 0);
    const sp2f= proj(col+0.9,  row+1.5, 0);
    ctx.save();
    ctx.globalAlpha = (alpha??1)*0.28;
    ctx.fillStyle   = '#000';
    ctx.beginPath();
    ctx.moveTo(sp.x,sp.y); ctx.lineTo(sp2.x,sp2.y);
    ctx.lineTo(sp2f.x,sp2f.y); ctx.lineTo(spf.x,spf.y);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // Back feet (drawn before body so body overlaps)
    drawBlock(col+0.04, row+0.70, base, 0.26, 0.14, bodyColor, C.frogDark);
    drawBlock(col+0.54, row+0.70, base, 0.26, 0.14, bodyColor, C.frogDark);

    // Body
    const BH_BODY = 0.52 * squish;
    drawBlock(col+0.12, row+0.18, base, 0.76, 0.64, bodyColor, C.frogSide, C.outline);
    // Belly lighter patch on top
    {
      const p  = proj(col+0.22, row+0.24, base+BH_BODY*0.5);
      const p2 = proj(col+0.78, row+0.24, base+BH_BODY*0.5);
      const pf = proj(col+0.22, row+0.58, base+BH_BODY*0.5);
      const p2f= proj(col+0.78, row+0.58, base+BH_BODY*0.5);
      ctx.save(); ctx.globalAlpha = (alpha??1)*0.50;
      ctx.fillStyle = C.frogBelly;
      ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p2.x,p2.y); ctx.lineTo(p2f.x,p2f.y); ctx.lineTo(pf.x,pf.y);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // Head block
    const HEAD_TOP = base + 0.52*squish;
    drawBlock(col+0.18, row+0.12, HEAD_TOP, 0.64, 0.52, C.frogBody, C.frogSide, C.outline);

    // Eyes
    _drawFrogEye(col+0.22, row+0.14, HEAD_TOP+0.30);
    _drawFrogEye(col+0.56, row+0.14, HEAD_TOP+0.30);

    // Front feet
    drawBlock(col+0.04, row+0.16, base, 0.20, 0.14, bodyColor, C.frogDark);
    drawBlock(col+0.58, row+0.16, base, 0.20, 0.14, bodyColor, C.frogDark);

    ctx.restore();
  }

  function _drawFrogEye (col, row, h) {
    const p = proj(col, row, h);
    ctx.save();
    ctx.fillStyle = C.frogEye;
    ctx.beginPath(); ctx.arc(p.x, p.y, BH*0.10, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = C.frogPupil;
    ctx.beginPath(); ctx.arc(p.x+BH*0.025, p.y+BH*0.02, BH*0.052, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.arc(p.x-BH*0.02, p.y-BH*0.025, BH*0.022, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // ── State ─────────────────────────────────────────────────────────────────
  let state = 'start';
  let score = 0;
  let best  = parseInt(localStorage.getItem('fr_best')||'0', 10);

  let player = { col: HALF_COLS, row: 0 };
  let alive  = true;

  const JUMP_DUR = 0.15;
  let jumping = false, jumpT = 0;
  let jumpFrom = {col:0,row:0}, jumpTo = {col:0,row:0};

  let deathTimer = 0, deathKind = 'hit', deathCol = 0, deathRow = 0;

  // Camera — camRow is the world row at screen bottom reference
  let camRow = 0;

  // ── Input ─────────────────────────────────────────────────────────────────
  let tx0=0, ty0=0;
  document.addEventListener('keydown', e=>{
    const M={'ArrowUp':'f','ArrowDown':'b','ArrowLeft':'l','ArrowRight':'r','w':'f','s':'b','a':'l','d':'r'};
    if (!M[e.key]) return; e.preventDefault();
    if (state==='playing') _jump(M[e.key]);
  });
  document.addEventListener('touchstart', e=>{ tx0=e.touches[0].clientX; ty0=e.touches[0].clientY; },{passive:true});
  document.addEventListener('touchend', e=>{
    if (state!=='playing') return;
    const dx=e.changedTouches[0].clientX-tx0, dy=e.changedTouches[0].clientY-ty0;
    if (Math.abs(dx)<12&&Math.abs(dy)<12) return;
    if (Math.abs(dy)>Math.abs(dx)) _jump(dy<0?'f':'b'); else _jump(dx<0?'l':'r');
  },{passive:true});

  function _jump (dir) {
    if (jumping||!alive) return;
    let dc=0, dr=0;
    if (dir==='f') dr=1;   // forward = deeper into world
    if (dir==='b') dr=-1;
    if (dir==='l') dc=-1;
    if (dir==='r') dc=1;
    const nc=player.col+dc, nr=player.row+dr;
    if (nc<0||nc>=COLS||nr<0) return;
    const lane=getLane(nr);
    if (lane&&lane.type==='safe') {
      for (const t of lane.objs) if (Math.round(nc)===t.col) return;
    }
    jumpFrom={col:player.col,row:player.row};
    jumpTo={col:nc,row:nr};
    jumping=true; jumpT=0;
  }

  // ── Update ────────────────────────────────────────────────────────────────
  function update (dt) {
    if (state!=='playing') return;

    if (jumping) {
      jumpT += dt;
      if (jumpT >= JUMP_DUR) {
        player.col=jumpTo.col; player.row=jumpTo.row;
        jumping=false;
        if (player.row>score) { score=player.row; _setScore(score); }
      }
    }

    // Move vehicles / logs
    const vs=Math.max(0, Math.floor(camRow)-2), ve=Math.floor(camRow)+VIS_ROWS+2;
    for (let r=vs; r<=ve; r++) {
      const lane=getLane(r);
      if (!lane||(lane.type!=='road'&&lane.type!=='water')) continue;
      for (const obj of lane.objs) {
        obj.x += lane.dir*lane.speed*dt;
        const span=COLS+(obj.w||1)+2;
        if (lane.dir>0&&obj.x> COLS+1)         obj.x-=span;
        if (lane.dir<0&&obj.x<-(obj.w||1)-1)   obj.x+=span;
      }
    }

    // Camera: keep player ~3 rows from bottom of visible area
    const targetCam = player.row - 3;
    camRow += (targetCam - camRow) * Math.min(dt*8, 1);

    if (alive&&!jumping) _collide();
    if (!alive) { deathTimer+=dt; if (deathTimer>1.5) _showDead(); }
  }

  function _collide () {
    const lane=getLane(player.row);
    if (!lane) return;
    const pc=player.col+0.18, pw=0.64;
    if (lane.type==='road') {
      for (const car of lane.objs) {
        if (pc<car.x+car.w-0.05 && pc+pw>car.x+0.05) { _die('hit'); return; }
      }
    }
    if (lane.type==='water') {
      let on=false;
      for (const log of lane.objs) {
        if (pc<log.x+log.w && pc+pw>log.x) {
          on=true;
          player.col+=lane.dir*lane.speed*(1/60);
          player.col=Math.max(0.1,Math.min(COLS-1.1,player.col));
          break;
        }
      }
      if (!on) _die('drown');
    }
  }

  function _die (kind) {
    alive=false; deathKind=kind; deathTimer=0;
    deathCol=player.col; deathRow=player.row;
    if (score>best) { best=score; localStorage.setItem('fr_best',best); }
  }

  function _showDead () {
    state='dead';
    const isHit=deathKind==='hit';
    document.getElementById('dead-emoji').textContent = isHit?'💀':'🌊';
    document.getElementById('dead-title').textContent = isHit?'Squished':'Drowned';
    document.getElementById('final-score').textContent= score;
    document.getElementById('best-score').textContent = 'Best: '+best;
    document.getElementById('dead-overlay').classList.remove('hidden');
  }

  function _setScore (v) {
    document.getElementById('score-display').textContent   = v;
    document.getElementById('panel-score-val').textContent = v;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render () {
    const W=canvas.width, H=canvas.height;
    ctx.clearRect(0,0,W,H);

    // Sky (bright like the real Crossy Road screenshot)
    const sky=ctx.createLinearGradient(0,0,0,H*0.6);
    sky.addColorStop(0,'#78c8f0');
    sky.addColorStop(1,'#b8e8ff');
    ctx.fillStyle=sky;
    ctx.fillRect(0,0,W,H);

    // Draw lanes from far (high row number) to near (low row number)
    // Far rows appear at the TOP of the screen.
    const drawEnd   = Math.floor(camRow) + VIS_ROWS + 2;
    const drawStart = Math.max(0, Math.floor(camRow) - 1);

    for (let r=drawEnd; r>=drawStart; r--) {
      renderLane(r);
    }

    // Player
    _renderFrogPlayer();
  }

  function _renderFrogPlayer () {
    let rc=player.col, rr=player.row, rh=0, sq=1, alpha=1;

    if (jumping) {
      const n=Math.min(jumpT/JUMP_DUR,1);
      const e=n<0.5?2*n*n:-1+(4-2*n)*n;
      rc=jumpFrom.col+(jumpTo.col-jumpFrom.col)*e;
      rr=jumpFrom.row+(jumpTo.row-jumpFrom.row)*e;
      rh=Math.sin(Math.PI*n)*0.60;
      sq=1+Math.sin(Math.PI*n)*0.12;
    }

    if (!alive) {
      rc=deathCol; rr=deathRow;
      alpha=Math.max(0, 1-deathTimer*1.8);
      if (deathKind==='hit') {
        sq=Math.max(0.25, 1-deathTimer*2.5);
        const flash=Math.floor(deathTimer*10)%2===0;
        renderFrog(rc,rr,0, flash?C.hitFlash:C.frogBody, sq, alpha);
      } else {
        renderFrog(rc,rr,Math.max(-0.35,rh-deathTimer*0.3), C.frogBody, sq, alpha);
      }
      return;
    }

    renderFrog(rc,rr,rh,C.frogBody,sq,alpha);
  }

  // ── Resize ────────────────────────────────────────────────────────────────
  function resize () {
    const area=document.getElementById('game-area');
    const W=area.clientWidth||window.innerWidth;
    const H=area.clientHeight||window.innerHeight;
    canvas.width=W; canvas.height=H;
    // OX: X position of column 0, row at camRow (near row sits at screen bottom)
    // We want COLS tiles to fill the width: TW*COLS ~ W, so center it
    OX = (W - TW*COLS) / 2;
    // OY: Y of the near (row 0) ground level — sit ~20% up from bottom
    OY = H * 0.82;
  }
  window.addEventListener('resize', resize);

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  function startGame () {
    score=0; player={col:HALF_COLS,row:0};
    alive=true; jumping=false; jumpT=0; deathTimer=0; camRow=0;
    world=[];
    for (let r=0;r<VIS_ROWS+4;r++) getLane(r);
    state='playing';
    _setScore(0);
    document.getElementById('panel-best-val').textContent=best;
    document.getElementById('start-overlay').classList.add('hidden');
    document.getElementById('dead-overlay').classList.add('hidden');
  }

  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('restart-btn').addEventListener('click', startGame);

  // ── Loop ──────────────────────────────────────────────────────────────────
  let last=0;
  function loop (ts) {
    const dt=Math.min((ts-last)/1000, 0.05);
    last=ts; update(dt); render();
    requestAnimationFrame(loop);
  }

  resize();
  document.getElementById('panel-best-val').textContent=best;
  for (let r=0;r<VIS_ROWS+4;r++) getLane(r);
  requestAnimationFrame(loop);

})();
