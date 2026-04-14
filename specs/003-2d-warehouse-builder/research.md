# Research: 2D Warehouse Builder

**Feature**: 003-2d-warehouse-builder  
**Date**: 2026-03-09

## Canvas Library Selection

**Decision**: Konva.js (v9.x)  
**Rationale**: Lightweight 2D canvas library purpose-built for drag-and-drop editing. Supports groups, transformers (resize handles), layering, and event system out of the box. No heavy framework dependency (React/Vue not needed). Works with vanilla JS, matching the existing frontend stack.  
**Alternatives Considered**:
- **Fabric.js** — Similar feature set but heavier bundle, more SVG-focused. Konva is more performant for our canvas-only use case.
- **Plain HTML5 Canvas** — Too low-level. Would need to hand-build hit detection, drag-and-drop, resize handles, and Z-ordering. Weeks of work for no benefit.
- **D3.js** — Designed for data visualization, not interactive editors. Wrong tool.

## Frontend Architecture Decision

**Decision**: Vanilla JS with Konva.js, served from the same `index.html` with hash-based routing (`#/builder` and `#/viewer`).  
**Rationale**: The existing frontend is vanilla JS with no framework. Introducing React/Vue for just the builder would create a split codebase. Hash routing avoids needing a build system or server-side routing changes.  
**Alternatives Considered**:
- **React app** — Would require a full build pipeline (Vite/Webpack), package.json, node_modules. Massive overhead for one page.
- **Separate HTML file** (builder.html) — Simple but loses shared state (warehouse selector, auth context).

## State Management (Undo/Redo)

**Decision**: Command pattern with an in-memory history stack.  
**Rationale**: Each user action (move zone, resize zone, change parameter) is encapsulated as a command object with `execute()` and `undo()` methods. A history stack stores executed commands. Ctrl+Z pops and calls `undo()`, Ctrl+Y re-executes. This is the established pattern for visual editors (used by Figma, Photoshop, etc.) and is trivial to implement without a library.  
**Alternatives Considered**:
- **Full state snapshot per action** — Creates memory pressure with large layouts. Command pattern only stores deltas.

## Location Code Pattern Engine

**Decision**: Custom template string parser using simple regex substitution.  
**Rationale**: Patterns like `E{zone:02d}-{aisle:02d}-{bay:03d}` are simple enough to handle with regex. No need for a full template engine. The parser replaces `{variable:format}` tokens with zero-padded values from the zone/aisle/bay/level hierarchy.  
**Alternatives Considered**:
- **Python's str.format()** on the backend — Would work, but the preview must also run in the browser (JS), so we need a JS-compatible solution. Custom parser works in both.

## Backend Configuration API

**Decision**: Single `POST /api/v1/layouts/configure` endpoint that accepts the full layout JSON and atomically replaces the layout in the database.  
**Rationale**: The builder sends the entire configuration as one payload. The backend drops existing records and recreates all Zone → Aisle → RackBay → Level → StorageUnit rows in a single transaction. This is simpler than differential PATCH operations and guarantees consistency.  
**Alternatives Considered**:
- **CRUD per entity** (POST zone, POST aisle, etc.) — Too many round trips and complex client-side state management. Atomic replace is correct for this use case.
- **PATCH with diff** — Overcomplicated for a configuration tool used infrequently.

## Multi-Pallet Per Bay

**Decision**: Add `pallets_per_bay` column (Integer, default=1) to `RackBay` model. StorageUnits are generated with slot suffixes (e.g., `A0-B0-L0-S0`, `A0-B0-L0-S1`).  
**Rationale**: Supports bays that hold 1, 2, 3, or 4 pallets side-by-side — the most requested real-world feature. The renderer subdivides each bay's width by `pallets_per_bay` to calculate per-slot X offsets.  
**Alternatives Considered**:
- **Separate SlotPosition model** — Overkill. A simple integer on RackBay is sufficient.
