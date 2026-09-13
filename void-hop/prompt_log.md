# Prompt Log — Void Hop

Full record of the build session with Kiro (AI agent) on 2026-09-13.

---

## Session Overview

**Duration:** ~1.5 hours  
**Commits:** 9  
**Final name:** Void Hop  
**Live URL:** [0l-l.github.io/void-hop/](https://0l-l.github.io/void-hop/)

---

## Prompt 1 — Initial Build

**User:**
> Build a javascript game that mimics Crossy Road as closely as you can, including the chunky, blocky, pseudo-3D camera angle. The 2.5D look is a big part of what makes Crossy Road feel like Crossy Road. Create this in my github, 0l-l.github.io. Structure: index.html (portfolio), styles.css, crossy-road/ (game folder) with index.html, game.js, README.md, prompt_log.md.

**Kiro:**
- Located `git.exe` bundled with GitHub Desktop at `AppData\Local\GitHubDesktop\`
- Cloned `0l-l.github.io`, read existing portfolio (Japanese editorial aesthetic, Shippori Mincho + Zen Kaku Gothic fonts)
- Created `frogger-road/` folder with all four files
- `game.js` (~800 lines): full Canvas 2D isometric engine using symmetric diamond iso projection, painter's algorithm, procedural lanes (safe/road/water), seeded PRNG, frog character, cars, logs, trees, jump arc, AABB collision, log riding, touch controls, localStorage best score
- Updated `index.html` portfolio to add a floating `🐸 Frogger Road` magnetic link
- Pushed to `main`

**Commit:** `853d906` — *Add Frogger Road — Crossy Road-style isometric game*

---

## Prompt 2 — Fix Instructions, Camera, Art

**User:**
> Fix: it's not very clear how to play. I want instructions on the side. Secondly, your art model makes it hard to differentiate whether it's a bug or play fail. Thirdly, make this view start from the player's eye view. Now when player pushes up arrow they turn to a different position. Change these 3, make the art better.

**Kiro:**
- Rebuilt `index.html` with CSS Grid layout: left panel (controls key diagram, lane legend, tips), right panel (live score + best, hazard guide), game canvas in center
- Identified the projection bug: symmetric diamond iso made "forward" feel sideways
- Replaced projection with oblique camera matching real Crossy Road screenshot: lanes are horizontal strips, depth axis leans upper-left (`DX=14`, `DY=42`), player at near/bottom edge
- Improved frog: distinct body + head blocks, bulging eye spheres with pupils + highlight, belly patch, four feet, mouth line
- Improved cars: full body + cab, windshield glass tint, distinct wheel blocks, correct headlight/taillight by travel direction
- Bright sky gradient (blue, matching Crossy Road)
- Score syncs to both HUD and right panel
- `Enter`/`Space` keyboard restart

**Commits:** `3d21a0f`, `d20e544`, `d626a8e`

---

## Prompt 3 — Keyboard Restart

**User:**
> One small adjustment: have one key on the keyboard for restart the game, now I can only do it by mouse.

**Kiro:**
- Added `Enter` / `Space` handling to `keydown` listener for `state === 'dead'` or `state === 'start'`
- Updated controls panel hint text

**Commit:** `d626a8e` — *Add Enter/Space keyboard restart*

---

## Prompt 4 — Full Art Retheme

**User:**
> Now, the mechanic works well. Change to another art concept. Do not use frog anymore. Think of something unique and very different. You should alternate all the elements of the art aspects of the game now.

**Kiro:**  
Concept chosen: **space explorer on an alien planet**

- **Player:** chunky astronaut — white suit, orange visor, gold backpack, blinking antenna
- **Safe lanes → Rock fields:** purple/lavender alien terrain, teal crystal spires (replace trees)
- **Road lanes → Hover lanes:** dark charcoal ground with neon teal energy grid, 6-color hovercrafts with cockpit dome + thrust glow
- **Water lanes → Lava flows:** orange-red ground, ride floating rock platforms instead of logs
- **Sky:** deep space gradient (near-black to purple), 120 flickering stars, ringed orange planet
- Death messages: "Vaporized 💥" / "Incinerated 🌋"
- UI accent color changed to purple `#b060ff`
- Portfolio link updated to `🚀 Astro Hop`

**Commit:** `a86aa75` — *Retheme: Astro Hop — astronaut, alien planet, hovercrafts, lava, crystals*

---

## Prompt 5 — Visual Readability Pass

**User:**
> Good concepts. I can see you changed all the elements. But I can only understand what they are by the instruction on the side. Please make them more intuitive so the player can know what the scenes and props are right when they look at them.

**Kiro:**
- **Lava lanes:** made ground much darker (cooled crust `#5a1800`), so bright crack veins are dominant
- **Hover lanes:** near-black ground (`#1c1c2e`) with animated neon teal dash lines + full-width edge stripe — unmistakably a high-tech road
- **Hovercrafts:** added exhaust trail (fading orange blobs behind craft), 3 pulsing white-hot thrust pods underneath
- **Rock platforms:** warm brown-grey (stone, not metal), raised texture patches on top (lighter blocks = uneven rock surface), shadow cast downward, bright orange lava-glow underside edge
- **Crystal spires:** changed from purple to **teal/cyan** for maximum contrast against purple rock ground; large radial gradient glow halo that pulses
- **Astronaut:** added prominent orange chest stripe (NASA suit read cue)

**Commit:** `79d1c0c` — *Improve visual readability*

---

## Prompt 6 — Lava & Platform Clarity

**User:** *(screenshot showing grey platform slabs that looked like abstract geometry)*
> I can't tell what these are. Make them into some concepts.

**Kiro:**
- Lava tile color changed to near-black dark crust — crack lines now 4.5px wide with yellow-white hot center
- Rock platform: warm brown-grey `#7a6858`, 2–3 raised lighter-tone texture patches on top (uneven rock), drop shadow below proving elevation, thick orange lava-glow underside line

**Commit:** `a2bf636` — *Lava: dark crust + thick glowing cracks; rock platforms: textured surface + float glow*

---

## Prompt 7 — Sound Effects

**User:**
> Can you now input the sound? I need some SFX.

**Kiro:**
- Added complete Web Audio API engine (no audio files, works in all browsers)
- `AudioContext` created lazily on first user gesture (autoplay policy compliance)
- 5 sounds synthesized procedurally:
  - **Hop:** square wave 520→680 Hz blip
  - **Land:** low-pass filtered noise thud
  - **Vaporized:** sawtooth 900→80 Hz descending zap with waveshaper distortion
  - **Incinerated:** bandpass noise burst + 60→30 Hz sine rumble
  - **Milestone:** 3-note ascending sine chime (C5→G5→C6) every 10 points
- Wired to: `_jump()` (hop), jump completion (land + milestone check), `_die()` (vaporized/incinerated)

**Commit:** `288614b` — *Add procedural SFX: hop, land, vaporized, incinerated, milestone chime*

---

## Prompt 8 — Landing Indicator

**User:** *(screenshot showing astronaut indistinguishable from terrain)*
> I can't tell which lane it lands on.

**Kiro:**
- Added `_renderLandingIndicator()` drawn before the player each frame
- **Standing:** white outer ring + teal inner ring drawn as ellipses on the ground tile the player occupies
- **During jump:** rings move to the **destination tile** and pulse at a faster frequency
- Both rings animate continuously (sine wave alpha)

**Commit:** `f4e07fd` — *Add landing indicator: glowing ring under player, pulsing target ring during jump*

---

## Prompt 9 — Final Polish & Documentation

**User:**
> Great. I think this will be it. Now help me conclude all my files on github. Give this game a good name, and then fill out a prompt log.

**Kiro:**
- Named game **Void Hop** — astronaut hopping across a hostile alien void
- Rewrote `README.md`: how to play, world/lane table, visual design notes, sound table, technical reference
- Wrote this `prompt_log.md` documenting all 9 prompts
- Updated all name references in UI (title tag, overlays)

**Commit:** *(this commit)*

---

## Final File Structure

```
0l-l.github.io/
├── index.html          ← portfolio (links to Void Hop via floating nav item)
├── style.css
├── script.js
└── frogger-road/
    ├── index.html      ← game shell: HUD, side panels, overlays
    ├── game.js         ← ~900 lines, all game + renderer + audio
    ├── README.md       ← game documentation
    └── prompt_log.md   ← this file
```

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Oblique projection (not symmetric iso) | Matches real Crossy Road — lanes read as horizontal strips, forward is unambiguous |
| Canvas 2D (not WebGL) | Simpler, sufficient for this tile count, no dependency |
| Painter's algorithm | Correct depth for oblique view without a depth buffer |
| Procedural audio (Web Audio API) | No hosting of audio files, works offline, browser autoplay-safe |
| Seeded PRNG per row | Deterministic world — same row always generates same lane type and objects |
| Landing indicator rings | Solves the core "where am I / where will I land" readability problem in oblique view |
