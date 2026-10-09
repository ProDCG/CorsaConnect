"""Server-Sent Events (SSE) live data stream endpoint.

Pushes real-time state updates to connected clients (Admin Dashboard, Lobby, Kiosks),
eliminating the need for uncoordinated HTTP polling loops.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import TYPE_CHECKING, Any

from fastapi import APIRouter, Request
from starlette.responses import StreamingResponse

if TYPE_CHECKING:
    from apps.orchestrator.state import AppState

logger = logging.getLogger("ridge.stream")

router = APIRouter(tags=["stream"])


def create_router(state: AppState) -> APIRouter:
    """Create the stream router bound to application state."""

    def _build_snapshot() -> dict[str, Any]:
        """Serialize current state into a consolidated dashboard snapshot."""
        all_rigs = state.get_rigs()
        all_groups = [g.model_dump() for g in state.get_groups()]
        all_sessions = state.get_all_sessions()

        top_today = [
            e.model_dump() for e in state.leaderboard_db.get_today_best(limit=10)
        ]
        top_all_time = [
            e.model_dump() for e in state.leaderboard_db.get_session_best_all(limit=10)
        ]

        active_rigs = [r for r in all_rigs if r.get("status") == "racing"]
        idle_rigs = [r for r in all_rigs if r.get("status") == "idle"]
        setup_rigs = [r for r in all_rigs if r.get("status") in ("setup", "ready")]

        # Health status checks
        now = time.time()
        heartbeats_ok = any(
            isinstance(r.get("last_seen"), (int, float)) and now - float(str(r["last_seen"])) < 5
            for r in all_rigs
        ) if all_rigs else False

        telemetry_ok = any(
            bool(r.get("telemetry")) for r in active_rigs
        ) if active_rigs else True

        return {
            "timestamp": now,
            "server_status": state.server_status,
            "rigs": all_rigs,
            "active_rigs_count": len(active_rigs),
            "idle_rigs_count": len(idle_rigs),
            "setup_rigs_count": len(setup_rigs),
            "total_rigs_count": len(all_rigs),
            "groups": all_groups,
            "sessions": all_sessions,
            "active_session": all_sessions[0] if all_sessions else None,
            "top_10_today": top_today,
            "top_10_all_time": top_all_time,
            "health": {
                "heartbeats_ok": heartbeats_ok,
                "telemetry_ok": telemetry_ok,
                "server_status": state.server_status,
            },
        }

    @router.get("/stream/live")
    async def stream_live_state(request: Request) -> StreamingResponse:
        """Stream real-time updates as Server-Sent Events (SSE)."""
        async def event_generator():
            logger.debug("Client connected to SSE stream")
            try:
                while True:
                    if await request.is_disconnected():
                        logger.debug("Client disconnected from SSE stream")
                        break

                    snapshot = _build_snapshot()
                    data_str = json.dumps(snapshot)
                    yield f"event: state_update\ndata: {data_str}\n\n"

                    # 1-second update interval
                    await asyncio.sleep(1.0)
            except asyncio.CancelledError:
                pass
            except Exception as e:
                logger.error("SSE stream error: %s", e)

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
                "Access-Control-Allow-Origin": "*",
            },
        )

    return router
