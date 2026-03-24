"""Create Windows startup shortcuts and desktop icons for Ridge-Link.

Run this ONCE after bootstrap.py to create:
1. Desktop shortcut for START_RIG.bat or START_ADMIN.bat
2. Startup folder shortcut (auto-launch on Windows login)
"""

from __future__ import annotations

import os


def create_shortcut(target: str, shortcut_path: str, work_dir: str, icon: str = "") -> None:
    """Create a Windows .lnk shortcut file."""
    try:
        import win32com.client  # type: ignore[import-untyped]

        shell = win32com.client.Dispatch("WScript.Shell")
        shortcut = shell.CreateShortCut(shortcut_path)
        shortcut.TargetPath = target
        shortcut.WorkingDirectory = work_dir
        shortcut.WindowStyle = 7  # Minimized
        if icon:
            shortcut.IconLocation = icon
        shortcut.save()
        print(f"  Created: {shortcut_path}")
    except ImportError:
        # Fallback: create a .bat wrapper
        bat_path = shortcut_path.replace(".lnk", ".bat")
        with open(bat_path, "w") as f:
            f.write(f'@echo off\ncd /d "{work_dir}"\nstart "" "{target}"\n')
        print(f"  Created (bat fallback): {bat_path}")


def main() -> None:
    if os.name != "nt":
        print("Shortcut creation is Windows-only.")
        return

    role = input("Create shortcuts for (admin/rig): ").strip().lower()
    repo_root = os.path.dirname(os.path.abspath(__file__))

    # Paths
    desktop = os.path.join(os.environ.get("USERPROFILE", ""), "Desktop")
    startup = os.path.join(
        os.environ.get("APPDATA", ""),
        "Microsoft", "Windows", "Start Menu", "Programs", "Startup",
    )

    if role == "rig":
        bat_file = os.path.join(repo_root, "START_RIG.bat")
        shortcut_name = "Ridge-Link Rig.lnk"
    elif role == "admin":
        bat_file = os.path.join(repo_root, "START_ADMIN.bat")
        shortcut_name = "Ridge-Link Admin.lnk"
    else:
        print("Invalid role. Use 'admin' or 'rig'.")
        return

    if not os.path.exists(bat_file):
        print(f"ERROR: {bat_file} not found. Run from the repo root.")
        return

    print(f"\nCreating shortcuts for: {role.upper()}")
    print(f"  Target: {bat_file}")

    # Desktop shortcut
    create_shortcut(bat_file, os.path.join(desktop, shortcut_name), repo_root)

    # Auto-start shortcut
    auto_start = input("\nAuto-start on Windows login? (y/n): ").strip().lower()
    if auto_start == "y":
        create_shortcut(bat_file, os.path.join(startup, shortcut_name), repo_root)
        print("  → Will auto-launch on next login")

    print("\nDone! You can now double-click the desktop icon to start Ridge-Link.")


if __name__ == "__main__":
    main()
