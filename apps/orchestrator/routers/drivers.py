"""Driver management endpoints for Ridge-Link."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from fastapi import APIRouter
from pydantic import BaseModel

if TYPE_CHECKING:
    from apps.orchestrator.state import AppState

logger = logging.getLogger("ridge.drivers")

router = APIRouter(tags=["drivers"])


class DriverPayload(BaseModel):
    display_name: str
    email: str | None = None
    phone: str | None = None
    driver_uuid: str | None = None


class DriverAssignPayload(BaseModel):
    rig_id: str
    driver_name: str
    driver_email: str | None = None
    driver_uuid: str | None = None


def create_router(state: AppState) -> APIRouter:
    """Create the drivers router bound to application state."""

    @router.get("/drivers")
    async def get_drivers() -> list[dict[str, object]]:
        """Return all registered drivers."""
        return state.leaderboard_db.get_drivers()

    @router.post("/drivers")
    async def upsert_driver(payload: DriverPayload) -> dict[str, object]:
        """Create or update a driver."""
        driver = state.leaderboard_db.upsert_driver(
            display_name=payload.display_name,
            email=payload.email,
            phone=payload.phone,
            driver_uuid=payload.driver_uuid,
        )
        return {"status": "success", "driver": driver}

    @router.delete("/drivers/{driver_uuid}")
    async def delete_driver(driver_uuid: str) -> dict[str, str]:
        """Delete a driver by UUID, unbind them from any active rigs, and mark their check-ins unbound."""
        all_drivers = state.leaderboard_db.get_drivers()
        target_driver = next((d for d in all_drivers if d.get("driver_uuid") == driver_uuid), None)
        target_name = str(target_driver.get("display_name") or "") if target_driver else ""

        state.leaderboard_db.delete_driver(driver_uuid)
        state.leaderboard_db.mark_rig_checkins_unbound(driver_uuid=driver_uuid)

        # Also unbind from any rig currently holding this driver
        for r in state.get_rigs():
            rid = str(r.get("rig_id") or "")
            if not rid:
                continue
            if r.get("driver_uuid") == driver_uuid or (target_name and r.get("driver_name") == target_name):
                state.update_rig_field(rid, "driver_name", None)
                state.update_rig_field(rid, "driver_email", None)
                state.update_rig_field(rid, "driver_uuid", None)
                state.update_rig_field(rid, "checkin_status", None)
                state.update_rig_field(rid, "driver_unbound", True)
                state.leaderboard_db.mark_rig_checkins_unbound(rig_id=rid)

        return {"status": "success"}

    @router.post("/drivers/assign")
    async def assign_driver_to_rig(payload: DriverAssignPayload) -> dict[str, str]:
        """Assign a driver to a physical or virtual rig."""
        rig = state.get_rig(payload.rig_id)
        if not rig:
            state.upsert_rig(
                payload.rig_id,
                {
                    "driver_name": payload.driver_name,
                    "driver_email": payload.driver_email,
                    "driver_uuid": payload.driver_uuid,
                },
            )
        else:
            state.update_rig_field(payload.rig_id, "driver_name", payload.driver_name)
            state.update_rig_field(payload.rig_id, "driver_email", payload.driver_email)
            state.update_rig_field(payload.rig_id, "driver_uuid", payload.driver_uuid)
            state.update_rig_field(payload.rig_id, "driver_unbound", False)

        # Also upsert into drivers table so they are remembered
        state.leaderboard_db.upsert_driver(
            display_name=payload.driver_name,
            email=payload.driver_email,
            driver_uuid=payload.driver_uuid,
        )
        logger.info("Assigned driver %s to rig %s", payload.driver_name, payload.rig_id)
        return {"status": "success", "rig_id": payload.rig_id, "driver_name": payload.driver_name}

    return router
