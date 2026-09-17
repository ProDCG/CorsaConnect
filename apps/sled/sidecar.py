"""Standalone sidecar process — reads AC shared memory and streams via UDP.

This runs as a separate process alongside sled.py, bridging AC's shared
memory to a local UDP socket that the telemetry module consumes.
"""

from __future__ import annotations

import ctypes
import json
import logging
import mmap
import socket
import time

logging.basicConfig(level=logging.INFO, format="%(asctime)s [SIDECAR] %(message)s", datefmt="%H:%M:%S")
logger = logging.getLogger("ridge.sidecar")


# --- AC Shared Memory Structures ---


class SPageFilePhysics(ctypes.Structure):
    _pack_ = 4
    _fields_ = [
        ("packetId", ctypes.c_int32),
        ("gas", ctypes.c_float),
        ("brake", ctypes.c_float),
        ("fuel", ctypes.c_float),
        ("gear", ctypes.c_int32),
        ("rpms", ctypes.c_int32),
        ("steerAngle", ctypes.c_float),
        ("speedKmh", ctypes.c_float),
        ("velocity", ctypes.c_float * 3),
        ("accG", ctypes.c_float * 3),
        ("wheelSlip", ctypes.c_float * 4),
        ("wheelLoad", ctypes.c_float * 4),
        ("wheelsPressure", ctypes.c_float * 4),
        ("wheelAngularSpeed", ctypes.c_float * 4),
        ("tyreWear", ctypes.c_float * 4),
        ("tyreDirtyLevel", ctypes.c_float * 4),
        ("tyreCoreTemperature", ctypes.c_float * 4),
        ("camberRAD", ctypes.c_float * 4),
        ("suspensionTravel", ctypes.c_float * 4),
        ("drs", ctypes.c_float),
        ("tc", ctypes.c_float),
        ("heading", ctypes.c_float),
        ("pitch", ctypes.c_float),
        ("roll", ctypes.c_float),
        ("cgHeight", ctypes.c_float),
        ("carDamage", ctypes.c_float * 5),
        ("numberOfTyresOut", ctypes.c_int32),
        ("pitLimiterOn", ctypes.c_int32),
        ("abs", ctypes.c_float),
        ("kersCharge", ctypes.c_float),
        ("kersInput", ctypes.c_float),
        ("autoShifterOn", ctypes.c_int32),
        ("rideHeight", ctypes.c_float * 2),
        ("turboBoost", ctypes.c_float),
        ("ballast", ctypes.c_float),
        ("airDensity", ctypes.c_float),
        ("airTemp", ctypes.c_float),
        ("roadTemp", ctypes.c_float),
        ("localAngularVel", ctypes.c_float * 3),
        ("finalFF", ctypes.c_float),
        ("performanceMeter", ctypes.c_float),
        ("engineBrake", ctypes.c_int32),
        ("ersRecoveryLevel", ctypes.c_int32),
        ("ersPowerLevel", ctypes.c_int32),
        ("ersHeatCharging", ctypes.c_int32),
        ("ersIsCharging", ctypes.c_int32),
        ("kersCurrentKJ", ctypes.c_float),
        ("drsAvailable", ctypes.c_int32),
        ("drsEnabled", ctypes.c_int32),
        ("brakeTemp", ctypes.c_float * 4),
        ("clutch", ctypes.c_float),
        ("tyreTempI", ctypes.c_float * 4),
        ("tyreTempM", ctypes.c_float * 4),
        ("tyreTempO", ctypes.c_float * 4),
        ("isAIControlled", ctypes.c_int32),
        ("tyreContactPoint", (ctypes.c_float * 3) * 4),
        ("tyreContactNormal", (ctypes.c_float * 3) * 4),
        ("tyreContactHeading", (ctypes.c_float * 3) * 4),
        ("brakeBias", ctypes.c_float),
        ("localVelocity", ctypes.c_float * 3),
    ]


class SPageFileGraphic(ctypes.Structure):
    _pack_ = 4
    _fields_ = [
        ("packetId", ctypes.c_int32),
        ("status", ctypes.c_int32),
        ("session", ctypes.c_int32),
        ("currentTime", ctypes.c_wchar * 15),
        ("lastTime", ctypes.c_wchar * 15),
        ("bestTime", ctypes.c_wchar * 15),
        ("split", ctypes.c_wchar * 15),
        ("completedLaps", ctypes.c_int32),
        ("position", ctypes.c_int32),
        ("iCurrentTime", ctypes.c_int32),
        ("iLastTime", ctypes.c_int32),
        ("iBestTime", ctypes.c_int32),
        ("sessionTimeLeft", ctypes.c_float),
        ("distanceTraveled", ctypes.c_float),
        ("isInPit", ctypes.c_int32),
        ("currentSectorIndex", ctypes.c_int32),
        ("lastSectorTime", ctypes.c_int32),
        ("numberOfLaps", ctypes.c_int32),
        ("tyreCompound", ctypes.c_wchar * 33),
        ("replayTimeMultiplier", ctypes.c_float),
        ("normalizedCarPosition", ctypes.c_float),
        ("activeCars", ctypes.c_int32),
        ("carCoordinates", (ctypes.c_float * 3) * 60),
        ("carID", ctypes.c_int32 * 60),
        ("playerCarID", ctypes.c_int32),
        ("penaltyTime", ctypes.c_float),
        ("flag", ctypes.c_int32),
        ("penalty", ctypes.c_int32),
        ("idealLineOn", ctypes.c_int32),
        ("isInPitLane", ctypes.c_int32),
        ("surfaceGrip", ctypes.c_float),
        ("mandatoryPitDone", ctypes.c_int32),
        ("windSpeed", ctypes.c_float),
        ("windDirection", ctypes.c_float),
        ("isSetupMenuVisible", ctypes.c_int32),
        ("mainTrackIndex", ctypes.c_int32),
        ("isValidLap", ctypes.c_int32),
    ]


def run_sidecar(udp_port: int = 9996) -> None:
    """Main sidecar loop — reads shared memory and broadcasts via UDP."""
    UDP_IP = "127.0.0.1"
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

    logger.info("Streaming AC Shared Memory -> UDP:%d", udp_port)
    logger.info("Press Ctrl+C to exit.")

    physics_mem = None
    graphic_mem = None

    while True:
        try:
            # Connect to shared memory if needed
            if not physics_mem:
                try:
                    physics_mem = mmap.mmap(0, ctypes.sizeof(SPageFilePhysics), "acqs_physics")  # type: ignore[arg-type]
                    graphic_mem = mmap.mmap(0, ctypes.sizeof(SPageFileGraphic), "acqs_graphics")  # type: ignore[arg-type]
                    logger.info("CONNECTED: Link to Assetto Corsa established")
                except Exception:
                    time.sleep(2)
                    continue

            # Read physics
            physics_mem.seek(0)
            p = SPageFilePhysics.from_buffer_copy(physics_mem.read(ctypes.sizeof(SPageFilePhysics)))

            # Read graphics
            if graphic_mem is None:
                continue
            graphic_mem.seek(0)
            g = SPageFileGraphic.from_buffer_copy(graphic_mem.read(ctypes.sizeof(SPageFileGraphic)))

            # Check validity
            is_valid = (
                bool(getattr(g, "isValidLap", 1) != 0)
                and (getattr(p, "numberOfTyresOut", 0) < 3)
                and (getattr(g, "penaltyTime", 0.0) <= 0)
                and (getattr(g, "penalty", 0) <= 0)
            )

            # Build payload
            payload = {
                "packet_id": p.packetId,
                "gas": round(p.gas, 3),
                "brake": round(p.brake, 3),
                "gear": p.gear - 1,
                "rpms": int(p.rpms),
                "velocity": [round(p.speedKmh, 1), 0, 0],
                "gforce": [round(p.accG[0], 2), round(p.accG[1], 2), round(p.accG[2], 2)],
                "status": g.status,
                "completed_laps": g.completedLaps,
                "position": g.position,
                "normalized_pos": round(g.normalizedCarPosition, 4),
                "current_lap_time": g.iCurrentTime if g.iCurrentTime > 0 else (str(g.currentTime).strip() or "00:00:00"),
                "last_lap_time": g.iLastTime if g.iLastTime > 0 else (str(g.lastTime).strip() or "00:00:00"),
                "best_lap_time": g.iBestTime if g.iBestTime > 0 else (str(g.bestTime).strip() or "00:00:00"),
                "is_lap_valid": is_valid,
            }

            sock.sendto(json.dumps(payload).encode("utf-8"), (UDP_IP, udp_port))
            time.sleep(0.1)  # 10 Hz

        except Exception as e:
            logger.error("Error: %s", e)
            physics_mem = None
            time.sleep(1)


if __name__ == "__main__":
    run_sidecar()
