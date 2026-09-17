"""Leaderboard and lobby endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Query

from apps.orchestrator.state import AppState
from shared.models import LeaderboardEntry

router = APIRouter(tags=["leaderboard"])


def create_router(state: AppState) -> APIRouter:
    """Create the leaderboard/lobby router bound to the given application state."""

    @router.get("/leaderboard")
    async def get_leaderboard(
        track: str | None = Query(None),
        session_id: str | None = Query(None),
        group: str | None = Query(None),
        view: str | None = Query(None),  # "recent", "session_best", "all_best", "today"
        sort_desc: bool = Query(False),
    ) -> list[LeaderboardEntry]:
        """Full leaderboard data for the admin dashboard.

        Supports filtering by track, session_id, group, or view modes:
          - "today"        → best laps from today
          - "recent"       → most recent session's raw laps
          - "session_best" → peak performance per driver (current session)
          - "all_best"     → peak performance per driver (all sessions)
        """
        if view == "today":
            return state.leaderboard_db.get_today_best(track=track, sort_desc=sort_desc)
        if view == "session_best":
            return state.leaderboard_db.get_session_best(session_id=session_id)
        if view == "all_best":
            return state.leaderboard_db.get_session_best_all(track=track, sort_desc=sort_desc)
        if view == "recent":
            return state.leaderboard_db.get_recent_session()
        if session_id:
            return state.leaderboard_db.get_by_session(session_id)
        if track:
            return state.leaderboard_db.get_by_track(track)
        return state.leaderboard

    @router.delete("/leaderboard")
    async def clear_leaderboard() -> dict[str, str]:
        """Clear all leaderboard data."""
        state.leaderboard_db.clear_leaderboard()
        # Also clear in-memory state if tracking recent session laps
        state.leaderboard = []
        return {"status": "success"}

    @router.delete("/leaderboard/{record_id}")
    async def delete_leaderboard_record(record_id: int) -> dict[str, str]:
        """Delete a single leaderboard record by ID."""
        if state.leaderboard_db.delete_record(record_id):
            return {"status": "success"}
        return {"status": "error", "message": "Record not found"}

    @router.post("/leaderboard/delete_entry")
    async def delete_entry_by_match(payload: dict[str, object]) -> dict[str, str]:
        """Delete an entry by ID or by rig/track/session/lap_time criteria."""
        rig_id = str(payload.get("rig_id") or "")
        track = str(payload.get("track") or "") or None
        session_id = str(payload.get("session_id") or "") or None
        lap_time_ms = payload.get("lap_time_ms")
        lap_ms = int(lap_time_ms) if isinstance(lap_time_ms, (int, float)) else None

        if payload.get("id"):
            try:
                rec_id = int(str(payload["id"]))
                if state.leaderboard_db.delete_record(rec_id):
                    return {"status": "success"}
            except ValueError:
                pass

        if state.leaderboard_db.delete_by_match(rig_id=rig_id, track=track, session_id=session_id, lap_time_ms=lap_ms):
            return {"status": "success"}
        return {"status": "error", "message": "Record not found"}

    @router.post("/leaderboard/test_lap")
    async def add_test_lap() -> dict[str, str]:
        """Inject a fake lap for UI testing."""
        import random
        import time
        import uuid
        from apps.orchestrator.services.content_scanner import scan_cars, scan_tracks
        
        content_folder = state.settings.content_folder
        cars = [c.id for c in scan_cars(content_folder)]
        tracks = [t.id for t in scan_tracks(content_folder)]
        
        if not cars:
            cars = ["ks_ferrari_488_gt3"]
        if not tracks:
            tracks = ["spa"]
            
        car = random.choice(cars)
        track = random.choice(tracks)
        
        entry = LeaderboardEntry(
            rig_id=f"RIG-{random.randint(1, 8):02d}",
            driver_name=random.choice(["Mason", "Alex", "Jordan", "Taylor", "Riley", "Casey", "Morgan", "Drew"]),
            car=car,
            track=track,
            group_name="Test Group",
            lap=random.randint(1, 10),
            lap_time_ms=random.randint(120_000, 160_000),
            session_id=str(uuid.uuid4())[:8],
            timestamp=time.time(),
        )
        state.add_leaderboard_entry(entry)
        state.upsert_session_best(entry)
        return {"status": "success"}

    @router.post("/leaderboard/clear_session")
    async def clear_session(payload: dict[str, object] | None = None) -> dict[str, str]:
        """Clear active/recent session(s) from display."""
        sid = str(payload.get("session_id")) if payload and payload.get("session_id") else None
        state.clear_active_session(session_id=sid)
        return {"status": "success"}

    @router.get("/lobby")
    async def get_lobby() -> dict[str, object]:
        """Public feed for TV displays — includes active sessions, today's best, and all-time records."""
        top_10_all_time = state.leaderboard_db.get_session_best_all(limit=10)
        top_10_today = state.leaderboard_db.get_today_best(limit=10)
        hall_of_fame = state.leaderboard_db.get_hall_of_fame(limit=10)

        active_rigs = [
            {
                "rig_id": r["rig_id"],
                "driver_name": r.get("driver_name"),
                "status": r.get("status", "idle"),
                "selected_car": r.get("selected_car"),
                "telemetry": r.get("telemetry"),
            }
            for r in state.get_rigs()
            if r.get("status") == "racing"
        ]

        # Multi-session standings builder
        all_state_sessions = state.get_all_sessions()
        state_sids = [str(s["session_id"]) for s in all_state_sessions if s.get("session_id")]
        db_sids = state.leaderboard_db.get_recent_session_ids(limit=5)
        
        # Combine unique session IDs preserving order (state active sessions first, then recent DB sessions)
        seen_sids: set[str] = set()
        ordered_sids: list[str] = []
        for sid in state_sids + db_sids:
            if sid and sid not in seen_sids:
                seen_sids.add(sid)
                ordered_sids.append(sid)

        sessions_data: list[dict[str, object]] = []
        for sid in ordered_sids:
            s_info = next((s for s in all_state_sessions if s.get("session_id") == sid), None)
            standings = state.leaderboard_db.get_session_standings(sid)
            
            if standings:
                standings["status"] = s_info.get("status", "finished") if s_info else "finished"
                if s_info:
                    if not standings.get("group_name") and s_info.get("group_name"):
                        standings["group_name"] = s_info.get("group_name")
                    if not standings.get("track") and s_info.get("track"):
                        standings["track"] = s_info.get("track")
                sessions_data.append(standings)
            elif s_info:
                # Active session with 0 completed laps yet — create placeholder cards
                drivers_placeholder = []
                for idx, rid in enumerate(s_info.get("rig_ids", [])):
                    rig_obj = state.get_rig(rid)
                    drivers_placeholder.append({
                        "position": idx + 1,
                        "driver_name": rig_obj.get("driver_name") if rig_obj else None,
                        "rig_id": rid,
                        "car": rig_obj.get("selected_car") if rig_obj else None,
                        "track": s_info.get("track"),
                        "group_name": s_info.get("group_name"),
                        "best_lap_time_ms": None,
                        "gap_ms": 0,
                        "total_laps": 0,
                        "last_lap_time_ms": None,
                        "timestamp": None,
                    })
                sessions_data.append({
                    "session_id": sid,
                    "track": s_info.get("track"),
                    "group_name": s_info.get("group_name"),
                    "started_at": s_info.get("started_at"),
                    "status": s_info.get("status", "racing"),
                    "drivers": drivers_placeholder,
                })

        def format_entries(entries: list[LeaderboardEntry]) -> list[dict[str, object]]:
            return [
                {
                    "rig_id": e.rig_id,
                    "driver_name": e.driver_name,
                    "car": e.car,
                    "track": e.track,
                    "lap": e.lap,
                    "lap_time_ms": e.lap_time_ms,
                    "timestamp": e.timestamp,
                }
                for e in entries
            ]

        return {
            "top_10_all_time": format_entries(top_10_all_time),
            "top_10_today": format_entries(top_10_today),
            "hall_of_fame": hall_of_fame,
            "active_rigs": active_rigs,
            "total_rigs": len(state.get_rigs()),
            "server_status": state.server_status,
            "sessions": sessions_data,
            "current_session": sessions_data[0] if sessions_data else None,
        }

    return router

