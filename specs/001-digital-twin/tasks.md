---
description: "Task list template for feature implementation"
---

# Tasks: Real Warehouse Digital Twin Model

**Input**: Design documents from `/specs/001-digital-twin/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: 100% Test Coverage is REQUIRED for Domain Entities per Project Constitution. UI and WebSocket logic have optional tests depending on scope.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Initialize database migrations for new Layout schema in `backend/alembic/versions/`
- [ ] T002 Configure Redis Pub/Sub backplane connection in `backend/app/core/redis.py`
- [ ] T003 [P] Scaffold basic Three.js setup and environment in `Native/scripts/warehouse.scene.js`
- [ ] T004 [P] Scaffold application entry point and config in `Native/scripts/warehouse.app.js` and `Native/scripts/warehouse.config.js`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented
**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Create `WarehouseLayout` SQLAlchemy model in `backend/app/models/layout.py`
- [ ] T006 [P] Create `Zone`, `Aisle`, and `RackBay` SQLAlchemy models in `backend/app/models/layout.py`
- [ ] T007 [P] Create `StorageUnit` SQLAlchemy model linked to `RackBay` and logical inventory in `backend/app/models/layout.py`
- [ ] T008 **[TEST REQUIREMENT]** Write unit tests for all Layout Domain Entities ensuring 100% coverage in `backend/tests/models/test_layout.py`
- [ ] T009 Create Pydantic schemas for WS stream payloads (SNAPSHOT, UPDATE, ALERT) in `backend/app/schemas/streaming.py`
- [ ] T010 Implement core WebSocket connection handler and Redis listener in `backend/app/api/v1/stream.py`

**Checkpoint**: Foundation ready - Database schema and WebSocket infrastructure established.

---

## Phase 3: User Story 1 - Real-Time Operational Monitoring (Priority: P1) 🎯 MVP

**Goal**: Accurately reflect inventory state visually within a 3D structural model using real-time WebSockets.
**Independent Test**: Simulate an inventory status change via backend and observe the corresponding 3D bin change color within 2 seconds.

### Implementation for User Story 1

- [ ] T011 [P] [US1] Implement WS client connection and message demultiplexing in `Native/scripts/warehouse.stream.js`
- [ ] T012 [P] [US1] Implement `InstancedMesh` rendering logic for storage unit visualization in `Native/scripts/warehouse.instancing.js`
- [ ] T013 [US1] Link `warehouse.stream.js` UPDATE events to `InstancedMesh` color updates in `Native/scripts/warehouse.instancing.js`
- [ ] T014 [US1] Implement backend `SNAPSHOT` payload generation grabbing current state in `backend/app/api/v1/stream.py`
- [ ] T015 [US1] Handle incoming `SNAPSHOT` on frontend to initialize the 3D grid in `Native/scripts/warehouse.app.js`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently (MVP).

---

## Phase 4: User Story 2 - Accurate Structural Configuration (Priority: P2)

**Goal**: Render the 3D twin based precisely on the configurable schema (aisle widths, rack heights, specific zones).
**Independent Test**: Modify the layout attributes in PostgreSQL (e.g., change `storage_type` of a zone to `FLOOR_BULK`) and observe the twin rendering dynamically.

### Implementation for User Story 2

- [ ] T016 [P] [US2] Implement CRUD REST endpoints for Layout Schema management in `backend/app/api/v1/layout.py`
- [ ] T017 [US2] Parse `WarehouseLayout` and `Zone` configuration in frontend to determine boundaries in `Native/scripts/warehouse.scene.js`
- [ ] T018 [US2] Parse `Aisle` and `RackBay` configuration to position individual instances in `Native/scripts/warehouse.instancing.js`
- [ ] T019 [US2] Implement `FLOOR_BULK` vs `STANDARD_RACK` distinct visual rendering geometry in `Native/scripts/warehouse.instancing.js`

**Checkpoint**: The twin now strictly conforms to the dedicated structural database rather than a hardcoded grid.

---

## Phase 5: User Story 3 - Interactive Element Inspection (Priority: P3)

**Goal**: Allow users to click specific bins and see detailed inventory data.
**Independent Test**: Click different bins and verify the detail panel shows the correct ID, SKU, and Quantity payload.

### Implementation for User Story 3

- [ ] T020 [P] [US3] Implement Three.js `Raycaster` for detecting mesh intersections (clicks) in `Native/scripts/warehouse.interaction.js`
- [ ] T021 [US3] Map clicked instance ID back to `StorageUnit` logical data stored in `Native/scripts/warehouse.state.js`
- [ ] T022 [US3] Update HTML DOM UI Panel (`Native/index.html`) with mapped data in `Native/scripts/warehouse.interaction.js`

**Checkpoint**: Users can visually query the 3D space.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T023 Implement JWT authentication extraction from iframe URL parameters in `Native/scripts/warehouse.app.js`
- [ ] T024 Validate JWT Token on WebSocket connection step in `backend/app/api/v1/stream.py`
- [ ] T025 [P] Setup camera controls (OrbitControls) to traverse from macro to micro views smoothly in `Native/scripts/warehouse.scene.js`
- [ ] T026 Add error handling for WS disconnect/reconnects with exponential backoff in `Native/scripts/warehouse.stream.js`

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup and Phase 2: Foundational (CRITICAL)
2. Complete Phase 3: User Story 1 (Real-Time Monitoring)
3. **STOP and VALIDATE**: Test User Story 1 using the local test script from `quickstart.md`.
4. The system is functional for passive observation of a generated grid. 

### Incremental Delivery

1. After MVP, execute Phase 4 (Accurate Configuration) to link the visuals to strict DB mapping.
2. Execute Phase 5 (Interaction) to add UI drill-downs.
3. Finish with Phase 6 (Security and Polish) to finalize the embedded inherited auth contract.
