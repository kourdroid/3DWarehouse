from fastapi import APIRouter
from app.api.v1 import warehouse, stock, stream, layout, configure

api_router = APIRouter()
api_router.include_router(warehouse.router, prefix="/warehouses", tags=["Warehouse Layout"])
api_router.include_router(stock.router, prefix="/stock", tags=["Stock Management"])
api_router.include_router(stream.router, tags=["Real-Time Stream"])
api_router.include_router(layout.router, tags=["Live Layout CRUD"])
api_router.include_router(configure.router, prefix="/layouts/configure", tags=["Layout Builder"])
