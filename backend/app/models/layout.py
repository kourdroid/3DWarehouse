import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.core.database import Base

# Alias so main.py keeps working — layout models now share the same metadata
LayoutBase = Base

# Portable UUID type — works on both SQLite and PostgreSQL
def _new_uuid():
    return str(uuid.uuid4())

class StorageType(str, Enum):
    STANDARD_RACK = "STANDARD_RACK"
    FLOOR_BULK = "FLOOR_BULK"

class AisleOrientation(str, Enum):
    NORTH_SOUTH = "NORTH_SOUTH"
    EAST_WEST = "EAST_WEST"

class WarehouseLayout(Base):
    __tablename__ = "warehouse_layout"
    
    id = Column(String(36), primary_key=True, default=_new_uuid)
    name = Column(String(255), nullable=False)
    total_width_meters = Column(Float, nullable=False)
    total_length_meters = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    zones = relationship("LayoutZone", back_populates="layout", cascade="all, delete-orphan")


class LayoutZone(Base):
    __tablename__ = "layout_zone"
    
    id = Column(String(36), primary_key=True, default=_new_uuid)
    layout_id = Column(String(36), ForeignKey("warehouse_layout.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    color_hex = Column(String(7), nullable=False)
    storage_type = Column(SQLEnum(StorageType), nullable=False)
    position_x_meters = Column(Float, nullable=False)
    position_z_meters = Column(Float, nullable=False)
    width_meters = Column(Float, nullable=False)
    length_meters = Column(Float, nullable=False)
    location_code_pattern = Column(String(255), nullable=False, default="{zone_name}-A{aisle_num:02d}-B{bay_num:03d}-L{level_num}")
    floor_slots = Column(Integer, nullable=False, default=0)

    layout = relationship("WarehouseLayout", back_populates="zones")
    aisles = relationship("LayoutAisle", back_populates="zone", cascade="all, delete-orphan")
    storage_units = relationship("LayoutStorageUnit", back_populates="zone", cascade="all, delete-orphan")


class LayoutAisle(Base):
    __tablename__ = "layout_aisle"
    
    id = Column(String(36), primary_key=True, default=_new_uuid)
    zone_id = Column(String(36), ForeignKey("layout_zone.id", ondelete="CASCADE"), nullable=False)
    identifier = Column(String(50), nullable=False)
    orientation = Column(SQLEnum(AisleOrientation), nullable=False)
    start_x_meters = Column(Float, nullable=False)
    start_z_meters = Column(Float, nullable=False)

    zone = relationship("LayoutZone", back_populates="aisles")
    rack_bays = relationship("LayoutRackBay", back_populates="aisle", cascade="all, delete-orphan")


class LayoutRackBay(Base):
    __tablename__ = "layout_rack_bay"
    
    id = Column(String(36), primary_key=True, default=_new_uuid)
    aisle_id = Column(String(36), ForeignKey("layout_aisle.id", ondelete="CASCADE"), nullable=False)
    identifier = Column(String(50), nullable=False)
    sequence_number = Column(Integer, nullable=False)
    width_meters = Column(Float, nullable=False)
    pallets_per_bay = Column(Integer, nullable=False, default=1)

    aisle = relationship("LayoutAisle", back_populates="rack_bays")
    levels = relationship("LayoutLevel", back_populates="bay", cascade="all, delete-orphan", order_by="LayoutLevel.level_number")
    storage_units = relationship("LayoutStorageUnit", back_populates="bay", cascade="all, delete-orphan")


class LayoutLevel(Base):
    __tablename__ = "layout_level"
    
    id = Column(String(36), primary_key=True, default=_new_uuid)
    bay_id = Column(String(36), ForeignKey("layout_rack_bay.id", ondelete="CASCADE"), nullable=False)
    level_number = Column(Integer, nullable=False)
    height_meters = Column(Float, nullable=False)
    max_weight_kg = Column(Float, nullable=False, default=1000.0)

    bay = relationship("LayoutRackBay", back_populates="levels")


class LayoutStorageUnit(Base):
    """
    The atomic physical location in the warehouse.
    """
    __tablename__ = "layout_storage_unit"
    
    id = Column(String(36), primary_key=True, default=_new_uuid)
    zone_id = Column(String(36), ForeignKey("layout_zone.id", ondelete="CASCADE"), nullable=True)
    bay_id = Column(String(36), ForeignKey("layout_rack_bay.id", ondelete="CASCADE"), nullable=True)
    
    location_code = Column(String(100), unique=True, nullable=False)
    level_number = Column(Integer, nullable=False, default=1)
    elevation_meters = Column(Float, nullable=False, default=0.0)
    max_weight_kg = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    zone = relationship("LayoutZone", back_populates="storage_units")
    bay = relationship("LayoutRackBay", back_populates="storage_units")
