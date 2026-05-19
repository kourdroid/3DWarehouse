import random
from dataclasses import dataclass
from typing import Iterable

from app.models.layout import InventoryStatus, StorageUnit


@dataclass(frozen=True)
class InventoryRecord:
    storage_unit_id: str
    location_code: str
    status: str
    fill_percentage: int
    sku: str | None
    quantity: int
    pallet_id: str | None
    storage_kind: str
    x_meters: float
    y_meters: float
    z_meters: float
    width_meters: float
    depth_meters: float
    height_meters: float

    def as_dict(self) -> dict:
        return {
            "storage_unit_id": self.storage_unit_id,
            "location_code": self.location_code,
            "status": self.status,
            "fill_percentage": self.fill_percentage,
            "sku": self.sku,
            "quantity": self.quantity,
            "pallet_id": self.pallet_id,
            "storage_kind": self.storage_kind,
            "x_meters": self.x_meters,
            "y_meters": self.y_meters,
            "z_meters": self.z_meters,
            "width_meters": self.width_meters,
            "depth_meters": self.depth_meters,
            "height_meters": self.height_meters,
        }


class InventoryProvider:
    def snapshot(self, units: Iterable[StorageUnit]) -> list[dict]:
        raise NotImplementedError

    def mock_update(self, location_codes: list[str]) -> dict | None:
        raise NotImplementedError


class DemoInventoryProvider(InventoryProvider):
    """
    Runtime inventory provider for the NCL demo.
    Uses stored inventory when imported, otherwise creates stable-shaped mock records
    against real StorageUnit.location_code values.
    """

    def snapshot(self, units: Iterable[StorageUnit]) -> list[dict]:
        unit_list = list(units)
        has_imported_inventory = any(
            unit.status != InventoryStatus.EMPTY or bool(unit.sku) or unit.quantity > 0
            for unit in unit_list
        )

        records = []
        for unit in unit_list:
            is_occupied = unit.status == InventoryStatus.OCCUPIED
            status = unit.status.value
            sku = unit.sku
            quantity = unit.quantity
            if not has_imported_inventory:
                is_occupied = random.random() > 0.4
                status = InventoryStatus.OCCUPIED.value if is_occupied else InventoryStatus.EMPTY.value
                sku = f"SKU-{random.randint(1000, 9999)}" if is_occupied else None
                quantity = random.randint(1, 200) if is_occupied else 0

            records.append(
                InventoryRecord(
                    storage_unit_id=str(unit.id),
                    location_code=unit.location_code,
                    status=status,
                    fill_percentage=100 if is_occupied else 0,
                    sku=sku,
                    quantity=quantity,
                    pallet_id=unit.pallet_id,
                    storage_kind=unit.storage_kind.value,
                    x_meters=unit.x_meters,
                    y_meters=unit.y_meters,
                    z_meters=unit.z_meters,
                    width_meters=unit.width_meters,
                    depth_meters=unit.depth_meters,
                    height_meters=unit.height_meters,
                ).as_dict()
            )
        return records

    def mock_update(self, location_codes: list[str]) -> dict | None:
        if not location_codes:
            return None
        location_code = random.choice(location_codes)
        is_occupied = random.random() > 0.5
        return {
            "location_code": location_code,
            "status": InventoryStatus.OCCUPIED.value if is_occupied else InventoryStatus.EMPTY.value,
            "fill_percentage": 100 if is_occupied else 0,
            "sku": f"SKU-DEMO-{random.randint(100, 999)}" if is_occupied else None,
            "quantity": random.randint(1, 100) if is_occupied else 0,
            "pallet_id": f"PALLET-DEMO-{random.randint(1000, 9999)}" if is_occupied else None,
        }


class WmsInventoryProvider(InventoryProvider):
    def snapshot(self, units: Iterable[StorageUnit]) -> list[dict]:
        raise NotImplementedError("WMS provider is intentionally deferred until NCL exposes an API contract")

    def mock_update(self, location_codes: list[str]) -> dict | None:
        return None
