"""Assetto Corsa dedicated server management endpoints."""

from __future__ import annotations

import logging
import os
import shutil
import subprocess

from fastapi import APIRouter

from apps.orchestrator.state import AppState
from shared.constants import (
    AC_ADMIN_PASSWORD,
    AC_HTTP_PORT,
    AC_SERVER_NAME,
    AC_SERVER_PASSWORD,
    AC_TCP_PORT,
    AC_UDP_PORT,
    DEFAULT_AC_PATH,
)
from shared.models import GlobalSettings

logger = logging.getLogger("ridge.server")

router = APIRouter(prefix="/server", tags=["server"])


class ServerManager:
    """Manages the Assetto Corsa dedicated server process."""

    def __init__(self) -> None:
        self.process: subprocess.Popen[bytes] | None = None
        self.config_dir = os.path.join(os.getcwd(), "server_config")
        os.makedirs(self.config_dir, exist_ok=True)

    def generate_configs(self, rigs_list: list[dict[str, object]], settings: GlobalSettings) -> None:
        """Generate server_cfg.ini and entry_list.ini from current rig/settings state."""
        cars_set = {str(r.get("selected_car", "ks_ferrari_488_gt3")) for r in rigs_list if r.get("selected_car")}

        server_cfg = f"""
[SERVER]
NAME={AC_SERVER_NAME}
CARS={",".join(cars_set)}
TRACK={settings.selected_track}
CONFIG_TRACK=
SUN_ANGLE=0
MAX_CLIENTS=16
RACE_OVER_TIME=60
UDP_PORT={AC_UDP_PORT}
TCP_PORT={AC_TCP_PORT}
HTTP_PORT={AC_HTTP_PORT}
PASSWORD={AC_SERVER_PASSWORD}
ADMIN_PASSWORD={AC_ADMIN_PASSWORD}
PICKUP_MODE_ENABLED=1
SLEEP_TIME=1
CLIENT_SEND_INTERVAL_HZ=30
SEND_BUFFER_SIZE=0
RECV_BUFFER_SIZE=0

[PRACTICE]
NAME=Practice
TIME={settings.practice_time}
WAIT_TIME=0

[QUALIFY]
NAME=Qualifying
TIME={settings.qualy_time}
WAIT_TIME=0

[RACE]
NAME=Grand Prix
LAPS={settings.race_laps}
WAIT_TIME=0

[DYNAMIC_TRACK]
SESSION_START=100
SESSION_TRANSFER=100
RANDOMNESS=0
LAP_GAIN=0
"""
        entry_list = ""
        for i, rig in enumerate(rigs_list):
            if rig.get("selected_car"):
                entry_list += f"""
[CAR_{i}]
MODEL={rig['selected_car']}
SKIN=0_official
SPECTATOR_MODE=0
DRIVER_NAME={rig['rig_id']}
TEAM=
GUID=
BALLAST=0
RESTRICTOR=0
"""

        with open(os.path.join(self.config_dir, "server_cfg.ini"), "w") as f:
            f.write(server_cfg.strip())
        with open(os.path.join(self.config_dir, "entry_list.ini"), "w") as f:
            f.write(entry_list.strip())

    def start(self, ac_path: str) -> bool:
        """Start the AC dedicated server."""
        self.stop()
        ac_dir = os.path.dirname(ac_path)
        server_dir = os.path.join(ac_dir, "server")
        server_exe = os.path.join(server_dir, "acServer.exe")

        if not os.path.exists(server_exe):
            if os.path.exists("acServer.exe"):
                server_exe = os.path.abspath("acServer.exe")
                server_dir = os.getcwd()
            else:
                logger.error("Server EXE not found at %s", server_exe)
                return False

        # Copy generated configs to server/cfg
        dest_cfg = os.path.join(server_dir, "cfg")
        os.makedirs(dest_cfg, exist_ok=True)
        try:
            shutil.copy(os.path.join(self.config_dir, "server_cfg.ini"), os.path.join(dest_cfg, "server_cfg.ini"))
            shutil.copy(os.path.join(self.config_dir, "entry_list.ini"), os.path.join(dest_cfg, "entry_list.ini"))
        except Exception as e:
            logger.error("Failed to copy server configs: %s", e)

        logger.info("Starting AC Server: %s", server_exe)
        try:
            self.process = subprocess.Popen([server_exe], cwd=server_dir)
            return True
        except Exception as e:
            logger.error("Failed to start server: %s", e)
            return False

    def stop(self) -> None:
        """Stop the AC dedicated server."""
        if self.process:
            self.process.terminate()
            self.process = None

        try:
            import psutil

            for proc in psutil.process_iter(["name"]):
                try:
                    if proc.info["name"] == "acServer.exe":
                        proc.kill()
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
        except ImportError:
            pass

    @property
    def is_running(self) -> bool:
        return self.process is not None and self.process.poll() is None


_server_manager = ServerManager()


def create_router(state: AppState) -> APIRouter:
    """Create the server router bound to the given application state."""

    @router.get("/status")
    async def get_server_status() -> dict[str, str]:
        status = "online" if _server_manager.is_running else "offline"
        state.server_status = status
        return {"status": status}

    @router.post("/start")
    async def start_server() -> dict[str, str]:
        _server_manager.generate_configs(state.get_rigs(), state.settings)
        if _server_manager.start(DEFAULT_AC_PATH):
            state.server_status = "online"
            return {"message": "Server started"}
        return {"error": "Failed to start server"}

    @router.post("/stop")
    async def stop_server() -> dict[str, str]:
        _server_manager.stop()
        state.server_status = "offline"
        return {"message": "Server stopped"}

    return router
