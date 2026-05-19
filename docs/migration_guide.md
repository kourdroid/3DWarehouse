# 3D Warehouse - Project Handover & Migration Guide

## 1. What the Project Is

The **3D Warehouse (Digital Twin)** is an interactive, real-time 3D visualization tool that acts as a digital twin for physical warehouse environments. 
It ingests structural layout data and real-time inventory updates to render a fast (60 FPS) 3D model in the browser. It is intended to be embedded as an isolated component into an existing WMS (Warehouse Management System) frontend.

### Tech Stack
- **Frontend:** Vanilla JavaScript, Three.js (utilizing `InstancedMesh` for rendering thousands of storage units efficiently), WebSocket client. Served as static files.
- **Backend:** Python 3.10+, FastAPI, Uvicorn, WebSockets. Uses SQLAlchemy (currently SQLite) for managing physical structural layout models independently of the core WMS logical models.

---

## 2. What We Already Did

### Architecture & Infrastructure
- Initialized the split environment folder structure (`Native/backend` and `Native/scripts`).
- Defined explicit database schemas for the physical layout (e.g., Aisles, Bays, Levels, and Bins) in `app.models.layout` and `app.core.database`.
- Configured the FastAPI API routing (`/api/v1`) and skeleton endpoints for `layout`, `stock`, `configure`, and real-time `stream`.
- Configured CORS and WebSocket routes to seamlessly push payloads to the frontend.

### Frontend Rendering (Three.js)
- Implemented core WebGL setup: camera, lighting (Hemisphere + Directional for shadows), and OrbitControls in `warehouse.app.js`.
- Established the `InstancedMesh` architecture (`warehouse.instancing.js`) to maintain performance limits (rendering up to 50,000+ objects without dropping frames).
- Built interactive features: raycaster-based selection (pulsing selected pallets), autocomplete search, camera fly-to animations, and UI overlays on click.
- Created environment visual elements like Aisle labels, occupation status badges, and ambient dust particles.
- Integrated the WebSocket listener (`warehouseStream.connect()`) to trigger the generation of the scene via `handleSnapshot`.

---

## 3. What Else is Rest (Pending Tasks)

To bring the project to a finalized, production-ready state, the incoming engineer must focus on the following:

### Backend 
- **Live Stream / Event Integration:** The WebSocket stream currently outputs static/mocked snapshots. This needs to be wired directly into the actual WMS event bus (e.g., using Redis Pub/Sub or Kafka) so that a real-world inventory update instantly triggers a WebSocket push to clients.
- **Production Database:** Setup PostgreSQL to replace SQLite. Apply Alembic migrations for data structural persistence.
- **Authentication:** Implement secure token verification handling. The Digital Twin is meant to act as an embedded component (NFR-002), securely authenticating cross-origin via JWT headers from the parent WMS interface.

### Frontend
- **Zone Variation Support:** Improve parsing logic to distinctly handle standard standard rack storage versus bulk floor storage arrays dynamically, matching data-model configurations.
- **Bundling / Build Step:** Currently, the code is standard Native Javascript running bare. While sticking to vanilla JS is preferred, implementing a modern bundler (like Vite) is critical for dead-code elimination, minification, and proper asset handling before production deployment.
- **Testing Integration:** The frontend operates without a structured test suite. Implement Playwright/Cypress for E2E visuals, and complete the backend Pytest suite.
- **Edge Conditions Handling:** Account for missing dimensions, unsupported configurations, and orphan SKU drops gracefully on the canvas interface.

---
