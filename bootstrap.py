"""Ridge-Link Bootstrap — sets up firewall rules, directories, and dependencies."""

from __future__ import annotations

import os
import socket
import subprocess
import sys

# Ports to open in Windows Firewall
FIREWALL_RULES: list[dict[str, str]] = [
    {"name": "Ridge AC UDP", "protocol": "UDP", "port": "9600"},
    {"name": "Ridge AC TCP", "protocol": "TCP", "port": "9600"},
    {"name": "Ridge AC HTTP", "protocol": "TCP", "port": "8081"},
    {"name": "Ridge Link Heartbeat", "protocol": "UDP", "port": "5001"},
    {"name": "Ridge Link Command", "protocol": "TCP", "port": "5000"},
    {"name": "Ridge Link UI", "protocol": "TCP", "port": "8000"},
]


def setup_firewall() -> None:
    """Add Windows Firewall rules for Ridge-Link ports."""
    print("Setting up firewall rules...")
    if os.name != "nt":
        print("Non-Windows detected. Please ensure ports 5000, 5001, 8000, 8081, 9600 are open.")
        return

    for rule in FIREWALL_RULES:
        subprocess.run(
            [
                "netsh", "advfirewall", "firewall", "add", "rule",
                f'name="{rule["name"]}"', "dir=in", "action=allow",
                f'protocol={rule["protocol"]}', f'localport={rule["port"]}',
            ],
            check=False,
        )


def setup_venv() -> None:
    """Create a virtual environment and install packages in dev mode."""
    venv_dir = os.path.join(os.getcwd(), "venv")
    if not os.path.exists(venv_dir):
        print("Creating virtual environment...")
        subprocess.run([sys.executable, "-m", "venv", venv_dir], check=True)

    # Use the venv python
    if os.name == "nt":
        pip = os.path.join(venv_dir, "Scripts", "pip.exe")
    else:
        pip = os.path.join(venv_dir, "bin", "pip")

    print("Installing shared package...")
    subprocess.run([pip, "install", "-e", "shared/"], check=True)


def main() -> None:
    print("=== Ridge-Link Bootstrap v2.0 ===")
    role = input("Is this the Admin PC or a Racing Rig? (admin/rig): ").strip().lower()

    if role == "admin":
        print("\nConfiguring Admin PC...")
        master_folder = r"C:\RidgeContent"
        if os.name == "nt" and not os.path.exists(master_folder):
            os.makedirs(master_folder)
            print(f"Created Master Content Folder at {master_folder}")

        setup_firewall()
        setup_venv()

        # Install orchestrator
        if os.name == "nt":
            pip = os.path.join("venv", "Scripts", "pip.exe")
        else:
            pip = os.path.join("venv", "bin", "pip")
        subprocess.run([pip, "install", "-e", "apps/orchestrator/"], check=False)

        print("\nSetup Complete.")
        print("Share 'C:\\RidgeContent' on the network as 'RidgeContent'.")
        print("Run: python apps/orchestrator/main.py")

    elif role == "rig":
        rig_id = socket.gethostname().upper()
        print(f"\nConfiguring Rig: {rig_id}")

        setup_firewall()
        setup_venv()

        # Install sled
        if os.name == "nt":
            pip = os.path.join("venv", "Scripts", "pip.exe")
        else:
            pip = os.path.join("venv", "bin", "pip")
        subprocess.run([pip, "install", "-e", "apps/sled/"], check=False)

        print("\nSetup Complete.")
        print("Run: python apps/sled/main.py")

    else:
        print("Invalid role. Use 'admin' or 'rig'.")


if __name__ == "__main__":
    main()
