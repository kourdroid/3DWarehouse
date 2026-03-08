# WebSocket API Contract: 3D Warehouse

## Connection
**Endpoint**: `ws://[host]:[port]/api/v1/stream/ws`
**Protocol**: `ws` or `wss`

## Pushed Events (Server -> Client)

The backend streams events to the connected frontend clients to trigger visual state changes in the 3D model.

### 1. Snapshot Event
Sent immediately upon successful connection. Contains the full state of the warehouse.

```json
{
  "type": "snapshot",
  "data": [
    {
      "location_code": "string (e.g., A0-B1-L2-0)",
      "status": "enum (OCCUPIED | EMPTY)",
      "quantity": "integer",
      "sku": "string"
    },
    ...
  ]
}
```

### 2. Update Event
Sent continuously (every 2 seconds by default in the mock generator) to simulate warehouse activity. The frontend `warehouse.instancing.js` intercepts this to mutate the specific `InstancedMesh` color buffer.

```json
{
  "type": "update",
  "data": {
    "location_code": "string",
    "status": "enum (OCCUPIED | EMPTY)",
    "quantity": "integer",
    "sku": "string",
    "timestamp": "ISO8601 string"
  }
}
```

## Client Actions
The client currently acts purely as a consumer (read-only) of the websocket stream. It does not send messages back to the server.
