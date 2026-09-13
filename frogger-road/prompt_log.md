# Prompt Log — Frogger Road

## 2026-09-13

**User prompt:**  
> Build a javascript game that mimics Crossy Road as closely as you can, including the chunky, blocky, pseudo-3D camera angle. The 2.5D look is a big part of what makes Crossy Road feel like Crossy Road. Create this in my github, 0l-l.github.io.

**Agent (Kiro):**  
Built from scratch in a single session:

1. Cloned repo via GitHub Desktop's bundled `git.exe`
2. Surveyed existing portfolio (Japanese editorial aesthetic, Shippori Mincho / Zen Kaku Gothic)
3. Wrote `frogger-road/index.html` — game shell with HUD, start/death overlays, back-to-portfolio link
4. Wrote `frogger-road/game.js` (~800 lines) — full custom isometric Canvas 2D engine:
   - Pseudo-3D projection matching Crossy Road's camera (30° elevation, dimetric approximation)
   - Painter's algorithm depth sort (back-to-front row rendering)
   - Procedural lane generation: safe grass → road → water bands
   - Seeded PRNG for deterministic lane variety
   - Chunky block renderer: top / left / right faces shaded independently
   - Car, log, tree, and frog character models all built from iso-boxes
   - Jump arc animation with ease-in-out curve
   - Smooth camera follow with exponential lerp
   - AABB collision (road → squish, water → drown)
   - Log riding (player position carried by log velocity)
   - Touch / swipe controls for mobile
   - Score + best score (localStorage)
5. Updated `index.html` (portfolio) to link to the game under Projects
6. Committed and pushed to `main`

**Key aesthetic decisions:**
- Frog is 3–4 stacked iso-boxes (body + head) with dot-eyes, giving the same voxel-puppet feel as the original
- Cars have cab blocks, wheel ellipses, and colored headlights/taillights
- Trees are stacked tapering pyramids of green blocks
- Water has animated shimmer overlay via sin-based alpha tiles
- Sky is a dark gradient (matching the late-night Crossy Road palette)
