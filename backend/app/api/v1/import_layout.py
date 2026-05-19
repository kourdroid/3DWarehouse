from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.stream import manager
from app.core.database import get_db
from app.services.layout_import import LayoutImportService

router = APIRouter(prefix="/import", tags=["Excel Layout Import"])


@router.get("/layout-template")
async def download_layout_template():
    workbook = LayoutImportService.create_template_workbook()
    return StreamingResponse(
        workbook,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="warehouse-layout-template.xlsx"'},
    )


@router.post("/layout-excel", status_code=status.HTTP_200_OK)
async def import_layout_excel(
    dry_run: bool = Query(True),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Only .xlsx layout workbooks are supported")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded workbook is empty")

    try:
        result = await LayoutImportService(db).import_workbook(content, dry_run=dry_run)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if result["errors"]:
        return result

    if result["applied"]:
        await manager.broadcast_json({
            "event": "ALERT",
            "data": {"level": "info", "message": "Layout import applied. Refreshing snapshot is required."},
        })

    return result
