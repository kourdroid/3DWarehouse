from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.stream import broadcast_snapshot
from app.core.auth import require_demo_token
from app.core.database import get_db
from app.services.location_code_import import DEFAULT_PATTERN, LocationCodeDefaults, LocationCodeImportService
from app.services.layout_import import LayoutImportService

router = APIRouter(prefix="/import", tags=["Layout Import"])


@router.get("/layout-template")
async def download_layout_template():
    workbook = LayoutImportService.create_template_workbook()
    return StreamingResponse(
        workbook,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="warehouse-layout-template.xlsx"'},
    )


@router.get("/location-code-template")
async def download_location_code_template():
    template = LocationCodeImportService.create_template_csv()
    return Response(
        content=template.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="location-codes-template.csv"'},
    )


@router.post("/layout-excel", status_code=status.HTTP_200_OK)
async def import_layout_excel(
    dry_run: bool = Query(True),
    file: UploadFile = File(...),
    _: None = Depends(require_demo_token),
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
        await broadcast_snapshot()

    return result


@router.post("/location-codes", status_code=status.HTTP_200_OK)
async def import_location_codes(
    dry_run: bool = Query(True),
    pattern: str = Query(DEFAULT_PATTERN),
    warehouse_name: str = Query("NCL Logical Warehouse"),
    aisle_spacing_meters: float = Query(3.5, gt=0),
    bay_width_meters: float = Query(2.8, gt=0),
    bay_depth_meters: float = Query(1.2, gt=0),
    floor_level_height_meters: float = Query(0.0, ge=0),
    upper_level_step_meters: float = Query(1.5, gt=0),
    file: UploadFile = File(...),
    _: None = Depends(require_demo_token),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv location-code files are supported")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded CSV is empty")

    defaults = LocationCodeDefaults(
        aisle_spacing_meters=aisle_spacing_meters,
        bay_width_meters=bay_width_meters,
        bay_depth_meters=bay_depth_meters,
        floor_level_height_meters=floor_level_height_meters,
        upper_level_step_meters=upper_level_step_meters,
    )

    try:
        result = await LocationCodeImportService(db).import_csv(
            content=content,
            dry_run=dry_run,
            pattern=pattern,
            warehouse_name=warehouse_name,
            defaults=defaults,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if result["applied"]:
        await broadcast_snapshot()

    return result
