"""Rig discovery and status endpoints."""

from __future__ import annotations

import logging
import time

from fastapi import APIRouter, Request
from pydantic import BaseModel

from apps.orchestrator.state import AppState
from shared.models import LeaderboardEntry, RigStatusUpdate

logger = logging.getLogger("ridge.rigs")

router = APIRouter(tags=["rigs"])


def _parse_lap_time_ms(raw: object) -> int | None:
    """Parse a lap time value into milliseconds.

    Handles:
      - int/float already in ms (if >= 1000 or integer)
      - float seconds (if float < 1000)
      - String formats:
          - "HH:MM:SS.ffffff" or "HH:MM:SS.mmm"
          - "HH:MM:SS"
          - "MM:SS.mmm" or "MM:SS:mmm"
          - "MM:SS"
          - "SS.mmm" or "SS"
    """
    if raw is None:
        return None

    # Numeric handling
    if isinstance(raw, (int, float)):
        v = float(raw)
        if v <= 0:
            return None
        # If integer or >= 1000, it's ms (e.g. 105320 ms or 8500 ms drag)
        if isinstance(raw, int) or v >= 1000:
            return int(v)
        # If float < 1000, it's seconds (e.g. 8.25s -> 8250 ms, 105.32s -> 105320 ms)
        return int(v * 1000)

    # String parsing
    s = str(raw).strip()
    if not s or s in ("--:--", "0", "0:00.000", "00:00:00", "00:00:00.0000000"):
        return None

    try:
        # Check if plain number in string form
        try:
            val = float(s)
            if val <= 0:
                return None
            if val >= 1000:
                return int(val)
            return int(val * 1000)
        except ValueError:
            pass

        parts = s.split(":")
        if len(parts) == 3:
            # Format could be HH:MM:SS(.mmm) or MM:SS:mmm
            p0 = float(parts[0])
            p1 = float(parts[1])

            # If parts[2] has a dot (e.g., "00:01:45.320"), it is HH:MM:SS.mmm
            if "." in parts[2]:
                p2 = float(parts[2])
                ms = (p0 * 3600 + p1 * 60 + p2) * 1000
                return int(ms) if ms > 0 else None

            # If parts[2] is an integer:
            # If parts[2] >= 60 (e.g. "1:45:320"), it is MM:SS:mmm where parts[2] is milliseconds
            p2_int = int(parts[2])
            if p2_int >= 60:
                ms = (p0 * 60 + p1) * 1000 + p2_int
                return int(ms) if ms > 0 else None

            # Otherwise standard HH:MM:SS (e.g. "00:01:45" or "00:09:12")
            ms = (p0 * 3600 + p1 * 60 + p2_int) * 1000
            return int(ms) if ms > 0 else None

        elif len(parts) == 2:
            # MM:SS.mmm or MM:SS
            m, sec = float(parts[0]), float(parts[1])
            ms = (m * 60 + sec) * 1000
            return int(ms) if ms > 0 else None
        else:
            # SS.mmm or SS
            ms = float(s) * 1000
            return int(ms) if ms > 0 else None
    except (ValueError, IndexError):
        return None


class ModeUpdate(BaseModel):
    """Payload for changing a rig's mode."""

    mode: str  # "lockout" or "freeuse"


class DriverNameUpdate(BaseModel):
    """Payload for setting a rig's driver name."""

    driver_name: str


def create_router(state: AppState) -> APIRouter:
    """Create the rigs router bound to the given application state."""

    @router.get("/rigs")
    async def get_rigs() -> list[dict[str, object]]:
        """Returns all currently discovered or registered rigs."""
        return state.get_rigs()

    @router.post("/rigs/{rig_id}/status")
    async def update_rig_status(rig_id: str, update: RigStatusUpdate, request: Request) -> dict[str, str]:
        """Allows kiosks and sleds to register or update their status/selection."""

        # Robust IP discovery
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        elif update.ip and update.ip != "127.0.0.1":
            client_ip = update.ip
        else:
            client_ip = request.client.host if request.client else "unknown"

        rig = state.upsert_rig(rig_id, {"ip": client_ip})

        # Status update logic with precedence rules
        if update.status:
            current_status = str(rig.get("status", "idle"))
            new_status = update.status

            # KILL-PENDING GUARD: After KILL_RACE is dispatched, the sled's
            # process watchdog may still see AC running and try to re-promote
            # the rig to 'racing' via heartbeat before the TCP kill arrives.
            # Block any heartbeat promoting to 'racing' for 10s after kill.
            kill_req_at = rig.get("kill_requested_at")
            if new_status == "racing" and isinstance(kill_req_at, (int, float)):
                elapsed = time.time() - kill_req_at
                if elapsed < 10:
                    logger.debug(
                        "Rig %s: blocking heartbeat promotion to 'racing' "
                        "(kill requested %.1fs ago)",
                        rig_id, elapsed,
                    )
                else:
                    # Guard expired — allow and clear
                    state.update_rig_field(rig_id, "kill_requested_at", None)
                    state.update_rig_field(rig_id, "status", new_status)
                    logger.info("Rig %s -> %s (kill guard expired)", rig_id, new_status)
            elif current_status in ("racing", "ready") and new_status in ("idle", "setup"):
                # Normal downgrade — allow unless very rapid
                last_seen = rig.get("last_seen")
                if isinstance(last_seen, (int, float)) and time.time() - last_seen < 3:
                    logger.debug("Rig %s: blocking heartbeat downgrade %s -> %s (too soon)",
                                  rig_id, current_status, new_status)
                else:
                    state.update_rig_field(rig_id, "status", new_status)
                    # Clear kill guard on natural idle transition
                    state.update_rig_field(rig_id, "kill_requested_at", None)
                    logger.info("Rig %s: %s -> %s (allowed)",
                                 rig_id, current_status, new_status)
            else:
                state.update_rig_field(rig_id, "status", new_status)
                if current_status != new_status:
                    logger.info("Rig %s -> %s", rig_id, new_status)

        # Only accept car selection from explicit selection calls, NOT heartbeats.
        # Heartbeats include cpu_temp/telemetry — car picks never do.
        is_heartbeat = update.cpu_temp is not None or update.telemetry is not None
        if update.selected_car is not None and not is_heartbeat:
            if str(update.selected_car) not in ("", "None"):
                state.update_rig_field(rig_id, "selected_car", update.selected_car)
                logger.info("Rig %s car -> %s (explicit selection)", rig_id, update.selected_car)
            else:
                # Empty string = "Random" — clear the selection
                state.update_rig_field(rig_id, "selected_car", None)
                logger.info("Rig %s car -> Random (cleared)", rig_id)
        if update.cpu_temp:
            state.update_rig_field(rig_id, "cpu_temp", update.cpu_temp)
        if update.telemetry:
            state.update_rig_field(rig_id, "telemetry", update.telemetry)

            # Leaderboard: capture lap completions
            completed = update.telemetry.get("completed_laps", 0)
            last_count = rig.get("last_lap_count", 0)
            if isinstance(completed, (int, float)) and isinstance(last_count, (int, float)):
                if completed < last_count:
                    # Session reset or restart detected — resync last_lap_count so new laps are captured
                    state.update_rig_field(rig_id, "last_lap_count", completed)
                elif completed > last_count:
                    state.update_rig_field(rig_id, "last_lap_count", completed)

                    # Lap validation check (reject out-laps and cut laps)
                    is_valid = update.telemetry.get("is_lap_valid", True)
                    if is_valid is False or is_valid == 0:
                        logger.info("Rig %s lap %d completed but marked INVALID (out-lap/cut) — skipping leaderboard", rig_id, completed)
                    else:
                        # Look up track/group context from the rig's group
                        rig_group = next(
                            (g for g in state.get_groups() if rig_id in g.rig_ids), None
                        )

                        # Parse lap time from telemetry
                        lap_time_ms: int | None = None
                        raw_time = update.telemetry.get("last_lap_time")
                        if raw_time is not None:
                            lap_time_ms = _parse_lap_time_ms(raw_time)

                        if lap_time_ms and lap_time_ms > 0:
                            entry = LeaderboardEntry(
                                rig_id=rig_id,
                                driver_name=str(rig.get("driver_name", "")) or None,
                                car=str(rig.get("selected_car", "")),
                                track=rig_group.track if rig_group else None,
                                group_name=rig_group.name if rig_group else None,
                                lap=int(completed),
                                lap_time_ms=lap_time_ms,
                                session_id=rig_group.id if rig_group else None,
                            )
                            state.add_leaderboard_entry(entry)
                            # Also upsert into session_best (peak performance per driver)
                            state.upsert_session_best(entry)
                            logger.info(
                                "Recorded lap for %s (driver: %s): lap %d, time: %d ms",
                                rig_id, entry.driver_name, completed, lap_time_ms
                            )

        # Service connectivity indicators
        if update.simhub_connected is not None:
            state.update_rig_field(rig_id, "simhub_connected", update.simhub_connected)
        if update.mumble_connected is not None:
            state.update_rig_field(rig_id, "mumble_connected", update.mumble_connected)
        if update.steam_connected is not None:
            state.update_rig_field(rig_id, "steam_connected", update.steam_connected)
        if update.moza_connected is not None:
            state.update_rig_field(rig_id, "moza_connected", update.moza_connected)
        if update.simcube_connected is not None:
            state.update_rig_field(rig_id, "simcube_connected", update.simcube_connected)

        return {"status": "success"}

    @router.get("/rigs/{rig_id}/mode")
    async def get_rig_mode(rig_id: str) -> dict[str, object]:
        """Get a rig's current mode (lockout/freeuse) and status."""
        rig = state.get_rig(rig_id)
        if not rig:
            return {"mode": "lockout", "status": "unknown", "car_pool": []}

        # Find which group this rig belongs to, and use that group's car_pool
        car_pool: list[str] = list(state.car_pool)  # fallback to global
        session_duration_min: int = 30  # default
        for g in state.get_groups():
            if rig_id in g.rig_ids:
                car_pool = list(g.car_pool)
                session_duration_min = g.session_duration_min
                break

        return {
            "mode": rig.get("mode", "lockout"),
            "status": rig.get("status", "idle"),
            "selected_car": rig.get("selected_car"),
            "car_pool": car_pool,
            "session_duration_min": session_duration_min,
        }

    @router.post("/rigs/{rig_id}/mode")
    async def set_rig_mode(rig_id: str, update: ModeUpdate) -> dict[str, str]:
        """Toggle a rig between lockout and freeuse mode."""
        rig = state.get_rig(rig_id)
        if not rig:
            return {"status": "error", "message": "Rig not found"}
        state.update_rig_field(rig_id, "mode", update.mode)
        logger.info("Rig %s mode -> %s", rig_id, update.mode)
        return {"status": "success", "mode": update.mode}

    @router.post("/rigs/{rig_id}/driver_name")
    async def set_driver_name(rig_id: str, update: DriverNameUpdate) -> dict[str, str]:
        """Set the display name for the driver on this rig."""
        rig = state.get_rig(rig_id)
        if not rig:
            state.upsert_rig(rig_id, {"driver_name": update.driver_name})
        else:
            state.update_rig_field(rig_id, "driver_name", update.driver_name)
        logger.info("Rig %s driver_name -> %s", rig_id, update.driver_name)
        return {"status": "success", "driver_name": update.driver_name}

    @router.post("/rigs/{rig_id}/spectate")
    async def spectate_rig(rig_id: str, action: str) -> dict[str, str]:
        """Send a spectate command to a rig (camera cycling, etc)."""
        rig = state.get_rig(rig_id)
        if not rig or not rig.get("ip"):
            return {"status": "error", "message": "Rig not found or no IP"}
        
        import socket
        import json
        from shared.constants import COMMAND_PORT
        
        try:
            # Connect to the sled agent's command port
            with socket.create_connection((str(rig.get("ip")), COMMAND_PORT), timeout=2) as s:
                payload = {"action": "SPECTATE_ACTION", "spectate_action": action}
                s.sendall(json.dumps(payload).encode("utf-8") + b"\n")
            return {"status": "success", "message": f"Sent {action} to {rig_id}"}
        except Exception as e:
            logger.error("Failed to send spectate command to %s: %s", rig_id, e)
            return {"status": "error", "message": str(e)}

    return router

