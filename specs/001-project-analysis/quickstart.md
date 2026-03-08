# Quickstart: 3D Warehouse Native App

This application consists of a Python FastAPI backend that serves JSON data and WebSocket streams, and a static frontend (HTML/JS/CSS) that renders the 3D Warehouse using Three.js.

## Prerequisites
- Python 3.10+
- Node.js (optional, for local frontend serving if not using python http.server)

## Local Development Setup

### 1. Backend Setup
1. Open a terminal and navigate to the `backend` directory.
2. Ensure you have a virtual environment (`python -m venv venv`) and it is activated.
3. Install dependencies: `pip install -r requirements.txt` (or if using pip-tools/poetry, as specified in the backend).
4. Run the FastAPI server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   The backend will now be available at `http://localhost:8000`. API docs are at `http://localhost:8000/docs`.

### 2. Frontend Setup
1. Open a new terminal and navigate to the root directory `Native`.
2. Start a simple static HTTP server to serve the frontend files:
   ```bash
   python -m http.server 3000
   ```
3. Open your web browser and navigate to `http://localhost:3000`.

## Architecture Overview
- **Backend (`backend/app/`):** Manages the data schema, generates the mock WMS layout, and broadcasts real-time updates via WebSockets (`api/v1/stream.py`).
- **Frontend (`scripts/`):** 
  - `warehouse.config.js`: Central configurations for physical dimensions.
  - `warehouse.state.js`: Global state management and initialization logic.
  - `warehouse.scene.js`: Three.js boilerplate, lighting, and camera setup.
  - `warehouse.instancing.js`: Logic to generate the physical racks and goods using `THREE.InstancedMesh`.
  - `warehouse.stream.js`: WebSocket client that listens for updates and mutates the visual state.
  - `warehouse.interaction.js`: Raycasting logic for clicking on 3D objects to retrieve data.
  - `warehouse.app.js` (or `script.js`): The main application loop.
