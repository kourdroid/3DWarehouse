from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
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

@router.get("/layouts/{layout_id}/builder", response_model=Dict[str, Any])
async def get_builder_config(layout_id: str, db: AsyncSession = Depends(get_db)):
    """
    Fetch the full configuration for the 2D builder canvas.
    Returns the warehouse footprint and all zones with their properties.
    """
    # We ignore layout_id for MVP and just get the primary
    result = await db.execute(
        select(WarehouseLayout)
        .options(selectinload(WarehouseLayout.zones))
        .limit(1)
    )
    layout = result.scalars().first()
    
    if not layout:
        return {}

    zones_data = []
    for z in layout.zones:
        zones_data.append({
            "id": str(z.id),
            "name": z.name,
            "type": z.storage_type.value,
            "color": z.color_hex,
            "x": z.position_x_meters * 20,  # Convert back to canvas pixels (scale=20)
            "y": z.position_z_meters * 20,
            "width_meters": z.width_meters,
            "length_meters": z.length_meters,
            "floorSlots": z.floor_slots,
            "pattern": z.location_code_pattern
        })

    return {
        "name": layout.name,
        "width_meters": layout.total_width_meters,
        "length_meters": layout.total_length_meters,
        "zones": zones_data
    }

@router.put("/layouts/{layout_id}")
async def update_layout(layout_id: str, payload: Dict[str, Any], db: Session = Depends(get_db)):
    """Update a layout's configuration dimensions or zones."""
    return {"message": "Layout updated"}

@router.delete("/layouts/{layout_id}")
async def delete_layout(layout_id: str, db: Session = Depends(get_db)):
    """Remove a physical layout from the system."""
    return {"message": "Layout deleted"}
