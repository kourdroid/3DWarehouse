# Tasks: Data-Driven 3D Layout

**Input**: Design documents from `/specs/002-data-driven-layout/`
**Prerequisites**: plan.md ✅, spec.md ✅, data-model.md ✅, contracts/ ✅, research.md ✅

**Tests**: Domain Entity tests included (100% coverage per Constitution). API contract test included.

**Organization**: Tasks grouped by user story. US3 (Layout API) is ordered before US1 (3D Rendering) because the frontend cannot render from the DB without the API endpoint.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database engine, session factory, and shared base configuration

- [ ] T001 Create async database session factory and `get_db` dependency in `backend/app/core/database.py`
- [ ] T002 [P] Update database URL in `backend/app/core/config.py` from in-memory SQLite to file-based `warehouse.db`
- [ ] T003 Add `Level` model to `backend/app/models/layout.py` (child of `RackBay` with `height_meters`, `max_weight_kg`)
- [ ] T004 Update `RackBay` model in `backend/app/models/layout.py` to add `levels` relationship to new `Level` model
- [ ] T005 [P] Create Pydantic V2 response schemas (`LayoutResponse`, `ZoneSchema`, `AisleSchema`, `BaySchema`, `LevelSchema`) in `backend/app/schemas/layout.py`

**Checkpoint**: Database layer ready — all models defined, session factory operational, Pydantic schemas complete

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Seed the database with realistic demo data and verify the data layer end-to-end

- [ ] T006 Create database seeder script `backend/app/seed.py` that populates: 1 warehouse, 2 zones (STANDARD_RACK + FLOOR_BULK), 6 aisles, 12 bays per aisle, 4 levels per bay, and storage units
- [ ] T007 [P] Add unit tests for the new `Level` model in `backend/tests/models/test_layout.py` (create + relationship + cascade delete)
- [ ] T008 Wire the real `get_db` dependency into `backend/app/api/v1/layout.py` replacing the mock `get_db` function
- [ ] T009 Add startup event in `backend/app/main.py` to create all tables on first run via `Base.metadata.create_all()`

**Checkpoint**: Foundation ready — seeded database operational, all models tested, dependency injection working

---

## Phase 3: User Story 3 — Layout Served via API (Priority: P1) 🎯 MVP

**Goal**: A single GET endpoint returns the full warehouse hierarchy as nested JSON for the 3D engine to consume.

**Independent Test**: Call `GET /api/v1/layouts/structure` and verify the response contains the correct nested JSON matching the seeded data.

### Implementation for User Story 3

- [ ] T010 [US3] Implement `GET /api/v1/layouts/structure` endpoint in `backend/app/api/v1/layout.py` — query `WarehouseLayout` with eager loading (`selectinload`) of zones → aisles → bays → levels, return nested JSON using Pydantic schemas
- [ ] T011 [US3] Register the new `/layouts/structure` route in `backend/app/api/v1/__init__.py`
- [ ] T012 [US3] Handle empty database case: return `404` with `{"detail": "No layout configured"}` when no layout exists
- [ ] T013 [P] [US3] Create API integration test in `backend/tests/api/test_layout_api.py` — test 200 with seeded data and 404 with empty DB

**Checkpoint**: Layout API is live. `curl http://localhost:8000/api/v1/layouts/structure` returns the full warehouse hierarchy.

---

## Phase 4: User Story 1 — Layout-Driven 3D Rendering (Priority: P1) 🎯 MVP

**Goal**: The Three.js frontend reads the layout JSON from the API and renders racks at the exact positions defined in the database.

**Independent Test**: Seed two different warehouse configurations, load each in the browser, and verify the 3D scene visually matches the configuration.

### Implementation for User Story 1

- [ ] T014 [US1] Embed the layout structure inside the WebSocket `SNAPSHOT` payload in `backend/app/api/v1/stream.py` — add a `layout` key containing the same hierarchy served by `GET /layouts/structure`
- [ ] T015 [US1] Add a new `buildStructureFromLayout(layoutData)` function in `scripts/warehouse.instancing.js` that iterates `zones → aisles → bays → levels` and places `InstancedMesh` instances at API-provided coordinates
- [ ] T016 [US1] Update `window.handleSnapshot` in `scripts/warehouse.app.js` to check for `snapshotData.layout`; if present, call `buildStructureFromLayout()` instead of legacy `createInstancedWarehouse()`
- [ ] T017 [US1] Create a `PHYSICAL_MAP` lookup table in `scripts/warehouse.state.js` that maps logical location codes (`A1-B01-L0`) to physical XYZ coordinates derived from the layout data
- [ ] T018 [US1] Update `handleUpdateDelta` in `scripts/warehouse.instancing.js` to use `PHYSICAL_MAP` for resolving location codes to InstancedMesh indices
- [ ] T019 [US1] Add an "empty layout" UI state to `scripts/warehouse.app.js` — when SNAPSHOT contains no layout, display a "No warehouse configured" message in the loading screen instead of crashing
- [ ] T020 [US1] Keep existing `createInstancedWarehouse()` as a legacy fallback — only called when SNAPSHOT has no `layout` key

**Checkpoint**: Browser loads, calls WebSocket, receives SNAPSHOT with layout, renders data-driven racks. Changing the DB seed and refreshing the browser shows a different warehouse.

---

## Phase 5: User Story 2 — Zone-Aware Visualization (Priority: P2)

**Goal**: Different zone types render with distinct visual styles — `STANDARD_RACK` generates vertical shelving, `FLOOR_BULK` generates flat ground storage.

**Independent Test**: Seed a warehouse with both zone types. Verify the rack zone shows metal uprights/beams, the floor zone shows a colored ground plane.

### Implementation for User Story 2

- [ ] T021 [US2] Add zone-type dispatch logic in `buildStructureFromLayout()` in `scripts/warehouse.instancing.js` — call `buildRackZone(zone)` for `STANDARD_RACK` and `buildFloorBulkZone(zone)` for `FLOOR_BULK`
- [ ] T022 [US2] Implement `buildRackZone(zone)` in `scripts/warehouse.instancing.js` — generate uprights, beams, and pallet slots using per-bay width and per-level height from the API
- [ ] T023 [US2] Implement `buildFloorBulkZone(zone)` in `scripts/warehouse.instancing.js` — generate a colored `PlaneGeometry` on the ground, with pallet grid slots at floor level (no vertical racks)
- [ ] T024 [US2] Apply `zone.color` to the zone's visual elements (rack metal tint for rack zones, floor plane color for bulk zones) in `scripts/warehouse.instancing.js`

**Checkpoint**: Both zone types render visually distinct. Changing a zone's `color_hex` in the seed and refreshing shows the updated color.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup, performance validation, and backward compatibility verification

- [ ] T025 [P] Update `scripts/warehouse.config.js` to document that constants are now fallback defaults overridden by API data
- [ ] T026 Run the existing model tests: `cd backend && ./venv/Scripts/python.exe -m pytest tests/ -v`
- [ ] T027 Run the quickstart validation from `specs/002-data-driven-layout/quickstart.md` end-to-end
- [ ] T028 [P] Clean up temporary debug scripts (`backend/test_ws.py`, `backend/test_http.py`, etc.) if still present

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US3 — Layout API (Phase 3)**: Depends on Phase 2 — the API must exist before the frontend can consume it
- **US1 — 3D Rendering (Phase 4)**: Depends on Phase 3 — the frontend reads what the API serves
- **US2 — Zone Visualization (Phase 5)**: Depends on Phase 4 — zone dispatch extends the layout renderer
- **Polish (Phase 6)**: Depends on all user stories complete

### Within Each User Story

- Models → Schemas → Endpoints → Frontend consumers
- Backend before frontend (data producer before data consumer)
- Core rendering before zone specialization

### Parallel Opportunities

- T002 ∥ T001 (different files, no dependencies)
- T005 ∥ T003, T004 (schemas vs models, different files)
- T007 ∥ T006 (test file vs seed script, different files)
- T013 ∥ T010, T011, T012 (test file vs endpoint, different files)
- T025 ∥ T028 (config docs vs cleanup, independent)

---

## Parallel Example: Phase 1

```
# These can run simultaneously:
T001: Create database session factory in backend/app/core/database.py
T002: Update config.py with file-based SQLite URL

# Then these can run simultaneously:
T003 + T004: Add Level model and relationship in backend/app/models/layout.py
T005: Create Pydantic schemas in backend/app/schemas/layout.py
```

---

## Implementation Strategy

### MVP First (US3 + US1 Only)

1. Complete Phase 1: Setup (T001-T005)
2. Complete Phase 2: Foundational (T006-T009)
3. Complete Phase 3: US3 Layout API (T010-T013)
4. Complete Phase 4: US1 3D Rendering (T014-T020)
5. **STOP and VALIDATE**: Seed → Run → Refresh → Does the 3D scene match the DB?
6. Demo-ready at this point

### Full Delivery

7. Complete Phase 5: US2 Zone Visualization (T021-T024)
8. Complete Phase 6: Polish (T025-T028)

---

## Notes

- US3 is listed before US1 because it is a technical prerequisite (backend before frontend)
- Both US3 and US1 are P1 priority per the spec
- US2 (P2) extends the renderer built in US1 — not independently parallelizable
- Total: **28 tasks** across 6 phases
