# Landing page animations

## `scene.json`

The Lottie scene shown in the "Manage your payments and virtual cards" section
of the landing page, exported from Jitter.

Save the export here as **`scene.json`** (exact name). The section picks it up
automatically and falls back to the dashboard screenshot while the file is
absent, so the page never breaks.

Notes:

- Export as **Lottie JSON**, not `.lottie` / dotLottie — the player reads plain
  JSON. Keep the images embedded as data URIs, which is Jitter's default.
- The file is fetched at runtime rather than imported, so its embedded rasters
  stay out of the JS bundle.
- The scene is authored 800x600 on a light `#f2f4f8` ground. It is rendered
  inside a rounded, clipped container so it reads as a panel on the dark page.
- `prefers-reduced-motion` holds the scene on its first frame instead of
  looping.
