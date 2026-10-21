# Credits and asset register

Every third-party asset in the game, with its source and licence. Anything not listed here was made for this project.

## Third-party assets

| Asset                   | Used for         | Source                                                                                                                                           | Author                      | Licence                   | Attribution required                     |
| ----------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- | ------------------------- | ---------------------------------------- |
| Oxanium                 | Display font     | [Google Fonts](https://fonts.google.com/specimen/Oxanium) via [Fontsource](https://fontsource.org/fonts/oxanium)                                 | The Oxanium Project Authors | SIL Open Font License 1.1 | No (licence travels with the font files) |
| IBM Plex Sans Condensed | Body font        | [Google Fonts](https://fonts.google.com/specimen/IBM+Plex+Sans+Condensed) via [Fontsource](https://fontsource.org/fonts/ibm-plex-sans-condensed) | IBM                         | SIL Open Font License 1.1 | No (licence travels with the font files) |
| JetBrains Mono          | Data/number font | [Google Fonts](https://fonts.google.com/specimen/JetBrains+Mono) via [Fontsource](https://fontsource.org/fonts/jetbrains-mono)                   | JetBrains                   | SIL Open Font License 1.1 | No (licence travels with the font files) |

## Software

| Library                                                                            | Licence            |
| ---------------------------------------------------------------------------------- | ------------------ |
| [Babylon.js](https://www.babylonjs.com/) (`@babylonjs/core`, `@babylonjs/loaders`) | Apache License 2.0 |

## Made for this project (placeholders)

| Asset                                                             | How it was made                      | Where                                                                   |
| ----------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------- |
| Ship and station models (barge, frigate, pirate frigate, station) | Built by a Blender script            | `blender/scripts/build_placeholder_models.py` → `public/assets/models/` |
| Captain portraits                                                 | Drawn as SVG from per-captain traits | `src/ui/portrait.ts`, traits in `src/data/placeholders.json`            |
| Star field, battle effects, warp gate                             | Generated in code at runtime         | `src/render/`                                                           |
| Favicon                                                           | Hand-written SVG                     | `public/favicon.svg`                                                    |

## Adding an asset

Add a row before committing it: what it is, where it came from (link), the author, the exact licence, and whether the licence requires attribution. "Free" does not always mean CC0: check for attribution, non-commercial and share-alike terms.
