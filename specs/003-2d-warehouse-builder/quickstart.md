# Quickstart: 2D Warehouse Builder

**Feature**: 003-2d-warehouse-builder  
**Date**: 2026-03-09

## Prerequisites

- Python 3.11+ with venv
- Backend dependencies installed (`pip install -r requirements.txt`)
- Database seeded or empty (builder creates layouts)

## Development Setup

### 1. Start the Backend

```powershell
cd backend
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Backend runs at `http://localhost:8000`.

### 2. Start the Frontend

```powershell
cd "C:\Users\kourd\Desktop\Smatch\Projects\3D Warehouse\Native"
.\backend\venv\Scripts\python.exe -m http.server 3000
```

Frontend runs at `http://localhost:3000`.

### 3. Access the Application

- **Builder**: `http://localhost:3000/#/builder`
- **3D Viewer**: `http://localhost:3000/#/viewer` (existing)

### 4. Usage Flow

1. Open `#/builder` in browser
2. Click "New Warehouse" → enter name and dimensions
3. Drag "Rack Zone" onto the canvas → configure aisles, bays, levels
4. Drag "Bulk Zone" onto the canvas → set floor slots
5. Define location code pattern per zone
6. Click "Save & Generate"
7. Switch to `#/viewer` → see the 3D warehouse rendered from your configuration

## Key Files (New)

| File | Purpose |
|------|---------|
| `builder.html` or `index.html#/builder` | Builder page HTML |
| `scripts/builder.canvas.js` | Konva.js canvas manager |
| `scripts/builder.panel.js` | Side panel with zone configuration |
| `scripts/builder.commands.js` | Undo/redo command pattern |
| `scripts/builder.api.js` | API calls to configure endpoint |
| `backend/app/api/v1/configure.py` | POST /configure endpoint |
| `backend/app/services/layout_generator.py` | Generates DB records from config JSON |

## Running Tests

```powershell
cd backend
$env:PYTHONPATH='.'; .\venv\Scripts\python.exe -m pytest tests/ -v
```
