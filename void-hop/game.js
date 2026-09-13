/**
 * Astro Hop — Crossy Road mechanics, alien planet art theme
 *
 * Terrain:
 *   safe  → alien rock fields  (dusty purple ground, crystal spires)
 *   road  → hover lanes        (dark teal ground, glowing hovercrafts)
 *   water → lava flows         (deep orange ground, ride floating rock slabs)
 *
 * Player: chunky space-suited astronaut (white suit, orange visor, backpack)
 *
 * Projection: same oblique camera as before (horizontal lanes, depth leans upper-left)
 */
(function () {
  'use strict';

  const canvas = document.getElementById('canvas');
  const ctx    = canvas.getContext('2d');

  // ── Projection constants ──────────────────────────────────────────────────
  const TW  = 72;
  const DX  = 14;
  const DY  = 42;
  const BH  = 52;
  const SH  = 14;

  const COLS      = 13;
  const HALF_COLS = 6;
  const VIS_ROWS  = 14;

  let OX = 0, OY = 0;

  // ── Alien Palette ─────────────────────────────────────────────────────────
  const C = {
    // Safe / rock fields — clearly alien: sandy purple-grey surface with subtle texture
    rockA:    '#8c7aaa', rockB:    '#7a688e', rockC:    '#9e8abf',
    rockSide: '#4e3e6a',
    // Crystal spires — bright teal/cyan so they read as "interesting obstacle" not ground
    xtalBase: '#20d8d0', xtalSide: '#0ea8a0', xtalDark: '#087870',
    xtalTipA: '#aafffc', xtalTipB: '#60f0ea', xtalGlow: '#dfffff',
    // Hover lane — clearly a ROAD: dark charcoal with bright neon grid lines
    hoverA:   '#1c1c2e', hoverB:   '#151520',
    hoverSide:'#0a0a14',
    hoverLine:'#00ffcc', // bright teal grid
    hoverEdge:'#00c8a0',
    // Hovercraft colors — saturated, distinct
    hcNeon:   '#00ffcc', hcNeonS:  '#009977',
    hcPurple: '#cc44ff', hcPurpleS:'#882abb',
    hcYellow: '#ffe030', hcYellowS:'#b89000',
    hcPink:   '#ff2288', hcPinkS:  '#bb0055',
    hcOrange: '#ff5500', hcOrangeS:'#cc2200',
    hcBlue:   '#2288ff', hcBlueS:  '#0055cc',
    hcGlass:  '#aaeeff',
    hcThrust: '#ff8800',
    hcTrail:  '#ffcc44',
    // Lava flow — unmistakably LAVA: vivid red-orange base, bright crack lines
    lavaA:    '#5a1800', lavaB:    '#4a1000', lavaC:    '#6a2000',
    lavaSide: '#2e0800',
    lavaCrack:'#ff7700', // orange crack glow
    lavaHot:  '#ffee00', // yellow-white hottest crack center
    lavaCool: '#cc2200',
    // Rock platform — clearly a rock chunk: warm brown-grey, visible texture
    platTop:  '#7a6858', platMid:  '#8a7868', platLight:'#9e8c7e',
    platSide: '#4a3828', platDark: '#2e2018',
    platEdge: '#ff8822', // lava-lit underside glow
    platCrack:'#3a2818',
    // Astronaut — orange suit stripe makes them instantly readable
    suitW:    '#dde0e8', suitS:    '#adb0b8', suitD:    '#7d8088',
    suitStripe:'#ff7700', suitStripeS:'#cc4400',
    visor:    '#ff9020', visorDark:'#cc6000', visorGlow:'#ffcc70',
    helmetR:  '#f0f0f8', helmetS:  '#c0c0c8',
    packTop:  '#e8c840', packSide: '#b89820',
    bootTop:  '#444860', bootSide: '#2a2c40',
    hitFlash: '#ff1010',
    outline:  'rgba(0,0,0,0.40)',
    shadow:   'rgba(0,0,0,0.35)',
    // Star field
    starA:    '#ffffff', starB:    '#e8d8ff', starC:    '#d8f0ff',
  };

  const HC_COLORS = [
    [C.hcNeon,   C.hcNeonS],
    [C.hcPurple, C.hcPurpleS],
    [C.hcYellow, C.hcYellowS],
    [C.hcPink,   C.hcPinkS],
    [C.hcOrange, C.hcOrangeS],
    [C.hcBlue,   C.hcBlueS],
  ];

  // ── Audio engine (Web Audio API, no files) ────────────────────────────────
  // AudioContext is created lazily on first user gesture to comply with
  // autoplay policies. All sounds are synthesized procedurally.
  let _ac = null;

  function _getAC () {
    if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
    if (_ac.state === 'suspended') _ac.resume();
    return _ac;
  }

  // Generic envelope helper: creates gain node with attack/decay/sustain/release
  function _adsr (ac, t, a, d, s, r) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + a);
    g.gain.linearRampToValueAtTime(s, t + a + d);
    g.gain.setValueAtTime(s, t + a + d + 0.001);
    g.gain.linearRampToValueAtTime(0, t + a + d + r);
    return g;
  }

  const SFX = {
    // Hop: quick pitched blip — feels snappy like Crossy Road
    hop () {
      try {
        const ac = _getAC(), t = ac.currentTime;
        const osc = ac.createOscillator();
        const g   = _adsr(ac, t, 0.002, 0.04, 0.0, 0.06);
        osc.type = 'square';
        osc.frequency.setValueAtTime(520, t);
        osc.frequency.linearRampToValueAtTime(680, t + 0.03);
        osc.connect(g); g.connect(ac.destination);
        osc.start(t); osc.stop(t + 0.12);
      } catch(e) {}
    },

    // Land: soft percussive thud
    land () {
      try {
        const ac = _getAC(), t = ac.currentTime;
        const buf = ac.createBuffer(1, ac.sampleRate * 0.08, ac.sampleRate);
        const d   = buf.getChannelData(0);
        for (let i=0; i<d.length; i++) d[i] = (Math.random()*2-1) * Math.exp(-i / (d.length * 0.25));
        const src = ac.createBufferSource();
        const filt= ac.createBiquadFilter();
        const g   = ac.createGain();
        src.buffer = buf;
        filt.type  = 'lowpass'; filt.frequency.value = 300;
        g.gain.setValueAtTime(0.55, t);
        g.gain.linearRampToValueAtTime(0, t + 0.08);
        src.connect(filt); filt.connect(g); g.connect(ac.destination);
        src.start(t);
      } catch(e) {}
    },

    // Vaporized: sharp descending laser zap
    vaporized () {
      try {
        const ac = _getAC(), t = ac.currentTime;
        const osc = ac.createOscillator();
        const g   = _adsr(ac, t, 0.003, 0.0, 0.6, 0.25);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(900, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.28);
        const dist = ac.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i=0; i<256; i++) { const x=i*2/256-1; curve[i]=x<0?-1:x>0.3?1:x/0.3; }
        dist.curve = curve;
        osc.connect(dist); dist.connect(g); g.connect(ac.destination);
        osc.start(t); osc.stop(t + 0.30);
      } catch(e) {}
    },

    // Incinerated (lava death): low bubbling hiss
    incinerated () {
      try {
        const ac = _getAC(), t = ac.currentTime;
        // Noise burst
        const buf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
        const d   = buf.getChannelData(0);
        for (let i=0; i<d.length; i++) d[i] = (Math.random()*2-1);
        const src  = ac.createBufferSource();
        const filt = ac.createBiquadFilter();
        const g    = ac.createGain();
        src.buffer = buf;
        filt.type  = 'bandpass'; filt.frequency.value = 180; filt.Q.value = 1.2;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.7, t + 0.04);
        g.gain.linearRampToValueAtTime(0.4, t + 0.2);
        g.gain.linearRampToValueAtTime(0,   t + 0.50);
        src.connect(filt); filt.connect(g); g.connect(ac.destination);
        src.start(t);
        // Low rumble oscillator
        const osc = ac.createOscillator();
        const g2  = ac.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(60, t);
        osc.frequency.linearRampToValueAtTime(30, t + 0.4);
        g2.gain.setValueAtTime(0.5, t);
        g2.gain.linearRampToValueAtTime(0, t + 0.4);
        osc.connect(g2); g2.connect(ac.destination);
        osc.start(t); osc.stop(t + 0.5);
      } catch(e) {}
    },

    // Milestone: ascending two-tone chime every 10 points
    milestone () {
      try {
        const ac = _getAC(), t = ac.currentTime;
        [523, 784, 1047].forEach((freq, i) => {
          const osc = ac.createOscillator();
          const g   = ac.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          const start = t + i * 0.10;
          g.gain.setValueAtTime(0, start);
          g.gain.linearRampToValueAtTime(0.4, start + 0.015);
          g.gain.linearRampToValueAtTime(0, start + 0.18);
          osc.connect(g); g.connect(ac.destination);
          osc.start(start); osc.stop(start + 0.20);
        });
      } catch(e) {}
    },
  };

  // ── RNG ───────────────────────────────────────────────────────────────────
  let _s = 1;
  function rng () { _s ^= _s<<13; _s ^= _s>>17; _s ^= _s<<5; return (_s>>>0)/0x100000000; }
  function rf (a,b) { return a+rng()*(b-a); }
  function ri (a,b) { return a+Math.floor(rng()*(b-a+1)); }
  function rp (a)   { return a[Math.floor(rng()*a.length)]; }
  function seed (n) { _s = Math.abs((n*1664525+1013904223)|0) || 1; }

  // ── Projection ────────────────────────────────────────────────────────────
  let camRow = 0;

  function proj (col, row, h) {
    const rel = row - camRow;
    return {
      x: OX + col * TW - rel * DX,
      y: OY             - rel * DY - h * BH,
    };
  }

  // ── Block primitive ───────────────────────────────────────────────────────
  function drawBlock (col, row, h, w, bh, topC, sideC, outlineC) {
    const p    = proj(col,   row,   h);
    const p2   = proj(col+w, row,   h);
    const pt   = proj(col,   row,   h+bh);
    const p2t  = proj(col+w, row,   h+bh);
    const pfar = proj(col,   row+1, h+bh);
    const p2f  = proj(col+w, row+1, h+bh);
    const sH   = bh * BH;

    // Near side
    ctx.beginPath();
    ctx.moveTo(p.x,  p.y);       ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p2.x, p2.y-sH);   ctx.lineTo(p.x,  p.y-sH);
    ctx.closePath();
    ctx.fillStyle = sideC; ctx.fill();

    // Top face
    ctx.beginPath();
    ctx.moveTo(pt.x,  pt.y);  ctx.lineTo(p2t.x, p2t.y);
    ctx.lineTo(p2f.x, p2f.y); ctx.lineTo(pfar.x,pfar.y);
    ctx.closePath();
    ctx.fillStyle = topC; ctx.fill();
    if (outlineC) { ctx.strokeStyle=outlineC; ctx.lineWidth=1.0; ctx.stroke(); }
  }

  function drawTile (col, row, topC, sideC) {
    drawBlock(col, row, 0, 1, SH/BH, topC, sideC, null);
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
    const diff = Math.min(Math.floor(r/6)*0.12, 0.9);
    const t = rng();
    if (t < 0.52) return _hoverLane(r, diff);
    if (t < 0.78) return _lavaLane(r, diff);
    return _safeLane(r, false);
  }

  function _safeLane (r, isStart) {
    seed(r * 2654435761 + 12345);
    const color = rp([C.rockA, C.rockB, C.rockC]);
    const crystals = [];
    if (!isStart) {
      for (let c=0; c<COLS; c++) {
        if (rng() < 0.13) crystals.push({ col:c, variant:ri(0,2) });
      }
    }
    return { type:'safe', color, side:C.rockSide, objs:crystals, speed:0, dir:1 };
  }

  function _hoverLane (r, diff) {
    seed(r * 2654435761 + 99991);
    const color = rng()<0.5 ? C.hoverA : C.hoverB;
    const dir   = rng()<0.5 ? 1 : -1;
    const speed = rf(2.5+diff*2.5, 4.5+diff*5.0);
    const count = ri(1, 2+Math.floor(diff*3));
    const spacing = COLS/count;
    const crafts = [];
    for (let i=0; i<count; i++) {
      const w = ri(1, 2+(diff>0.3?1:0));
      crafts.push({ x:i*spacing+rng()*spacing*0.5, w, ci:ri(0,HC_COLORS.length-1), type:ri(0,1) });
    }
    return { type:'road', color, side:C.hoverSide, objs:crafts, speed, dir };
  }

  function _lavaLane (r, diff) {
    seed(r * 2654435761 + 77777);
    const color = rp([C.lavaA, C.lavaB, C.lavaC]);
    const dir   = rng()<0.5 ? 1 : -1;
    const speed = rf(1.0+diff*1.2, 2.2+diff*2.0);
    const count = ri(2, 3+(diff>0.4?1:0));
    const spacing = COLS/count;
    const plats = [];
    for (let i=0; i<count; i++) {
      plats.push({ x:i*spacing+rng()*spacing*0.25, w:rf(1.4,2.2) });
    }
    return { type:'water', color, side:C.lavaSide, objs:plats, speed, dir };
  }

  // ── Terrain rendering ─────────────────────────────────────────────────────
  function renderLane (r) {
    const lane = getLane(r);
    if (!lane) return;

    for (let c=0; c<COLS; c++) drawTile(c, r, lane.color, lane.side);

    if (lane.type==='road') {
      _renderHoverMarkings(r, lane);
      for (const obj of lane.objs) renderHovercraft(r, obj, lane.dir);
    }
    if (lane.type==='water') {
      _renderLavaGlow(r);
      for (const obj of lane.objs) renderRockPlatform(r, obj);
    }
    if (lane.type==='safe') {
      for (const obj of lane.objs) renderCrystal(obj.col, r, obj.variant);
    }
  }

  // Bright neon grid on hover lanes — unmistakably a high-tech road
  function _renderHoverMarkings (r, lane) {
    // Full-width bright edge stripe at the near edge of the lane
    const edgeA = proj(0,    r, SH/BH+0.02);
    const edgeB = proj(COLS, r, SH/BH+0.02);
    ctx.save();
    ctx.strokeStyle = C.hoverEdge;
    ctx.lineWidth   = 2.5;
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(edgeA.x, edgeA.y); ctx.lineTo(edgeB.x, edgeB.y); ctx.stroke();
    ctx.restore();

    // Animated neon dash lines running along the lane
    const t = performance.now() * 0.0008 * lane.dir;
    for (let c=0; c<COLS; c++) {
      const phase = ((c + t) % 2);
      if (phase > 1) continue;
      const mid  = proj(c + 0.5, r + 0.5, SH/BH + 0.02);
      const midf = proj(c + 0.5, r + 0.5 + 0.35, SH/BH + 0.02);
      ctx.save();
      ctx.strokeStyle = C.hoverLine;
      ctx.lineWidth   = 2;
      ctx.globalAlpha = 0.7 * (1 - phase);
      ctx.beginPath(); ctx.moveTo(mid.x, mid.y); ctx.lineTo(midf.x, midf.y); ctx.stroke();
      ctx.restore();
    }
  }

  // Lava: bright glowing cracks between tiles — reads as molten rock immediately
  function _renderLavaGlow (r) {
    const t = performance.now() * 0.0018;

    // Thick glowing veins between tile columns
    for (let c=0; c<=COLS; c++) {
      const pulse = 0.60 + 0.40 * Math.abs(Math.sin(c * 1.7 + r * 0.9 + t));
      const pa = proj(c, r,   SH/BH + 0.005);
      const pb = proj(c, r+1, SH/BH + 0.005);
      // Wide outer glow
      ctx.save();
      ctx.strokeStyle = C.lavaCrack;
      ctx.lineWidth   = 4.5;
      ctx.globalAlpha = pulse * 0.80;
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
      // Bright inner core
      ctx.strokeStyle = C.lavaHot;
      ctx.lineWidth   = 1.5;
      ctx.globalAlpha = pulse * 0.60;
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
      ctx.restore();
    }

    // Horizontal crack at the near edge of the lane
    const ha = proj(0,    r, SH/BH + 0.005);
    const hb = proj(COLS, r, SH/BH + 0.005);
    const pulse2 = 0.65 + 0.35 * Math.abs(Math.sin(r * 2.1 + t * 1.3));
    ctx.save();
    ctx.strokeStyle = C.lavaCrack; ctx.lineWidth = 4.5; ctx.globalAlpha = pulse2 * 0.90;
    ctx.beginPath(); ctx.moveTo(ha.x, ha.y); ctx.lineTo(hb.x, hb.y); ctx.stroke();
    ctx.strokeStyle = C.lavaHot;   ctx.lineWidth = 1.5; ctx.globalAlpha = pulse2 * 0.60;
    ctx.beginPath(); ctx.moveTo(ha.x, ha.y); ctx.lineTo(hb.x, hb.y); ctx.stroke();
    ctx.restore();
  }

  // ── Hovercraft rendering ──────────────────────────────────────────────────
  function renderHovercraft (r, craft, dir) {
    const [topC, sideC] = HC_COLORS[craft.ci % HC_COLORS.length];
    const x=craft.x, w=craft.w;
    const gH=SH/BH;

    // Exhaust trail behind craft (drawn first, underneath)
    _drawExhaustTrail(x, r, w, dir, topC);

    // Hover skirt — wide bright-edged base that reads as "floating"
    drawBlock(x+0.02, r+0.02, gH, w-0.04, 0.12, _mix(topC,'#ffffff',0.10), _mix(sideC,'#000',0.2), C.outline);

    // Main body
    drawBlock(x+0.08, r+0.08, gH+0.12, w-0.16, 0.46, topC, sideC, C.outline);

    // Cockpit dome
    if (craft.type===0) {
      const dw=(w-0.16)*0.50, dc=(w-0.16-dw)/2;
      drawBlock(x+0.08+dc, r+0.10, gH+0.58, dw, 0.32,
        _mix(topC,'#ffffff',0.28), _mix(sideC,'#000',0.05), C.outline);
      // Glass visor
      const vp  = proj(x+0.08+dc+0.05, r+0.12, gH+0.76);
      const vp2 = proj(x+0.08+dc+dw-0.05, r+0.12, gH+0.76);
      ctx.save(); ctx.globalAlpha=0.65; ctx.fillStyle=C.hcGlass;
      ctx.beginPath(); ctx.moveTo(vp.x,vp.y); ctx.lineTo(vp2.x,vp2.y);
      ctx.lineTo(vp2.x,vp2.y-BH*0.20); ctx.lineTo(vp.x,vp.y-BH*0.20); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // Pulsing thrust pods underneath
    _drawThrustGlow(x, r, w, gH, topC);
  }

  function _drawExhaustTrail (x, r, w, dir, col) {
    // Trail extends behind the craft in its travel direction
    const trailDir = dir > 0 ? -1 : 1;  // trail goes opposite to movement
    const trailLen = 1.2;
    for (let i=0; i<6; i++) {
      const frac = i / 6;
      const tx2  = x + w*0.5 + trailDir * (0.3 + frac * trailLen);
      const p    = proj(tx2, r + 0.45, SH/BH + 0.06);
      const radius = BH * (0.10 - frac * 0.07);
      if (radius <= 0) continue;
      ctx.save();
      ctx.globalAlpha = 0.55 * (1 - frac) * (0.6 + 0.4 * Math.abs(Math.sin(performance.now()*0.006 + i)));
      ctx.fillStyle   = i < 2 ? C.hcThrust : C.hcTrail;
      ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  function _drawThrustGlow (x, r, w, gH, col) {
    const t = performance.now()*0.005;
    for (let i=0; i<3; i++) {
      const glow = 0.5 + 0.5 * Math.abs(Math.sin(t + x + i));
      const px2  = proj(x + 0.18 + i * (w-0.36) * 0.5, r + 0.48, gH - 0.08);
      ctx.save();
      ctx.globalAlpha = glow * 0.85;
      ctx.fillStyle   = C.hcThrust;
      ctx.beginPath(); ctx.arc(px2.x, px2.y, BH*0.085, 0, Math.PI*2); ctx.fill();
      // Inner white-hot core
      ctx.globalAlpha = glow * 0.60;
      ctx.fillStyle   = '#ffffff';
      ctx.beginPath(); ctx.arc(px2.x, px2.y, BH*0.035, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  function _mix (hex, hex2, t) {
    const parse = h => [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
    const [r1,g1,b1]=parse(hex), [r2,g2,b2]=parse(hex2);
    return `rgb(${~~(r1+(r2-r1)*t)},${~~(g1+(g2-g1)*t)},${~~(b1+(b2-b1)*t)})`;
  }

  // ── Rock platform rendering ───────────────────────────────────────────────
  // Reads as a chunky boulder floating over lava:
  //   • Warm brown-grey base (clearly rock, not metal)
  //   • Raised texture patches on top (lighter/darker blocks) = rocky surface
  //   • Bright orange lava-glow on the underside = hovering over heat
  //   • Shadow cast downward = clearly elevated above the lava
  function renderRockPlatform (r, plat) {
    const gH  = SH/BH;
    const pH  = 0.35;  // platform height
    const x   = plat.x, w = plat.w;
    const rOff= 0.06;  // row inset

    // Drop shadow — dark pool on the lava below, proves it's floating
    const sA = proj(x+0.15,   r+rOff+0.15, gH-0.05);
    const sB = proj(x+w-0.15, r+rOff+0.15, gH-0.05);
    const sC2= proj(x+w-0.15, r+rOff+0.85, gH-0.05);
    const sD = proj(x+0.15,   r+rOff+0.85, gH-0.05);
    ctx.save(); ctx.globalAlpha=0.50; ctx.fillStyle='#000';
    ctx.beginPath(); ctx.moveTo(sA.x,sA.y); ctx.lineTo(sB.x,sB.y); ctx.lineTo(sC2.x,sC2.y); ctx.lineTo(sD.x,sD.y); ctx.closePath(); ctx.fill(); ctx.restore();

    // Main rock body — warm brown-grey
    drawBlock(x+0.05, r+rOff, gH, w-0.10, pH, C.platTop, C.platSide, C.outline);

    // Rocky texture: 2-3 raised sub-patches on top surface (lighter tone)
    // These make the flat top read as uneven stone rather than a slab
    const patches = Math.max(2, Math.floor(w * 1.5));
    for (let i=0; i<patches; i++) {
      // Use lane row + platform pos as deterministic seed
      const px = x + 0.08 + (w-0.16) * (i / patches) + 0.04;
      const pz = r + rOff + 0.12 + (i%2) * 0.22;
      const pw2 = 0.28 + (i%3)*0.08;
      const pd2 = 0.20 + (i%2)*0.12;
      // Alternate light and mid tones
      const tC  = i%2===0 ? C.platLight : C.platMid;
      const sC3 = i%2===0 ? C.platTop   : C.platSide;
      drawBlock(px, pz, gH+pH, pw2, pd2, 0.06, tC, sC3, null);
    }

    // Lava-orange glowing underside edge — THE key "floating over lava" read
    const pulse = 0.7 + 0.3 * Math.abs(Math.sin(performance.now()*0.0022 + x));
    const eA = proj(x+0.05,   r+rOff, gH+0.005);
    const eB = proj(x+w-0.05, r+rOff, gH+0.005);
    ctx.save();
    ctx.strokeStyle = C.platEdge; ctx.lineWidth = 4; ctx.globalAlpha = pulse*0.90;
    ctx.beginPath(); ctx.moveTo(eA.x, eA.y); ctx.lineTo(eB.x, eB.y); ctx.stroke();
    ctx.strokeStyle = C.lavaHot;  ctx.lineWidth = 1.5; ctx.globalAlpha = pulse*0.55;
    ctx.beginPath(); ctx.moveTo(eA.x, eA.y-1); ctx.lineTo(eB.x, eB.y-1); ctx.stroke();
    ctx.restore();
  }

  // ── Crystal spire rendering ───────────────────────────────────────────────
  // Teal/cyan crystals on purple ground — maximum contrast, reads as obstacle
  function renderCrystal (col, row, variant) {
    const gH=SH/BH;
    const configs = [
      // variant 0: single tall spire + two small flankers
      [{x:0.10,z:0.30,w:0.22,bh:0.50},{x:0.68,z:0.28,w:0.22,bh:0.40},  // flankers
       {x:0.28,z:0.18,w:0.44,bh:0.65},{x:0.36,z:0.22,w:0.28,bh:1.10}], // main
      // variant 1: two equal spires
      [{x:0.08,z:0.16,w:0.38,bh:0.55},{x:0.10,z:0.20,w:0.24,bh:0.95},
       {x:0.52,z:0.18,w:0.38,bh:0.50},{x:0.54,z:0.22,w:0.24,bh:0.85}],
      // variant 2: wide flat cluster
      [{x:0.06,z:0.14,w:0.88,bh:0.38},{x:0.18,z:0.18,w:0.64,bh:0.58},{x:0.32,z:0.24,w:0.36,bh:0.80}],
    ];
    const shards = configs[variant % configs.length];

    for (let i=0; i<shards.length; i++) {
      const s=shards[i];
      // Tips get the bright white-cyan; base gets medium teal
      const isTip = i >= shards.length - 2;
      const tC = isTip ? C.xtalTipA : C.xtalBase;
      const sC = isTip ? C.xtalTipB : C.xtalSide;
      drawBlock(col+s.x, row+s.z, gH, s.w, s.bh, tC, sC, 'rgba(0,0,0,0.50)');
    }

    // Large animated glow halo — makes crystals visible from a distance
    const tip = shards[shards.length-1];
    const tipP = proj(col+tip.x+tip.w*0.5, row+tip.z+0.2, gH+tip.bh+0.20);
    const glowA = 0.30 + 0.22*Math.abs(Math.sin(performance.now()*0.0025+col*1.8));
    ctx.save();
    const grd = ctx.createRadialGradient(tipP.x,tipP.y,0, tipP.x,tipP.y, BH*0.38);
    grd.addColorStop(0, C.xtalGlow);
    grd.addColorStop(1, 'rgba(160,255,252,0)');
    ctx.globalAlpha = glowA;
    ctx.fillStyle   = grd;
    ctx.beginPath(); ctx.arc(tipP.x, tipP.y, BH*0.38, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // ── Astronaut rendering ───────────────────────────────────────────────────
  function renderAstronaut (col, row, h, suitColor, squish, alpha) {
    ctx.save();
    if (alpha != null) ctx.globalAlpha = alpha;

    const gH  = SH/BH;
    const base = gH + h;

    // Shadow
    const sp=proj(col+0.1,row+0.9,0), sp2=proj(col+0.9,row+0.9,0);
    const sf=proj(col+0.1,row+1.5,0), sf2=proj(col+0.9,row+1.5,0);
    ctx.save(); ctx.globalAlpha=(alpha??1)*0.25; ctx.fillStyle='#000';
    ctx.beginPath(); ctx.moveTo(sp.x,sp.y); ctx.lineTo(sp2.x,sp2.y); ctx.lineTo(sf2.x,sf2.y); ctx.lineTo(sf.x,sf.y); ctx.closePath(); ctx.fill(); ctx.restore();

    // Boots
    drawBlock(col+0.14, row+0.65, base,          0.28, 0.18, C.bootTop, C.bootSide, C.outline);
    drawBlock(col+0.58, row+0.65, base,          0.28, 0.18, C.bootTop, C.bootSide, C.outline);

    // Legs
    drawBlock(col+0.18, row+0.45, base+0.18,     0.22, 0.24, suitColor, C.suitS,    C.outline);
    drawBlock(col+0.58, row+0.45, base+0.18,     0.22, 0.24, suitColor, C.suitS,    C.outline);

    // Body (chunky torso)
    drawBlock(col+0.12, row+0.16, base+0.42,     0.76, 0.60, suitColor, C.suitS,    C.outline);

    // Orange stripe across chest — the key "astronaut suit" read cue
    drawBlock(col+0.12, row+0.16, base+0.42+0.18, 0.76, 0.16, C.suitStripe, C.suitStripeS, C.outline);

    // Life-support backpack (on the back = far side, so render behind body)
    drawBlock(col+0.20, row+0.68, base+0.42,     0.60, 0.20, C.packTop, C.packSide, C.outline);

    // Arms
    drawBlock(col+0.02, row+0.20, base+0.54,     0.18, 0.50, suitColor, C.suitD,    C.outline);
    drawBlock(col+0.80, row+0.20, base+0.54,     0.18, 0.50, suitColor, C.suitD,    C.outline);

    // Helmet sphere (rounded by stacking 3 blocks)
    const hBase = base + 0.42 + 0.60*squish;
    drawBlock(col+0.18, row+0.14, hBase,          0.64, 0.58, C.helmetR,  C.helmetS,  C.outline);
    drawBlock(col+0.24, row+0.18, hBase+0.58,     0.52, 0.44, C.helmetR,  C.helmetS,  C.outline);

    // Visor — orange/amber tinted glass
    const vp  = proj(col+0.26, row+0.16, hBase+0.15);
    const vp2 = proj(col+0.74, row+0.16, hBase+0.15);
    ctx.save(); ctx.globalAlpha=(alpha??1)*0.85; ctx.fillStyle=C.visor;
    ctx.beginPath(); ctx.moveTo(vp.x,vp.y); ctx.lineTo(vp2.x,vp2.y); ctx.lineTo(vp2.x,vp2.y-BH*0.30); ctx.lineTo(vp.x,vp.y-BH*0.30); ctx.closePath(); ctx.fill();
    // Visor reflection
    ctx.globalAlpha=(alpha??1)*0.40; ctx.fillStyle=C.visorGlow;
    ctx.beginPath(); ctx.moveTo(vp.x+BH*0.06,vp.y-BH*0.22); ctx.lineTo(vp.x+BH*0.18,vp.y-BH*0.22); ctx.lineTo(vp.x+BH*0.18,vp.y-BH*0.10); ctx.lineTo(vp.x+BH*0.06,vp.y-BH*0.10); ctx.closePath(); ctx.fill();
    ctx.restore();

    // Antenna
    const antp = proj(col+0.72, row+0.18, hBase+1.02);
    const antb = proj(col+0.72, row+0.18, hBase+0.60);
    ctx.save(); ctx.globalAlpha=(alpha??1); ctx.strokeStyle='#c8c0b8'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(antb.x,antb.y); ctx.lineTo(antp.x,antp.y); ctx.stroke();
    ctx.fillStyle='#ffee88'; ctx.beginPath(); ctx.arc(antp.x,antp.y,BH*0.055,0,Math.PI*2); ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  // ── State ─────────────────────────────────────────────────────────────────
  let state = 'start';
  let score = 0;
  let best  = parseInt(localStorage.getItem('fr_best')||'0', 10);

  let player = { col:HALF_COLS, row:0 };
  let alive  = true;

  const JUMP_DUR = 0.15;
  let jumping=false, jumpT=0;
  let jumpFrom={col:0,row:0}, jumpTo={col:0,row:0};
  let deathTimer=0, deathKind='hit', deathCol=0, deathRow=0;

  // ── Input ─────────────────────────────────────────────────────────────────
  let tx0=0, ty0=0;
  document.addEventListener('keydown', e=>{
    if (e.key==='Enter'||e.key===' ') {
      if (state==='dead'||state==='start') { e.preventDefault(); startGame(); return; }
    }
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
    if (dir==='f') dr=1; if (dir==='b') dr=-1;
    if (dir==='l') dc=-1; if (dir==='r') dc=1;
    const nc=player.col+dc, nr=player.row+dr;
    if (nc<0||nc>=COLS||nr<0) return;
    const lane=getLane(nr);
    if (lane&&lane.type==='safe') {
      for (const t of lane.objs) if (Math.round(nc)===t.col) return;
    }
    jumpFrom={col:player.col,row:player.row};
    jumpTo={col:nc,row:nr};
    jumping=true; jumpT=0;
    SFX.hop();
  }

  // ── Update ────────────────────────────────────────────────────────────────
  function update (dt) {
    if (state!=='playing') return;

    if (jumping) {
      jumpT+=dt;
      if (jumpT>=JUMP_DUR) {
        player.col=jumpTo.col; player.row=jumpTo.row;
        jumping=false;
        SFX.land();
        if (player.row>score) {
          score=player.row; _setScore(score);
          if (score > 0 && score % 10 === 0) SFX.milestone();
        }
      }
    }

    const vs=Math.max(0,Math.floor(camRow)-2), ve=Math.floor(camRow)+VIS_ROWS+2;
    for (let r=vs; r<=ve; r++) {
      const lane=getLane(r);
      if (!lane||(lane.type!=='road'&&lane.type!=='water')) continue;
      for (const obj of lane.objs) {
        obj.x+=lane.dir*lane.speed*dt;
        const span=COLS+(obj.w||1)+2;
        if (lane.dir>0&&obj.x>COLS+1)           obj.x-=span;
        if (lane.dir<0&&obj.x<-(obj.w||1)-1)    obj.x+=span;
      }
    }

    const targetCam=player.row-3;
    camRow+=(targetCam-camRow)*Math.min(dt*8,1);

    if (alive&&!jumping) _collide();
    if (!alive) { deathTimer+=dt; if (deathTimer>1.5) _showDead(); }
  }

  function _collide () {
    const lane=getLane(player.row);
    if (!lane) return;
    const pc=player.col+0.18, pw=0.64;
    if (lane.type==='road') {
      for (const obj of lane.objs) {
        if (pc<obj.x+obj.w-0.05&&pc+pw>obj.x+0.05) { _die('hit'); return; }
      }
    }
    if (lane.type==='water') {
      let on=false;
      for (const obj of lane.objs) {
        if (pc<obj.x+obj.w&&pc+pw>obj.x) {
          on=true;
          player.col+=lane.dir*lane.speed*(1/60);
          player.col=Math.max(0.1,Math.min(COLS-1.1,player.col));
          break;
        }
      }
      if (!on) _die('lava');
    }
  }

  function _die (kind) {
    alive=false; deathKind=kind; deathTimer=0;
    deathCol=player.col; deathRow=player.row;
    if (score>best) { best=score; localStorage.setItem('fr_best',best); }
    if (kind==='hit') SFX.vaporized(); else SFX.incinerated();
  }

  function _showDead () {
    state='dead';
    const isHit=deathKind==='hit';
    document.getElementById('dead-emoji').textContent = isHit?'💥':'🌋';
    document.getElementById('dead-title').textContent = isHit?'Vaporized':'Incinerated';
    document.getElementById('final-score').textContent= score;
    document.getElementById('best-score').textContent = 'Best: '+best;
    document.getElementById('dead-overlay').classList.remove('hidden');
  }

  function _setScore (v) {
    document.getElementById('score-display').textContent   = v;
    document.getElementById('panel-score-val').textContent = v;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  // Precompute star positions (fixed seed)
  const STARS = (() => {
    const arr=[]; let ss=987654321;
    for (let i=0; i<120; i++) {
      ss^=ss<<13; ss^=ss>>17; ss^=ss<<5;
      const x=(ss>>>0)/0x100000000;
      ss^=ss<<13; ss^=ss>>17; ss^=ss<<5;
      const y=(ss>>>0)/0x100000000;
      ss^=ss<<13; ss^=ss>>17; ss^=ss<<5;
      const r=(ss>>>0)/0x100000000;
      arr.push({x,y:y*0.55, r:0.5+r*1.5, c:[C.starA,C.starB,C.starC][i%3]});
    }
    return arr;
  })();

  function render () {
    const W=canvas.width, H=canvas.height;
    ctx.clearRect(0,0,W,H);

    // Deep space sky
    const sky=ctx.createLinearGradient(0,0,0,H*0.65);
    sky.addColorStop(0,'#08060e');
    sky.addColorStop(0.5,'#1a0a2e');
    sky.addColorStop(1,'#2a1040');
    ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);

    // Distant planet
    const px=W*0.78, py=H*0.14, pr=H*0.09;
    const grad=ctx.createRadialGradient(px-pr*0.3,py-pr*0.3,pr*0.1, px,py,pr);
    grad.addColorStop(0,'#e8803a'); grad.addColorStop(0.6,'#c85020'); grad.addColorStop(1,'#601810');
    ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(px,py,pr,0,Math.PI*2); ctx.fill();
    // Planet rings
    ctx.save(); ctx.translate(px,py); ctx.scale(1,0.28);
    ctx.strokeStyle='rgba(200,120,60,0.4)'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.arc(0,0,pr*1.5,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle='rgba(200,120,60,0.2)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(0,0,pr*1.75,0,Math.PI*2); ctx.stroke();
    ctx.restore();

    // Stars
    for (const s of STARS) {
      const flicker=0.6+0.4*Math.abs(Math.sin(performance.now()*0.0008+s.x*10));
      ctx.save(); ctx.globalAlpha=flicker; ctx.fillStyle=s.c;
      ctx.beginPath(); ctx.arc(s.x*W, s.y*H, s.r, 0, Math.PI*2); ctx.fill(); ctx.restore();
    }

    // Terrain — far to near
    const drawEnd  =Math.floor(camRow)+VIS_ROWS+2;
    const drawStart=Math.max(0,Math.floor(camRow)-1);
    for (let r=drawEnd; r>=drawStart; r--) renderLane(r);

    // Player landing indicator (drawn before player so it appears under them)
    _renderLandingIndicator();

    // Player
    _renderPlayer();
  }

  // Glowing ring on the ground tile the player occupies / is jumping toward
  function _renderLandingIndicator () {
    if (!alive) return;

    const pulse = 0.55 + 0.45 * Math.abs(Math.sin(performance.now() * 0.004));

    if (jumping) {
      // Show target ring at destination — pulses faster during jump
      const fastPulse = 0.5 + 0.5 * Math.abs(Math.sin(performance.now() * 0.012));
      _drawRing(jumpTo.col + 0.5, jumpTo.row + 0.45, '#ffffff', fastPulse * 0.85, TW * 0.52, TW * 0.14);
      _drawRing(jumpTo.col + 0.5, jumpTo.row + 0.45, '#00ffcc', fastPulse * 0.55, TW * 0.36, TW * 0.07);
    } else {
      // Standing ring under player
      _drawRing(player.col + 0.5, player.row + 0.45, '#ffffff', pulse * 0.45, TW * 0.50, TW * 0.12);
      _drawRing(player.col + 0.5, player.row + 0.45, '#00ffcc', pulse * 0.30, TW * 0.34, TW * 0.06);
    }
  }

  function _drawRing (col, row, color, alpha, rx, ry) {
    const p = proj(col, row, SH / BH + 0.01);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function _renderPlayer () {
    let rc=player.col, rr=player.row, rh=0, sq=1, alpha=1;

    if (jumping) {
      const n=Math.min(jumpT/JUMP_DUR,1);
      const e=n<0.5?2*n*n:-1+(4-2*n)*n;
      rc=jumpFrom.col+(jumpTo.col-jumpFrom.col)*e;
      rr=jumpFrom.row+(jumpTo.row-jumpFrom.row)*e;
      rh=Math.sin(Math.PI*n)*0.55;
      sq=1+Math.sin(Math.PI*n)*0.10;
    }

    if (!alive) {
      rc=deathCol; rr=deathRow;
      alpha=Math.max(0,1-deathTimer*1.8);
      if (deathKind==='hit') {
        sq=Math.max(0.2,1-deathTimer*2.5);
        const flash=Math.floor(deathTimer*10)%2===0;
        renderAstronaut(rc,rr,0, flash?C.hitFlash:C.suitW, sq, alpha);
        // Explosion particles
        _drawExplosion(rc,rr, deathTimer);
      } else {
        // Sink into lava
        renderAstronaut(rc,rr,Math.max(-0.35,rh-deathTimer*0.35), C.suitW, sq, alpha);
      }
      return;
    }

    renderAstronaut(rc,rr,rh, C.suitW, sq, alpha);
  }

  function _drawExplosion (col, row, t) {
    if (t>0.6) return;
    const count=8;
    for (let i=0; i<count; i++) {
      const angle=(i/count)*Math.PI*2;
      const dist=t*2.5;
      const ec=col+0.5+Math.cos(angle)*dist;
      const er=row+0.5+Math.sin(angle)*dist*0.4;
      const p=proj(ec,er,SH/BH+0.2+t*0.5);
      const size=BH*(0.12-t*0.15);
      if (size<=0) continue;
      ctx.save();
      ctx.globalAlpha=Math.max(0,0.9-t*2);
      ctx.fillStyle=i%2===0?'#ff9900':'#ffdd00';
      ctx.beginPath(); ctx.arc(p.x,p.y,size,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  // ── Resize ────────────────────────────────────────────────────────────────
  function resize () {
    const area=document.getElementById('game-area');
    const W=area.clientWidth||window.innerWidth;
    const H=area.clientHeight||window.innerHeight;
    canvas.width=W; canvas.height=H;
    OX=(W-TW*COLS)/2;
    OY=H*0.82;
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

  let last=0;
  function loop (ts) {
    const dt=Math.min((ts-last)/1000,0.05);
    last=ts; update(dt); render();
    requestAnimationFrame(loop);
  }

  resize();
  document.getElementById('panel-best-val').textContent=best;
  for (let r=0;r<VIS_ROWS+4;r++) getLane(r);
  requestAnimationFrame(loop);

})();
