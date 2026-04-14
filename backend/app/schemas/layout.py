from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from app.models.layout import StorageType, AisleOrientation

class LevelSchema(BaseModel):
    id: str
    level_number: int
    height_meters: float
    max_weight_kg: float

    model_config = {"from_attributes": True}

class BaySchema(BaseModel):
    id: str
    identifier: str
    sequence_number: int
    width_meters: float
    pallets_per_bay: int = 1
    levels: List[LevelSchema] = []

    model_config = {"from_attributes": True}

class AisleSchema(BaseModel):
    id: str
    identifier: str
    orientation: AisleOrientation
    start_x_meters: float
    start_z_meters: float
    rack_bays: List[BaySchema] = []

    model_config = {"from_attributes": True}

class ZoneSchema(BaseModel):
    id: str
    name: str = Field(..., max_length=100)
    color_hex: str = Field(..., max_length=7)
    storage_type: StorageType
    position_x_meters: float = Field(..., ge=0)
    position_z_meters: float = Field(..., ge=0)
    width_meters: float = Field(..., gt=0, le=1000)
    length_meters: float = Field(..., gt=0, le=1000)
    location_code_pattern: str = "{zone_name}-A{aisle_num:02d}-B{bay_num:03d}-L{level_num}"
    floor_slots: int = Field(0, ge=0, le=10000)
    aisles: List[AisleSchema] = Field(default=[], max_length=100)

    model_config = {"from_attributes": True}

class LayoutPayload(BaseModel):
    name: str = "Custom Layout"
    total_width_meters: float = Field(..., gt=0)
    total_length_meters: float = Field(..., gt=0)
    zones: List[dict] = Field(default=[], max_length=50)

class LayoutResponse(BaseModel):
    id: str
    name: str
    total_width_meters: float
    total_length_meters: float
    zones: List[ZoneSchema] = []

    model_config = {"from_attributes": True}
