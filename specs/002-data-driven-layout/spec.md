# Feature Specification: Data-Driven 3D Layout

**Feature Branch**: `002-data-driven-layout`  
**Created**: 2026-03-09  
**Status**: Draft  
**Input**: User description: "Connect the DB layout models (Zones, Aisles, Bays, Levels) to the 3D engine so any warehouse can be visualized by simply configuring the database. Hot-swappable topology."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Layout-Driven 3D Rendering (Priority: P1)

As a warehouse integrator, I configure the warehouse structure (zones, aisles, bays, levels) in the database, and the 3D visualizer renders the exact physical layout without any code changes.

**Why this priority**: This is the core value proposition. Without it, the product is a hard-coded demo, not a product. Every downstream feature (multi-warehouse, analytics, zone management) depends on the 3D engine reading its topology from data.

**Independent Test**: Create two different warehouse configurations in the database (one with 4 aisles and 6 levels, another with 10 aisles and 3 levels). Load each in the browser. The 3D scene must visually match the configuration.

**Acceptance Scenarios**:

1. **Given** a warehouse layout with 3 zones and varying aisle counts exists in the database, **When** the frontend loads, **Then** the 3D scene renders racks matching the exact zone boundaries, aisle positions, bay widths, and level heights from the database.
2. **Given** the database layout is modified (e.g., an aisle is moved 5 meters), **When** the user refreshes the browser, **Then** the 3D scene reflects the updated positions without any code deployment.
3. **Given** an empty database with no layout configured, **When** the frontend loads, **Then** it displays a clear "No warehouse configured" message instead of crashing.

---

### User Story 2 — Zone-Aware Visualization (Priority: P2)

As a warehouse manager, I see different areas of the warehouse rendered with distinct visual styles based on their zone type — racked pallet storage zones look different from floor bulk ("zone de masse") areas.

**Why this priority**: Real warehouses are not uniform. A "zone de masse" has no racks — pallets sit flat on the ground. Differentiating zone types visually is essential for accurate spatial awareness.

**Independent Test**: Configure two zones: one of type `STANDARD_RACK` and one of type `FLOOR_BULK`. Verify that the rack zone renders vertical metal uprights and beams, while the floor zone renders a colored ground area with pallet slots directly on the floor.

**Acceptance Scenarios**:

1. **Given** a zone with type "STANDARD_RACK", **When** it renders, **Then** the system generates vertical rack uprights, horizontal beams, and stacked pallet positions at each configured level height.
2. **Given** a zone with type "FLOOR_BULK" (zone de masse), **When** it renders, **Then** the system generates a flat colored ground plane with pallet positions arranged in a grid at floor level only — no vertical racking.
3. **Given** a zone with a custom `color_hex` value, **When** it renders, **Then** the zone's visual elements (rack color or floor tint) match the configured color.

---

### User Story 3 — Layout Served via API (Priority: P1)

As the frontend application, I request the full warehouse physical structure from a single backend endpoint and receive a hierarchical JSON tree that I can parse to build the 3D scene.

**Why this priority**: This is a technical prerequisite for US1. The frontend cannot render from the database without an API endpoint to serve the data.

**Independent Test**: Call the endpoint directly and verify the returned JSON contains the correct nested hierarchy (warehouse → zones → aisles → bays → levels) matching the database seed data.

**Acceptance Scenarios**:

1. **Given** a warehouse layout exists in the database, **When** the endpoint is called, **Then** it returns a JSON payload with all zones, their aisles, bays, and level configurations nested hierarchically.
2. **Given** the database has no layout, **When** the endpoint is called, **Then** it returns an appropriate error response (not a server crash).

---

### Edge Cases

- What happens when a zone has zero aisles? → The zone boundary renders but no racks appear inside it.
- What happens when an aisle has zero bays? → The aisle is skipped during rendering.
- What happens when bay widths vary within the same aisle? → Each bay is positioned using its own individual width, not a global constant.
- What happens when two zones overlap spatially? → The system renders both; visual overlap is the integrator's responsibility to avoid via proper coordinates.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST serve the complete warehouse physical structure as a hierarchical JSON payload from a single endpoint.
- **FR-002**: The JSON payload MUST include zones, each with their aisles, each with their bays, each with their levels and physical dimensions.
- **FR-003**: The 3D engine MUST read the layout structure from the API response, not from hardcoded configuration constants.
- **FR-004**: The 3D engine MUST support at least two zone rendering strategies: `STANDARD_RACK` (vertical shelving) and `FLOOR_BULK` (flat ground storage).
- **FR-005**: Each zone MUST be visually distinguished by its configured color.
- **FR-006**: Position calculations (X, Y, Z) for every rack, beam, and pallet MUST derive from the API-provided coordinates and dimensions, not from index-based multiplication.
- **FR-007**: The system MUST gracefully handle a missing or empty layout by displaying a user-friendly message.
- **FR-008**: The inventory overlay (existing `wmsData` and `handleUpdateDelta`) MUST continue to function on top of the new layout-driven structure.

### Key Entities

- **Warehouse**: The top-level container. Has a name and overall floor dimensions.
- **Zone**: A logical area within the warehouse (e.g., "Cold Storage", "Zone de Masse"). Has a type (`STANDARD_RACK`, `FLOOR_BULK`), a color, and a position offset.
- **Aisle**: A row of racks within a zone. Has a unique identifier, a start position, and an orientation.
- **Bay**: A single vertical column within an aisle. Has a width and a sequence number.
- **Level**: A horizontal shelf within a bay. Has a height offset and optional weight capacity.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Two visually distinct warehouse configurations can be rendered by changing only database records — zero code or config file changes required.
- **SC-002**: The 3D scene renders correctly with warehouses containing between 1 and 50 aisles with varying bay counts per aisle.
- **SC-003**: "Zone de masse" (floor bulk) areas render as flat ground zones, visually distinct from vertical racking zones.
- **SC-004**: The full layout loads and renders within 3 seconds for a warehouse of up to 20 zones and 200 aisles.
- **SC-005**: Existing real-time inventory updates (WebSocket color changes) continue working seamlessly on top of the new layout.

## Assumptions

- MVP targets a single active warehouse. Multi-warehouse switching is a future feature (V4 per CDC).
- The database will be pre-seeded with layout data by an administrator or import script; there is no admin UI for layout editing in this feature scope.
- The existing `warehouse.config.js` constants (`rackWidth`, `levelHeight`, etc.) will become fallback defaults that are overridden by per-bay/per-level values from the API when available.
