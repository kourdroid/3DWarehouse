# Quickstart: Real Warehouse Digital Twin Model

**Feature**: 001-digital-twin
**Date**: 2026-02-26

## Overview

This guide explains how to embed and test the 3D Digital Twin within the parent WMS application, and how to stream data to it during local development.

## 1. Prerequisites

- Python 3.11+ (Backend)
- Node.js / NPM (For frontend asset bundling if applicable, though the twin uses Vanilla JS + CDN Three.js)
- Redis running locally (for FastAPI WebSocket Pub/Sub backplane)
- PostgreSQL running locally

## 2. Local Setup

1. Start the Redis broker:
   ```bash
   docker run -d -p 6379:6379 redis:alpine
   ```

2. Start the FastAPI backend with WebSockets enabled:
   ```bash
   cd backend
   # Ensure .env points to local Redis for pub/sub: REDIS_URL=redis://localhost:6379/0
   uvicorn app.main:app --reload --port 8000
   ```

3. Serve the standalone frontend:
   You can use any local static server. For example:
   ```bash
   cd Native
   python -m http.server 3000
   ```

## 3. Embedding the Twin (Frontend Integration)

To embed the 3D Twin within your existing React/Vue WMS application, use an `<iframe>` and pass the user's current JWT token via the URL.

```html
<!-- Inside Parent WMS App -->
<iframe 
  src="http://localhost:3000/index.html?token=YOUR_VALID_JWT_HERE" 
  width="100%" 
  height="800px" 
  frameborder="0"
  allowfullscreen>
</iframe>
```

The `warehouse.app.js` script will automatically extract the `token` parameter and use it to authenticate the WebSocket connection.

## 4. Testing the Real-Time Stream

To simulate an inventory movement without triggering a full WMS workflow, you can publish directly to the local Redis channel using the backend test utilities.

1. Open a terminal in the `backend` folder.
2. Run the payload simulation script:
   ```bash
   python scripts/simulate_inventory_movement.py --location "A01-B12-L01" --status "EMPTY"
   ```
3. Observe the `<iframe>` embedded twin instantly update the target storage unit's color/occupancy state seamlessly at 60 FPS without a page reload.
