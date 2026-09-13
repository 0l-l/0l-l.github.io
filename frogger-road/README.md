# Void Hop 🚀

A Crossy Road-style browser game set on an alien planet — built entirely in vanilla JavaScript with Canvas 2D. No libraries, no framework, no audio files.

**Play it:** [0l-l.github.io/frogger-road/](https://0l-l.github.io/frogger-road/)

---

## How to Play

| Input | Action |
|-------|--------|
| `↑` / `W` | Hop forward (deeper into the world) |
| `↓` / `S` | Hop backward |
| `←` / `A` | Hop left |
| `→` / `D` | Hop right |
| `Enter` / `Space` | Start / restart |
| Swipe | Touch / mobile |

Hop as far forward as you can. Dodge hovercrafts. Ride rock platforms over lava. Don't get vaporized — or incinerated.

---

## World

| Lane type | Ground | Hazard | Safe method |
|-----------|--------|--------|-------------|
| **Rock Field** | Purple alien rock | Crystal spires block path | Walk around |
| **Hover Lane** | Dark charcoal + neon grid | Hovercrafts with exhaust trails | Time your crossing |
| **Lava Flow** | Dark crust with glowing cracks | Instant death if not on a rock | Ride floating rock platforms |

---

## Visual Design

Oblique (non-symmetric) projection matching Crossy Road's exact camera angle:
- Lanes are **horizontal strips** across the full screen width
- Depth axis leans upper-left at ~30° from horizontal (`DX=14px`, `DY=42px` per row)
- Painter's algorithm: rows drawn far-to-near, objects drawn back-to-front within each row
- Each block face shaded independently (top → side → front) for the chunky 2.5D look
- Deep space sky with 120 flickering stars and a ringed orange planet

**Theme: alien planet survival**
- Astronaut: white suit, orange chest stripe, amber visor, gold backpack, blinking antenna
- Hovercrafts: 6 neon color variants, cockpit dome, animated thrust pods, exhaust trail
- Lava: dark cooled-crust tiles with bright glowing orange/yellow crack veins
- Rock platforms: warm brown-grey slabs with texture patches, lava-glow underside
- Crystal spires: teal/cyan, contrast against purple rock ground, large pulsing glow halo
- Landing indicator: white + teal rings under the player; moves to destination during jump

---

## Sound (Web Audio API, no files)

All SFX synthesized procedurally at runtime:

| Sound | Trigger |
|-------|---------|
| Hop blip | Every jump |
| Landing thud | Jump completes |
| Vaporized zap | Hit by hovercraft |
| Lava hiss + rumble | Fall in lava |
| Ascending chime | Every 10 points |

---

## Structure

```
frogger-road/
├── index.html      — game shell: HUD, side panels (controls + legend), overlays
├── game.js         — all game logic, renderer, audio (~850 lines, vanilla JS)
├── README.md       — this file
└── prompt_log.md   — full build session log
```

---

## Technical Notes

- **Projection:** oblique camera — `sx = OX + col×TW - (row-camRow)×DX`, `sy = OY - (row-camRow)×DY - h×BH`
- **Renderer:** Canvas 2D only — `drawBlock()` draws near-side face + top parallelogram per block
- **Depth sort:** rows rendered far→near; within each row, objects rendered by painter's order
- **Lane gen:** seeded Xorshift PRNG — deterministic per row index; bands of safe / hover / lava
- **Collision:** AABB in world-tile space (0.18–0.82 of tile width)
- **Camera:** exponential lerp toward `player.row - 3`
- **Audio:** `AudioContext` created lazily on first interaction; all sounds built from oscillators and buffer noise

---

## Credits

Designed and built by **Oulan Li** — [0l-l.github.io](https://0l-l.github.io)
