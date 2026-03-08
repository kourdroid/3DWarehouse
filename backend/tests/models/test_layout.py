import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.layout import Base, WarehouseLayout, Zone, Aisle, RackBay, StorageUnit, StorageType, AisleOrientation

# Use an in-memory SQLite database for fast unit testing of the domain model schema
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)

def test_create_warehouse_layout(db_session):
    layout = WarehouseLayout(name="Central Hub", total_width_meters=50.0, total_length_meters=100.0)
    db_session.add(layout)
    db_session.commit()
    
    saved_layout = db_session.query(WarehouseLayout).filter_by(name="Central Hub").first()
    assert saved_layout is not None
    assert saved_layout.total_width_meters == 50.0

def test_zone_creation_and_relationship(db_session):
    layout = WarehouseLayout(name="Hub", total_width_meters=50.0, total_length_meters=100.0)
    db_session.add(layout)
    db_session.commit()
    
    zone = Zone(
        layout_id=layout.id, 
        name="A1", 
        color_hex="#FF0000", 
        storage_type=StorageType.STANDARD_RACK,
        position_x_meters=0.0,
        position_z_meters=0.0,
        width_meters=10.0,
        length_meters=10.0
    )
    db_session.add(zone)
    db_session.commit()
    
    assert db_session.query(Zone).count() == 1
    assert zone.layout.name == "Hub"

def test_aisle_bay_and_storage_unit(db_session):
    layout = WarehouseLayout(name="Hub", total_width_meters=50.0, total_length_meters=100.0)
    db_session.add(layout)
    db_session.commit()
    
    zone = Zone(layout_id=layout.id, name="A1", color_hex="#FF0000", storage_type=StorageType.STANDARD_RACK,
                position_x_meters=0.0, position_z_meters=0.0, width_meters=10.0, length_meters=10.0)
    db_session.add(zone)
    db_session.commit()

    aisle = Aisle(zone_id=zone.id, identifier="Aisle-1", orientation=AisleOrientation.NORTH_SOUTH, start_x_meters=1.0, start_z_meters=1.0)
    db_session.add(aisle)
    db_session.commit()

    bay = RackBay(aisle_id=aisle.id, identifier="Bay-1", sequence_number=1, width_meters=2.5)
    db_session.add(bay)
    db_session.commit()

    unit = StorageUnit(bay_id=bay.id, location_code="A1-B1-L1", max_weight_kg=1000.0)
    db_session.add(unit)
    db_session.commit()

    assert db_session.query(StorageUnit).count() == 1
    assert unit.bay.identifier == "Bay-1"
    assert unit.location_code == "A1-B1-L1"

def test_floor_bulk_storage_unit(db_session):
    layout = WarehouseLayout(name="Hub", total_width_meters=50.0, total_length_meters=100.0)
    db_session.add(layout)
    db_session.commit()
    
    zone = Zone(layout_id=layout.id, name="Bulk", color_hex="#00FF00", storage_type=StorageType.FLOOR_BULK,
                position_x_meters=0.0, position_z_meters=0.0, width_meters=10.0, length_meters=10.0)
    db_session.add(zone)
    db_session.commit()

    unit = StorageUnit(zone_id=zone.id, location_code="BULK-1", max_weight_kg=5000.0)
    db_session.add(unit)
    db_session.commit()

    assert db_session.query(StorageUnit).count() == 1
    assert unit.zone.name == "Bulk"
    assert unit.bay_id is None
