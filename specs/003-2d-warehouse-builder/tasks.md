---
description: "Implementation tasks for 2D Warehouse Builder"
---

# Tasks: 2D Warehouse Builder

**Input**: Design documents from `/specs/003-2d-warehouse-builder/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/layout-api.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Configure hash routing in `scripts/main.js` to support `#/builder` and `#/viewer`
- [x] T002 Add Konva.js (v9.x) via CDN script tag to `index.html`
- [x] T003 Create builder container div mapping in `index.html`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Update `backend/app/models/layout.py` to add `location_code_pattern` and `floor_slots` to Zone model
- [x] T005 [P] Update `backend/app/models/layout.py` to add `pallets_per_bay` to RackBay model 
- [x] T006 Update `backend/app/schemas/layout.py` with the new fields for validation
- [x] T007 Apply database schema changes (or recreate SQLite DB if using `seed.py`)
- [x] T008 [P] Initialize modular frontend files (`builder.canvas.js`, `builder.panel.js`, `builder.api.js`, `builder.commands.js`) in `scripts/builder/`
- [x] T009 Create `backend/app/api/v1/configure.py` router and register with `backend/app/main.py`

**Checkpoint**: Foundation ready - database models support new fields, routing and skeleton structure are ready.

---

## Phase 3: User Story 1 — Draw Warehouse Footprint (Priority: P1) 🎯 MVP

**Goal**: Operators can draw a scaled rectangle defining their warehouse floor area.

**Independent Test**: Can be tested by creating a warehouse footprint and verifying it renders at the correct dimensions visually.

### Implementation for User Story 1

- [x] T010 [US1] Implement undo/redo stack in `scripts/builder/builder.commands.js` to support all future canvas actions (satisfies FR-019 for footprint)
- [x] T011 [US1] Implement Konva Stage, Layer, and infinite grid background in `scripts/builder/builder.canvas.js`
- [x] T012 [P] [US1] Build side panel UI in `scripts/builder/builder.panel.js` for "New Warehouse" form (Name, Width, Length)
- [x] T013 [US1] Implement interaction handler to draw footprint rectangle with dimensions on canvas in `scripts/builder/builder.canvas.js`
- [x] T014 [US1] Implement canvas scaling/zoom/pan controls in `scripts/builder/builder.canvas.js`

**Checkpoint**: At this point, User Story 1 operates visually in the browser.

---

## Phase 4: User Story 2 — Add and Configure Rack Zones (Priority: P1)

**Goal**: Operators can drag a rack zone onto the footprint and configure Aisles, Bays, Levels, and Pallets.

**Independent Test**: Can be tested visually by adding a rack zone, changing constraints in UI, and verifying internal lines (aisles) update instantly.

### Implementation for User Story 2

- [x] T015 [US2] Build "Add Rack Zone" UI form in `scripts/builder/builder.panel.js` (Aisles, Spacing, Bays, etc.)
- [x] T016 [US2] Implement drag-and-drop zone creation onto the Konva canvas in `scripts/builder/builder.canvas.js`
- [x] T017 [US2] Implement Zone visual representation (Group, Rect, internal Lines for aisles) in `scripts/builder/builder.canvas.js`
- [x] T018 [US2] Implement zone resizing using Konva.Transformer in `scripts/builder/builder.canvas.js`
- [x] T019 [US2] Add overlap detection logic (visual warning on overlap) in `scripts/builder/builder.canvas.js`
- [x] T020 [US2] Add bounds detection (prevent moving outside footprint) in `scripts/builder/builder.canvas.js`

**Checkpoint**: At this point, User Stories 1 AND 2 operate visually in the frontend.

---

## Phase 5: User Story 5 — Save & Generate 3D (Priority: P1)

*(Note: Prioritized ahead of US3/US4 to unblock end-to-end data flow)*
**Goal**: The operator can save the visual layout, triggering backend generation of the 3D twin.

**Independent Test**: Configure layout, click save, verify 3D viewer renders identical topology.

### Implementation for User Story 5

- [x] T021 [US5] Implement `POST /api/v1/layouts/configure` endpoint logic in `backend/app/api/v1/configure.py` (atomic drop layout records)
- [x] T022 [US5] Implement `LayoutBuilderService` in `backend/app/services/layout_builder.py` to generate Zone/Aisle/Bay/Level models logically from JSON config
- [x] T023 [P] [US5] Implement frontend state serialization (Konva nodes to JSON payload) in `scripts/builder/builder.canvas.js`
- [x] T024 [P] [US5] Implement API push logic in `scripts/builder/builder.api.js` tied to "Save & Generate" button
- [x] T025 [US5] Integrate save success with WebSocket `SNAPSHOT` broadcast in `backend/app/api/v1/configure.py` to auto-refresh 3D viewer
- [x] T026 [US5] Update 3D `warehouse.instancing.js` to subdivide bays visually if `pallets_per_bay > 1`

**Checkpoint**: End-to-End core loop is functional. Visual builder pushes to DB, DB renders to 3D.

---

## Phase 6: User Story 3 — Add and Configure Floor Bulk Zones (Priority: P2)

**Goal**: Operators can add floor zones where pallets rest directly on the ground.

**Independent Test**: Can be tested visually in 2D builder, saved, and seen in 3D viewer.

### Implementation for User Story 3

- [x] T027 [US3] Build "Add Bulk Zone" UI form in `scripts/builder/builder.panel.js` (Floor Slots count input)
- [x] T028 [US3] Implement distinct visual style (grid overlay) for BULK zones in `scripts/builder/builder.canvas.js`
- [x] T029 [US3] Update `LayoutBuilderService` in `backend/app/services/layout_builder.py` to handle `FLOOR_BULK` storage generation (skip aisles/bays, generate direct layout grid)

---

## Phase 7: User Story 4 — Custom Location Code Schema (Priority: P2)

**Goal**: Accept template strings for parsing and generating unique WMS location codes.

**Independent Test**: Define pattern, verify generated `StorageUnit` location codes match the format string.

### Implementation for User Story 4

- [x] T030 [P] [US4] Add Location Code Pattern input to side panel forms in `scripts/builder/builder.panel.js`
- [x] T031 [US4] Implement regex template parsing logic in `LayoutBuilderService` (`backend/app/services/layout_builder.py`)
- [x] T032 [US4] Add duplicate location code validation check pre-commit in `backend/app/api/v1/configure.py`
- [x] T033 [US4] Expose a format preview API or frontend simulator to preview codes before saving

---

## Phase 8: User Story 6 — Load and Edit Existing Layout (Priority: P3)

**Goal**: Opening the builder restores the previously saved configuration.

**Independent Test**: Refresh page, verify zones populate in builder.

### Implementation for User Story 6

- [x] T034 [P] [US6] Implement `GET /api/v1/layouts/{layout_id}/builder` in `backend/app/api/v1/configure.py` (serving full aggregate model payload)
- [x] T035 [US6] Implement data loading in `scripts/builder/builder.api.js` on app startup
- [x] T036 [US6] Implement inverse serialization (JSON struct to Konva node instantiation) in `scripts/builder/builder.canvas.js`

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Security, limits, and final checks.

- [x] T037 [P] Implement validation limits (max 100 aisles, bay width 0.5-10m) in frontend `script/builder/builder.panel.js` and backend Pydantic schemas.
- [x] T038 Add role-based access checks (FR-020) for `#/builder` route and `/configure` APIs
- [x] T039 Clean up logging and error messages for deployment

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion - BLOCKS all user stories
- **US1 & US2 (Phases 3 & 4)**: Must run sequentially. Visual canvas (US1) is needed before dragging zones (US2).
- **US5 (Phase 5)**: Critical. Connects the 2D visual logic (US2) to the backend API and 3D rendering.
- **US3, US4, US6 (Phases 6, 7, 8)**: Parallelizable once Phase 5 is operational.

### Parallel Opportunities

- T004 - T006 (Backend schema modifications) can run parallel with T008 (Frontend skeleton generation).
- T012 (Side panel form logic) can be built in parallel with T011 (Canvas Grid rendering).
- T021 & T022 (Backend Layout creation API) can be built in parallel with T023 & T024 (Frontend payload generation).
- T026 (3D Instancing updates for multi-pallet bays) can be done anytime after Phase 2 schema changes.

## Implementation Strategy

### MVP First

1. Complete Setup + Foundational
2. Complete US1 (Canvas & Footprint)
3. Complete US2 (Rack Zones visually)
4. Complete US5 (Save logic to Database → render to 3D)
5. **STOP**: Test the core builder-to-viewer flow.

### Incremental Delivery

After MVP is proven:
6. Add Floor Bulk zones (US3)
7. Add Template engines (US4)
8. Add Save/Load state hydration (US6)
9. Lock down roles/validations (Polish)
