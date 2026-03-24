"""Leaderboard and lobby endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from apps.orchestrator.state import AppState
from shared.models import LeaderboardEntry

router = APIRouter(tags=["leaderboard"])


def create_router(state: AppState) -> APIRouter:
    """Create the leaderboard/lobby router bound to the given application state."""

    @router.get("/leaderboard")
    async def get_leaderboard() -> list[LeaderboardEntry]:
        """Full leaderboard data for the admin dashboard."""
        return state.leaderboard

    @router.get("/lobby")
    async def get_lobby() -> dict[str, object]:
        """Public feed for TV displays — top 10, current active rigs, and race status.

        Designed to be consumed by a full-screen lobby page on wall-mounted screens.
        """
        entries = sorted(state.leaderboard, key=lambda e: e.lap, reverse=True)[:10]
        active_rigs = [
            {
                "rig_id": r["rig_id"],
                "status": r.get("status", "idle"),
                "selected_car": r.get("selected_car"),
                "telemetry": r.get("telemetry"),
            }
            for r in state.get_rigs()
            if r.get("status") == "racing"
        ]

        return {
            "top_10": [e.model_dump() for e in entries],
            "active_rigs": active_rigs,
            "total_rigs": len(state.get_rigs()),
            "server_status": state.server_status,
        }

    return router
