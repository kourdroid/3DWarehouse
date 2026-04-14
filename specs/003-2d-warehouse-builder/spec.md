# Feature Specification: 2D Warehouse Builder

**Feature Branch**: `003-2d-warehouse-builder`  
**Created**: 2026-03-09  
**Status**: Draft  
**Input**: User description: "A 2D top-down visual editor that allows warehouse operators to configure their warehouse layout by drawing zones, setting aisle/bay/level parameters, and generating the 3D digital twin automatically. Must support any warehouse on earth with any location code schema. Configuration should take minutes, not hours."

## Clarifications

### Session 2026-03-09

- Q: Should one account manage multiple warehouses? → A: Yes. Each client account can configure multiple independent warehouses, selectable from a dropdown.
- Q: Where does the builder live relative to the 3D viewer? → A: Same application, separate route. Builder at `/builder`, viewer at `/viewer`, shared backend and auth.
- Q: How should saving work in the builder? → A: Explicit save via a "Save & Generate" button. Changes are only persisted and pushed to the 3D viewer when the operator clicks save.
- Q: Should the builder support undo/redo? → A: Yes. Basic undo/redo (Ctrl+Z / Ctrl+Y) for move, resize, delete, and parameter changes.
- Q: Who can access the builder? → A: Only Admin/Manager roles. Viewers see the 3D twin as read-only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Draw Warehouse Footprint (Priority: P1)

A warehouse operator opens the builder in their browser. They see an empty grid canvas measured in meters. They click "New Warehouse," enter the warehouse name, then drag to define the total floor area (e.g., 60m × 120m). The canvas now shows a scaled rectangle representing their warehouse boundary.

**Why this priority**: Without a footprint, no zones can be placed. This is the absolute foundation of every configuration.

**Independent Test**: Can be tested by creating a warehouse footprint and verifying it persists when the page is refreshed.

**Acceptance Scenarios**:

1. **Given** the builder is open, **When** the operator creates a new warehouse with name "Casablanca DC" and drags a 60×120m area, **Then** a labeled rectangle appears on the canvas with correct meter dimensions shown on the edges.
2. **Given** a footprint exists, **When** the operator resizes it by dragging a corner, **Then** the dimensions update in real time and the canvas re-scales.
3. **Given** a footprint has been configured, **When** the operator refreshes the page, **Then** the previous footprint loads from the server exactly as it was saved.

---

### User Story 2 — Add and Configure Rack Zones (Priority: P1)

The operator selects "Add Rack Zone" from a toolbar and drags a rectangle inside the warehouse footprint to define where the zone sits. A side panel appears where they configure the zone's internal structure: number of aisles, aisle spacing, bays per aisle, bay width, levels per bay, level height, and pallets per bay. They can also name the zone and pick a display color. The 2D canvas shows a simplified top-down preview of the aisles inside the zone rectangle.

**Why this priority**: Rack zones are the most common storage type in warehouses globally. Without this, the builder cannot model the majority of warehouses.

**Independent Test**: Can be tested by adding a rack zone with specific parameters and verifying the correct number of database records (Zone, Aisle, RackBay, Level, StorageUnit) are created.

**Acceptance Scenarios**:

1. **Given** a warehouse footprint exists, **When** the operator drags a rack zone into position and sets 8 aisles / 15 bays / 5 levels / 3 pallets per bay, **Then** the zone appears on the canvas with 8 parallel lines (representing aisles) and the side panel shows a summary: "8 aisles × 15 bays × 5 levels × 3 pallets = 1,800 storage positions."
2. **Given** a rack zone is on the canvas, **When** the operator changes the number of aisles from 8 to 6, **Then** the 2D preview updates immediately to show 6 parallel lines instead of 8.
3. **Given** a rack zone is configured, **When** the operator changes the zone color to red, **Then** the zone rectangle and its internal lines update to the new color on the canvas.
4. **Given** two rack zones exist, **When** the operator drags one zone to overlap with another, **Then** the system shows a visual warning (red border) indicating an overlap conflict.

---

### User Story 3 — Add and Configure Floor Bulk Zones (Priority: P2)

The operator selects "Add Bulk Zone" and drags a rectangle on the canvas. This zone represents a floor area where pallets are placed directly on the ground (no racking). The side panel lets them name the zone, set a color, and define how many floor slots exist within the area (e.g., 50 positions in a grid).

**Why this priority**: Many warehouses have mixed configurations (racks + floor bulk). Supporting this covers the second most common layout type.

**Independent Test**: Can be tested by adding a bulk zone, saving, and verifying the generated StorageUnit records appear with correct location codes.

**Acceptance Scenarios**:

1. **Given** a warehouse footprint exists, **When** the operator adds a bulk zone at position (38m, 0m) with 50 floor positions, **Then** the canvas shows a distinct rectangle (different visual style from rack zones) with a grid overlay suggesting floor slot positions.
2. **Given** a bulk zone exists, **When** the operator saves the configuration, **Then** 50 StorageUnit records are created with sequential location codes.

---

### User Story 4 — Custom Location Code Schema (Priority: P2)

Every warehouse uses a different location code format. The operator must be able to define their own naming pattern. When configuring a zone, they set a "location code pattern" — a template string like `E{zone_num:02d}-{aisle_num:02d}-{bay_num:03d}` or `{zone_name}-R{aisle_num}-B{bay_num}-N{level_num}`. The system generates all location codes from this pattern when saving.

**Why this priority**: Without this, clients cannot match their WMS codes to the 3D model. Every WMS uses its own scheme, so the system must adapt.

**Independent Test**: Can be tested by defining a custom pattern, saving the zone, then checking that StorageUnit.location_code values match the expected format.

**Acceptance Scenarios**:

1. **Given** a rack zone with 2 aisles / 3 bays / 2 levels, **When** the operator sets the pattern to `E01-{aisle:02d}-{bay:03d}`, **Then** the generated location codes are `E01-01-001`, `E01-01-002`, `E01-01-003`, `E01-02-001`, `E01-02-002`, `E01-02-003` (per level).
2. **Given** a pattern is set, **When** the operator previews the codes, **Then** a summary table shows all generated codes with their zone/aisle/bay/level mapping, allowing the operator to verify correctness before saving.
3. **Given** a pattern would create duplicate codes (e.g., two zones with the same prefix and overlapping numbers), **When** the operator saves, **Then** the system rejects the save and shows a clear error identifying the duplicate codes.

---

### User Story 5 — Save & Generate 3D (Priority: P1)

After configuring all zones, the operator clicks "Save & Generate." The system persists the full layout to the database and triggers the 3D viewer to reload. The operator then switches to the 3D tab and sees their warehouse rendered with racks, beams, and floor markings exactly matching their 2D configuration.

**Why this priority**: This is the delivery moment — the entire builder's value proposition. If the 3D doesn't match the 2D configuration, the feature fails.

**Independent Test**: Can be tested by configuring a layout in the builder, saving it, then opening the 3D viewer and verifying the zone count, aisle count, and overall structure match.

**Acceptance Scenarios**:

1. **Given** a complete layout with 2 rack zones and 1 bulk zone configured in the builder, **When** the operator clicks "Save & Generate," **Then** the 3D viewer displays exactly 2 sets of rack structures and 1 floor-marked bulk area positioned according to the 2D layout.
2. **Given** a layout was previously generated, **When** the operator modifies one zone (e.g., adds 2 more aisles) and clicks "Save & Generate" again, **Then** the 3D viewer updates to reflect the change without duplicating existing structures.
3. **Given** the operator saves a new layout, **When** a WebSocket-connected 3D viewer is already open, **Then** the viewer receives an updated SNAPSHOT event and re-renders automatically without manual refresh.

---

### User Story 6 — Load and Edit Existing Layout (Priority: P3)

The operator opens the builder and their previously saved layout loads automatically. They see all zones positioned as before and can click on any zone to edit its parameters or drag it to a new position. Changes are saved incrementally.

**Why this priority**: Essential for iterative refinement, but not needed for the initial onboarding flow (create once, view in 3D).

**Independent Test**: Can be tested by saving a layout, refreshing the page, and verifying all zone positions, names, colors, and parameters are restored correctly.

**Acceptance Scenarios**:

1. **Given** a layout was previously saved with 3 zones, **When** the operator opens the builder, **Then** all 3 zones appear at their correct positions with correct names and colors.
2. **Given** a zone is loaded, **When** the operator clicks it, **Then** the side panel shows the correct parameter values that were previously saved.

---

### Edge Cases

- What happens when the operator tries to place a zone outside the warehouse footprint? → System should constrain the zone within the footprint boundaries.
- What happens when the operator tries to save a warehouse with zero zones? → System should warn that at least one zone is required.
- What happens when the operator enters unrealistic values (e.g., 1000 levels per bay)? → System should enforce sensible maximums and show validation errors.
- What happens when two users try to edit the same warehouse layout simultaneously? → The last save wins, with a warning if the layout has been modified since the user loaded it.
- What happens on a small screen or mobile device? → The builder should show a minimum viewport warning; the canvas requires a desktop-sized screen.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a 2D grid canvas that represents the warehouse floor plan in meters.
- **FR-002**: System MUST allow operators to create, resize, and delete a warehouse footprint.
- **FR-003**: System MUST allow operators to add, position, resize, and delete rack zones within the footprint.
- **FR-004**: System MUST allow operators to add, position, resize, and delete floor bulk zones within the footprint.
- **FR-005**: System MUST allow operators to configure zone parameters: aisles, aisle spacing, bays per aisle, bay width, levels per bay, level height, and pallets per bay.
- **FR-006**: System MUST support configurable location code patterns per zone, using template variables for zone, aisle, bay, and level identifiers.
- **FR-007**: System MUST validate that no two zones overlap on the canvas and display a visual warning when overlap is detected.
- **FR-008**: System MUST validate that all zones fit within the warehouse footprint boundaries.
- **FR-009**: System MUST persist the complete layout configuration via an API endpoint.
- **FR-010**: System MUST generate all database records (Zone, Aisle, RackBay, Level, StorageUnit) from the saved configuration.
- **FR-011**: System MUST trigger an automatic 3D viewer refresh when a new layout is saved.
- **FR-012**: System MUST load a previously saved layout when the builder page is opened.
- **FR-013**: System MUST enforce validation limits on zone parameters (e.g., max 100 aisles, max 50 levels, bay width between 0.5m and 10m).
- **FR-014**: System MUST display a summary of total storage positions per zone as parameters are configured.
- **FR-015**: System MUST prevent saving configurations that produce duplicate location codes.
- **FR-016**: System MUST support multiple independent warehouse layouts per account, selectable from a list.
- **FR-017**: Builder and 3D viewer MUST be separate routes within the same application, sharing a common backend and authentication context.
- **FR-018**: Layout changes MUST only persist and trigger 3D regeneration when the operator explicitly clicks "Save & Generate." No auto-save to production layout.
- **FR-019**: Builder MUST support basic undo/redo (Ctrl+Z / Ctrl+Y) for zone move, resize, delete, and parameter changes.
- **FR-020**: Builder access MUST be restricted to Admin and Manager roles. Viewer-role users can only access the 3D viewer as read-only.

### Key Entities

- **WarehouseLayout**: The root container representing one physical warehouse. Attributes: name, total width, total length.
- **Zone**: A rectangular area within the warehouse with a specific storage type (rack or floor bulk). Attributes: name, position, dimensions, color, storage type, location code pattern.
- **Aisle**: A row of racking within a zone. Attributes: identifier, spacing offset.
- **RackBay**: A single bay within an aisle. Attributes: width, sequence number, pallets per bay.
- **Level**: A vertical tier within a bay. Attributes: height, weight capacity.
- **StorageUnit**: An atomic storage position with a unique location code generated from the zone's pattern.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator can configure a new warehouse layout from scratch in under 5 minutes using only the visual builder (no code editing, no database access).
- **SC-002**: The 3D viewer renders a warehouse structure that exactly matches the zone count, aisle count, and bay count defined in the 2D builder.
- **SC-003**: 100% of generated location codes are unique within a single warehouse.
- **SC-004**: The system supports warehouses ranging from 5 storage positions to 50,000 storage positions without performance degradation in the builder.
- **SC-005**: Editing an existing layout and re-generating produces a correct 3D update in under 3 seconds.
- **SC-006**: Any location code schema provided by a client's WMS can be expressed using the template pattern system.

### Assumptions

- Operators access the builder on a desktop browser (minimum 1280×720 viewport). Mobile is out of scope for this version.
- Each client account can manage multiple independent warehouses, selectable from a dropdown list. Cross-warehouse features (search, comparison) are out of scope for this version.
- Zone shapes are always rectangular. Irregular polygon zones are out of scope.
- The system handles the most common warehouse configurations: standard racking, floor bulk storage. Specialized storage (automated retrievals, carousels, conveyors) is out of scope.
