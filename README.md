# 3DWarehouse

Real-time 3D Digital Twin for warehouse visualization.

## Stack
- **Frontend**: Vanilla JS + Three.js (InstancedMesh)
- **Backend**: Python FastAPI + WebSocket streaming

## Local Dev
```bash
# Backend
cd backend
python -m venv venv && ./venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd ..
python -m http.server 3000
```
Open `http://localhost:3000`
