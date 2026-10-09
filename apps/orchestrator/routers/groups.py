"""Rig group/pairing CRUD endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from apps.orchestrator.state import AppState
from shared.models import RigGroup, RigGroupAddRig, RigGroupCreate, RigGroupUpdate

router = APIRouter(prefix="/groups", tags=["groups"])


from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from apps.orchestrator.services.mumble_service import MumbleService


def create_router(state: AppState, mumble_service: MumbleService | None = None) -> APIRouter:
    """Create the groups router bound to the given application state and Mumble service."""

    @router.get("/")
    async def list_groups() -> list[RigGroup]:
        """List all rig groups."""
        return state.get_groups()

    @router.post("/")
    async def create_group(body: RigGroupCreate) -> RigGroup:
        """Create a new rig group."""
        return state.create_group(name=body.name, mode=body.mode, voice_channel=body.voice_channel)

    @router.get("/{group_id}")
    async def get_group(group_id: str) -> dict[str, object]:
        """Get a group with its member rigs."""
        group = state.get_group(group_id)
        if not group:
            return {"error": "Group not found"}
        rigs = state.get_group_rigs(group_id)
        return {"group": group.model_dump(), "rigs": rigs}

    @router.put("/{group_id}")
    async def update_group(group_id: str, body: RigGroupUpdate) -> dict[str, object]:
        """Update a group's settings."""
        update_data = body.model_dump(exclude_none=True)
        group = state.update_group(group_id, **update_data)
        if not group:
            return {"error": "Group not found"}
        if "voice_channel" in update_data and mumble_service:
            vc = update_data["voice_channel"]
            for rid in group.rig_ids:
                if vc:
                    mumble_service.assign_rig(rid, str(vc))
                else:
                    mumble_service.unassign_rig(rid)
        return {"status": "success", "group": group.model_dump()}

    @router.delete("/{group_id}")
    async def delete_group(group_id: str) -> dict[str, str]:
        """Delete a group and unassign its rigs."""
        if state.delete_group(group_id):
            return {"status": "success"}
        return {"status": "error", "message": "Group not found"}

    @router.post("/{group_id}/rigs")
    async def add_rig_to_group(group_id: str, body: RigGroupAddRig) -> dict[str, str]:
        """Add a rig to a group (removes from previous group automatically)."""
        if state.add_rig_to_group(group_id, body.rig_id):
            group = state.get_group(group_id)
            if group and group.voice_channel and mumble_service:
                mumble_service.assign_rig(body.rig_id, group.voice_channel)
            return {"status": "success"}
        return {"status": "error", "message": "Group not found"}

    @router.delete("/{group_id}/rigs/{rig_id}")
    async def remove_rig_from_group(group_id: str, rig_id: str) -> dict[str, str]:
        """Remove a rig from a group."""
        group = state.get_group(group_id)
        if state.remove_rig_from_group(group_id, rig_id):
            if group and group.voice_channel and mumble_service:
                mumble_service.unassign_rig(rig_id)
            return {"status": "success"}
        return {"status": "error", "message": "Group or rig not found"}

    return router
