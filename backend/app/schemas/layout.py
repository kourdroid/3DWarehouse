from pydantic import BaseModel, UUID4, Field
from typing import List, Optional
from datetime import datetime
from app.models.layout import StorageType, AisleOrientation

class LevelSchema(BaseModel):
    id: UUID4
    level_number: int
    height_meters: float
    max_weight_kg: float

    model_config = {"from_attributes": True}

class BaySchema(BaseModel):
    id: UUID4
    identifier: str
    sequence_number: int
    width_meters: float
    levels: List[LevelSchema] = []

    model_config = {"from_attributes": True}

class AisleSchema(BaseModel):
    id: UUID4
    identifier: str
    orientation: AisleOrientation
    start_x_meters: float
    start_z_meters: float
    rack_bays: List[BaySchema] = []

    model_config = {"from_attributes": True}

class ZoneSchema(BaseModel):
    id: UUID4
    name: str
    color_hex: str
    storage_type: StorageType
    position_x_meters: float
    position_z_meters: float
    width_meters: float
    length_meters: float
    aisles: List[AisleSchema] = []

    model_config = {"from_attributes": True}

class LayoutResponse(BaseModel):
    id: UUID4
    name: str
    total_width_meters: float
    total_length_meters: float
    zones: List[ZoneSchema] = []

    model_config = {"from_attributes": True}
