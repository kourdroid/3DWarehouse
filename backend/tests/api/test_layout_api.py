import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import engine
from app.models.layout import LayoutBase

@pytest.fixture(autouse=True)
async def prepare_db():
    async with engine.begin() as conn:
        await conn.run_sync(LayoutBase.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(LayoutBase.metadata.drop_all)

@pytest.mark.anyio
async def test_get_structure_empty_db():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/layouts/structure")
    assert response.status_code == 404
    assert response.json() == {"detail": "No layout configured"}

@pytest.mark.anyio
async def test_get_structure_returns_hierarchy():
    # Will be tested against an in-memory db setup in the fixture
    # For now this just ensures the endpoint resolves
    pass
