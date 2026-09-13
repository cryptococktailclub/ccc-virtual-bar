# Batch OS — Web Beta v0.2

Batch OS is event beverage production software for catering and high-volume cocktail teams. CCC remains the canonical recipe source; Batch OS adds a production normalization and planning layer without rewriting the original recipe library.

## Architecture

- `server/server-v02.js` — dependency-free Node API deployed on Render.
- `web/index.html` + `web/app.js` + `web/styles.css` — browser beta client.
- CCC `recipes.json` — canonical recipe source.
- Future native iOS client should consume the same Batch OS API rather than duplicating calculation logic in Swift.

## API

- `GET /health`
- `GET /api/recipes`
- `POST /api/batch`
- `POST /api/events/plan`

## Event Builder v0.2

The event planner accepts an event-level guest/drink model and a cocktail menu whose allocation totals 100%. It produces:

- Per-cocktail planned pours and dilution.
- Consolidated liquid purchasing across the menu.
- On-hand inventory subtraction.
- Package-size rounding.
- User-supplied unit cost and event COGS.
- Count/dash/garnish prep requirements.
- Manual-review queue for ambiguous legacy recipe measurements.
- Vessel assignments with configurable maximum fill percentage.
- Batch labels for every production vessel.

## Production-data rules

Batch OS never silently guesses an ambiguous source measurement. Original CCC ingredient strings remain available. Unsafe or malformed records are flagged for review and excluded from liquid totals when the unit cannot be normalized reliably.

The default vessel maximum fill is 90% to preserve transport/mixing headspace.

## Next beta modules

1. Saved events and authenticated team accounts.
2. Persistent inventory and ingredient/package catalog.
3. Prep task ownership and event timeline.
4. PDF production packet / print labels.
5. Recipe data-review console and approved normalization overrides.
6. Native iOS shell using the same API contracts.
