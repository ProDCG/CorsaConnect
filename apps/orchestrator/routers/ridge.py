"""Ridge Sim Racing API endpoints for QR check-ins, lap synchronization, and remote stats."""

from __future__ import annotations

import io
import logging
import time
import uuid
from typing import TYPE_CHECKING, Any

from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel

from apps.orchestrator.services.qr_generator import generate_qr_matrix
from apps.orchestrator.services.ridge_api import RidgeApiService, build_checkin_qr_url

if TYPE_CHECKING:
    from apps.orchestrator.state import AppState

logger = logging.getLogger("ridge.router.ridge")


class StartCheckinSessionPayload(BaseModel):
    session_id: str | None = None
    rig_ids: list[str]
    expires_in_sec: int | None = 600
    group_id: str | None = None
    group_name: str | None = None
    track: str | None = None
    track_layout: str | None = None
    test_mode: bool | None = None
    show_qr_on_rigs: bool | None = None


class SyncSessionPayload(BaseModel):
    finalize: bool = False


class ToggleRigQrPayload(BaseModel):
    rig_id: str | None = None  # If None or "ALL", toggles for all rigs
    show_qr: bool


class TestApiPayload(BaseModel):
    api_url: str | None = None
    api_key: str | None = None


def _generate_qr_svg(data: str, border: int = 2) -> str:
    """Generate a scannable ISO/IEC 18004 SVG QR code string with zero external dependencies."""
    matrix = generate_qr_matrix(data, border=border)
    size = len(matrix)
    rects: list[str] = []
    for r_idx, row in enumerate(matrix):
        for c_idx, val in enumerate(row):
            if val:
                rects.append(f'<rect x="{c_idx}" y="{r_idx}" width="1" height="1" fill="#000000"/>')
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" '
        f'shape-rendering="crispEdges" width="256" height="256">'
        f'<rect width="100%" height="100%" fill="#FFFFFF"/>'
        + "".join(rects)
        + "</svg>"
    )


def create_router(state: AppState, ridge_svc: RidgeApiService) -> APIRouter:
    """Create the Ridge API router bound to application state and RidgeApiService."""
    router = APIRouter(tags=["ridge"])

    @router.get("/ridge/sessions")
    async def list_ridge_sessions(limit: int = 20) -> dict[str, Any]:
        """List recent Ridge API sessions and their active check-in tokens."""
        sessions = state.leaderboard_db.get_ridge_sessions(limit=limit)
        base_url = (getattr(state.settings, "ridge_api_url", None) or "https://theridge.fun/racing-api/").rstrip("/")
        for s in sessions:
            sid = str(s["session_id"])
            checkins = state.leaderboard_db.get_ridge_checkins(sid)
            for c in checkins:
                c["checkin_url"] = build_checkin_qr_url(base_url, str(c["raw_token"]))
            s["checkins"] = checkins
            unsynced = state.leaderboard_db.get_unsynced_laps(sid)
            s["unsynced_laps_count"] = len(unsynced)
        return {
            "status": "success",
            "sessions": sessions,
            "show_qr_on_rigs": bool(getattr(state.settings, "ridge_show_qr_on_rigs", False)),
            "ridge_test_mode": bool(getattr(state.settings, "ridge_test_mode", False)),
            "ridge_auto_sync": bool(getattr(state.settings, "ridge_auto_sync", True)),
            "has_api_key": bool(getattr(state.settings, "ridge_api_key", None)),
        }

    @router.post("/ridge/session/start")
    async def start_checkin_session(payload: StartCheckinSessionPayload) -> dict[str, Any]:
        """Generate CSPRNG QR tokens for specified rigs and register them with Ridge API."""
        use_test = payload.test_mode if payload.test_mode is not None else getattr(state.settings, "ridge_test_mode", False)
        prefix = "test_sess" if use_test else "sess"
        session_id = payload.session_id or f"{prefix}_{int(time.time())}_{uuid.uuid4().hex[:6]}"
        if use_test and not session_id.startswith("test_"):
            session_id = f"test_{session_id}"

        res = ridge_svc.register_session_tokens(
            session_id=session_id,
            rig_ids=payload.rig_ids,
            expires_in_sec=payload.expires_in_sec,
            group_id=payload.group_id,
            group_name=payload.group_name,
            track=payload.track,
            track_layout=payload.track_layout,
            show_qr_on_rigs=payload.show_qr_on_rigs,
        )
        return res

    @router.get("/ridge/session/{session_id}/checkins")
    async def poll_checkins(session_id: str) -> dict[str, Any]:
        """Poll Ridge API for session check-ins and update local rig driver bindings."""
        return ridge_svc.poll_session_checkins(session_id)

    @router.post("/ridge/session/{session_id}/sync")
    async def sync_session(session_id: str, payload: SyncSessionPayload | None = None) -> dict[str, Any]:
        """Synchronize unsynced laps for this session and optionally finalize it."""
        finalize = payload.finalize if payload else False
        return ridge_svc.sync_session_laps(session_id=session_id, finalize=finalize)

    @router.post("/ridge/sync-all")
    async def sync_all_databases() -> dict[str, Any]:
        """Two-way database sync: polls active check-ins, pushes unsynced local laps, and pulls remote drivers/records."""
        return ridge_svc.sync_all_databases()

    @router.post("/ridge/qr/visibility")
    async def set_qr_visibility(payload: ToggleRigQrPayload) -> dict[str, Any]:
        """Explicitly show or hide QR codes on a specific rig or across all rigs."""
        if not payload.rig_id or payload.rig_id.upper() == "ALL":
            s = state.settings
            s.ridge_show_qr_on_rigs = payload.show_qr
            state.settings = s
            for rig in state.get_rigs():
                rid = str(rig["rig_id"])
                state.update_rig_field(rid, "show_qr", payload.show_qr)
            return {
                "status": "success",
                "scope": "ALL",
                "show_qr": payload.show_qr,
            }
        else:
            state.upsert_rig(payload.rig_id, {})
            state.update_rig_field(payload.rig_id, "show_qr", payload.show_qr)
            return {
                "status": "success",
                "scope": payload.rig_id,
                "show_qr": payload.show_qr,
            }

    @router.get("/ridge/qr.svg")
    async def get_qr_svg(url: str) -> Response:
        """Render an offline-safe SVG QR code for any check-in URL."""
        svg_str = _generate_qr_svg(url)
        return Response(content=svg_str, media_type="image/svg+xml")

    @router.get("/ridge/qr.png")
    async def get_qr_png(url: str) -> Response:
        """Render a real scannable PNG QR code for Tkinter splash screens or kiosks (zero external deps)."""
        try:
            matrix = generate_qr_matrix(url, border=2)
            from PIL import Image

            size = len(matrix)
            scale = 8
            img = Image.new("RGB", (size * scale, size * scale), "white")
            pixels = img.load()
            if pixels is not None:
                for r_idx, row in enumerate(matrix):
                    for c_idx, val in enumerate(row):
                        if val:
                            for dy in range(scale):
                                for dx in range(scale):
                                    pixels[c_idx * scale + dx, r_idx * scale + dy] = (0, 0, 0)
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            return Response(content=buf.getvalue(), media_type="image/png")
        except Exception as e:
            logger.error("Failed to render QR PNG: %s", e)
            return Response(status_code=500, content="QR generator error")

    @router.get("/ridge/leaderboard")
    async def get_remote_leaderboard(
        track: str | None = None,
        layout: str | None = None,
        car: str | None = None,
        limit: int = 10,
    ) -> dict[str, Any]:
        """Proxy read-only leaderboard query to Ridge VPS (`index.php?r=api/leaderboard`)."""
        return ridge_svc.fetch_remote_leaderboard(track=track, layout=layout, car=car, limit=limit)

    @router.get("/ridge/driver/{driver_uuid}")
    async def get_remote_driver(driver_uuid: str) -> dict[str, Any]:
        """Proxy read-only driver statistics query to Ridge VPS (`index.php?r=api/driver&uuid=...`)."""
        return ridge_svc.fetch_remote_driver_stats(driver_uuid=driver_uuid)

    @router.post("/ridge/test")
    async def test_ridge_connection(payload: TestApiPayload | None = None) -> dict[str, Any]:
        """Test connectivity and API key scopes against Ridge VPS."""
        base_url = (
            (payload.api_url if payload and payload.api_url else None)
            or getattr(state.settings, "ridge_api_url", None)
            or "https://theridge.fun/racing-api/"
        ).rstrip("/")
        api_key = (
            (payload.api_key if payload and payload.api_key else None)
            or getattr(state.settings, "ridge_api_key", None)
        )

        # 1. Test public leaderboard endpoint
        pub_code, pub_resp = ridge_svc._request(
            "GET",
            "api/leaderboard",
            query_params={"limit": 3},
            require_auth=False,
            override_base_url=base_url,
        )

        # 2. If API key provided, test authenticated checkins:read endpoint with a dummy test_ session
        auth_code: int | None = None
        auth_resp: dict[str, Any] | None = None
        if api_key and api_key.strip():
            auth_code, auth_resp = ridge_svc._request(
                "GET",
                "api/session-checkins",
                query_params={"session_id": "test_connectivity_probe"},
                require_auth=True,
                override_api_key=api_key.strip(),
                override_base_url=base_url,
            )

        ok = pub_code == 200 and (auth_code is None or auth_code == 200)
        return {
            "status": "success" if ok else "error",
            "base_url": base_url,
            "public_endpoint": {"http_status": pub_code, "response": pub_resp},
            "authenticated_endpoint": (
                {"http_status": auth_code, "response": auth_resp}
                if auth_code is not None
                else {"status": "skipped (no API key provided)"}
            ),
        }

    return router
