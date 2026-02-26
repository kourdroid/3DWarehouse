from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db_session
from app.models import Entrepot, Zone, Emplacement
from app.schemas import EntrepotLayoutResource

router = APIRouter()

DbSession = Annotated[AsyncSession, Depends(get_db_session)]

@router.get("/{warehouse_id}/layout", response_model=EntrepotLayoutResource)
async def get_warehouse_layout(warehouse_id: int, db: DbSession):
    """
    Fetch the complete physical layout of the warehouse (Zones -> Emplacements)
    used for the static 3D geometry instancing.
    """
    stmt = (
        select(Entrepot)
        .options(
            selectinload(Entrepot.zones).selectinload(Zone.emplacements)
        )
        .where(Entrepot.id == warehouse_id)
    )
    result = await db.execute(stmt)
    warehouse = result.scalars().first()

    if not warehouse:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")

    return warehouse
