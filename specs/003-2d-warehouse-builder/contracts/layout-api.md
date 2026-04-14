# API Contract: Layout Configuration

**Feature**: 003-2d-warehouse-builder  
**Date**: 2026-03-09

## POST /api/v1/layouts/configure

Atomically replaces the warehouse layout configuration. Drops all existing zones, aisles, bays, levels, and storage units for the given layout, then recreates them from the request body.

### Request

```json
{
  "layout_id": "uuid (optional — omit for new warehouse, include for update)",
  "name": "Casablanca Distribution Center",
  "total_width_meters": 60.0,
  "total_length_meters": 120.0,
  "zones": [
    {
      "name": "Zone A - Stockage",
      "storage_type": "STANDARD_RACK",
      "color_hex": "#2563eb",
      "position_x_meters": 0.0,
      "position_z_meters": 0.0,
      "width_meters": 25.0,
      "length_meters": 40.0,
      "location_code_pattern": "E01-{aisle:02d}-{bay:03d}",
      "aisles": 8,
      "aisle_spacing_meters": 4.0,
      "bays_per_aisle": 15,
      "bay_width_meters": 2.8,
      "levels_per_bay": 5,
      "level_height_meters": 1.5,
      "pallets_per_bay": 3
    },
    {
      "name": "Zone B - Masse",
      "storage_type": "FLOOR_BULK",
      "color_hex": "#f59e0b",
      "position_x_meters": 38.0,
      "position_z_meters": 0.0,
      "width_meters": 20.0,
      "length_meters": 15.0,
      "location_code_pattern": "BULK-{slot:03d}",
      "floor_slots": 50
    }
  ]
}
```

### Response (201 Created / 200 Updated)

```json
{
  "layout_id": "uuid",
  "name": "Casablanca Distribution Center",
  "total_storage_positions": 1850,
  "zones_created": 2,
  "message": "Layout configured successfully. 3D viewer will auto-refresh."
}
```

### Error Responses

**400 Bad Request** — Validation failure
```json
{
  "detail": "Zone 'Zone A' exceeds warehouse footprint. Zone extends to x=67.0m but warehouse width is 60.0m."
}
```

**409 Conflict** — Duplicate location codes
```json
{
  "detail": "Duplicate location codes generated: E01-01-001 appears in Zone A and Zone C."
}
```

---

## GET /api/v1/layouts

List all warehouse layouts for the current account.

### Response (200 OK)

```json
{
  "layouts": [
    {
      "id": "uuid",
      "name": "Casablanca DC",
      "total_width_meters": 60.0,
      "total_length_meters": 120.0,
      "zone_count": 3,
      "total_storage_positions": 1850,
      "updated_at": "2026-03-09T13:00:00Z"
    }
  ]
}
```

---

## GET /api/v1/layouts/{layout_id}/builder

Fetch the full configuration for the builder (includes zone parameters, not just structure).

### Response (200 OK)

Returns the same shape as the POST request body, with `layout_id` included and all computed values (aisles, bays, levels) materialized.

---

## DELETE /api/v1/layouts/{layout_id}

Delete a warehouse layout and all associated records (cascade).

### Response (204 No Content)
