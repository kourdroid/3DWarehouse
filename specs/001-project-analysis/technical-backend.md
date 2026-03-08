# Backend Technical Architecture

The backend of the 3D Warehouse Digital Twin is built with Python 3.10+ and the FastAPI framework, leveraging PyDantic for data validation and Uvicorn as the ASGI server.

## Core Structure

- **`app/main.py`**: The application entry point. Initializes FastAPI, configures CORS middleware to allow frontend connections, and includes API routers.
- **`app/api/v1/stream.py`**: The core interactive endpoint. Contains the `WebSocket` route `/ws`.
  - It maintains a list of `active_connections`.
  - Upon connection, it immediately pushes a full `snapshot` payload of the warehouse inventory.
  - It runs a background `asyncio` loop that periodically (e.g., every 2 seconds) generates random delta updates to simulate live WMS activity.
- **`app/schemas/streaming.py`**: Pydantic models (e.g., `UpdateDelta`, `SnapshotPayload`) ensuring that all data pushed over the WebSocket strictly adheres to the expected types and formatting.
- **`app/models/layout.py`**: Provides the structural generation logic to create the initial mock dataset that represents the warehouse inventory.

## Data Philosophy
The backend acts as the single source of truth for the physical state of the digital twin. It is entirely stateless concerning the 3D visual math; it only pushes logical coordinates (`Aisle`, `Bay`, `Level`) and statuses (`EMPTY`, `OCCUPIED`). 

## Future Expansion
The architecture is designed to eventually replace the mock background generator with a Redis Pub/Sub consumer or Kafka listener, ingesting real WMS events and fanning them out to connected WebSocket clients.
