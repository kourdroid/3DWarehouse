from typing import Annotated, List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db_session
from app.models import Stock, Emplacement, Zone
from app.schemas import StockResource

router = APIRouter()

DbSession = Annotated[AsyncSession, Depends(get_db_session)]

@router.get("/{warehouse_id}", response_model=List[StockResource])
async def get_warehouse_stock(warehouse_id: int, db: DbSession):
    """
    Fetch all active stock for a given warehouse.
    This provides the lightweight data strictly needed to highlight the instanced meshes.
    """
    stmt = (
        select(Stock)
        .join(Stock.emplacement)
        .join(Emplacement.zone)
        .where(Zone.entrepot_id == warehouse_id)
        .where(Stock.quantite > 0)
    )
    result = await db.execute(stmt)
    stocks = result.scalars().all()

    return stocks
