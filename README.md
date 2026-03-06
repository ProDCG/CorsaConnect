# Ridge-Link: Facility Orchestration System (Windows Deployment Guide)

Ridge-Link is a high-performance, distributed management system built to control 10+ Assetto Corsa racing rigs from a single Admin console. This system is designed specifically for **Windows-powered racing facilities**.

## 1. Prerequisites (All Machines)

-   **Python 3.11+**: [Download from python.org](https://www.python.org/downloads/windows/). Ensure "Add Python to PATH" is checked during installation.
-   **Assetto Corsa**: Installed at `C:\AssettoCorsa` (default local path defined in `sled.py`).
-   **Local Area Network**: All machines must be on the same subnet (e.g., 192.168.1.x).

---

## 2. Admin PC Setup (The Hub)

The Admin PC acts as the "Master" and hosts all game content.

1.  **Run Bootstrap**:
    Open a terminal as **Administrator** and run:
    ```powershell
    python bootstrap.py
    ```
    Select `admin`. This will create `C:\RidgeContent` and open the firewall.

2.  **Share Content Folder (SMB)**:
    -   Right-click `C:\RidgeContent` -> Properties -> Sharing -> Advanced Sharing.
    -   Check "Share this folder".
    -   Click "Permissions" and ensure "Everyone" has **Read** access.
    -   **Important**: The network path must be reachable as `\\ADMIN-PC\RidgeContent`. If your Admin PC has a different name, update `ADMIN_SHARED_FOLDER` in `sled.py`.

3.  **Start the Controller**:
    ```powershell
    cd ridge-link-orchestrator/backend
    pip install .
    python main.py
    ```

---

## 3. Racing Rig Setup (The Sleds)

Repeat these steps for every simulator rig.

1.  **Run Bootstrap**:
    Open a terminal as **Administrator**:
    ```powershell
    python bootstrap.py
    ```
    Select `rig`.

2.  **Start the Agent**:
    ```powershell
    cd ridge-link-sled
    pip install .
    python sled.py
    ```
    The Rig will instantly appear on the Admin Dashboard.

---

## 4. Testing on Actual Hardware

Once the software is running, follow this validation flow:

1.  **Discovery Check**: Open the Admin Dashboard. You should see a card for every rig that has `sled.py` running.
2.  **Branding Check**: Verify that the rig is showing the "Ridge Racing" splash screen (Kiosk Mode).
3.  **Sync Test**: Put a small text file in `C:\RidgeContent` on the Admin PC. Click "Start All" on the dashboard. Verify the file appears in `C:\AssettoCorsa` on the rig via Robocopy.
4.  **Process Test**: Verify that the Kiosk screen disappears and a dummy process (or AC) launches. Verify "Global Reset" kills the process and restores the Kiosk screen.

---

## 5. Compiling to Executables (Optional)

To avoid showing a console window to staff/customers, compile the scripts:

1.  **Install PyInstaller**: `pip install pyinstaller`
2.  **Compile Sled**:
    ```powershell
    cd ridge-link-sled
    pyinstaller --noconsole --onefile --add-data "assets;assets" sled.py
    ```
3.  **Compile Orchestrator**:
    ```powershell
    cd ridge-link-orchestrator/backend
    pyinstaller --noconsole --onefile main.py
    ```
    *Note: The frontend dashboard should be hosted via a web server or kept as a Vite dev process for speed tonight.*

---

## 6. Troubleshooting
-   **Rigs not appearing?** Check if the Admin PC can ping the Rig and vice versa. Ensure UDP port 5001 is not blocked by a third-party antivirus.
-   **Robocopy failing?** Try accessing `\\ADMIN-PC\RidgeContent` manually via Windows Explorer on the Rig. If it asks for a password, you may need to disable "Password protected sharing" in Windows Network and Sharing Center.
