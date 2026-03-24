"""Async TCP command dispatcher for sending commands to sled agents."""

from __future__ import annotations

import asyncio
import json
import logging

logger = logging.getLogger("ridge.dispatcher")


async def dispatch_command_async(ip: str, port: int, payload: dict[str, object]) -> None:
    """Send a JSON command to a sled via async TCP."""
    action = payload.get("action", "UNKNOWN")
    logger.info("Dispatching %s to %s:%d", action, ip, port)
    try:
        _reader, writer = await asyncio.wait_for(
            asyncio.open_connection(ip, port),
            timeout=2.0,
        )
        writer.write(json.dumps(payload).encode("utf-8"))
        await writer.drain()
        writer.close()
        await writer.wait_closed()
        logger.info("Successfully sent %s to %s", action, ip)
    except Exception as e:
        logger.error("Failed to send command to %s: %s", ip, e)


def dispatch_command(ip: str, port: int, payload: dict[str, object]) -> None:
    """Sync wrapper for use in FastAPI background tasks.

    FastAPI's BackgroundTasks run in a thread pool, so we create a new
    event loop to run the async dispatch.
    """
    try:
        loop = asyncio.new_event_loop()
        loop.run_until_complete(dispatch_command_async(ip, port, payload))
        loop.close()
    except Exception as e:
        logger.error("Dispatch wrapper error for %s: %s", ip, e)
