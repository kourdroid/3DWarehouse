from fastapi import APIRouter
from app.api.v1 import warehouse, stock

api_router = APIRouter()
api_router.include_router(warehouse.router, prefix="/warehouses", tags=["Warehouse Layout"])
api_router.include_router(stock.router, prefix="/stock", tags=["Stock Management"])
