from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1 import api_router
from contextlib import asynccontextmanager
from app.core.database import engine
from app.core.database import Base # Logical WMS Models
from app.models.layout import LayoutBase # Physical Layout Models

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(LayoutBase.metadata.create_all)
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# Set up CORS for the frontend Native JS client
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Expand to explicit origins later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "message": "Smatch 3D Warehouse API is running"}
