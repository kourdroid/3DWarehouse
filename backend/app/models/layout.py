import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.dialects.postgresql import UUID

Base = declarative_base()

class StorageType(str, Enum):
    STANDARD_RACK = "STANDARD_RACK"
    FLOOR_BULK = "FLOOR_BULK"

class AisleOrientation(str, Enum):
    NORTH_SOUTH = "NORTH_SOUTH"
    EAST_WEST = "EAST_WEST"

class WarehouseLayout(Base):
    __tablename__ = "warehouse_layout"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    total_width_meters = Column(Float, nullable=False)
    total_length_meters = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    zones = relationship("Zone", back_populates="layout", cascade="all, delete-orphan")


class Zone(Base):
    __tablename__ = "zone"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    layout_id = Column(UUID(as_uuid=True), ForeignKey("warehouse_layout.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    color_hex = Column(String(7), nullable=False)
    storage_type = Column(SQLEnum(StorageType), nullable=False)
    position_x_meters = Column(Float, nullable=False)
    position_z_meters = Column(Float, nullable=False)
    width_meters = Column(Float, nullable=False)
    length_meters = Column(Float, nullable=False)

    layout = relationship("WarehouseLayout", back_populates="zones")
    aisles = relationship("Aisle", back_populates="zone", cascade="all, delete-orphan")
    storage_units = relationship("StorageUnit", back_populates="zone", cascade="all, delete-orphan")


class Aisle(Base):
    __tablename__ = "aisle"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    zone_id = Column(UUID(as_uuid=True), ForeignKey("zone.id", ondelete="CASCADE"), nullable=False)
    identifier = Column(String(50), nullable=False)
    orientation = Column(SQLEnum(AisleOrientation), nullable=False)
    start_x_meters = Column(Float, nullable=False)
    start_z_meters = Column(Float, nullable=False)

    zone = relationship("Zone", back_populates="aisles")
    rack_bays = relationship("RackBay", back_populates="aisle", cascade="all, delete-orphan")


class RackBay(Base):
    __tablename__ = "rack_bay"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    aisle_id = Column(UUID(as_uuid=True), ForeignKey("aisle.id", ondelete="CASCADE"), nullable=False)
    identifier = Column(String(50), nullable=False)
    sequence_number = Column(Integer, nullable=False)
    width_meters = Column(Float, nullable=False)

    aisle = relationship("Aisle", back_populates="rack_bays")
    storage_units = relationship("StorageUnit", back_populates="bay", cascade="all, delete-orphan")


class StorageUnit(Base):
    """
    The atomic physical location in the warehouse.
    """
    __tablename__ = "storage_unit"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Required for FLOOR_BULK
    zone_id = Column(UUID(as_uuid=True), ForeignKey("zone.id", ondelete="CASCADE"), nullable=True)
    # Required for STANDARD_RACK
    bay_id = Column(UUID(as_uuid=True), ForeignKey("rack_bay.id", ondelete="CASCADE"), nullable=True)
    
    location_code = Column(String(100), unique=True, nullable=False)
    level_number = Column(Integer, nullable=False, default=1)
    elevation_meters = Column(Float, nullable=False, default=0.0)
    max_weight_kg = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    zone = relationship("Zone", back_populates="storage_units")
    bay = relationship("RackBay", back_populates="storage_units")
