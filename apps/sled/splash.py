"""Fullscreen desktop blocker / splash screen for Ridge-Link rigs.

Covers the entire Windows desktop immediately on launch to prevent
users from accessing the Windows shell. Shows branding while the
sled agent and kiosk browser boot up in the background.

Uses only Tkinter (ships with Python, zero extra dependencies).
"""

from __future__ import annotations

import logging
import os
import subprocess
import sys
import threading
import time
import tkinter as tk
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [SPLASH] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("ridge.splash")


class DesktopBlocker:
    """Fullscreen always-on-top splash that blocks the Windows desktop."""

    def __init__(self) -> None:
        self.root = tk.Tk()
        self.root.title("Ridge-Link")

        # Fullscreen, always on top, no decorations
        self.root.attributes("-fullscreen", True)
        self.root.attributes("-topmost", True)
        self.root.configure(bg="#050505", cursor="none")
        self.root.overrideredirect(True)

        # Block Alt-F4 and other close attempts
        self.root.protocol("WM_DELETE_WINDOW", lambda: None)

        # Block Alt-Tab on Windows
        if os.name == "nt":
            try:
                import ctypes
                # Disable Windows key
                ctypes.windll.user32.SystemParametersInfoW(97, 1, None, 0)  # type: ignore[attr-defined]
            except Exception:
                pass

        # Get screen dimensions
        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()

        # Canvas for rendering
        self.canvas = tk.Canvas(
            self.root,
            width=sw,
            height=sh,
            bg="#050505",
            highlightthickness=0,
        )
        self.canvas.pack(fill="both", expand=True)

        # Draw branding
        self._draw_splash(sw, sh)

        # Status label (updated as services boot)
        self.status_text = self.canvas.create_text(
            sw // 2,
            sh // 2 + 80,
            text="INITIALIZING SYSTEMS...",
            font=("Arial", 10, "bold"),
            fill="#666666",
        )

        # Pulse animation
        self._pulse_state = 0
        self._animate_pulse()

    def _draw_splash(self, sw: int, sh: int) -> None:
        """Draw the branded splash screen."""
        # Background gradient bar top
        for i in range(3):
            self.canvas.create_rectangle(
                0, i * 2, sw, (i + 1) * 2,
                fill=f"#{hex(5 + i * 3)[2:]}0505",
                outline="",
            )

        # Main title
        self.canvas.create_text(
            sw // 2,
            sh // 2 - 60,
            text="RIDGE",
            font=("Arial", 72, "bold italic"),
            fill="#FF6B00",
        )
        self.canvas.create_text(
            sw // 2,
            sh // 2 + 10,
            text="RACING",
            font=("Arial", 36, "bold italic"),
            fill="#FFFFFF",
        )

        # Tagline
        self.canvas.create_text(
            sw // 2,
            sh // 2 + 50,
            text="POWERED BY RIDGE-LINK v2.0",
            font=("Arial", 8, "bold"),
            fill="#333333",
        )

        # Bottom accent line
        self.canvas.create_rectangle(
            sw // 4, sh - 80, sw * 3 // 4, sh - 78,
            fill="#FF6B00",
            outline="",
        )

    def _animate_pulse(self) -> None:
        """Subtle pulsing dot animation to show the system is alive."""
        self._pulse_state = (self._pulse_state + 1) % 3
        dots = "." * (self._pulse_state + 1)
        current_text: str = self.canvas.itemcget(self.status_text, "text")  # type: ignore[no-untyped-call]
        base_text = current_text.rstrip(".")
        self.canvas.itemconfig(self.status_text, text=f"{base_text}{dots}")
        self.root.after(500, self._animate_pulse)

    def update_status(self, text: str) -> None:
        """Update the status message from another thread."""
        self.root.after(0, lambda: self.canvas.itemconfig(self.status_text, text=text))

    def lower_behind_kiosk(self) -> None:
        """Lower splash behind the kiosk browser but keep it as desktop blocker."""
        def _lower() -> None:
            self.root.attributes("-topmost", False)
            self.root.lower()
        self.root.after(0, _lower)

    def destroy(self) -> None:
        """Close the splash (only called on graceful shutdown)."""
        if os.name == "nt":
            try:
                import ctypes
                # Re-enable Windows key
                ctypes.windll.user32.SystemParametersInfoW(97, 0, None, 0)  # type: ignore[attr-defined]
            except Exception:
                pass
        self.root.destroy()

    def mainloop(self) -> None:
        """Start the Tk event loop (blocking)."""
        self.root.mainloop()


def _boot_sled(splash: DesktopBlocker) -> None:
    """Boot the sled agent in a background thread, updating splash status."""
    try:
        time.sleep(1)
        splash.update_status("STARTING SLED AGENT...")
        logger.info("Launching sled agent...")

        # Find the correct Python to use
        repo_root = Path(__file__).resolve().parent.parent
        if os.name == "nt":
            venv_python = repo_root / "venv" / "Scripts" / "python.exe"
        else:
            venv_python = repo_root / "venv" / "bin" / "python"

        if not venv_python.exists():
            venv_python = Path(sys.executable)

        # Start sled as a subprocess
        sled_proc = subprocess.Popen(
            [str(venv_python), "-m", "apps.sled.main"],
            cwd=str(repo_root),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,  # type: ignore[attr-defined]
        )

        time.sleep(2)
        splash.update_status("CONNECTING TO ORCHESTRATOR...")
        time.sleep(3)

        if sled_proc.poll() is None:
            splash.update_status("SYSTEMS ONLINE — LOADING KIOSK...")
            logger.info("Sled agent running (PID: %d)", sled_proc.pid)
            time.sleep(2)
            # Lower splash behind the kiosk browser
            splash.lower_behind_kiosk()
            splash.update_status("RIDGE-LINK ACTIVE")
        else:
            splash.update_status("WARNING: SLED AGENT FAILED TO START")
            logger.error("Sled agent exited prematurely")

    except Exception as e:
        logger.error("Boot error: %s", e)
        splash.update_status(f"ERROR: {e}")


def main() -> None:
    """Entry point — show splash and boot sled in background."""
    logger.info("Ridge-Link Desktop Blocker starting...")

    splash = DesktopBlocker()

    # Boot sled in background thread
    boot_thread = threading.Thread(target=_boot_sled, args=(splash,), daemon=True)
    boot_thread.start()

    # Tk mainloop runs on main thread (required by Tkinter)
    splash.mainloop()


if __name__ == "__main__":
    main()
