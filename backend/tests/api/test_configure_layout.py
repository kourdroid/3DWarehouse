import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import engine
from app.main import app
from app.models.layout import LayoutBase

AUTH_HEADERS = {"X-Demo-Token": "demo-token"}


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True)
async def prepare_db():
    async with engine.begin() as conn:
        await conn.run_sync(LayoutBase.metadata.drop_all)
        await conn.run_sync(LayoutBase.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(LayoutBase.metadata.drop_all)


@pytest.mark.anyio
async def test_configure_layout_broadcasts_snapshot_event(monkeypatch):
    called = False

    async def fake_broadcast_snapshot():
        nonlocal called
        called = True

    monkeypatch.setattr("app.api.v1.configure.broadcast_snapshot", fake_broadcast_snapshot)

    payload = {
        "name": "Demo Layout",
        "total_width_meters": 20,
        "total_length_meters": 30,
        "zones": [
            {
                "name": "Rack Zone",
                "color_hex": "#2563eb",
                "storage_type": "STANDARD_RACK",
                "position_x_meters": 0,
                "position_z_meters": 0,
                "width_meters": 10,
                "length_meters": 20,
                "aisles": 1,
                "spacing": 3.5,
                "bays_per_aisle": 2,
                "bay_width_meters": 2.8,
                "levels": 2,
                "pallets_per_bay": 1,
            }
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/layouts/configure", headers=AUTH_HEADERS, json=payload)

    assert response.status_code == 201
    assert called is True


@pytest.mark.anyio
async def test_configure_layout_requires_demo_token():
    payload = {
        "name": "Demo Layout",
        "total_width_meters": 20,
        "total_length_meters": 30,
        "zones": [],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/layouts/configure", json=payload)

    assert response.status_code == 401
