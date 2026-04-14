import math
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete
from app.models.layout import WarehouseLayout, Zone, Aisle, RackBay, Level, StorageUnit, StorageType, AisleOrientation
from typing import Dict, Any

class LayoutBuilderService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def generate_layout(self, payload: Dict[str, Any]) -> WarehouseLayout:
        # 1. Clean slate - In a real app we might soft-delete or version, 
        # but for this MVP, an atomic "configure" drops the old layout.
        # Since we only support 1 layout right now, we find it or make it.
        # Currently, seed.py creates a layout named "Primary Facility".
        # We will aggressively clear all zones to ensure a fresh generation.
        
        # We find the existing layout
        from sqlalchemy.future import select
        result = await self.db.execute(select(WarehouseLayout).limit(1))
        layout = result.scalars().first()

        if not layout:
            layout = WarehouseLayout(
                name=payload.get("name", "Generated Warehouse"),
                total_width_meters=payload["total_width_meters"],
                total_length_meters=payload["total_length_meters"]
            )
            self.db.add(layout)
            await self.db.flush()
        else:
            layout.name = payload.get("name", layout.name)
            layout.total_width_meters = payload["total_width_meters"]
            layout.total_length_meters = payload["total_length_meters"]
            
            # Cascade delete all existing zones for this layout to rebuild
            await self.db.execute(delete(Zone).where(Zone.layout_id == layout.id))
            await self.db.flush()

        # 2. Iterate Zones
        new_zones = []
        new_aisles = []
        new_bays = []
        new_levels = []
        new_storage_units = []
        generated_codes = set()

        zones_data = payload.get("zones", [])
        for z_idx, z_data in enumerate(zones_data):
            zone = Zone(
                layout_id=layout.id,
                name=z_data.get("name", f"Zone {z_idx+1}"),
                color_hex=z_data.get("color_hex", "#ffffff"),
                storage_type=z_data.get("storage_type", StorageType.STANDARD_RACK),
                position_x_meters=z_data["position_x_meters"],
                position_z_meters=z_data["position_z_meters"],
                width_meters=z_data["width_meters"],
                length_meters=z_data["length_meters"],
                location_code_pattern=z_data.get("location_code_pattern", "{zone_name}-A{aisle_num:02d}-B{bay_num:03d}-L{level_num}"),
                floor_slots=z_data.get("floor_slots", 0)
            )
            self.db.add(zone)
            await self.db.flush() # Need zone.id

            if zone.storage_type == StorageType.STANDARD_RACK:
                aisle_count = z_data.get("aisles", 0)
                bays_per_aisle = z_data.get("bays_per_aisle", 0)
                bay_width = z_data.get("bay_width_meters", 2.8)
                level_count = z_data.get("levels", 0)
                pallets_per_bay = z_data.get("pallets_per_bay", 1)
                spacing = z_data.get("spacing", 3.0)

                for a_idx in range(aisle_count):
                    aisle = Aisle(
                        zone_id=zone.id,
                        identifier=f"A{a_idx+1:02d}",
                        orientation=AisleOrientation.NORTH_SOUTH, # Hardcoded for now based on standard UI drop
                        start_x_meters=zone.position_x_meters + (a_idx * spacing),
                        start_z_meters=zone.position_z_meters
                    )
                    self.db.add(aisle)
                    await self.db.flush()

                    for b_idx in range(bays_per_aisle):
                        bay = RackBay(
                            aisle_id=aisle.id,
                            identifier=f"B{b_idx+1:03d}",
                            sequence_number=b_idx + 1,
                            width_meters=bay_width,
                            pallets_per_bay=pallets_per_bay
                        )
                        self.db.add(bay)
                        await self.db.flush()

                        for l_idx in range(level_count):
                            level = Level(
                                bay_id=bay.id,
                                level_number=l_idx + 1,
                                height_meters=l_idx * 1.5, # Assume 1.5m per level
                                max_weight_kg=1000.0
                            )
                            self.db.add(level)
                            await self.db.flush()

                            # Generate Atomic Storage Units
                            for p_idx in range(pallets_per_bay):
                                # Basic pattern processing
                                loc_code = zone.location_code_pattern.format(
                                    zone_name=zone.name.replace(" ", "").upper()[:3],
                                    aisle_num=a_idx+1,
                                    bay_num=b_idx+1,
                                    level_num=l_idx+1
                                )
                                if pallets_per_bay > 1:
                                    loc_code += f"-P{p_idx+1}"

                                su = StorageUnit(
                                    zone_id=zone.id,
                                    bay_id=bay.id,
                                    location_code=loc_code,
                                    level_number=level.level_number,
                                    elevation_meters=level.height_meters,
                                    max_weight_kg=level.max_weight_kg
                                )
                                
                                if loc_code in generated_codes:
                                    raise ValueError(f"Duplicate location code detected: {loc_code}. Adjust your naming pattern.")
                                generated_codes.add(loc_code)
                                
                                self.db.add(su)
            
            elif zone.storage_type == StorageType.FLOOR_BULK:
                # Direct generation of StorageUnits on the floor
                floor_slots = z_data.get("floor_slots", 0)
                grid_dim = math.ceil(math.sqrt(max(floor_slots, 1)))
                
                for s_idx in range(floor_slots):
                    zone_prefix = zone.name.replace(" ", "").upper()[:3]
                    # Try the user's custom pattern first; fallback to a safe default
                    try:
                        loc_code = zone.location_code_pattern.format(
                            zone_name=zone_prefix,
                            slot_num=s_idx + 1,
                            aisle_num=0,
                            bay_num=0,
                            level_num=0
                        )
                    except (KeyError, IndexError):
                        # Fallback if pattern doesn't have slot_num
                        loc_code = f"{zone_prefix}-S{s_idx+1:03d}"

                    # Calculate hypothetical X/Z in the zone
                    x_idx = s_idx % grid_dim
                    z_idx_2 = s_idx // grid_dim
                    
                    su = StorageUnit(
                        zone_id=zone.id,
                        bay_id=None, # No bay
                        location_code=loc_code,
                        level_number=0, # Floor level
                        elevation_meters=0.0,
                        max_weight_kg=5000.0 # High floor capacity
                        # In a real system, we'd add precise X/Y here if the model supported discrete pallet coordinates
                    )
                    
                    if loc_code in generated_codes:
                        raise ValueError(f"Duplicate location code detected: {loc_code}. Adjust your naming pattern.")
                    generated_codes.add(loc_code)
                    
                    self.db.add(su)
        
        await self.db.commit()
        await self.db.refresh(layout)
        return layout
