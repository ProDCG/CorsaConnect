"""Telemetry acquisition — SimHub API → UDP Bridge → Shared Memory fallback chain."""

from __future__ import annotations

import json
import logging
import os
import socket
import time
from typing import Any

logger = logging.getLogger("ridge.telemetry")


class ACTelemetry:
    """Multi-source telemetry reader for Assetto Corsa.

    Tries sources in order: SimHub API → UDP bridge → Windows shared memory.
    """

    def __init__(self, simhub_url: str = "http://127.0.0.1:8888/api/getgamedata", udp_port: int = 9996) -> None:
        self.simhub_url = simhub_url
        self.simhub_connected = False
        self.steam_connected = False
        self.moza_connected = False
        self.simcube_connected = False
        self._last_sh_check: float = 0.0

        # Physics / Graphics shared memory (Windows only)
        self.physics_mmap: Any = None
        self.graphics_mmap: Any = None
        self.static_mmap: Any = None

        # Lap validity tracking state
        self.current_lap_valid: bool = True
        self.last_lap_valid: bool = True
        self._last_completed_laps: int = 0

        # UDP bridge socket
        self.udp_sock: socket.socket | None = None
        try:
            self.udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.udp_sock.bind(("127.0.0.1", udp_port))
            self.udp_sock.setblocking(False)
            logger.info("UDP bridge listener active on port %d", udp_port)
        except Exception as e:
            logger.warning("Could not bind UDP bridge: %s", e)
            self.udp_sock = None

    # ------------------------------------------------------------------
    # SimHub API (preferred)
    # ------------------------------------------------------------------

    def _get_simhub_data(self) -> dict[str, object] | None:
        """Pull telemetry from SimHub's getgamedata endpoint."""
        try:
            import requests

            r = requests.get(self.simhub_url, timeout=0.2)
            if r.status_code != 200:
                return None

            raw = r.json()
            new_data = raw.get("NewData", {})

            if not self.simhub_connected:
                logger.debug("SimHub API connected (getgamedata)")
                self.simhub_connected = True

            # Calculate normalized track position (0.0 to 1.0)
            raw_pos = new_data.get("TrackPositionPercent")
            if raw_pos is None:
                raw_pos = new_data.get("TrackPosition")
            if raw_pos is None and (new_data.get("TrackLength") or 0) > 0:
                raw_pos = (new_data.get("TrackPositionMeters") or 0) / float(new_data.get("TrackLength"))

            if raw_pos is not None:
                pos_val = float(raw_pos)
                if pos_val > 1.0:
                    pos_val = pos_val / 100.0
                normalized_pos = round(max(0.0, min(1.0, pos_val)), 4)
            else:
                normalized_pos = 0.0

            # Core driving data
            result: dict[str, object] = {
                "packet_id": int(time.time() * 100),
                "gas": round(new_data.get("Throttle", 0) / 100.0, 2),
                "brake": round(new_data.get("Brake", 0) / 100.0, 2),
                "gear": new_data.get("Gear", "N"),
                "rpms": int(new_data.get("Rpms", 0)),
                "max_rpm": int(new_data.get("MaxRpm", 8000)),
                "velocity": [round(new_data.get("SpeedKmh", 0), 1), 0, 0],
                "gforce": [
                    round(new_data.get("AccelerationSway", 0), 2),
                    round(new_data.get("AccelerationHeave", 0), 2),
                    round(new_data.get("AccelerationSurge", 0), 2),
                ],
                "status": 2 if raw.get("GameRunning") else 0,
                "completed_laps": new_data.get("CompletedLaps", 0) if raw.get("GameRunning") else 0,
                "current_lap": new_data.get("CurrentLap", 1),
                "total_laps": new_data.get("TotalLaps", 0),
                "remaining_laps": new_data.get("RemainingLaps", 0),
                "position": new_data.get("Position", 0),
                "normalized_pos": normalized_pos,
                "track_position_meters": round(new_data.get("TrackPositionMeters", 0), 1),
                "track_length": round(new_data.get("TrackLength", 0), 1),
                # Fuel
                "fuel": round(new_data.get("Fuel", 0), 2),
                "fuel_percent": round(new_data.get("FuelPercent", 0), 1),
                "max_fuel": round(new_data.get("MaxFuel", 0), 2),
                # Tyres — temperatures
                "tyre_temp_fl": round(new_data.get("TyreTemperatureFrontLeft", 0), 1),
                "tyre_temp_fr": round(new_data.get("TyreTemperatureFrontRight", 0), 1),
                "tyre_temp_rl": round(new_data.get("TyreTemperatureRearLeft", 0), 1),
                "tyre_temp_rr": round(new_data.get("TyreTemperatureRearRight", 0), 1),
                # Tyres — wear
                "tyre_wear_fl": round(new_data.get("TyreWearFrontLeft", 0), 1),
                "tyre_wear_fr": round(new_data.get("TyreWearFrontRight", 0), 1),
                "tyre_wear_rl": round(new_data.get("TyreWearRearLeft", 0), 1),
                "tyre_wear_rr": round(new_data.get("TyreWearRearRight", 0), 1),
                # Tyres — pressure
                "tyre_psi_fl": round(new_data.get("TyrePressureFrontLeft", 0), 1),
                "tyre_psi_fr": round(new_data.get("TyrePressureFrontRight", 0), 1),
                "tyre_psi_rl": round(new_data.get("TyrePressureRearLeft", 0), 1),
                "tyre_psi_rr": round(new_data.get("TyrePressureRearRight", 0), 1),
                # Brakes — temperatures
                "brake_temp_fl": round(new_data.get("BrakeTemperatureFrontLeft", 0), 1),
                "brake_temp_fr": round(new_data.get("BrakeTemperatureFrontRight", 0), 1),
                "brake_temp_rl": round(new_data.get("BrakeTemperatureRearLeft", 0), 1),
                "brake_temp_rr": round(new_data.get("BrakeTemperatureRearRight", 0), 1),
                "brake_bias": round(new_data.get("BrakeBias", 0), 1),
                # Damage
                "damage_front": round(new_data.get("CarDamage1", 0), 2),
                "damage_rear": round(new_data.get("CarDamage2", 0), 2),
                "damage_left": round(new_data.get("CarDamage3", 0), 2),
                "damage_right": round(new_data.get("CarDamage4", 0), 2),
                "damage_avg": round(new_data.get("CarDamagesAvg", 0), 2),
                # Electronics
                "abs_active": int(new_data.get("ABSActive", 0)),
                "abs_level": int(new_data.get("ABSLevel", 0)),
                "tc_active": int(new_data.get("TCActive", 0)),
                "tc_level": int(new_data.get("TCLevel", 0)),
                "drs_available": int(new_data.get("DRSAvailable", 0)),
                "drs_enabled": int(new_data.get("DRSEnabled", 0)),
                "clutch": round(new_data.get("Clutch", 0) / 100.0, 2),
                # Temperatures
                "air_temp": round(new_data.get("AirTemperature", 0), 1),
                "road_temp": round(new_data.get("RoadTemperature", 0), 1),
                # Lap times
                "current_lap_time": (
                    int(new_data["CurrentLapTime"]["TotalMilliseconds"])
                    if isinstance(new_data.get("CurrentLapTime"), dict) and "TotalMilliseconds" in new_data["CurrentLapTime"]
                    else (new_data.get("CurrentLapTime") if isinstance(new_data.get("CurrentLapTime"), (int, float)) else str(new_data.get("CurrentLapTime", "00:00:00")))
                ),
                "last_lap_time": (
                    int(new_data["LastLapTime"]["TotalMilliseconds"])
                    if isinstance(new_data.get("LastLapTime"), dict) and "TotalMilliseconds" in new_data["LastLapTime"]
                    else (new_data.get("LastLapTime") if isinstance(new_data.get("LastLapTime"), (int, float)) else str(new_data.get("LastLapTime", "00:00:00")))
                ),
                "best_lap_time": (
                    int(new_data["BestLapTime"]["TotalMilliseconds"])
                    if isinstance(new_data.get("BestLapTime"), dict) and "TotalMilliseconds" in new_data["BestLapTime"]
                    else (new_data.get("BestLapTime") if isinstance(new_data.get("BestLapTime"), (int, float)) else str(new_data.get("BestLapTime", "00:00:00")))
                ),
                # Pit
                "is_in_pit": int(new_data.get("IsInPit", 0)),
                "is_in_pit_lane": int(new_data.get("IsInPitLane", 0)),
                # Car/Track info
                "car_model": str(new_data.get("CarModel", "")),
                "car_id": str(new_data.get("CarId", "")),
                "track_name": str(new_data.get("TrackName", "")),
                "track_id": str(new_data.get("TrackId", "")),
                "session_type": str(new_data.get("SessionTypeName", "")),
                # Max speed this session
                "max_speed": round(new_data.get("MaxSpeedKmh", 0), 1),
                "engine_torque": round(new_data.get("EngineTorque", 0), 1),
                # Validity (instantaneous frame check)
                "is_lap_valid": (
                    (
                        bool(raw.get("GameRawData", {}).get("Graphics", {}).get("isValidLap") != 0)
                        if isinstance(raw.get("GameRawData"), dict) and isinstance(raw.get("GameRawData", {}).get("Graphics"), dict) and "isValidLap" in raw.get("GameRawData", {}).get("Graphics", {})
                        else (bool(new_data.get("IsLapValid")) if new_data.get("IsLapValid") is not None else True)
                    )
                    and (int(raw.get("GameRawData", {}).get("Physics", {}).get("numberOfTyresOut", 0) or 0) < 3 if isinstance(raw.get("GameRawData"), dict) and isinstance(raw.get("GameRawData", {}).get("Physics"), dict) else True)
                    and (float(raw.get("GameRawData", {}).get("Graphics", {}).get("penaltyTime", 0) or 0) <= 0 if isinstance(raw.get("GameRawData"), dict) and isinstance(raw.get("GameRawData", {}).get("Graphics"), dict) else True)
                    and (int(raw.get("GameRawData", {}).get("Graphics", {}).get("penalty", 0) or 0) <= 0 if isinstance(raw.get("GameRawData"), dict) and isinstance(raw.get("GameRawData", {}).get("Graphics"), dict) else True)
                ),
            }
            return result
        except Exception as e:
            if self.simhub_connected:
                logger.debug("SimHub connection lost: %s", e)
                self.simhub_connected = False
            return None

    # ------------------------------------------------------------------
    # UDP Bridge
    # ------------------------------------------------------------------

    def _get_udp_data(self) -> dict[str, object] | None:
        """Read latest packet from the UDP bridge sidecar."""
        if not self.udp_sock:
            return None
        try:
            data: bytes | None = None
            # Drain buffer to get latest packet
            while True:
                try:
                    data, _ = self.udp_sock.recvfrom(2048)
                except BlockingIOError:
                    break
            if data:
                return json.loads(data.decode("utf-8"))  # type: ignore[no-any-return]
        except Exception:
            pass
        return None

    # ------------------------------------------------------------------
    # Shared Memory (Windows only, fallback)
    # ------------------------------------------------------------------

    def _open_mmap(self) -> bool:
        """Try to open AC shared memory mappings (Windows only)."""
        try:
            import ctypes
            import mmap

            kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)  # type: ignore[attr-defined]
            FILE_MAP_READ = 0x0004

            def try_open(tag: str) -> bool:
                h = kernel32.OpenFileMappingW(FILE_MAP_READ, False, tag)
                if h:
                    kernel32.CloseHandle(h)
                    return True
                return False

            for pref in ["", "Local\\", "Global\\"]:
                if try_open(f"{pref}acqs_physics"):
                    self._close_mmaps()
                    try:
                        self.physics_mmap = mmap.mmap(-1, 1024, f"{pref}acqs_physics", access=mmap.ACCESS_READ)  # type: ignore[arg-type]
                        self.graphics_mmap = mmap.mmap(-1, 1024, f"{pref}acqs_graphics", access=mmap.ACCESS_READ)  # type: ignore[arg-type]
                        self.static_mmap = mmap.mmap(-1, 1024, f"{pref}acqs_static", access=mmap.ACCESS_READ)  # type: ignore[arg-type]
                        logger.info("Shared memory linked (prefix=%s)", pref or "none")
                        return True
                    except Exception:
                        pass
            return False
        except Exception:
            return False

    def _get_mmap_data(self) -> dict[str, object] | None:
        """Read telemetry from AC shared memory."""
        try:
            if not self.physics_mmap or not self.graphics_mmap:
                if not self._open_mmap():
                    return None

            import ctypes
            from apps.sled.sidecar import SPageFileGraphic, SPageFilePhysics

            self.physics_mmap.seek(0)  # type: ignore[union-attr]
            p = SPageFilePhysics.from_buffer_copy(
                self.physics_mmap.read(ctypes.sizeof(SPageFilePhysics))  # type: ignore[union-attr]
            )

            self.graphics_mmap.seek(0)  # type: ignore[union-attr]
            g = SPageFileGraphic.from_buffer_copy(
                self.graphics_mmap.read(ctypes.sizeof(SPageFileGraphic))  # type: ignore[union-attr]
            )

            is_valid_instant = (
                bool(getattr(g, "isValidLap", 1) != 0)
                and (getattr(p, "numberOfTyresOut", 0) < 3)
                and (getattr(g, "penaltyTime", 0.0) <= 0)
                and (getattr(g, "penalty", 0) <= 0)
            )

            return {
                "packet_id": p.packetId,
                "gas": round(max(0.0, p.gas), 2),
                "brake": round(max(0.0, p.brake), 2),
                "gear": p.gear - 1,
                "rpms": int(p.rpms),
                "velocity": [round(p.speedKmh, 1), 0, 0],
                "gforce": [round(p.accG[0], 2), round(p.accG[1], 2), round(p.accG[2], 2)],
                "status": g.status,
                "completed_laps": g.completedLaps,
                "position": g.position,
                "normalized_pos": round(max(0.0, min(1.0, g.normalizedCarPosition)), 4),
                "current_lap_time": g.iCurrentTime if g.iCurrentTime > 0 else (str(g.currentTime).strip() or "00:00:00"),
                "last_lap_time": g.iLastTime if g.iLastTime > 0 else (str(g.lastTime).strip() or "00:00:00"),
                "best_lap_time": g.iBestTime if g.iBestTime > 0 else (str(g.bestTime).strip() or "00:00:00"),
                "is_lap_valid": is_valid_instant,
            }
        except Exception:
            return None

    def reset_lap_state(self) -> None:
        """Reset lap tracking state on session restart or race launch."""
        self.current_lap_valid = True
        self.last_lap_valid = True
        self._last_completed_laps = 0

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_data(self) -> dict[str, object]:
        """Get telemetry from the best available source.

        Priority: SimHub → UDP bridge → shared memory → empty dict.
        """
        now = time.time()

        # Throttle SimHub retry logging
        if not self.simhub_connected and now - self._last_sh_check > 5:
            logger.debug("Probing SimHub at %s...", self.simhub_url)
            self._last_sh_check = now
            # Also check if SimHub process is running (works even without a race)
            self._check_simhub_process()
            # Check other services too
            self._check_service_processes()

        result = self._get_simhub_data()
        if not result:
            result = self._get_udp_data()
        if not result:
            result = self._get_mmap_data()

        if not result:
            return {}

        # Lap validity latch state machine
        completed_laps = int(result.get("completed_laps", 0) or 0)
        instant_valid = bool(result.get("is_lap_valid", True))

        if completed_laps > self._last_completed_laps:
            # Completed a lap! Latch the outcome of the lap that just finished
            self.last_lap_valid = self.current_lap_valid
            self._last_completed_laps = completed_laps
            # Reset current lap validity for the new lap (starting with instant state)
            self.current_lap_valid = instant_valid
        elif completed_laps < self._last_completed_laps:
            # Session reset / new race
            self._last_completed_laps = completed_laps
            self.current_lap_valid = True
            self.last_lap_valid = True
        else:
            # Mid-lap: if any frame is invalid, the lap becomes invalid for its duration
            if not instant_valid:
                self.current_lap_valid = False

        result["is_lap_valid"] = self.current_lap_valid
        result["last_lap_valid"] = self.last_lap_valid

        return result

    def _check_simhub_process(self) -> None:
        """Check if SimHub process is running and set simhub_connected accordingly."""
        try:
            import psutil
            for proc in psutil.process_iter(["name"]):
                try:
                    pinfo = proc.info
                    name = (pinfo["name"] if isinstance(pinfo, dict) else getattr(pinfo, "name", "")).lower()
                    if "simhub" in name:
                        if not self.simhub_connected:
                            logger.info("SimHub process detected (running)")
                            self.simhub_connected = True
                        return
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
        except ImportError:
            # If psutil not available, try tasklist on Windows
            if os.name == "nt":
                try:
                    import subprocess
                    out = subprocess.check_output(
                        ["tasklist", "/FI", "IMAGENAME eq SimHubWPF.exe", "/NH"],
                        text=True, timeout=3,
                    )
                    if "simhub" in out.lower():
                        if not self.simhub_connected:
                            logger.info("SimHub process detected via tasklist")
                            self.simhub_connected = True
                        return
                except Exception:
                    pass

    def _check_service_processes(self) -> None:
        """Check if Steam, Moza, and SimCube processes are running.

        DISABLED: Always reports True to avoid false negatives on dashboard.
        Re-enable when infrastructure is stable.
        """
        self.steam_connected = True
        self.moza_connected = True
        self.simcube_connected = True

    # ------------------------------------------------------------------
    # Cleanup
    # ------------------------------------------------------------------

    def _close_mmaps(self) -> None:
        for mm in (self.physics_mmap, self.graphics_mmap, self.static_mmap):
            if mm and hasattr(mm, "close"):
                mm.close()  # type: ignore[union-attr]
        self.physics_mmap = self.graphics_mmap = self.static_mmap = None

    def close(self) -> None:
        """Release all resources."""
        self._close_mmaps()
        if self.udp_sock:
            self.udp_sock.close()
