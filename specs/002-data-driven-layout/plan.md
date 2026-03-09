# Implementation Plan: Data-Driven 3D Layout

**Branch**: `002-data-driven-layout` | **Date**: 2026-03-09 | **Spec**: [spec.md](file:///c:/Users/kourd/Desktop/Smatch/Projects/3D%20Warehouse/Native/specs/002-data-driven-layout/spec.md)
**Input**: Feature specification from `/specs/002-data-driven-layout/spec.md`

## Summary

Connect the existing SQLAlchemy layout models (`WarehouseLayout`, `Zone`, `Aisle`, `RackBay`, `StorageUnit`) to a real API endpoint that serves the full warehouse hierarchy as JSON. Refactor the Three.js frontend to read this JSON instead of hardcoded `CONFIG` constants, enabling any warehouse to be visualized by simply configuring the database.

## Technical Context

**Language/Version**: Python 3.13 (backend), Vanilla JavaScript ES6 (frontend)  
**Primary Dependencies**: FastAPI, SQLAlchemy 2.0, Pydantic V2, Three.js r128  
**Storage**: SQLite (aiosqlite for dev, PostgreSQL for prod)  
**Testing**: pytest (backend), browser manual (frontend)  
**Target Platform**: Web browser (desktop Chrome/Edge/Firefox)  
**Project Type**: Web application (backend API + frontend SPA)  
**Performance Goals**: 60 FPS with 50,000+ instances, layout API <500ms  
**Constraints**: Single warehouse MVP, no admin UI for layout editing  
**Scale/Scope**: Up to 20 zones, 200 aisles, 2400 bays

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Prime Directive**: All external APIs and libraries have been verified against official documentation. SQLAlchemy 2.0 `relationship()`, FastAPI `@router.websocket`, Three.js `InstancedMesh` — all verified in the existing codebase.
- [x] **100-Step Prediction**: At 10k users → layout is read-only, cached trivially. At 50k units → InstancedMesh handles this already (<10 draw calls). At 2 years → clean separation of layout data from rendering logic ensures maintainability.
- [x] **Sovereign Audit**: No new libraries required. We reuse SQLAlchemy models already defined in `layout.py`, the existing FastAPI router, and the existing Three.js InstancedMesh engine.
- [x] **Data Integrity**: The schema follows Kleppmann's principle of storing the canonical physical layout in the relational DB and streaming the derivative 3D coordinates to the frontend. The DB schema is already normalized (Warehouse → Zone → Aisle → RackBay → StorageUnit).

## Project Structure

### Documentation (this feature)

```text
specs/002-data-driven-layout/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── layout-api.md
└── tasks.md             # Phase 2 output (from /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── api/v1/
│   │   ├── layout.py         # [MODIFY] Real GET /structure endpoint
│   │   ├── stream.py         # [MODIFY] Include layout in SNAPSHOT
│   │   └── __init__.py       # [MODIFY] Register new route
│   ├── core/
│   │   └── database.py       # [NEW] Async session factory
│   ├── models/
│   │   └── layout.py         # [MODIFY] Add Level model, fix Base import
│   ├── schemas/
│   │   └── layout.py         # [NEW] Pydantic response schemas
│   └── seed.py               # [NEW] Database seeder script
└── tests/
    ├── models/
    │   └── test_layout.py    # [EXISTS] Already has 4 tests
    └── api/
        └── test_layout_api.py # [NEW] API integration tests

scripts/
├── warehouse.config.js       # [MODIFY] Make constants overridable
├── warehouse.instancing.js   # [MODIFY] Build from layout JSON
├── warehouse.app.js          # [MODIFY] Fetch layout before rendering
└── warehouse.stream.js       # [NO CHANGE]
```

**Structure Decision**: Web application with backend API serving layout JSON to the vanilla JS frontend. No new frameworks or libraries needed.

## Proposed Changes

### Backend: Database Layer

#### [MODIFY] [layout.py](file:///c:/Users/kourd/Desktop/Smatch/Projects/3D%20Warehouse/Native/backend/app/models/layout.py)
- Add a `Level` model (currently levels are implicit in `StorageUnit.level_number`). Each `RackBay` will have explicit `Level` children with `height_meters` and `max_weight_kg`.
- Fix the `Base` import to use a shared declarative base from a central location to avoid SQLite/PostgreSQL dialect conflicts.

#### [NEW] [database.py](file:///c:/Users/kourd/Desktop/Smatch/Projects/3D%20Warehouse/Native/backend/app/core/database.py)
- Create a proper async `SessionLocal` factory using `create_async_engine` with `aiosqlite`.
- Expose a `get_db` async dependency for FastAPI.

#### [NEW] [seed.py](file:///c:/Users/kourd/Desktop/Smatch/Projects/3D%20Warehouse/Native/backend/app/seed.py)
- A script that populates the database with a realistic demo warehouse: 2 zones (one `STANDARD_RACK`, one `FLOOR_BULK`), 6 aisles with 12 bays each, 6 levels, and randomized storage units.

---

### Backend: API Layer

#### [NEW] [layout.py (schemas)](file:///c:/Users/kourd/Desktop/Smatch/Projects/3D%20Warehouse/Native/backend/app/schemas/layout.py)
- Pydantic V2 response models: `LayoutResponse`, `ZoneSchema`, `AisleSchema`, `BaySchema`, `LevelSchema`.

#### [MODIFY] [layout.py (api)](file:///c:/Users/kourd/Desktop/Smatch/Projects/3D%20Warehouse/Native/backend/app/api/v1/layout.py)
- Replace the mocked `get_layout` endpoint with a real `GET /layouts/structure` that queries the DB and returns the full nested hierarchy.
- Add eager loading (`selectinload`) to avoid N+1 queries.

#### [MODIFY] [stream.py](file:///c:/Users/kourd/Desktop/Smatch/Projects/3D%20Warehouse/Native/backend/app/api/v1/stream.py)
- Include the layout structure in the initial `SNAPSHOT` event so the frontend has both layout and inventory in a single connection.

---

### Frontend: 3D Engine

#### [MODIFY] [warehouse.config.js](file:///c:/Users/kourd/Desktop/Smatch/Projects/3D%20Warehouse/Native/scripts/warehouse.config.js)
- Keep existing constants as defaults but allow them to be overridden by API data.

#### [MODIFY] [warehouse.instancing.js](file:///c:/Users/kourd/Desktop/Smatch/Projects/3D%20Warehouse/Native/scripts/warehouse.instancing.js)
- Add a new `buildStructureFromLayout(layoutData)` function that loops through `zones → aisles → bays → levels` from the API JSON and places InstancedMesh instances at the exact coordinates.
- Add zone-type dispatch: `STANDARD_RACK` generates vertical racks/beams; `FLOOR_BULK` generates colored floor planes.
- Keep existing `createInstancedWarehouse()` as a fallback for when no layout data is available.

#### [MODIFY] [warehouse.app.js](file:///c:/Users/kourd/Desktop/Smatch/Projects/3D%20Warehouse/Native/scripts/warehouse.app.js)
- In `handleSnapshot`, check if `snapshotData.layout` contains zones. If yes, call `buildStructureFromLayout(snapshotData.layout)` instead of the legacy item-based rendering.

## Verification Plan

### Automated Tests

1. **Existing model tests** (already pass):
   ```bash
   cd backend && ./venv/Scripts/python.exe -m pytest tests/models/test_layout.py -v
   ```

2. **New API integration test** (`tests/api/test_layout_api.py`):
   - Test that `GET /api/v1/layouts/structure` returns 200 with correct nested JSON when a layout is seeded.
   - Test that `GET /api/v1/layouts/structure` returns 404 when no layout exists.
   ```bash
   cd backend && ./venv/Scripts/python.exe -m pytest tests/api/test_layout_api.py -v
   ```

### Manual Verification

1. **Run the seed script** to populate the database with the demo warehouse.
2. **Start the backend**: `cd backend && ./venv/Scripts/uvicorn app.main:app --reload --port 8000`
3. **Start the frontend**: `cd .. && python -m http.server 3000`
4. **Open browser** to `http://localhost:3000` — verify the 3D scene renders racks matching the seeded layout (not the old hardcoded grid).
5. **Modify the seed data** (change aisle count or zone color), re-run the seed, refresh the browser — verify the 3D scene changes to match.
