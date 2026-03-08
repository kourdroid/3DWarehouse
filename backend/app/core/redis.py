import os
import json
import logging
from typing import Optional, AsyncGenerator
import redis.asyncio as redis

logger = logging.getLogger(__name__)

# Fallback to local Redis if env var not set
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Global variables for the Redis connection pool
_redis_pool: Optional[redis.Redis] = None

async def init_redis_pool():
    """Initialize the Redis connection pool."""
    global _redis_pool
    if not _redis_pool:
        _redis_pool = redis.from_url(REDIS_URL, decode_responses=True)
        logger.info(f"Connected to Redis at {REDIS_URL}")

async def close_redis_pool():
    """Close the Redis connection pool."""
    global _redis_pool
    if _redis_pool:
        await _redis_pool.close()
        _redis_pool = None
        logger.info("Closed Redis connection")

async def get_redis() -> redis.Redis:
    """Dependency to get Redis connection."""
    global _redis_pool
    if not _redis_pool:
        await init_redis_pool()
    return _redis_pool

async def publish_event(channel: str, message: dict):
    """Publish a dictionary message to a Redis channel."""
    r = await get_redis()
    await r.publish(channel, json.dumps(message))

async def subscribe_channel(channel: str) -> AsyncGenerator[dict, None]:
    """Subscribe to a Redis channel and yield messages."""
    r = await get_redis()
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
