# Landing page screenshots

The landing page shows real product captures. Save them here with these exact
names — the sections pick them up automatically, and fall back to the drawn SVG
illustrations in `src/components/Home/illustrations` while a file is missing.

| File | What to capture | Used by |
|---|---|---|
| `dashboard.png` | Dashboard home, full width | Hero, Portfolio |
| `wallet.png` | Wallet & Liquidity Hub, full page | Work section |
| `cards.png` | Cards page, full width | Upgrade section |
| `card.png` | A single card, cropped, transparent background | Hero, Upgrade (floating) |
| `mobile.png` | Dashboard at ~390px wide | Hero (phone frame) |

Notes:

- Capture in **dark mode** — the landing page is dark, and the frames assume it.
- `card.png` should be a tight crop of one card with a transparent background,
  since it floats over the other shots.
- Export at 2x for a crisp result; `next/image` handles the downscaling.
- The `width`/`height` props in `src/components/Home/showcase/index.tsx` only
  reserve layout space before load. If your captures have a noticeably
  different aspect ratio, update them there to avoid a layout shift.
