import json
import logging
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException
from pydantic import BaseModel, Field, ValidationError
from typing import Dict, Any

from app.core.redis import subscribe_channel

router = APIRouter()
logger = logging.getLogger(__name__)

# T024: Pydantic Validation for incoming WebSocket connection token
class AuthTokenSchema(BaseModel):
    token: str = Field(..., min_length=10, description="JWT Authentication Token from WMS")

def validate_token(token: str) -> bool:
    try:
        AuthTokenSchema(token=token)
        return True
    except ValidationError:
        return False

@router.websocket("/stream")
async def warehouse_stream(websocket: WebSocket, token: str = Query(...)):
    if not validate_token(token):
        logger.warning("Rejected websocket connection due to invalid token")
        await websocket.close(code=1008, reason="Invalid authentication token")
        return
        
    await websocket.accept()
    logger.info("WebSocket connection established")
    
    # 1. Send the initial snapshot immediately
    # (Mocked for now until standard logic is connected)
    initial_snapshot = {
        "event": "SNAPSHOT",
        "data": {
            "layout": {
                "id": "uuid-123",
                "name": "Main Facility",
                "dimensions": { "width": 100.0, "length": 250.0 },
                "zones": []
            },
            "inventory_state": []
        }
    }
    await websocket.send_json(initial_snapshot)
    
    # 2. Subscribe to internal Redis Pub/Sub backplane
    # For MVP showcase, we will mock a data pump loop directly so it works out of the box locally 
    # without needing a Redis server running on Windows.
    # subscription = subscribe_channel("warehouse_events") 
    
    # Task to forward message from Redis to Client
    async def forward_messages():
        try:
            import random
            while True:
                # Simulate a random inventory update every 500ms
                await asyncio.sleep(0.5)
                mock_aisle = random.randint(0, 5)
                mock_bay = random.randint(0, 11)
                mock_level = random.randint(0, 5)
                mock_slot = random.choice([0, 1, 2, 3]) if mock_aisle >= 3 else 0
                mock_loc = f"A{mock_aisle}-B{mock_bay}-L{mock_level}-{mock_slot}"
                
                is_occupied = random.random() > 0.5
                
                update_event = {
                    "event": "UPDATE",
                    "data": {
                        "storage_unit_id": f"mock-uuid-{mock_loc}",
                        "location_code": mock_loc,
                        "status": "OCCUPIED" if is_occupied else "EMPTY",
                        "fill_percentage": 100 if is_occupied else 0,
                        "sku": f"SKU-DEMO-{random.randint(100, 999)}" if is_occupied else None,
                        "quantity": random.randint(1, 100) if is_occupied else 0
                    }
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
