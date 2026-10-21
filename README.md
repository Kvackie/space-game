# space-game

A single-player, browser-based space fleet management game: mine, refine, build ships, recruit captains and send fleets on expeditions. Built with Babylon.js, TypeScript and Vite; menus are HTML/CSS over the 3D view.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5190
```

| Command           | What it does                            |
| ----------------- | --------------------------------------- |
| `npm run dev`     | Dev server with hot reload              |
| `npm run build`   | Type-check and build to `dist/`         |
| `npm run preview` | Serve the production build              |
| `npm test`        | Run the unit tests (Vitest)             |
| `npm run lint`    | ESLint                                  |
| `npm run format`  | Prettier (`format:check` to only check) |

## Structure

```
index.html            page shell: game area, 3D canvas, UI layer
src/
  main.ts             start-up: fonts, layout, engine, scene, UI
  layout.ts           screen scaling (16:9 design core, letterboxing)
  theme.css           colour and font tokens
  data/               game data; placeholders.json holds every temporary value
  render/             Babylon.js scenes
  ui/                 HTML/CSS screens
public/assets/        game-ready art and audio, served as-is
blender/              Blender sources and scripts
tests/                unit tests
```

## Deploying

GitHub Pages is built by the `Deploy Pages` workflow (`.github/workflows/pages.yml`): install, test, build, upload `dist/`, deploy. It is **manual only**: run it from **Actions > Deploy Pages > Run workflow**. It never runs on push.

Enable it in **Settings > Pages > Source: GitHub Actions** if it is ever turned off.
