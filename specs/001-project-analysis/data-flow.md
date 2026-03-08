# Data Flow Architecture

The following diagram illustrates the lifecycle of a real-time data update, flowing from the Backend generator to the internal Three.js GPU buffers.

```mermaid
sequenceDiagram
    participant B as Backend (FastAPI)
    participant WS as WebSocket Connection
    participant S as warehouse.stream.js
    participant I as warehouse.instancing.js
    participant R as Three.js Renderer

    Note over B: WMS Event Occurs
    B->>WS: Push JSON {location, status, sku}
    WS->>S: onmessage() triggered
    S->>I: handleUpdateDelta(payload)
    Note over I: 1. Find item in wmsData
    Note over I: 2. Get targetMesh & instanceId
    Note over I: 3. Calculate new color Hex
    I->>R: targetMesh.setColorAt(id, color)
    I->>R: instanceColor.needsUpdate = true
    Note over R: GPU Buffer Sync
    R-->>User: Visual Change Rendered
```

## Key Mechanisms
1. **Push over Pull**: The frontend never requests updates; it subscribes to the persistent WebSocket and reacts purely to pushed JSON.
2. **Buffer Mutation**: We do not destroy or recreate 3D objects. When status changes from `OCCUPIED` to `EMPTY`, the `warehouse.instancing.js` script simply overwrites the specific index within the InstancedMesh's color Float32Array and flags it for GPU upload.
