# Research: Data-Driven 3D Layout

## Decision 1: Database Engine for MVP
- **Decision**: Use SQLite with `aiosqlite` for local development, PostgreSQL for production.
- **Rationale**: SQLite requires zero setup for local demos. The existing `config.py` already has `DATABASE_URL = "sqlite+aiosqlite:///:memory:"`. We switch to a file-based SQLite (`./warehouse.db`) so data persists across restarts.
- **Alternatives considered**: PostgreSQL-only (rejected: requires Docker/install for local dev, overkill for MVP demo).

## Decision 2: Layout API Design — Nested vs Flat
- **Decision**: Nested hierarchical JSON (`warehouse.zones[].aisles[].bays[].levels[]`).
- **Rationale**: The frontend needs to iterate zone-by-zone to dispatch different rendering strategies (`STANDARD_RACK` vs `FLOOR_BULK`). A flat list would require client-side grouping logic.
- **Alternatives considered**: Flat list with parent IDs (rejected: shifts complexity to the frontend where JavaScript has no ORM).

## Decision 3: Layout Delivery — Separate HTTP vs WebSocket SNAPSHOT
- **Decision**: Embed the layout inside the existing WebSocket `SNAPSHOT` event.
- **Rationale**: The frontend already waits for the SNAPSHOT before rendering. Adding the layout to this payload means zero additional HTTP calls and zero additional latency. The frontend already has the plumbing to handle it.
- **Alternatives considered**: Separate `GET /layouts/structure` endpoint (kept as fallback, but primary delivery is via SNAPSHOT).

## Decision 4: Level Model — Explicit vs Implicit
- **Decision**: Add an explicit `Level` model as a child of `RackBay`.
- **Rationale**: The current schema stores `level_number` and `elevation_meters` on `StorageUnit`, but the frontend needs to know level heights to place beams even when no stock exists. An explicit Level model allows the 3D engine to render empty racks at the correct heights.
- **Alternatives considered**: Deriving levels from CONFIG constants (rejected: defeats the purpose of data-driven layout).

## Decision 5: Frontend Fallback Strategy
- **Decision**: Keep existing `createInstancedWarehouse()` as a fallback. If the SNAPSHOT contains no layout zones, fall back to legacy rendering from `wmsData` items.
- **Rationale**: Ensures backward compatibility during migration. The old demo still works if someone runs the system without seeding a layout.
