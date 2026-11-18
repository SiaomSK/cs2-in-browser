# Breach — lightweight browser FPS

An original, dependency-free, offline single-player tactical shooter. Not CS2, not affiliated with Valve, and not a multiplayer or feature-complete CS2 implementation.

## Run

Serve this directory with any static HTTP server:

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

Open the server URL in a desktop browser. No build step, external assets, account, or package installation is required. The files can also be opened directly in browsers that allow local scripts.

## Play

- WASD: movement; mouse: aim; arrow keys: turn
- Left click: fire; R: reload; Shift: sprint
- Escape: pause and release pointer lock
- Eliminate all three bots. First to three rounds wins; rounds last 90 seconds.
- Free practice has no enemies or time limit.
- The armory has three weapons with different damage, magazines, and fire rates.
- Settings save locally. Choose Potato (240 rays), Balanced (400), or Sharp (640).

## Implementation & limitations

Canvas 2D raycasting, grid collision, occluded procedural enemy sprites, line-of-sight AI, synthesized sound effects, and a mini-map. No libraries, downloaded models, WebGL, or external fonts. Rendering is intentionally low-resolution and uses simple geometry to reduce work. Performance varies by device and viewport; no universal minimum frame rate is guaranteed. Desktop keyboard and mouse are required for gameplay. This is a compact 2.5D game, not a modern 3D engine: no jumping, bomb mode, online multiplayer, or real CS assets.

## Courtyards update

- Mouse rotation is 54% slower at the same setting (including existing saved settings). Sensitivity now ranges from 0.5 to 10 in 0.1 increments, with a numeric readout. Field Settings is also available while paused.
- Expanded 24 × 22 map: West Approach, Sun Court, Mid Connector, Blue Court, and East Market. A/B signs are navigation landmarks, not bomb objectives. Cross-routes and cargo cover support flanking.
- Bots use a shared breadth-first navigation field refreshed every 0.6 seconds to route around walls.
- Deterministic, pre-generated stone/plaster/cargo textures, shutters, courtyard signs, directional shading, paving, and a refreshed sky. No downloaded art or runtime dependencies. Potato mode skips floor detail.
- Radar fits the expanded map and the HUD names your current area.

Run the dependency-free logic checks with `node --test tests/game.test.cjs`. These cover rounds, reloads, pause, mouse scaling, all map-cell connectivity, bot navigation, and renderer smoke checks at all three quality settings. Mock-DOM tests are not full browser integration tests.
