# Frontend Technical Architecture

The frontend of the 3D Warehouse Digital Twin is built using Vanilla JavaScript and Three.js (WebGL). It is designed to be highly modular and decoupled.

## Core Modules

- **`warehouse.config.js`**: Contains the physical constraints and dimensions of the warehouse layout (e.g., `rackWidth`, `aisleWidth`).
- **`warehouse.scene.js`**: Initializes the Three.js renderer, camera, orbital controls, and lighting. It acts as the canvas lifecycle manager.
- **`warehouse.state.js`**: Maintains the global application state and parsed data structures representing the inventory (`wmsData`).
- **`warehouse.instancing.js`**: The performance core of the visualizer. Instead of rendering thousands of individual `THREE.Mesh` objects, it uses `THREE.InstancedMesh`. 
  - It handles mathematical conversion from logical layout constraints (Aisle A, Bay B, Level L) to absolute `X, Y, Z` world coordinates.
  - Exposes the global `handleUpdateDelta(deltaData)` method to mutate the `instanceColor` of specific mesh instances when stock changes.
- **`warehouse.interaction.js`**: Implements Three.js `Raycaster` to handle mouse clicks. It maps intersected 3D faces back to their corresponding data object in `wmsData` using `instanceId`.
- **`warehouse.stream.js`**: The WebSocket consumer. It listens to `ws://localhost:8000/api/v1/stream/ws` and dispatches update events to `handleUpdateDelta()`.
- **`warehouse.app.js`**: The main entry point orchestrating the initialization sequence and the requestAnimationFrame loop.

## Performance Considerations
By strictly using `THREE.InstancedMesh` for racks, beams, pallets, and cartons, the application keeps draw calls to an absolute minimum (under 10), easily sustaining 60 FPS for tens of thousands of items. Single-threading is sufficient because the layout math is computed only once geometry initialization occurs, and subsequent updates only mutate Float32 buffer attributes (`instanceColor`).
