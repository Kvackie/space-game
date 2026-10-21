# space-game

Space game project, published as a static site with GitHub Pages.

## Structure

```
src/                      static site source (this is what gets published)
.github/workflows/pages.yml   Pages deploy workflow
```

## Pages

GitHub Pages is built by the `Deploy Pages` workflow (`.github/workflows/pages.yml`):
checkout -> upload `src/` -> deploy. There is no build step and no Node.js involved —
`src/` is served as-is.

Enable it in **Settings > Pages > Source: GitHub Actions** if it is ever turned off.
