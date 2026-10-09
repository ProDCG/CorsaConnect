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
        """Delete a driver by UUID."""
        state.leaderboard_db.delete_driver(driver_uuid)
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

        # Also upsert into drivers table so they are remembered
        state.leaderboard_db.upsert_driver(
            display_name=payload.driver_name,
            email=payload.driver_email,
            driver_uuid=payload.driver_uuid,
        )
        logger.info("Assigned driver %s to rig %s", payload.driver_name, payload.rig_id)
        return {"status": "success", "rig_id": payload.rig_id, "driver_name": payload.driver_name}

    return router
