import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Enum as SQLEnum, Index
from sqlalchemy.orm import declarative_base, relationship

LayoutBase = declarative_base()

# Portable UUID type — works on both SQLite and PostgreSQL
def _new_uuid():
    return str(uuid.uuid4())

class StorageType(str, Enum):
    STANDARD_RACK = "STANDARD_RACK"
    FLOOR_BULK = "FLOOR_BULK"

class AisleOrientation(str, Enum):
    NORTH_SOUTH = "NORTH_SOUTH"
    EAST_WEST = "EAST_WEST"

class StorageKind(str, Enum):
    PALLET = "PALLET"
    BOX = "BOX"
    FLOOR = "FLOOR"
    BULK = "BULK"

class InventoryStatus(str, Enum):
    EMPTY = "EMPTY"
    OCCUPIED = "OCCUPIED"
    RESERVED = "RESERVED"
    BLOCKED = "BLOCKED"
    DAMAGED = "DAMAGED"

class WarehouseLayout(LayoutBase):
    __tablename__ = "warehouse_layout"
    
    id = Column(String(36), primary_key=True, default=_new_uuid)
    name = Column(String(255), nullable=False)
    total_width_meters = Column(Float, nullable=False)
    total_length_meters = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    zones = relationship("Zone", back_populates="layout", cascade="all, delete-orphan")


class Zone(LayoutBase):
    __tablename__ = "layout_zone"
    
    id = Column(String(36), primary_key=True, default=_new_uuid)
    layout_id = Column(String(36), ForeignKey("warehouse_layout.id", ondelete="CASCADE"), nullable=False)
    code = Column(String(50), nullable=True)
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
    aisles = relationship("Aisle", back_populates="zone", cascade="all, delete-orphan")
    storage_units = relationship("StorageUnit", back_populates="zone", cascade="all, delete-orphan")


class Aisle(LayoutBase):
    __tablename__ = "layout_aisle"
    
    id = Column(String(36), primary_key=True, default=_new_uuid)
    zone_id = Column(String(36), ForeignKey("layout_zone.id", ondelete="CASCADE"), nullable=False)
    identifier = Column(String(50), nullable=False)
    orientation = Column(SQLEnum(AisleOrientation), nullable=False)
    start_x_meters = Column(Float, nullable=False)
    start_z_meters = Column(Float, nullable=False)
    spacing_meters = Column(Float, nullable=False, default=0.0)

    zone = relationship("Zone", back_populates="aisles")
    rack_bays = relationship("RackBay", back_populates="aisle", cascade="all, delete-orphan")


class RackBay(LayoutBase):
    __tablename__ = "layout_rack_bay"
    
    id = Column(String(36), primary_key=True, default=_new_uuid)
    aisle_id = Column(String(36), ForeignKey("layout_aisle.id", ondelete="CASCADE"), nullable=False)
    identifier = Column(String(50), nullable=False)
    sequence_number = Column(Integer, nullable=False)
    width_meters = Column(Float, nullable=False)
    depth_meters = Column(Float, nullable=False, default=1.2)
    pallets_per_bay = Column(Integer, nullable=False, default=1)

    aisle = relationship("Aisle", back_populates="rack_bays")
    levels = relationship("Level", back_populates="bay", cascade="all, delete-orphan", order_by="Level.level_number")
    storage_units = relationship("StorageUnit", back_populates="bay", cascade="all, delete-orphan")


class Level(LayoutBase):
    __tablename__ = "layout_level"
    
    id = Column(String(36), primary_key=True, default=_new_uuid)
    bay_id = Column(String(36), ForeignKey("layout_rack_bay.id", ondelete="CASCADE"), nullable=False)
    level_number = Column(Integer, nullable=False)
    height_meters = Column(Float, nullable=False)
    max_weight_kg = Column(Float, nullable=False, default=1000.0)

    bay = relationship("RackBay", back_populates="levels")


class StorageUnit(LayoutBase):
    """
    The atomic physical location in the warehouse.
    """
    __tablename__ = "layout_storage_unit"
    
    id = Column(String(36), primary_key=True, default=_new_uuid)
    zone_id = Column(String(36), ForeignKey("layout_zone.id", ondelete="CASCADE"), nullable=True)
    bay_id = Column(String(36), ForeignKey("layout_rack_bay.id", ondelete="CASCADE"), nullable=True)
    
    location_code = Column(String(100), unique=True, nullable=False)
    level_number = Column(Integer, nullable=False, default=1)
    position_number = Column(Integer, nullable=False, default=1)
    storage_kind = Column(SQLEnum(StorageKind), nullable=False, default=StorageKind.PALLET)
    elevation_meters = Column(Float, nullable=False, default=0.0)
    x_meters = Column(Float, nullable=False, default=0.0)
    y_meters = Column(Float, nullable=False, default=0.0)
    z_meters = Column(Float, nullable=False, default=0.0)
    width_meters = Column(Float, nullable=False, default=1.2)
    depth_meters = Column(Float, nullable=False, default=1.2)
    height_meters = Column(Float, nullable=False, default=1.2)
    max_weight_kg = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    status = Column(SQLEnum(InventoryStatus), nullable=False, default=InventoryStatus.EMPTY)
    sku = Column(String(100), nullable=True)
    quantity = Column(Integer, nullable=False, default=0)
    pallet_id = Column(String(100), nullable=True)
    last_updated_at = Column(DateTime, nullable=True)

    zone = relationship("Zone", back_populates="storage_units")
    bay = relationship("RackBay", back_populates="storage_units")


Index("ix_layout_zone_layout_id", Zone.layout_id)
Index("ix_layout_aisle_zone_id", Aisle.zone_id)
Index("ix_layout_rack_bay_aisle_id", RackBay.aisle_id)
Index("ix_layout_level_bay_id", Level.bay_id)
Index("ix_layout_storage_unit_zone_id", StorageUnit.zone_id)
Index("ix_layout_storage_unit_bay_id", StorageUnit.bay_id)
Index("ix_layout_storage_unit_location_code", StorageUnit.location_code)
