# API Contracts: Real Warehouse Digital Twin Model

**Feature**: 001-digital-twin
**Date**: 2026-02-26

## 1. WebSocket Connection (Frontend → Backend)

### Endpoint
`wss://[API_DOMAIN]/api/v1/warehouse/stream`

### Authentication
JWT passed via query parameter (for standard browser WebSocket API compatibility without custom headers).

```
wss://[API_DOMAIN]/api/v1/warehouse/stream?token=eyJhbG...
```

---

## 2. Server-to-Client Payloads (Backend → Frontend)

All messages from the server are JSON-encoded strings.

### 2.1 Full State Snapshot (Initial Load)
Sent immediately upon successful connection authentication.

**Event Type**: `SNAPSHOT`

```json
{
  "event": "SNAPSHOT",
  "data": {
    "layout": {
      "id": "uuid-123",
      "name": "Main Facility",
      "dimensions": { "width": 100.0, "length": 250.0 },
      "zones": [ ... ]
    },
    "inventory_state": [
      {
        "storage_unit_id": "uuid-abc",
        "location_code": "A01-B12-L01",
        "status": "OCCUPIED",
        "fill_percentage": 100,
        "sku": "SKU-9992",
        "quantity": 50
      },
      ...
    ]
  }
}
```

### 2.2 Delta Update (Real-time Stream)
Sent whenever an inventory event occurs in the WMS (e.g., a pallet is moved or picked).

**Event Type**: `UPDATE`

```json
{
  "event": "UPDATE",
  "data": {
    "storage_unit_id": "uuid-abc",
    "location_code": "A01-B12-L01",
    "status": "EMPTY",
    "fill_percentage": 0,
    "sku": null,
    "quantity": 0
  }
}
```

### 2.3 Error/Alert Update
Sent when a logical error occurs requiring visual attention (e.g., WMS reports a pallet in a location that physically doesn't exist, or capacity exceeded).

**Event Type**: `ALERT`

```json
{
  "event": "ALERT",
  "data": {
    "level": "WARNING",
    "storage_unit_id": "uuid-abc",
    "message": "Weight capacity exceeded (1200kg / 1000kg max)"
  }
}
```

---

## 3. Client-to-Server Payloads (Frontend → Backend)

The connection is primarily read-only for the client, but supports subscription filtering if the warehouse is too large to stream entirely.

### 3.1 Subscribe to Zone
*(Optional optimization)* Tells the server to only send delta updates for specific physical zones.

**Event Type**: `SUBSCRIBE`

```json
{
  "action": "SUBSCRIBE",
  "zone_ids": ["uuid-zone1", "uuid-zone2"]
}
```
