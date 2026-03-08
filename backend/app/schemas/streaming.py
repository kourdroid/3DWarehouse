from pydantic import BaseModel
from typing import List, Optional

class DimensionSchema(BaseModel):
    width: float
    length: float

class ZoneSchema(BaseModel):
    id: str
    name: str
    color_hex: str

class LayoutSnapshotSchema(BaseModel):
    id: str
    name: str
    dimensions: DimensionSchema
    zones: List[ZoneSchema]

class InventoryStateSchema(BaseModel):
    storage_unit_id: str
    location_code: str
    status: str
    fill_percentage: int
    sku: Optional[str] = None
    quantity: int

class SnapshotPayload(BaseModel):
    layout: LayoutSnapshotSchema
    inventory_state: List[InventoryStateSchema]

class UpdatePayload(BaseModel):
    storage_unit_id: str
    location_code: str
    status: str
    fill_percentage: int
    sku: Optional[str] = None
    quantity: int

class AlertDataSchema(BaseModel):
    level: str
    storage_unit_id: str
    message: str

class StreamMessage(BaseModel):
    event: str
    data: dict

