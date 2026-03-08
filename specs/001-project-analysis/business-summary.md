# Business Summary: 3D Warehouse MVP

The 3D Warehouse Digital Twin MVP is designed to provide immediate, actionable visibility into warehouse layout and stock density. 

## Current Capabilities
- **Static Layout Generation**: Automatically generates a full-scale 3D operational environment based on a defined structural schema (Aisles, Bays, Levels).
- **Live Operation Twinning**: Receives and visualizes sub-second inventory updates (stock arrivals, departures) without requiring page reloads, using passive WebSocket listening.
- **Granular Inspection**: Users can click on any individual pallet or box slot to instantly retrieve its associated SKU, status, and precise logical coordinates.
- **Performance**: Capable of mapping tens of thousands of individual goods dynamically in a standard web browser without performance degradation (constant 60 FPS).

## Out of Scope / Limitations
- **Predictive Simulations**: The MVP is an observational tool. It cannot simulate "what-if" scenarios, reorganize layouts via drag-and-drop, or calculate optimal picking paths.
- **Moving Equipment Tracking**: AGVs (Automated Guided Vehicles), forklifts, and personnel are not currently tracked or rendered in the 3D space.
- **Historical Playback**: The system currently reflects the immediate "now" and does not record states for historical scrubbing/playback.

## Strategic Value
By decoupling the heavy 3D rendering engine (Frontend Vanilla/Three.js) from the data processing layer (FastAPI Python Backend), the application guarantees that integrating future hardware telemetry (IoT sensors, advanced WMS feeds) will require zero modifications to the 3D rendering logic.
