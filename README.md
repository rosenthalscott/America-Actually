# America Actually

Election maps in true color. Each county or state is painted from the **vote mix**, not a winner-takes-all quilt — a 51–49 toss-up reads purple, a landslide leans red or blue.

Built-in returns: U.S. president, 2008–2024, counties and states. Plug in any other contest with a GeoJSON + vote table.

## Run it

Needs **Node 22+**.

```bash
npm install
npm run dev
```

The app serves at `http://localhost:8080`.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite + TanStack Start on `0.0.0.0:8080` |
| `npm run build` | Production build (Vercel / Nitro preset) |
| `npm run preview` | Serve the production build on `127.0.0.1:8081` |
| `npm run typecheck` | `tsc --noEmit` |

## What to try

- **Blend** (default) mixes the two party colors by share.
- **Winner** is the familiar red/blue map of the same votes.
- **Margin** keeps the mix but fades close races so landslides read louder.
- **Polarize** pushes a blend toward the winner without snapping to a single color.
- Click a place, search by name, switch years and counties/states.
- **Plug in** your own geography + results (CSV or JSON). Sample CSV: [`public/data/sample-results.csv`](public/data/sample-results.csv).

## Project layout

```
src/
  routes/            pages (`/` is the map)
  components/app/    year rail, inspector, upload, how-to-read
  components/map/    SVG map + legend
  lib/election/      catalog, join, color, parse, stats, store
public/
  data/elections/    2008–2024 president (counties + states)
  data/geo/          US 10m TopoJSON + Harbor City GeoJSON
  og.jpg             share card
```

## Data shape

Results files live under `public/data/elections/` and look like:

```json
{
  "id": "2024-president-counties",
  "title": "2024 President",
  "geographyId": "us-counties",
  "parties": [
    { "id": "dem", "label": "Harris", "shortLabel": "Dem", "color": "#1D4E89" },
    { "id": "gop", "label": "Trump", "shortLabel": "GOP", "color": "#B91C2C" }
  ],
  "rows": [{ "id": "06037", "name": "Los Angeles", "dem": 0, "gop": 0, "oth": 0 }]
}
```

CSV upload columns: `id`, `name`, `dem`, `gop`, `oth`. `id` should match the geography feature id (FIPS for U.S. counties/states).

Geographies are registered in [`src/lib/election/catalog.ts`](src/lib/election/catalog.ts).

Coloring lives in [`src/lib/election/color.ts`](src/lib/election/color.ts) — blend, winner, and margin are three readings of the same numbers.

## Stack

React 19, TanStack Start / Router, Tailwind v4, d3-geo, TopoJSON, Zustand. No database and no accounts: custom uploads stay in the browser.

The repo still includes Grok App Builder glue (`scripts/grok-pwa-*.mjs`, `server/middleware/grok-pwa.ts`, `public/__grok/`, `src/components/preview-host-bridge.tsx`). Leave it in place if you want `npm run dev` / `npm run build` to keep working as they do now. The app itself is the map in `src/`.

## License

Data and code as shipped. Presidential returns are public record; treat uploaded files as yours.
