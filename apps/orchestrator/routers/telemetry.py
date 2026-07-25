"""Telemetry endpoints for AssettoServer."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel

from apps.orchestrator.state import AppState
from shared.models import LeaderboardEntry

logger = logging.getLogger(__name__)

router = APIRouter(tags=["telemetry"])


class LapCompletedPayload(BaseModel):
    rig_id: str
    driver_name: str | None = None
    driver_email: str | None = None
    driver_phone: str | None = None
    car: str | None = None
    track: str | None = None
    weather: str | None = None
    group_name: str | None = None
    session_type: str | None = None  # race, qualify, practice
    lap: int = 0
    lap_time_ms: int
    session_id: str | None = None
    timestamp: float | None = None


def process_notifications_placeholder(
    previous_driver_name: str | None,
    previous_driver_email: str | None,
    previous_driver_phone: str | None,
    new_driver_name: str | None,
    track: str | None,
    car: str | None,
) -> None:
    """Mock worker to process notifications."""
    logger.info(f"NOTIFICATION PENDING: {previous_driver_name} dethroned by {new_driver_name} on {track} in {car}.")
    logger.info(f"Would send email to: {previous_driver_email} and SMS to: {previous_driver_phone}")
    # In the future, this will run at the end of the session.


def create_router(state: AppState) -> APIRouter:
    @router.post("/api/telemetry/lap-completed")
    async def lap_completed(payload: LapCompletedPayload, background_tasks: BackgroundTasks) -> dict[str, Any]:
        # Only count laps if we are in qualify or race
        if payload.session_type and payload.session_type.lower() not in ("race", "qualify"):
            return {"status": "ignored", "reason": f"session_type is {payload.session_type}"}

        import time

        timestamp = payload.timestamp or time.time()

        entry = LeaderboardEntry(
            rig_id=payload.rig_id,
            driver_name=payload.driver_name,
            driver_email=payload.driver_email,
            driver_phone=payload.driver_phone,
            car=payload.car,
            track=payload.track,
            weather=payload.weather,
            group_name=payload.group_name,
            session_type=payload.session_type,
            lap=payload.lap,
            lap_time_ms=payload.lap_time_ms,
            session_id=payload.session_id,
            timestamp=timestamp,
            notification_pending=False,
        )

        # Check reigning champion
        current_top = state.leaderboard_db.get_filtered_leaderboard(
            track=payload.track, car=payload.car, weather=payload.weather, limit=1
        )

        if current_top:
            top = current_top[0]
            if top.lap_time_ms and payload.lap_time_ms < top.lap_time_ms:
                # Dethroned!
                entry.notification_pending = True
                if top.driver_name != payload.driver_name or top.driver_email != payload.driver_email:
                    background_tasks.add_task(
                        process_notifications_placeholder,
                        previous_driver_name=top.driver_name,
                        previous_driver_email=top.driver_email,
                        previous_driver_phone=top.driver_phone,
                        new_driver_name=payload.driver_name,
                        track=payload.track,
                        car=payload.car,
                    )

        state.add_leaderboard_entry(entry)
        state.upsert_session_best(entry)

        if state.settings.enable_per_lap_logging:
            logger.info(f"Lap recorded: {payload.driver_name} on {payload.track} - {payload.lap_time_ms}ms")

        return {"status": "success", "dethroned": entry.notification_pending}

    return router
