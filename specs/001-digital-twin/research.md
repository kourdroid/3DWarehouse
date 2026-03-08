# Research: Real Warehouse Digital Twin Model

**Feature**: 001-digital-twin
**Date**: 2026-02-26

## Objective
To resolve technical unknowns regarding the implementation of a 3D digital twin within the existing FastAPI + PostgreSQL + Vanilla JS/Three.js ecosystem, ensuring compliance with the project's Core Principles (specifically the "Sovereign Audit" and "100-Step Prediction").

## Findings

### Topic 1: 3D Layout Schema Design (Kleppmann Principles)

- **Unknown**: How to store the 3D physical configuration mapped against the logical WMS inventory without creating tight, fragile coupling?
- **Decision**: Separate the Layout schema from the Inventory tracking schema. Introduce a `StorageUnit` mapping entity that links a physical 3D coordinate (Aisle/Bay/Level, XYZ absolute) to a logical `InventoryItem` UUID.
- **Rationale**: Follows Domain-Driven Design (Clean Architecture). The 3D view only needs to know *what* to draw and *where* to draw it. When an inventory update occurs via WebSocket, the payload only needs to contain `StorageUnitID` and the visual state payload (quantity, color).
- **Alternatives Rejected**: Standard JSON blobs inside a single `Warehouse` table. Rejected because it prevents efficient querying/indexing of specific zones or bays when rendering partial scenes, violating performance hygiene at 50,000 units.

### Topic 2: WebSocket Streaming Architecture

- **Unknown**: How to push high-frequency inventory changes to the Three.js client efficiently?
- **Decision**: Use FastAPI `WebSocket` endpoints with a Redis Pub/Sub backplane (or similar lightweight memory broker) to fan-out events to connected clients.
- **Rationale**: Native FastAPI feature. Minimal bloat. Handles concurrent connections efficiently using standard Python async.
- **Alternatives Rejected**: Server-Sent Events (SSE). Rejected per user clarification (Option A: WebSockets).

### Topic 3: 3D Rendering Performance (50,000 units)

- **Unknown**: How to render 50k interactive objects in Three.js at 60 FPS on standard hardware?
- **Decision**: Implement `THREE.InstancedMesh`. Instead of creating 50,000 individual `Mesh` objects, we create 1 base geometry (e.g., a generic box representing a pallet slot) and draw it 50,000 times using a transformation matrix array.
- **Rationale**: WebGL draw calls are the primary bottleneck. Instancing reduces draw calls from 50,000 to 1 per material type. Colors (occupancy state) can be updated via `InstancedMesh.setColorAt`.
- **Alternatives Rejected**: Merging geometries (violates the requirement for individual interactive elements per FR-006).

### Topic 4: Application Context & Inheritance

- **Unknown**: How to integrate the WebGL canvas securely into the parent WMS application?
- **Decision**: Deliver the 3D Twin as a standalone `index.html` file designed to be embedded within an `<iframe>`. Authentication will be handled by passing an short-lived JWT token via `URLSearchParams` or `postMessage` upon initialization. The backend WebSocket will validate this token upon connection upgrade.
- **Rationale**: Isolates the Three.js dependency tree and DOM management from the parent framework (React/Angular/etc.), preventing memory leaks and CSS conflicts.

## Conclusion
All `NEEDS CLARIFICATION` aspects from the initial plan template have been resolved through architectural decisions governed by the project Constitution. We are ready to proceed to Phase 1: Design & Contracts.
