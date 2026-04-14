import os
import json
import logging
from typing import Optional, AsyncGenerator

logger = logging.getLogger(__name__)

# Soft-import redis — the module is NOT required for local dev.
# The WebSocket stream uses a mock data pump, not Redis Pub/Sub.
try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    redis = None  # type: ignore
    REDIS_AVAILABLE = False
    logger.warning("redis package not installed. Redis features disabled — using mock stream only.")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
_redis_pool = None

async def init_redis_pool():
    global _redis_pool
    if not REDIS_AVAILABLE:
        return
    if not _redis_pool:
        _redis_pool = redis.from_url(REDIS_URL, decode_responses=True)
        logger.info(f"Connected to Redis at {REDIS_URL}")

async def close_redis_pool():
    global _redis_pool
    if _redis_pool:
        await _redis_pool.close()
        _redis_pool = None

async def get_redis():
    global _redis_pool
    if not REDIS_AVAILABLE:
        return None
    if not _redis_pool:
        await init_redis_pool()
    return _redis_pool

async def publish_event(channel: str, message: dict):
    r = await get_redis()
    if r:
        await r.publish(channel, json.dumps(message))

async def subscribe_channel(channel: str) -> AsyncGenerator[dict, None]:
    r = await get_redis()
    if not r:
        return  # No-op generator if redis unavailable
    pubsub = r.pubsub()
    await pubsub.subscribe(channel)
    try:
        async for message in pubsub.listen():
            if message['type'] == 'message':
                try:
                    yield json.loads(message['data'])
                except json.JSONDecodeError:
                    logger.error(f"Failed to decode message: {message['data']}")
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close()
