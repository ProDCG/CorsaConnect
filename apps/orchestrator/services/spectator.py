"""Spectator Sled Service — launches AC on Monitor 2 as a spectator.

Responsibilities:
  - Generates a dedicated spectator_race.ini (does NOT touch race.ini)
  - Generates a low-quality spectator_video.ini to minimise Admin PC GPU load
  - Launches acs.exe and moves the window to Monitor 2 (index 1)
  - Manages a global numpad key listener for camera / driver cycling
  - Exposes launch / kill / status methods called by the server router
"""

from __future__ import annotations

import logging
import os
import subprocess
import threading
import time

logger = logging.getLogger("ridge.spectator")

IS_WINDOWS = os.name == "nt"

# Default car used for the spectator slot (any valid car that exists on disk)
_SPECTATOR_CAR_FALLBACK = "ks_ferrari_488_gt3"

# Monitor index (0 = primary, 1 = secondary)
SPECTATOR_MONITOR_INDEX = 1

# Numpad → AC keypress mapping
# Keys are sent to the AC window even when it is not the foreground window.
_NUMPAD_MAP: dict[str, str | list[str]] = {
    "num 4":    "left",          # Previous driver
    "num 6":    "right",         # Next driver
    "num enter":"f1",            # Cycle camera mode
    "num 8":    "f1",            # Cockpit cam
    "num 2":    "f2",            # Chase cam
    "num 5":    "f3",            # TV / track cam
    # num 1-9 → Ctrl+1 through Ctrl+9 for direct slot jump
    "num 1": ["ctrl", "1"],
    "num 2": ["ctrl", "2"],
    "num 3": ["ctrl", "3"],
    "num 7": ["ctrl", "7"],
    "num 9": ["ctrl", "9"],
}


def _generate_spectator_race_ini(
    server_ip: str,
    server_port: int,
    server_http_port: int,
    track: str,
    config_track: str,
    car: str,
    sun_angle: float,
) -> str:
    """Write a spectator_race.ini and return its path.

    Uses a *separate* file from race.ini so it never conflicts with a sled session
    on the Admin PC.
    """
    user_profile = os.environ.get("USERPROFILE") or os.path.expanduser("~")
    documents = os.path.join(user_profile, "Documents")
    onedrive_docs = os.path.join(user_profile, "OneDrive", "Documents")
    if not os.path.exists(os.path.join(documents, "Assetto Corsa")) and os.path.exists(onedrive_docs):
        documents = onedrive_docs

    cfg_dir = os.path.join(documents, "Assetto Corsa", "cfg")
    os.makedirs(cfg_dir, exist_ok=True)
    # acs.exe always loads race.ini regardless of the -race= argument filename,
    # so write directly there. Admin PC has no sled agent so there is no conflict.
    ini_path = os.path.join(cfg_dir, "race.ini")

    # Map sun_angle to seconds-from-midnight for the [TIME] section
    time_map = {
        -16: 25200, 8: 28800, 24: 32400, 40: 37800, 56: 43200,
        72: 48600, 88: 54000, 104: 59400, 120: 64800, 136: 70200, 163: 79200
    }
    time_seconds = time_map.get(int(sun_angle), 43200)

    content = (
        "[RACE]\n"
        "VERSION=1.1\n"
        "MODEL=abarth500\n"
        f"TRACK={track}\n"
        f"CONFIG_TRACK={config_track}\n"
        "CARS=1\n"
        "AI_LEVEL=100\n"
        "FIXED_SETUP=0\n"
        "PENALTIES=0\n"
        "JUMP_START_PENALTY=0\n"
        "AUTO_START=1\n"
        "OPEN_CONTROL_CONFIG=0\n"
        "PIT_MODE=0\n"
        "CONF_MODE=\n"
        "MODEL_CONFIG=\n"
        "SKIN=\n"
        "DRIFT_MODE=0\n"
        "RACE_LAPS=0\n"
        "\n[CAR_0]\n"
        "SETUP=\n"
        "SKIN=\n"
        "MODEL=-\n"
        "MODEL_CONFIG=\n"
        "BALLAST=0\n"
        "RESTRICTOR=0\n"
        "DRIVER_NAME=Spectator\n"
        "NATIONALITY=ITA\n"
        "NATION_CODE=ITA\n"
        "\n[REMOTE]\n"
        "ACTIVE=1\n"
        f"SERVER_IP={server_ip}\n"
        f"SERVER_PORT={server_port}\n"
        f"SERVER_HTTP_PORT={server_http_port}\n"
        "REQUESTED_CAR=abarth500\n"
        "NAME=Spectator\n"
        "TEAM=Spectator\n"
        "GUID=\n"
        "PASSWORD=\n"
        "\n[LIGHTING]\n"
        "SPECULAR_MULT=1.0\n"
        "CLOUD_SPEED=0.200\n"
        f"SUN_ANGLE={sun_angle:.2f}\n"
        "TIME_MULT=1.0\n"
        "__CM_WEATHER_CONTROLLER=pureCtrl static\n"
        "__CM_WEATHER_TYPE=15\n"
        f"__TRACK_TIMEZONE_OFFSET=3600\n"
        "__TRACK_GEOTAG_LONG=9.2811\n"
        "__TRACK_TIMEZONE_BASE_OFFSET=3600\n"
        "__TRACK_GEOTAG_LAT=45.6156\n"
        "__TRACK_TIMEZONE_DTS=0\n"
        "\n[WEATHER]\n"
        "NAME=sol_42_thunderstorm\n"
        "GRAPHICS=sol_42_thunderstorm\n"
        "CONTROLLER=pure\n"
        "TYPE=1\n"
        "\n[TIME]\n"
        f"TIME={time_seconds}\n"
        "DAYS=21\n"
        "MONTHS=6\n"
        "YEARS=2026\n"
        "\n[BENCHMARK]\n"
        "ACTIVE=0\n"
        "\n[REPLAY]\n"
        "ACTIVE=0\n"
        "\n[RESTART]\n"
        "ACTIVE=0\n"
        "\n[HEADER]\n"
        "VERSION=2\n"
        "CM_FEATURE_SET=2\n"
        "\n[OPTIONS]\n"
        "USE_MPH=0\n"
    )

    with open(ini_path, "w") as f:
        f.write(content)

    logger.info("Wrote spectator_race.ini: %s  (server=%s:%d)", ini_path, server_ip, server_port)
    return ini_path


def _write_low_quality_video_ini(ac_folder: str) -> str | None:
    """Write a spectator-optimised video.ini to reduce GPU load.

    Only writes if we can locate an existing video.ini to base off of.
    Returns path written or None.
    """
    user_profile = os.environ.get("USERPROFILE") or os.path.expanduser("~")
    documents = os.path.join(user_profile, "Documents")
    onedrive_docs = os.path.join(user_profile, "OneDrive", "Documents")
    if not os.path.exists(os.path.join(documents, "Assetto Corsa")) and os.path.exists(onedrive_docs):
        documents = onedrive_docs

    cfg_dir = os.path.join(documents, "Assetto Corsa", "cfg")
    video_ini = os.path.join(cfg_dir, "video.ini")

    if not os.path.exists(video_ini):
        logger.warning("video.ini not found — skipping low-quality override")
        return None

    try:
        with open(video_ini, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()

        # Write a backup if not already done
        backup = video_ini + ".spectator_backup"
        if not os.path.exists(backup):
            with open(backup, "w", encoding="utf-8") as f:
                f.writelines(lines)
            logger.info("Backed up video.ini -> %s", backup)

        # Keys to override for spectator low-quality.
        # FILTER=pureHDR and ENABLED=1 are pinned so Pure's post-processing
        # chain is always active — without these, Pure won't auto-enable and
        # graphics look like vanilla AC.  DISABLE_LEGACY_HDR=1 is required for
        # Pure's HDR pipeline to take over from AC's built-in tonemapper.
        overrides = {
            "SHADOW_MAP_SIZE": "512",
            "SHADOW_MAP_SIZE2": "512",
            "SHADOW_MAP_SIZE3": "256",
            "REFLECTION_RESOLUTION": "0",
            "REFLECTION_DISTANCE": "0",
            "MOTION_BLUR": "0",
            "DEPTH_OF_FIELD": "0",
            "ANISOTROPIC": "4",
            "WIDTH": "1920",
            "HEIGHT": "1080",
            "FULLSCREEN": "0",          # Must be windowed to move to monitor 2
            "BORDERLESS": "1",
            # Pure HDR — must be present or Pure won't initialise its pipeline
            "FILTER": "pureHDR",        # [POST_PROCESS]
            "ENABLED": "1",             # [POST_PROCESS] — enables PP chain
            "DISABLE_LEGACY_HDR": "1",  # [VIDEO] — lets Pure own tonemapping
        }

        new_lines = []
        for line in lines:
            stripped = line.strip()
            key = stripped.split("=")[0].strip().upper() if "=" in stripped else ""
            if key in overrides:
                new_lines.append(f"{key}={overrides[key]}\n")
                overrides.pop(key)
            else:
                new_lines.append(line)

        # Append any keys not already in the file
        for k, v in overrides.items():
            new_lines.append(f"{k}={v}\n")

        with open(video_ini, "w", encoding="utf-8") as f:
            f.writelines(new_lines)

        logger.info("Wrote low-quality spectator video.ini overrides")
        return video_ini

    except Exception as e:
        logger.warning("Could not write low-quality video.ini: %s", e)
        return None


def _restore_video_ini() -> None:
    """Restore the original video.ini from the backup after spectating."""
    user_profile = os.environ.get("USERPROFILE") or os.path.expanduser("~")
    documents = os.path.join(user_profile, "Documents")
    onedrive_docs = os.path.join(user_profile, "OneDrive", "Documents")
    if not os.path.exists(os.path.join(documents, "Assetto Corsa")) and os.path.exists(onedrive_docs):
        documents = onedrive_docs

    video_ini = os.path.join(documents, "Assetto Corsa", "cfg", "video.ini")
    backup = video_ini + ".spectator_backup"

    if os.path.exists(backup):
        try:
            import shutil
            shutil.copy2(backup, video_ini)
            os.remove(backup)
            logger.info("Restored original video.ini from backup")
        except Exception as e:
            logger.warning("Could not restore video.ini: %s", e)


def _move_window_to_monitor(window_title_fragment: str, monitor_index: int = 1) -> None:
    """Move the AC window to the specified monitor using Win32 APIs via ctypes.

    Only works on Windows. Finds the first window whose title contains
    `window_title_fragment` and moves it to the target monitor.
    """
    if not IS_WINDOWS:
        return
    try:
        import ctypes
        import ctypes.wintypes

        user32 = ctypes.windll.user32  # type: ignore[attr-defined]

        # Collect monitor rectangles
        monitors: list[tuple[int, int, int, int]] = []

        def _monitor_callback(hMonitor: int, hdcMonitor: int, lprcMonitor: ctypes.wintypes.LPRECT, dwData: int) -> bool:
            rc = lprcMonitor.contents
            monitors.append((rc.left, rc.top, rc.right, rc.bottom))
            return True

        MONITOR_ENUM_PROC = ctypes.WINFUNCTYPE(
            ctypes.c_bool,
            ctypes.c_ulong,
            ctypes.c_ulong,
            ctypes.POINTER(ctypes.wintypes.RECT),
            ctypes.c_double,
        )
        cb = MONITOR_ENUM_PROC(_monitor_callback)
        user32.EnumDisplayMonitors(None, None, cb, 0)

        if monitor_index >= len(monitors):
            logger.warning("Monitor %d not found (only %d monitors detected)", monitor_index, len(monitors))
            return

        left, top, right, bottom = monitors[monitor_index]
        width = right - left
        height = bottom - top

        # Find the AC window
        hwnd = user32.FindWindowW(None, None)
        found_hwnd = None
        while hwnd:
            length = user32.GetWindowTextLengthW(hwnd)
            if length > 0:
                buf = ctypes.create_unicode_buffer(length + 1)
                user32.GetWindowTextW(hwnd, buf, length + 1)
                if window_title_fragment.lower() in buf.value.lower():
                    found_hwnd = hwnd
                    break
            hwnd = user32.GetWindow(hwnd, 2)  # GW_HWNDNEXT

        if not found_hwnd:
            logger.warning("Could not find AC window containing '%s'", window_title_fragment)
            return

        SWP_NOSIZE = 0x0001
        SWP_NOZORDER = 0x0004
        # Move to top-left of target monitor, keep size
        user32.SetWindowPos(found_hwnd, None, left, top, width, height, SWP_NOZORDER)
        logger.info("Moved AC spectator window to monitor %d (%dx%d @ %d,%d)",
                    monitor_index, width, height, left, top)
    except Exception as e:
        logger.warning("Could not move window to monitor %d: %s", monitor_index, e)


def _send_key_to_ac(key: str | list[str]) -> None:
    """Send a keypress to the AC window using pydirectinput."""
    try:
        import pydirectinput  # type: ignore[import]
        if isinstance(key, list):
            # Combo: e.g. ["ctrl", "1"]
            for k in key[:-1]:
                pydirectinput.keyDown(k)
            pydirectinput.press(key[-1])
            for k in reversed(key[:-1]):
                pydirectinput.keyUp(k)
        else:
            pydirectinput.press(key)
    except ImportError:
        logger.error("pydirectinput not installed — numpad input will not work")
    except Exception as e:
        logger.error("Key send failed: %s", e)


def _start_numpad_listener() -> threading.Thread | None:
    """Start the global numpad listener in a daemon thread.

    Uses the `keyboard` library to listen for numpad events globally.
    Returns the thread, or None if `keyboard` is not available.
    """
    try:
        import keyboard  # type: ignore[import]
    except ImportError:
        logger.warning("'keyboard' package not installed — numpad listener unavailable")
        return None

    def _listener() -> None:
        logger.info("Numpad listener active — waiting for numpad events")
        for numpad_key, ac_key in _NUMPAD_MAP.items():
            keyboard.add_hotkey(numpad_key, _send_key_to_ac, args=(ac_key,), suppress=True)
        keyboard.wait()  # Block forever (daemon thread, so exits with process)

    t = threading.Thread(target=_listener, name="numpad-listener", daemon=True)
    t.start()
    logger.info("Numpad listener thread started")
    return t


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

class SpectatorService:
    """Singleton service managing the spectator AC instance on Monitor 2."""

    def __init__(self) -> None:
        self._process: subprocess.Popen[bytes] | None = None
        self._active_group_id: str | None = None
        self._lock = threading.Lock()
        self._numpad_thread: threading.Thread | None = None

    @property
    def is_active(self) -> bool:
        with self._lock:
            return self._process is not None and self._process.poll() is None

    @property
    def active_group_id(self) -> str | None:
        with self._lock:
            return self._active_group_id

    def launch(
        self,
        group_id: str,
        server_ip: str,
        server_port: int,
        server_http_port: int,
        track: str,
        config_track: str,
        car: str,
        sun_angle: float,
        ac_path: str,
        monitor_index: int = SPECTATOR_MONITOR_INDEX,
    ) -> dict[str, object]:
        """Launch a spectator AC instance for the given group's server."""
        with self._lock:
            # Kill any existing spectator
            if self._process and self._process.poll() is None:
                logger.info("Killing existing spectator process before re-launch")
                self._kill_process()

            # Write the low-quality video settings
            _write_low_quality_video_ini(os.path.dirname(ac_path))

            # Generate the dedicated race.ini
            try:
                ini_path = _generate_spectator_race_ini(
                    server_ip, server_port, server_http_port,
                    track, config_track, car, sun_angle,
                )
            except Exception as e:
                logger.error("Failed to generate spectator_race.ini: %s", e)
                return {"status": "error", "message": f"INI generation failed: {e}"}

            # Ensure steam_appid.txt exists
            ac_dir = os.path.dirname(ac_path)
            steam_appid = os.path.join(ac_dir, "steam_appid.txt")
            if not os.path.exists(steam_appid):
                try:
                    with open(steam_appid, "w") as f:
                        f.write("244210")
                except Exception:
                    pass

            # Launch acs.exe
            if not os.path.exists(ac_path):
                logger.error("acs.exe not found at %s", ac_path)
                return {"status": "error", "message": f"acs.exe not found: {ac_path}"}

            try:
                proc = subprocess.Popen(
                    [ac_path, f"-race={ini_path}"],
                    cwd=ac_dir,
                )
                self._process = proc
                self._active_group_id = group_id
                logger.info("Spectator AC launched (PID %d) joining %s:%d", proc.pid, server_ip, server_port)
            except Exception as e:
                logger.error("Failed to launch spectator AC: %s", e)
                _restore_video_ini()
                return {"status": "error", "message": str(e)}

        # Move window to secondary monitor after a short delay (AC needs time to open)
        def _move_after_delay() -> None:
            time.sleep(8)
            _move_window_to_monitor("Assetto Corsa", monitor_index)
            # Switch to TV cam (F3) automatically for the best spectator view
            time.sleep(2)
            _send_key_to_ac("f3")

        threading.Thread(target=_move_after_delay, daemon=True).start()

        # Start numpad listener (idempotent — only starts once)
        if self._numpad_thread is None or not self._numpad_thread.is_alive():
            self._numpad_thread = _start_numpad_listener()

        return {"status": "success", "pid": self._process.pid if self._process else None}

    def kill(self) -> dict[str, str]:
        """Terminate the spectator AC instance and restore video.ini."""
        with self._lock:
            if not self._process or self._process.poll() is not None:
                self._active_group_id = None
                return {"status": "ok", "message": "No spectator running"}
            self._kill_process()
        _restore_video_ini()
        return {"status": "ok"}

    def _kill_process(self) -> None:
        """Internal — must be called with self._lock held."""
        if self._process:
            try:
                self._process.kill()
            except Exception:
                pass
            self._process = None
        self._active_group_id = None

        # Also force-kill by name on Windows
        if IS_WINDOWS:
            import subprocess as _sp
            for exe in ("acs.exe", "acs_x86.exe"):
                try:
                    _sp.run(["taskkill", "/F", "/T", "/IM", exe], capture_output=True, timeout=5)
                except Exception:
                    pass

        logger.info("Spectator process killed")

    def status(self) -> dict[str, object]:
        return {
            "active": self.is_active,
            "group_id": self.active_group_id,
            "pid": self._process.pid if self._process and self._process.poll() is None else None,
        }
