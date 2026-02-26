from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional
from datetime import datetime

class ZoneBase(BaseModel):
    nom: str
    description: Optional[str] = None
    type_zone_id: int

class ZoneCreate(ZoneBase):
    pass

class ZoneResource(ZoneBase):
    id: int
    entrepot_id: int
    model_config = ConfigDict(from_attributes=True)

class EmplacementBase(BaseModel):
    code: str
    niveau: int = 0
    dimension_L_cm: float = 0.0
    dimension_l_cm: float = 0.0
    dimension_H_cm: float = 0.0
    poids_max_kg: float = 0.0
    status: bool = False
    type_emplacement_id: int

class EmplacementCreate(EmplacementBase):
    pass

class EmplacementResource(EmplacementBase):
    id: int
    zone_id: int
    model_config = ConfigDict(from_attributes=True)

# Warehouse Response (Layout Payload V1)
class EntrepotBase(BaseModel):
    nom: str
    code: str
    adresse: Optional[str] = None
    capacite_max: Optional[float] = 0.0
    description: Optional[str] = None

class EntrepotLayoutResource(EntrepotBase):
    id: int
    compte_id: int
    zones: List[ZoneResource] = []
    model_config = ConfigDict(from_attributes=True)

class StockBase(BaseModel):
    emplacement_id: int
    article_id: int
    quantite: int = Field(ge=0)

class StockResource(StockBase):
    id: int
    date_maj: datetime
    model_config = ConfigDict(from_attributes=True)
