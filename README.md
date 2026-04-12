# CorsaConnect - Facility Reinstallation Guide

This document covers the **exact process** to compile the CorsaConnect v2 tools and redeploy them across your facility without losing any historical data (like leaderboards or rig configurations). 

## Prerequisites (Build PC only)

To compile the actual executables, the PC performing the compile (usually your Admin PC) needs:
1. **Python 3.11+** installed (`pip install nuitka zstandard`)
2. **Node.js 18+** installed.
3. **Inno Setup 6** installed (must be added to your Windows PATH if you want to use the `iscc` compiler from the command line).
4. **Visual Studio C++ Build Tools** installed (required by Nuitka to compile python code into `.exe` binaries).

---

## Step 1: Compile the Installers

Open your terminal or Powershell in the `CorsaConnect` repository folder and run the following exactly in order:

```powershell
# 1. Pull down the latest v2.1 code containing the AppData migrations & fixes
git pull

# 2. Build the React Frontend dashboard
cd apps/orchestrator/frontend
npm install
npm run build
cd ../../../

# 3. Build the Nuitka Executables for the Sled and Orchestrator
python deploy/build_orchestrator.py
python deploy/build_sled.py

# 4. Generate the distributable Windows Installers
iscc deploy/setup_orchestrator.iss
iscc deploy/setup_sled.iss
```

> **Result:** You will find `CorsaConnect-Orchestrator-Setup.exe` and `CorsaConnect-Sled-Setup.exe` sitting in your `build\installer\` folder!

---

## Step 2: Deploying the Admin PC (Orchestrator)

1. Run **`CorsaConnect-Orchestrator-Setup.exe`** on the Admin PC.
2. The installation will cleanly establish the software in your Program Files and place a launch shortcut on your desktop.
3. **ZERO-TOUCH DATA MIGRATION:** The very first time you boot the Orchestrator via the shortcut, the underlying engine will automatically hunt down your legacy `projects/CorsaConnect/data` folder. It safely copies `leaderboard.db` and your group settings over into the new, permanent Windows `%APPDATA%\CorsaConnect` folder. 
4. *Do not move your database manually. It is entirely handled by the system.*

---

## Step 3: Deploying the Rigs (Sled PCs)

1. Put the **`CorsaConnect-Sled-Setup.exe`** installer on a USB thumb drive or your `\\ADMIN-PC\RidgeContent` network share.
2. Run the installer on every racing rig in the facility. 
3. **ZERO-TOUCH DATA MIGRATION:** The Sled's configuration script automatically locates the old `config.json` that used to sit adjacent to your executable, and ports it permanently into the rig's `%APPDATA%\CorsaConnect\config.json`.
4. **Setup Wizard:** If the installer does *not* detect an old config (for instance, on a brand new chassis), the installer wizard will elegantly prompt you to enter the Admin IP and the Rig's explicit name (e.g., `RIG-04`) during the setup phase! It automatically stores those answers to the AppData folder securely.

### That's it! 
You can now start CorsaConnect on the Admin PC via your desktop shortcut and navigate to your dashboard as normal. Your leaderboards, rig identities, and Sled configurations are all strictly preserved. 

---

## Quick Reference / Developer Architecture

```text
/corsa (monorepo root)
├── /apps
│   ├── /orchestrator     ← FastAPI backend + React dashboard
│   └── /sled             ← Rig agent / AC Game Launcher
├── /deploy               ← Installer generators & Build pipelines
├── Makefile              ← Dev commands
└── README.md             ← (You are here)
```
