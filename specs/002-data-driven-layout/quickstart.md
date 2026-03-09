# Quickstart: Data-Driven Layout

## Prerequisites
- Python 3.10+
- Git

## Setup

```bash
# 1. Clone and switch to branch
git checkout 002-data-driven-layout

# 2. Install backend dependencies
cd backend
python -m venv venv
./venv/Scripts/activate   # Windows
pip install -r requirements.txt

# 3. Seed the database with a demo warehouse layout
python -m app.seed

# 4. Start the backend
./venv/Scripts/uvicorn app.main:app --reload --port 8000

# 5. Start the frontend (separate terminal)
cd ..
python -m http.server 3000
```

## Verify

1. Open `http://localhost:3000` — the 3D warehouse should render racks based on the seeded layout data.
2. Call `http://localhost:8000/api/v1/layouts/structure` — should return the full JSON hierarchy.
3. Modify `seed.py` (change aisle count or zone color), re-run `python -m app.seed`, and refresh the browser — the 3D scene should reflect the new layout.

## Running Tests

```bash
cd backend
./venv/Scripts/python.exe -m pytest tests/ -v
```
