"""Unit tests for Ridge Sim Racing API integration, QR display controls, and Discord Debug Webhook."""

from __future__ import annotations

import re
from typing import Any
from unittest.mock import patch

from fastapi.testclient import TestClient

from apps.orchestrator.main import app, ridge_svc, state
from apps.orchestrator.services.ridge_api import build_checkin_qr_url, generate_qr_token


def test_qr_token_format_and_checkin_url() -> None:
    """Verify QR tokens match chk_ + 32 hex chars (128-bit entropy) and build proper query-string URLs."""
    t1 = generate_qr_token()
    t2 = generate_qr_token()
    assert t1 != t2
    assert re.fullmatch(r"chk_[0-9a-f]{32}", t1)

    qr_url = build_checkin_qr_url("https://theridge.fun/racing-api/", t1)
    assert qr_url == f"https://theridge.fun/racing-api/index.php?r=checkin&id={t1}"


def test_register_poll_sync_and_qr_visibility_workflow() -> None:
    """Test the full check-in registration, QR visibility toggling, polling, and lap sync lifecycle."""
    client = TestClient(app)

    # Configure Ridge API key and test mode
    s = state.settings
    s.ridge_api_url = "https://theridge.fun/racing-api/"
    s.ridge_api_key = "test_secret_key_123"
    s.ridge_test_mode = True
    s.ridge_show_qr_on_rigs = False
    state.settings = s

    # Mock RidgeApiService._request to simulate the standalone PHP VPS responses
    captured_requests: list[tuple[str, str, dict[str, Any] | None, dict[str, Any] | None]] = []

    def fake_request(
        method: str,
        route: str,
        query_params: dict[str, Any] | None = None,
        json_body: dict[str, Any] | None = None,
        require_auth: bool = True,
        override_api_key: str | None = None,
        override_base_url: str | None = None,
        timeout: float = 10.0,
    ) -> tuple[int, dict[str, Any]]:
        captured_requests.append((method, route, query_params, json_body))
        if route == "api/register-tokens":
            assert json_body is not None
            return 200, {
                "success": True,
                "session_id": json_body["session_id"],
                "registered": len(json_body["tokens"]),
            }
        elif route == "api/session-checkins":
            sid = (query_params or {}).get("session_id", "")
            return 200, {
                "session_id": sid,
                "checkins": [
                    {
                        "rig_id": "RIG-01",
                        "status": "claimed",
                        "driver_uuid": "drv_a1b2c3d4e5f6",
                        "driver_name": "Alex",
                        "driver_email": "alex@example.com",
                        "claimed_at": 1760000100,
                        "expires_at": 1760000600,
                    },
                    {
                        "rig_id": "RIG-02",
                        "status": "pending",
                        "driver_uuid": None,
                        "driver_name": None,
                        "driver_email": None,
                        "claimed_at": None,
                        "expires_at": 1760000600,
                    },
                ],
            }
        elif route == "api/sync-session":
            assert json_body is not None
            laps = json_body.get("laps", [])
            is_final = json_body.get("final_batch", False)
            return 200, {
                "success": True,
                "session_id": json_body["session_id"],
                "session_status": "completed" if is_final else "receiving",
                "inserted_laps": len(laps),
                "duplicate_laps": 0,
            }
        elif route == "api/leaderboard":
            return 200, {
                "leaderboard": [
                    {
                        "driver_uuid": "drv_a1b2c3d4e5f6",
                        "display_name": "Alex",
                        "track": "spa",
                        "track_layout": "gp",
                        "car": "ks_ferrari_488_gt3",
                        "fastest_lap_ms": "138450",  # String from MySQL/PDO to test defensive int coercion
                        "achieved_at": 1760000123,
                    }
                ]
            }
        return 404, {"error": "not_found"}

    with patch.object(ridge_svc, "_request", side_effect=fake_request):
        # 1. Start check-in session with show_qr_on_rigs=True
        res = client.post(
            "/ridge/session/start",
            json={
                "session_id": "sess_unit_01",
                "rig_ids": ["RIG-01", "RIG-02"],
                "expires_in_sec": 600,
                "track": "spa",
                "track_layout": "gp",
                "show_qr_on_rigs": True,
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        # Because ridge_test_mode=True, session_id is prefixed with test_
        sid = data["session_id"]
        assert sid == "test_sess_unit_01"
        assert data["registered"] == 2

        # Verify RIG-01 has show_qr=True and a valid checkin_url in /rigs/{rig_id}/mode
        mode_res = client.get("/rigs/RIG-01/mode")
        assert mode_res.status_code == 200
        mode_data = mode_res.json()
        assert mode_data["show_qr"] is True
        assert mode_data["checkin_url"].startswith("https://theridge.fun/racing-api/index.php?r=checkin&id=chk_")

        # 2. Explicitly toggle QR visibility off for RIG-02
        vis_res = client.post("/ridge/qr/visibility", json={"rig_id": "RIG-02", "show_qr": False})
        assert vis_res.status_code == 200
        assert client.get("/rigs/RIG-02/mode").json()["show_qr"] is False

        # 3. Poll session check-ins -> RIG-01 is claimed by Alex (drv_a1b2c3d4e5f6)
        poll_res = client.get(f"/ridge/session/{sid}/checkins")
        assert poll_res.status_code == 200
        poll_data = poll_res.json()
        assert len(poll_data["newly_claimed"]) == 1
        assert poll_data["newly_claimed"][0]["driver_uuid"] == "drv_a1b2c3d4e5f6"

        # Verify RIG-01 now has driver_name="Alex", driver_uuid="drv_a1b2c3d4e5f6", and show_qr automatically False
        r1 = state.get_rig("RIG-01")
        assert r1 is not None
        assert r1["driver_name"] == "Alex"
        assert r1["driver_uuid"] == "drv_a1b2c3d4e5f6"
        assert r1["show_qr"] is False

        # 4. Record a lap on RIG-01 (claimed) and RIG-02 (unclaimed)
        from shared.models import LeaderboardEntry

        state.add_leaderboard_entry(
            LeaderboardEntry(
                rig_id="RIG-01",
                driver_name="Alex",
                driver_uuid="drv_a1b2c3d4e5f6",
                car="ks_ferrari_488_gt3",
                track="spa",
                track_layout="gp",
                lap=1,
                lap_time_ms=138450,
                session_id=sid,
                is_valid=True,
            )
        )
        state.add_leaderboard_entry(
            LeaderboardEntry(
                rig_id="RIG-02",
                driver_name="Guest",
                car="ks_ferrari_488_gt3",
                track="spa",
                track_layout="gp",
                lap=1,
                lap_time_ms=140100,
                session_id=sid,
                is_valid=True,
            )
        )

        # 5. Sync session laps and finalize -> Only RIG-01's lap is sent; RIG-02's lap is skipped (unclaimed)
        sync_res = client.post(f"/ridge/session/{sid}/sync", json={"finalize": True})
        assert sync_res.status_code == 200
        sync_data = sync_res.json()
        assert sync_data["status"] == "success"
        assert sync_data["inserted_laps"] == 1
        assert sync_data["skipped_unclaimed_laps"] == 1
        assert sync_data["finalized"] is True

        # 6. Test public leaderboard proxy & defensive int coercion
        lb_res = client.get("/ridge/leaderboard?track=spa&layout=gp")
        assert lb_res.status_code == 200
        lb_row = lb_res.json()["data"]["leaderboard"][0]
        assert lb_row["fastest_lap_ms"] == 138450
        assert isinstance(lb_row["fastest_lap_ms"], int)


def test_discord_debug_webhook_filters() -> None:
    """Verify Discord debug webhook respects event checkboxes and payload field checkboxes."""
    from apps.orchestrator.services.discord import send_debug_notification
    from shared.models import GlobalSettings

    dispatched: list[tuple[str, str, str, list[dict[str, Any]]]] = []

    def fake_send(url: str, title: str, desc: str, fields: list[dict[str, Any]] | None = None) -> None:
        dispatched.append((url, title, desc, fields or []))

    cfg = GlobalSettings(
        discord_debug_webhook_url="https://discord.com/api/webhooks/debug/123",
        discord_debug_lap_complete=True,
        discord_debug_invalid_laps=False,
        discord_debug_include_telemetry=True,
        discord_debug_include_driver=False,  # Exclude driver fields
        discord_debug_include_session=True,
    )

    with patch("apps.orchestrator.services.discord.send_discord_webhook", side_effect=fake_send):
        # 1. Invalid lap should be muted because discord_debug_invalid_laps=False
        send_debug_notification(
            cfg,
            event_type="invalid_lap",
            title="Invalid Lap",
            description="Should be ignored",
            telemetry_info={"Lap Time": "1:50.000"},
        )
        assert len(dispatched) == 0

        # 2. Valid lap should fire, and include Telemetry + Session fields but NOT Driver fields
        send_debug_notification(
            cfg,
            event_type="lap_complete",
            title="Lap Complete",
            description="Valid lap",
            telemetry_info={"Lap Time": "1:45.123"},
            driver_info={"Driver": "Alex"},
            session_info={"Session ID": "sess_123"},
        )
        assert len(dispatched) == 1
        _, _, _, fields = dispatched[0]
        field_names = [f["name"] for f in fields]
        assert "LAP TIME" in field_names
        assert "SESSION ID" in field_names
        assert "DRIVER" not in field_names
