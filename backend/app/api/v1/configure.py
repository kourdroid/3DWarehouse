from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any

from app.core.auth import require_demo_token
from app.core.database import get_db
from app.schemas.layout import LayoutPayload

router = APIRouter()

from app.services.layout_builder import LayoutBuilderService
from app.api.v1.stream import broadcast_snapshot

@router.post("", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def configure_layout(
    payload: LayoutPayload,
    _: None = Depends(require_demo_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Atomically replace the warehouse layout.
    Drops existing layout topology and recreates it based on the incoming configuration.
    """
    try:
        service = LayoutBuilderService(db)
        await service.generate_layout(payload.model_dump())
        
        await broadcast_snapshot()

        return {
            "message": "Layout configured successfully. 3D viewer will auto-refresh.",
            "zones_created": len(payload.zones)
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
