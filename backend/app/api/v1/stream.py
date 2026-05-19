import json
import logging
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.core.redis import subscribe_channel
from app.core.auth import validate_demo_token

router = APIRouter()
logger = logging.getLogger(__name__)

# ─── WebSocket Connection Manager ──────────────────
# Used by configure.py to broadcast layout updates to all connected viewers
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast_json(self, data: dict):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(data)
            except Exception:
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect(conn)

manager = ConnectionManager()

from app.core.database import AsyncSessionLocal
from app.models.layout import WarehouseLayout, Zone, Aisle, RackBay, StorageUnit
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.schemas.layout import LayoutResponse
from app.services.inventory_provider import DemoInventoryProvider


async def build_snapshot_payload() -> tuple[dict, list[str]]:
    inventory_provider = DemoInventoryProvider()
    async with AsyncSessionLocal() as session:
        stmt = select(WarehouseLayout).options(
            selectinload(WarehouseLayout.zones)
            .selectinload(Zone.aisles)
            .selectinload(Aisle.rack_bays)
            .selectinload(RackBay.levels),
            selectinload(WarehouseLayout.zones).selectinload(Zone.storage_units),
        )
        result = await session.execute(stmt)
        layout = result.scalars().first()
        layout_dict = LayoutResponse.model_validate(layout).model_dump(mode="json") if layout else None

        units_result = await session.execute(select(StorageUnit).where(StorageUnit.is_active == True))
        all_units = units_result.scalars().all()

    return (
        {
            "event": "SNAPSHOT",
            "data": {
                "layout": layout_dict,
                "inventory_state": inventory_provider.snapshot(all_units),
            },
        },
        [unit.location_code for unit in all_units],
    )


async def broadcast_snapshot() -> None:
    snapshot, _ = await build_snapshot_payload()
    await manager.broadcast_json(snapshot)


@router.websocket("/stream")
async def warehouse_stream(websocket: WebSocket, token: str = Query(...)):
    if not validate_demo_token(token):
        logger.warning("Rejected websocket connection due to invalid token")
        await websocket.close(code=1008, reason="Invalid authentication token")
        return

    await manager.connect(websocket)
    logger.info("WebSocket connection established")
    
    # 1. Send the initial snapshot immediately
    inventory_provider = DemoInventoryProvider()
    initial_snapshot, location_codes = await build_snapshot_payload()
    await websocket.send_json(initial_snapshot)
    
    # 2. Subscribe to internal Redis Pub/Sub backplane
    # For MVP showcase, we will mock a data pump loop directly so it works out of the box locally 
    # without needing a Redis server running on Windows.
    # subscription = subscribe_channel("warehouse_events") 
    
    # Task to forward message from Redis to Client
    async def forward_messages():
        try:
            while True:
                await asyncio.sleep(5)
                update_data = inventory_provider.mock_update(location_codes)
                if not update_data:
                    continue
                update_event = {
                    "event": "UPDATE",
                    "data": update_data,
                }
                await websocket.send_json(update_event)
        except Exception as e:
            logger.error(f"Error in mock data generator: {e}")
    
    # Task to gracefully handle client disconnects
    async def hold_connection():
        try:
            while True:
                data = await websocket.receive_text()
                # If the client sends subscriptions (Action: SUBSCRIBE)
                try:
                    payload = json.loads(data)
                    if payload.get("action") == "SUBSCRIBE":
                        logger.info(f"Client subscribed to zones: {payload.get('zone_ids')}")
                except json.JSONDecodeError:
                    pass
        except WebSocketDisconnect:
            logger.info("Client cleanly disconnected")

    # Run tasks concurrently
    forward_task = asyncio.create_task(forward_messages())
    hold_task = asyncio.create_task(hold_connection())
    
    # Wait for either to finish (client disconnect or redis failure)
    done, pending = await asyncio.wait(
        [forward_task, hold_task], 
        return_when=asyncio.FIRST_COMPLETED
    )
    
    for task in pending:
        task.cancel()

    manager.disconnect(websocket)
