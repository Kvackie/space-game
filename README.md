# space-game

Space game project with a Node.js-built GitHub Pages site.

## Setup

```bash
npm install     # install dependencies
npm run build   # build src/ -> dist/
npm start       # preview dist/ on http://localhost:8080
```

## Pages

GitHub Pages is built by the `Deploy Pages` workflow (`.github/workflows/pages.yml`):
checkout -> Node.js 20 (`npm ci`) -> `npm run build` -> upload `dist/` -> deploy.

Enable it in **Settings > Pages > Source: GitHub Actions** if it is ever turned off.
