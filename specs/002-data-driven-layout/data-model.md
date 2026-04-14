# Data Model: Data-Driven 3D Layout

## Entity Hierarchy

```
WarehouseLayout (1)
  └── Zone (N)
        ├── Aisle (N)      [for STANDARD_RACK zones]
        │     └── RackBay (N)
        │           └── Level (N)   ←── NEW
        │                 └── StorageUnit (N)
        └── StorageUnit (N)  [for FLOOR_BULK zones — directly under Zone]
```

## Entities

### WarehouseLayout
| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID | PK |
| name | String(255) | NOT NULL |
| total_width_meters | Float | NOT NULL |
| total_length_meters | Float | NOT NULL |
| created_at | DateTime | NOT NULL, auto |
| updated_at | DateTime | NOT NULL, auto |

### Zone
| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID | PK |
| layout_id | UUID | FK → WarehouseLayout, CASCADE |
| name | String(255) | NOT NULL |
| color_hex | String(7) | NOT NULL |
| storage_type | Enum(STANDARD_RACK, FLOOR_BULK) | NOT NULL |
| position_x_meters | Float | NOT NULL |
| position_z_meters | Float | NOT NULL |
| width_meters | Float | NOT NULL |
| length_meters | Float | NOT NULL |

### Aisle
| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID | PK |
| zone_id | UUID | FK → Zone, CASCADE |
| identifier | String(50) | NOT NULL |
| orientation | Enum(NORTH_SOUTH, EAST_WEST) | NOT NULL |
| start_x_meters | Float | NOT NULL |
| start_z_meters | Float | NOT NULL |

### RackBay
| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID | PK |
| aisle_id | UUID | FK → Aisle, CASCADE |
| identifier | String(50) | NOT NULL |
| sequence_number | Integer | NOT NULL |
| width_meters | Float | NOT NULL |

### Level (NEW)
| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID | PK |
| bay_id | UUID | FK → RackBay, CASCADE |
| level_number | Integer | NOT NULL |
| height_meters | Float | NOT NULL |
| max_weight_kg | Float | NOT NULL, default 1000.0 |

### StorageUnit
| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID | PK |
| zone_id | UUID | FK → Zone, CASCADE, nullable |
| bay_id | UUID | FK → RackBay, CASCADE, nullable |
| location_code | String(100) | UNIQUE, NOT NULL |
| level_number | Integer | NOT NULL, default 1 |
| elevation_meters | Float | NOT NULL, default 0.0 |
| max_weight_kg | Float | NOT NULL |
| is_active | Boolean | NOT NULL, default true |

## Validation Rules
- A `StorageUnit` must have either `zone_id` (for `FLOOR_BULK`) or `bay_id` (for `STANDARD_RACK`), never both.
- `color_hex` must match pattern `#[0-9A-Fa-f]{6}`.
- `width_meters`, `height_meters`, and all dimension fields must be > 0.
