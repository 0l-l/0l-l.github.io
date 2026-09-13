# Frogger Road 🐸

A Crossy Road-style browser game built entirely in vanilla JavaScript on Canvas 2D — no libraries, no framework.

## How to Play

| Input | Action |
|-------|--------|
| `↑` / `W` | Hop forward |
| `↓` / `S` | Hop backward |
| `←` / `A` | Hop left |
| `→` / `D` | Hop right |
| Swipe | Touch / mobile controls |

Hop as far forward as you can. Dodge cars. Ride logs across water. Don't fall in.

## Visual Style

The game uses a **pseudo-3D isometric projection** — the same "2.5D" camera angle that gives Crossy Road its chunky, toy-like feel:

- World-space coordinates are projected with a 30° elevation angle
- Blocks are drawn face-by-face using the painter's algorithm (back-to-front)
- Each face gets a unique shade: top is brightest, left is mid, right is darkest
- The camera smoothly tracks the player forward

## Structure

```
frogger-road/
├── index.html     — game shell, HUD, overlays
├── game.js        — all game logic, renderer, input
├── README.md      — this file
└── prompt_log.md  — build history
```

## Technical Notes

- **Renderer:** Custom Canvas 2D isometric engine, no WebGL
- **Projection:** `x′ = (wx - wz) × cos30°`, `y′ = (wx + wz) × sin30° - wy`
- **Depth sort:** Painter's algorithm — rows drawn back-to-front
- **Lane gen:** Seeded PRNG, procedural road / water / safe-zone groups
- **Collision:** AABB in world-tile space
- **Camera:** Exponential smoothing toward player's row

## Credits

Built by Oulan Li · [0l-l.github.io](https://0l-l.github.io)
