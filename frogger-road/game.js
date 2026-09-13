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
    // Safe / rock fields — dusty purple alien terrain
    rockA:    '#7a5c9e', rockB:    '#6a4c8e', rockC:    '#8a6cb0',
    rockSide: '#4a3468',
    // Crystal spires (replace trees)
    xtalBase: '#9860c8', xtalSide: '#6a3898', xtalDark: '#4a2878',
    xtalTipA: '#e0b0ff', xtalTipB: '#c890ff', xtalGlow: '#f0d8ff',
    // Hover lane — dark teal energy road
    hoverA:   '#1a3a4a', hoverB:   '#142e3c',
    hoverSide:'#0c1e28',
    hoverLine:'#00e8c8', // teal energy stripe
    // Hovercraft colors
    hcNeon:   '#00ffcc', hcNeonS:  '#009988',
    hcPurple: '#cc44ff', hcPurpleS:'#882abb',
    hcYellow: '#ffe030', hcYellowS:'#b8a010',
    hcPink:   '#ff4499', hcPinkS:  '#cc1166',
    hcOrange: '#ff6600', hcOrangeS:'#cc4400',
    hcBlue:   '#3388ff', hcBlueS:  '#1155cc',
    hcGlass:  '#88eeff',
    hcThrust: '#ff9900',
    // Lava flow — deep orange/red hazard
    lavaA:    '#c84800', lavaB:    '#b03800', lavaC:    '#e05800',
    lavaSide: '#882800',
    lavaGlow: '#ff9940',
    // Rock platform (rides over lava)
    platTop:  '#706070', platSide: '#504050', platDark: '#303030',
    platCrack:'#403040',
    // Astronaut
    suitW:    '#e8e4dc', suitS:    '#b8b4ac', suitD:    '#888480',
    visor:    '#ff9020', visorDark:'#cc6000', visorGlow:'#ffcc70',
    helmetR:  '#f0ece4', helmetS:  '#c0bcb4',
    packTop:  '#c8b870', packSide: '#a89850',
    bootTop:  '#888090', bootSide: '#585060',
    hitFlash: '#ff2020',
    outline:  'rgba(0,0,0,0.35)',
    shadow:   'rgba(0,0,0,0.30)',
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

  // Teal energy dashes on hover lanes
  function _renderHoverMarkings (r, lane) {
    for (let c=0; c<COLS; c++) {
      if ((c+r) % 2 === 0) continue;
      const pa = proj(c+0.2, r,   SH/BH+0.01);
      const pb = proj(c+0.8, r,   SH/BH+0.01);
      const pc2= proj(c+0.8, r+1, SH/BH+0.01);
      const pd = proj(c+0.2, r+1, SH/BH+0.01);
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = C.hoverLine;
      ctx.beginPath();
      ctx.moveTo((pa.x+pd.x)*0.5,(pa.y+pd.y)*0.5);
      ctx.lineTo((pb.x+pc2.x)*0.5,(pb.y+pc2.y)*0.5);
      ctx.lineTo((pb.x+pc2.x)*0.5,(pb.y+pc2.y)*0.5+3);
      ctx.lineTo((pa.x+pd.x)*0.5,(pa.y+pd.y)*0.5+3);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  // Lava glow shimmer
  function _renderLavaGlow (r) {
    const t = performance.now()*0.0012;
    for (let c=0; c<COLS; c++) {
      const a = 0.08+0.10*Math.abs(Math.sin(c*2.1+r*0.6+t));
      const pa = proj(c+0.05, r+0.1,  SH/BH+0.01);
      const pb = proj(c+0.95, r+0.1,  SH/BH+0.01);
      const pc2= proj(c+0.95, r+0.9,  SH/BH+0.01);
      const pd = proj(c+0.05, r+0.9,  SH/BH+0.01);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = C.lavaGlow;
      ctx.beginPath(); ctx.moveTo(pa.x,pa.y); ctx.lineTo(pb.x,pb.y); ctx.lineTo(pc2.x,pc2.y); ctx.lineTo(pd.x,pd.y); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  // ── Hovercraft rendering ──────────────────────────────────────────────────
  function renderHovercraft (r, craft, dir) {
    const [topC, sideC] = HC_COLORS[craft.ci % HC_COLORS.length];
    const x=craft.x, w=craft.w;
    const gH=SH/BH;

    // Hover skirt (flat wide base, slightly darker)
    drawBlock(x+0.02, r+0.02, gH, w-0.04, 0.14, _mix(topC,'#000',0.25), _mix(sideC,'#000',0.3), C.outline);

    // Main body
    drawBlock(x+0.10, r+0.10, gH+0.14, w-0.20, 0.44, topC, sideC, C.outline);

    // Cockpit dome (type 0) or flat top (type 1)
    if (craft.type===0) {
      const dw=(w-0.20)*0.48, dc=(w-0.20-dw)/2;
      drawBlock(x+0.10+dc, r+0.12, gH+0.58, dw, 0.30,
        _mix(topC,'#ffffff',0.25), _mix(sideC,'#000',0.05), C.outline);
      // Visor glass
      const vp  = proj(x+0.10+dc+0.06, r+0.14, gH+0.75);
      const vp2 = proj(x+0.10+dc+dw-0.06, r+0.14, gH+0.75);
      ctx.save(); ctx.globalAlpha=0.6; ctx.fillStyle=C.hcGlass;
      ctx.beginPath(); ctx.moveTo(vp.x,vp.y); ctx.lineTo(vp2.x,vp2.y); ctx.lineTo(vp2.x,vp2.y-BH*0.18); ctx.lineTo(vp.x,vp.y-BH*0.18); ctx.closePath(); ctx.fill(); ctx.restore();
    }

    // Thrust glow underneath (small orange dots)
    _drawThrustGlow(x, r, w, gH, topC);
  }

  function _drawThrustGlow (x, r, w, gH, col) {
    const t = performance.now()*0.004;
    const glow = Math.abs(Math.sin(t + x))*0.5+0.4;
    const p1 = proj(x+0.18, r+0.5, gH-0.06);
    const p2 = proj(x+w-0.22, r+0.5, gH-0.06);
    ctx.save();
    ctx.globalAlpha = glow*0.8;
    ctx.fillStyle = C.hcThrust;
    ctx.beginPath(); ctx.arc(p1.x, p1.y, BH*0.09, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(p2.x, p2.y, BH*0.09, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  function _mix (hex, hex2, t) {
    const parse = h => [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
    const [r1,g1,b1]=parse(hex), [r2,g2,b2]=parse(hex2);
    return `rgb(${~~(r1+(r2-r1)*t)},${~~(g1+(g2-g1)*t)},${~~(b1+(b2-b1)*t)})`;
  }

  // ── Rock platform rendering ───────────────────────────────────────────────
  function renderRockPlatform (r, plat) {
    const gH=SH/BH;
    // Main slab
    drawBlock(plat.x, r+0.08, gH, plat.w, 0.28, C.platTop, C.platSide, C.outline);
    // Crack details
    const segs=Math.max(1,Math.round(plat.w));
    for (let i=1; i<segs; i++) {
      const xp=plat.x+(plat.w/segs)*i;
      const pa=proj(xp+0.05, r+0.08, gH+0.28);
      const pb=proj(xp-0.05, r+0.08+0.7, gH+0.28);
      ctx.save(); ctx.globalAlpha=0.35; ctx.strokeStyle=C.platCrack; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(pa.x,pa.y); ctx.lineTo(pb.x,pb.y); ctx.stroke(); ctx.restore();
    }
    // Lava glow on edge
    const p1=proj(plat.x, r+0.08, gH); const p2=proj(plat.x+plat.w, r+0.08, gH);
    ctx.save(); ctx.globalAlpha=0.45; ctx.strokeStyle=C.lavaGlow; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(p1.x,p1.y-2); ctx.lineTo(p2.x,p2.y-2); ctx.stroke(); ctx.restore();
  }

  // ── Crystal spire rendering ───────────────────────────────────────────────
  function renderCrystal (col, row, variant) {
    const gH=SH/BH;
    // Base cluster — 1-3 shards depending on variant
    const configs = [
      // variant 0: single tall spire
      [{x:0.28,z:0.20,w:0.44,bh:0.70},{x:0.36,z:0.24,w:0.28,bh:1.05},{x:0.40,z:0.28,w:0.20,bh:0.50}],
      // variant 1: two side-by-side shards
      [{x:0.12,z:0.18,w:0.36,bh:0.60},{x:0.14,z:0.22,w:0.22,bh:0.90},
       {x:0.52,z:0.22,w:0.36,bh:0.55},{x:0.54,z:0.26,w:0.22,bh:0.80}],
      // variant 2: wide squat cluster
      [{x:0.10,z:0.16,w:0.80,bh:0.40},{x:0.22,z:0.20,w:0.56,bh:0.62},{x:0.34,z:0.26,w:0.32,bh:0.82}],
    ];
    const shards = configs[variant % configs.length];

    for (let i=0; i<shards.length; i++) {
      const s=shards[i];
      const factor = 1 - i*0.08;
      const tC = i===shards.length-1 ? C.xtalTipA : C.xtalBase;
      const sC = i===shards.length-1 ? C.xtalTipB : C.xtalSide;
      drawBlock(col+s.x, row+s.z, gH, s.w, s.bh*factor, tC, sC, C.outline);
    }

    // Glow halo on the tip
    const tip=shards[shards.length-1];
    const tipP=proj(col+tip.x+tip.w*0.5, row+tip.z, gH+tip.bh*0.9+0.12);
    ctx.save(); ctx.globalAlpha=0.25+0.15*Math.abs(Math.sin(performance.now()*0.002+col*1.3));
    ctx.fillStyle=C.xtalGlow;
    ctx.beginPath(); ctx.arc(tipP.x, tipP.y, BH*0.22, 0, Math.PI*2); ctx.fill(); ctx.restore();
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
  }

  // ── Update ────────────────────────────────────────────────────────────────
  function update (dt) {
    if (state!=='playing') return;

    if (jumping) {
      jumpT+=dt;
      if (jumpT>=JUMP_DUR) {
        player.col=jumpTo.col; player.row=jumpTo.row;
        jumping=false;
        if (player.row>score) { score=player.row; _setScore(score); }
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

    // Player
    _renderPlayer();
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
