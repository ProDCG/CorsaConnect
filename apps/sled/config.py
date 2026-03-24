"""Sled configuration — validated from config.json."""

from __future__ import annotations

import json
import os
import socket

from pydantic import BaseModel, Field

from shared.constants import (
    COMMAND_PORT,
    DEFAULT_AC_FOLDER,
    DEFAULT_AC_PATH,
    DEFAULT_ADMIN_SHARE,
    DEFAULT_CM_PATH,
    HEARTBEAT_PORT,
)


class SledConfig(BaseModel):
    """Typed configuration for a sled rig agent."""

    rig_id: str = Field(default_factory=lambda: socket.gethostname())
    orchestrator_ip: str = "192.168.9.35"
    heartbeat_port: int = HEARTBEAT_PORT
    command_port: int = COMMAND_PORT
    mod_version: str = "2.0.0"
    admin_shared_folder: str = DEFAULT_ADMIN_SHARE
    local_ac_folder: str = DEFAULT_AC_FOLDER
    cm_path: str = DEFAULT_CM_PATH
    ac_path: str = DEFAULT_AC_PATH
    default_car: str = "ks_ferrari_488_gt3"
    simhub_url: str = "http://127.0.0.1:8888/api/getgamedata"
    udp_bridge_port: int = 9996
    standalone_mode: bool = False  # Auto-set when orchestrator is unreachable


def load_config(config_path: str = "config.json") -> SledConfig:
    """Load and validate sled config from a JSON file.

    Returns defaults if the file doesn't exist or is invalid.
    """
    if os.path.exists(config_path):
        try:
            with open(config_path) as f:
                data = json.load(f)
            return SledConfig(**data)
        except Exception:
            pass
    return SledConfig()
