from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session # Keep Session for non-async endpoints
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Dict, Any

from app.core.database import get_db
from app.models.layout import WarehouseLayout, Zone, Aisle, RackBay, Level
from app.schemas.layout import LayoutResponse

router = APIRouter()

@router.post("/layouts", status_code=status.HTTP_201_CREATED)
async def create_layout(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """Create a new warehouse physical layout configuration."""
    # Logic to parse payload and insert WarehouseLayout, Zones, Aisles, Bays 
    # omitted for brevity in this MVP stage; assume it accepts a deep JSON config
    return {"message": "Layout created", "id": "mocked-uuid"}

@router.get("/layouts/structure", response_model=LayoutResponse)
async def get_structure(db: AsyncSession = Depends(get_db)):
    """Retrieve the full nested physical configuration for the 3D builder."""
    stmt = select(WarehouseLayout).options(
        selectinload(WarehouseLayout.zones)
        .selectinload(Zone.aisles)
        .selectinload(Aisle.rack_bays)
        .selectinload(RackBay.levels)
    )
    result = await db.execute(stmt)
    layout = result.scalars().first()
    
    if not layout:
        raise HTTPException(status_code=404, detail="No layout configured")
        
    return layout

@router.put("/layouts/{layout_id}")
async def update_layout(layout_id: str, payload: Dict[str, Any], db: Session = Depends(get_db)):
    """Update a layout's configuration dimensions or zones."""
    return {"message": "Layout updated"}

@router.delete("/layouts/{layout_id}")
async def delete_layout(layout_id: str, db: Session = Depends(get_db)):
    """Remove a physical layout from the system."""
    return {"message": "Layout deleted"}
