from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from io import StringIO
from typing import Any

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.layout import (
    Aisle,
    AisleOrientation,
    InventoryStatus,
    Level,
    RackBay,
    StorageKind,
    StorageType,
    StorageUnit,
    WarehouseLayout,
    Zone,
)


DEFAULT_PATTERN = r"^(?P<zone>[A-Z]+)-(?P<aisle>\d+)-(?P<bay>\d+)-(?P<level>\d+)-(?P<slot>\d+)$"


@dataclass(frozen=True)
class LocationCodeDefaults:
    aisle_spacing_meters: float = 3.5
    bay_width_meters: float = 2.8
    bay_depth_meters: float = 1.2
    floor_level_height_meters: float = 0.0
    upper_level_step_meters: float = 1.5


@dataclass(frozen=True)
class ParsedLocation:
    raw: str
    zone: str
    aisle: str
    bay: str
    level: int
    slot: str


@dataclass(frozen=True)
class ImportErrorDetail:
    row: int
    column: str
    message: str

    def as_dict(self) -> dict[str, Any]:
        return {"sheet": "location_codes", "row": self.row, "column": self.column, "message": self.message}


class LocationCodeImportService:
    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def create_template_csv() -> StringIO:
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(["location_code"])
        writer.writerow(["A-01-03-0-1"])
        writer.writerow(["A-01-03-1-1"])
        writer.writerow(["A-01-03-1-2"])
        writer.writerow(["A-01-03-1-3"])
        writer.writerow(["A-01-03-2-1"])
        writer.writerow(["A-01-03-2-2"])
        output.seek(0)
        return output

    async def import_csv(
        self,
        content: bytes,
        dry_run: bool,
        pattern: str = DEFAULT_PATTERN,
        warehouse_name: str = "NCL Logical Warehouse",
        defaults: LocationCodeDefaults | None = None,
    ) -> dict[str, Any]:
        parsed = self._parse_csv(content, pattern, warehouse_name, defaults or LocationCodeDefaults())

        if parsed["errors"] or dry_run:
            return self._response(parsed, dry_run=dry_run, applied=False)

        await self._replace_layout(parsed)
        return self._response(parsed, dry_run=False, applied=True)

    def _parse_csv(
        self,
        content: bytes,
        pattern: str,
        warehouse_name: str,
        defaults: LocationCodeDefaults,
    ) -> dict[str, Any]:
        errors: list[ImportErrorDetail] = []
        warnings: list[str] = []
        rows = self._read_rows(content, errors)
        regex = self._compile_pattern(pattern, errors)

        parsed_locations: list[ParsedLocation] = []
        seen: set[str] = set()
        for row_index, row in rows:
            location_code = str(row.get("location_code") or "").strip().upper()
            if not location_code:
                errors.append(ImportErrorDetail(row_index, "location_code", "Required value is missing"))
                continue
            if location_code in seen:
                errors.append(ImportErrorDetail(row_index, "location_code", "Duplicate location_code"))
                continue
            seen.add(location_code)
            if regex is None:
                continue
            match = regex.match(location_code)
            if not match:
                errors.append(ImportErrorDetail(row_index, "location_code", "Value does not match parser pattern"))
                continue
            group = match.groupdict()
            missing = [key for key in ("zone", "aisle", "bay", "level", "slot") if not group.get(key)]
            if missing:
                errors.append(ImportErrorDetail(row_index, "location_code", f"Pattern missing groups: {', '.join(missing)}"))
                continue
            try:
                level = int(group["level"])
            except ValueError:
                errors.append(ImportErrorDetail(row_index, "level", "Level must be numeric"))
                continue
            parsed_locations.append(
                ParsedLocation(
                    raw=location_code,
                    zone=str(group["zone"]).upper(),
                    aisle=str(group["aisle"]).zfill(2),
                    bay=str(group["bay"]).zfill(3),
                    level=level,
                    slot=str(group["slot"]).zfill(2),
                )
            )

        topology = self._build_topology(parsed_locations)
        generated = self._generate_layout(topology, warehouse_name, pattern, defaults)
        if not parsed_locations:
            warnings.append("No valid location codes were parsed")

        return {
            "warehouse_name": warehouse_name,
            "pattern": pattern,
            "defaults": defaults.__dict__,
            "topology": topology,
            "generated": generated,
            "warnings": warnings,
            "errors": [error.as_dict() for error in errors],
        }

    def _read_rows(self, content: bytes, errors: list[ImportErrorDetail]) -> list[tuple[int, dict[str, str]]]:
        try:
            decoded = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            errors.append(ImportErrorDetail(1, "*", "CSV must be UTF-8 encoded"))
            return []
        reader = csv.DictReader(StringIO(decoded))
        if not reader.fieldnames or "location_code" not in reader.fieldnames:
            errors.append(ImportErrorDetail(1, "location_code", "Required column is missing"))
            return []
        return [(index, row) for index, row in enumerate(reader, start=2)]

    def _compile_pattern(self, pattern: str, errors: list[ImportErrorDetail]):
        try:
            regex = re.compile(pattern)
        except re.error as exc:
            errors.append(ImportErrorDetail(1, "pattern", f"Invalid regex pattern: {exc}"))
            return None
        required_groups = {"zone", "aisle", "bay", "level", "slot"}
        missing_groups = required_groups - set(regex.groupindex)
        if missing_groups:
            errors.append(ImportErrorDetail(1, "pattern", f"Regex must define groups: {', '.join(sorted(missing_groups))}"))
            return None
        return regex

    def _build_topology(self, locations: list[ParsedLocation]) -> dict[str, Any]:
        topology: dict[str, dict[str, dict[str, dict[int, list[ParsedLocation]]]]] = {}
        for location in locations:
            topology.setdefault(location.zone, {}).setdefault(location.aisle, {}).setdefault(location.bay, {}).setdefault(
                location.level,
                [],
            ).append(location)
        return topology

    def _generate_layout(
        self,
        topology: dict[str, Any],
        warehouse_name: str,
        pattern: str,
        defaults: LocationCodeDefaults,
    ) -> dict[str, Any]:
        zones: dict[str, Any] = {}
        storage_units: list[dict[str, Any]] = []
        zone_x = 0.0
        total_length = defaults.bay_depth_meters

        for zone_code in sorted(topology):
            aisles = topology[zone_code]
            max_bay_count = max((len(bays) for bays in aisles.values()), default=1)
            zone_width = max_bay_count * defaults.bay_width_meters
            zone_length = max(len(aisles) * defaults.aisle_spacing_meters, defaults.bay_depth_meters)
            total_length = max(total_length, zone_length)
            zones[zone_code] = {
                "code": zone_code,
                "name": f"Zone {zone_code}",
                "color_hex": "#2563eb",
                "storage_type": StorageType.STANDARD_RACK,
                "position_x_meters": round(zone_x, 4),
                "position_z_meters": 0.0,
                "width_meters": round(zone_width, 4),
                "length_meters": round(zone_length, 4),
                "location_code_pattern": pattern,
                "aisles": {},
            }

            for aisle_index, aisle_code in enumerate(sorted(aisles, key=self._sort_key)):
                bays = aisles[aisle_code]
                aisle_data = {
                    "identifier": f"A{aisle_code}",
                    "orientation": AisleOrientation.NORTH_SOUTH,
                    "start_x_meters": 0.0,
                    "start_z_meters": round(aisle_index * defaults.aisle_spacing_meters, 4),
                    "spacing_meters": defaults.aisle_spacing_meters,
                    "bays": {},
                }
                zones[zone_code]["aisles"][aisle_code] = aisle_data

                for bay_index, bay_code in enumerate(sorted(bays, key=self._sort_key), start=1):
                    levels = bays[bay_code]
                    bay_data = {
                        "identifier": f"B{bay_code}",
                        "sequence_number": bay_index,
                        "width_meters": defaults.bay_width_meters,
                        "depth_meters": defaults.bay_depth_meters,
                        "pallets_per_bay": max(len(slots) for slots in levels.values()),
                        "levels": {},
                    }
                    aisle_data["bays"][bay_code] = bay_data

                    for level_number in sorted(levels):
                        locations = sorted(levels[level_number], key=lambda item: self._sort_key(item.slot))
                        slot_count = len(locations)
                        slot_width = defaults.bay_width_meters / max(slot_count, 1)
                        y = (
                            defaults.floor_level_height_meters
                            if level_number == 0
                            else level_number * defaults.upper_level_step_meters
                        )
                        bay_data["levels"][level_number] = {
                            "level_number": level_number,
                            "height_meters": round(y, 4),
                            "max_weight_kg": 1000.0,
                        }

                        for slot_index, location in enumerate(locations):
                            x = zone_x + ((bay_index - 1) * defaults.bay_width_meters) + (slot_index * slot_width) + (slot_width / 2)
                            z = aisle_index * defaults.aisle_spacing_meters
                            storage_units.append(
                                {
                                    "zone_code": zone_code,
                                    "aisle_code": aisle_code,
                                    "bay_code": bay_code,
                                    "location_code": location.raw,
                                    "level_number": level_number,
                                    "position_number": slot_index + 1,
                                    "storage_kind": StorageKind.PALLET,
                                    "x_meters": round(x, 4),
                                    "y_meters": round(y, 4),
                                    "z_meters": round(z, 4),
                                    "width_meters": round(slot_width, 4),
                                    "depth_meters": defaults.bay_depth_meters,
                                    "height_meters": 1.2,
                                    "max_weight_kg": 1000.0,
                                }
                            )
            zone_x += zone_width + 10.0

        return {
            "warehouse": {
                "name": warehouse_name,
                "total_width_meters": round(max(zone_x - 10.0, defaults.bay_width_meters), 4),
                "total_length_meters": round(total_length, 4),
            },
            "zones": zones,
            "storage_units": storage_units,
        }

    async def _replace_layout(self, parsed: dict[str, Any]) -> None:
        generated = parsed["generated"]
        try:
            await self.db.execute(delete(StorageUnit))
            await self.db.execute(delete(Level))
            await self.db.execute(delete(RackBay))
            await self.db.execute(delete(Aisle))
            await self.db.execute(delete(Zone))
            await self.db.execute(delete(WarehouseLayout))
            await self.db.flush()

            layout = WarehouseLayout(**generated["warehouse"])
            self.db.add(layout)
            await self.db.flush()

            zone_models: dict[str, Zone] = {}
            aisle_models: dict[tuple[str, str], Aisle] = {}
            bay_models: dict[tuple[str, str, str], RackBay] = {}

            for zone_code, zone_data in generated["zones"].items():
                zone = Zone(
                    layout_id=layout.id,
                    code=zone_data["code"],
                    name=zone_data["name"],
                    color_hex=zone_data["color_hex"],
                    storage_type=zone_data["storage_type"],
                    position_x_meters=zone_data["position_x_meters"],
                    position_z_meters=zone_data["position_z_meters"],
                    width_meters=zone_data["width_meters"],
                    length_meters=zone_data["length_meters"],
                    location_code_pattern=zone_data["location_code_pattern"],
                    floor_slots=0,
                )
                self.db.add(zone)
                await self.db.flush()
                zone_models[zone_code] = zone

                for aisle_code, aisle_data in zone_data["aisles"].items():
                    aisle = Aisle(
                        zone_id=zone.id,
                        identifier=aisle_data["identifier"],
                        orientation=aisle_data["orientation"],
                        start_x_meters=aisle_data["start_x_meters"],
                        start_z_meters=aisle_data["start_z_meters"],
                        spacing_meters=aisle_data["spacing_meters"],
                    )
                    self.db.add(aisle)
                    await self.db.flush()
                    aisle_models[(zone_code, aisle_code)] = aisle

                    for bay_code, bay_data in aisle_data["bays"].items():
                        bay = RackBay(
                            aisle_id=aisle.id,
                            identifier=bay_data["identifier"],
                            sequence_number=bay_data["sequence_number"],
                            width_meters=bay_data["width_meters"],
                            depth_meters=bay_data["depth_meters"],
                            pallets_per_bay=bay_data["pallets_per_bay"],
                        )
                        self.db.add(bay)
                        await self.db.flush()
                        bay_models[(zone_code, aisle_code, bay_code)] = bay

                        for level_data in bay_data["levels"].values():
                            self.db.add(
                                Level(
                                    bay_id=bay.id,
                                    level_number=level_data["level_number"],
                                    height_meters=level_data["height_meters"],
                                    max_weight_kg=level_data["max_weight_kg"],
                                )
                            )

            await self.db.flush()
            for unit_data in generated["storage_units"]:
                zone = zone_models[unit_data["zone_code"]]
                bay = bay_models[(unit_data["zone_code"], unit_data["aisle_code"], unit_data["bay_code"])]
                self.db.add(
                    StorageUnit(
                        zone_id=zone.id,
                        bay_id=bay.id,
                        location_code=unit_data["location_code"],
                        level_number=unit_data["level_number"],
                        position_number=unit_data["position_number"],
                        storage_kind=unit_data["storage_kind"],
                        elevation_meters=unit_data["y_meters"],
                        x_meters=unit_data["x_meters"],
                        y_meters=unit_data["y_meters"],
                        z_meters=unit_data["z_meters"],
                        width_meters=unit_data["width_meters"],
                        depth_meters=unit_data["depth_meters"],
                        height_meters=unit_data["height_meters"],
                        max_weight_kg=unit_data["max_weight_kg"],
                        is_active=True,
                        status=InventoryStatus.EMPTY,
                    )
                )
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            raise

    def _response(self, parsed: dict[str, Any], dry_run: bool, applied: bool) -> dict[str, Any]:
        generated = parsed["generated"]
        zones = generated["zones"]
        aisles_count = sum(len(zone["aisles"]) for zone in zones.values())
        bays_count = sum(len(aisle["bays"]) for zone in zones.values() for aisle in zone["aisles"].values())
        levels_count = sum(
            len(bay["levels"])
            for zone in zones.values()
            for aisle in zone["aisles"].values()
            for bay in aisle["bays"].values()
        )
        return {
            "dry_run": dry_run,
            "applied": applied,
            "warehouse_name": parsed["warehouse_name"],
            "pattern": parsed["pattern"],
            "defaults": parsed["defaults"],
            "counts": {
                "zones": len(zones),
                "aisles": aisles_count,
                "bays": bays_count,
                "levels": levels_count,
                "storage_positions": len(generated["storage_units"]),
                "inventory_rows": 0,
            },
            "preview": generated["storage_units"][:25],
            "warnings": parsed["warnings"],
            "errors": parsed["errors"],
        }

    def _sort_key(self, value: str) -> tuple[int, Any]:
        try:
            return (0, int(value))
        except ValueError:
            return (1, value)
