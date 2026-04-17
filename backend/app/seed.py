import asyncio
from app.core.database import AsyncSessionLocal, engine
from app.models.layout import LayoutBase, WarehouseLayout, LayoutZone, LayoutAisle, LayoutRackBay, LayoutLevel, LayoutStorageUnit, StorageType, AisleOrientation

async def seed_data():
    async with engine.begin() as conn:
        await conn.run_sync(LayoutBase.metadata.drop_all)
        await conn.run_sync(LayoutBase.metadata.create_all)

    async with AsyncSessionLocal() as session:
        layout = WarehouseLayout(name="Main Facility", total_width_meters=50.0, total_length_meters=100.0)
        session.add(layout)
        await session.flush()

        # Zone 1: Standard Rack
        zone1 = LayoutZone(
            layout_id=layout.id, name="Pallet Picking A", color_hex="#2563eb",
            storage_type=StorageType.STANDARD_RACK,
            position_x_meters=0.0, position_z_meters=0.0,
            width_meters=20.0, length_meters=50.0
        )
        session.add(zone1)
        await session.flush()

        for a in range(6):
            aisle = LayoutAisle(
                zone_id=zone1.id, identifier=f"A{a}",
                orientation=AisleOrientation.NORTH_SOUTH,
                start_x_meters=0.0, start_z_meters=a * 4.0
            )
            session.add(aisle)
            await session.flush()

            for b in range(12):
                bay = LayoutRackBay(
                    aisle_id=aisle.id, identifier=f"A{a}-B{b}",
                    sequence_number=b, width_meters=2.8
                )
                session.add(bay)
                await session.flush()

                for l in range(4):
                    level = LayoutLevel(
                        bay_id=bay.id, level_number=l,
                        height_meters=1.5, max_weight_kg=1000.0
                    )
                    session.add(level)
                    await session.flush()

                    unit = LayoutStorageUnit(
                        bay_id=bay.id, location_code=f"A{a}-B{b}-L{l}",
                        level_number=l, elevation_meters=l * 1.5,
                        max_weight_kg=1000.0
                    )
                    session.add(unit)

        # Zone 2: Floor Bulk
        zone2 = LayoutZone(
            layout_id=layout.id, name="Zone de Masse", color_hex="#f59e0b",
            storage_type=StorageType.FLOOR_BULK,
            position_x_meters=38.0, position_z_meters=0.0,
            width_meters=20.0, length_meters=30.0
        )
        session.add(zone2)
        await session.flush()

        # Add 10 bulk spaces
        for i in range(10):
            unit = LayoutStorageUnit(
                zone_id=zone2.id, location_code=f"BULK-{i}",
                level_number=0, elevation_meters=0.0,
                max_weight_kg=5000.0
            )
            session.add(unit)
            
        await session.commit()
    print("Database seeded with demo layout successfully.")

if __name__ == "__main__":
    asyncio.run(seed_data())
