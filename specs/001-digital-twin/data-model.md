# Data Model: Real Warehouse Digital Twin Model

**Feature**: 001-digital-twin
**Date**: 2026-02-26

## Overview
This document defines the physical layout schema that allows the 3D Twin to render an accurate structural representation of the warehouse, independent of the logical WMS inventory data.

## Entities

### `WarehouseLayout`

Represents the macro configuration of the entire warehouse physical space.

**Fields**:
- `id` (UUID, Primary Key)
- `name` (String, e.g., "Main Facility DC1")
- `total_width_meters` (Float)
- `total_length_meters` (Float)
- `created_at` (DateTime)
- `updated_at` (DateTime)

**Validation/Constraints**:
- Only one active layout is rendered at a time per facility.

---

### `Zone`

A logical sub-area within the layout with specific rendering properties (e.g., floor storage vs rack storage).

**Fields**:
- `id` (UUID, Primary Key)
- `layout_id` (UUID, Foreign Key → `WarehouseLayout.id`)
- `name` (String, e.g., "Pallet Picking A1", "Zone de Masse")
- `color_hex` (String, visual indicator for the zone floor)
- `storage_type` (Enum: `STANDARD_RACK`, `FLOOR_BULK`)
- `position_x_meters` (Float, relative to layout origin)
- `position_z_meters` (Float, relative to layout origin)
- `width_meters` (Float)
- `length_meters` (Float)

---

### `Aisle`

A structural row containing racks. (Used primarily for grouping and spacing).

**Fields**:
- `id` (UUID, Primary Key)
- `zone_id` (UUID, Foreign Key → `Zone.id`)
- `identifier` (String, e.g., "Aisle 01")
- `orientation` (Enum: `NORTH_SOUTH`, `EAST_WEST`)
- `start_x_meters` (Float)
- `start_z_meters` (Float)

---

### `RackBay`

A vertical column of storage locations within an aisle.

**Fields**:
- `id` (UUID, Primary Key)
- `aisle_id` (UUID, Foreign Key → `Aisle.id`)
- `identifier` (String, e.g., "Bay 12")
- `sequence_number` (Integer, order along the aisle)
- `width_meters` (Float)

---

### `StorageUnit` (The Target Node)

The precise physical location where an `InventoryItem` can be placed. This is the atomic unit rendered in the 3D instanced mesh.

**Fields**:
- `id` (UUID, Primary Key)
- `bay_id` (UUID, Foreign Key → `RackBay.id` - nullable for FLOOR_BULK)
- `zone_id` (UUID, Foreign Key → `Zone.id` - required if bay_id is null)
- `location_code` (String, Unique e.g., "A01-B12-L03". Must map to the WMS logical location)
- `level_number` (Integer, 1 = floor, 2 = first beam, etc.)
- `elevation_meters` (Float, Y-axis height from floor)
- `max_weight_kg` (Float)
- `is_active` (Boolean)

**Relationships**:
- Has Zero-to-One `InventoryItem` (managed by external WMS logical state, linked via `location_code`).

**State Transitions (Visual)**:
- `EMPTY` (No inventory linked) → Renders semi-transparent or specific empty material.
- `OCCUPIED` (Inventory linked) → Renders solid material based on fill percentage or item category.
- `ERROR` (Orphan data/Mismatch) → Renders flashing red.
