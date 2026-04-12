# CorsaConnect - Facility Reinstallation Guide

This document covers the **exact process** to compile the CorsaConnect v2 tools and redeploy them across your facility without losing any historical data (like leaderboards or rig configurations). 

## Prerequisites (Build PC only)

To compile the actual executables, the PC performing the compile (usually your Admin PC) needs:
1. **Python 3.11+** installed (`pip install nuitka zstandard`)
2. **Node.js 18+** installed.
3. **Inno Setup 6** installed (must be added to your Windows PATH if you want to use the `iscc` compiler from the command line).
4. **Visual Studio C++ Build Tools** installed (required by Nuitka to compile python code into `.exe` binaries).

---

## Step 1: Get the Installers

The absolute easiest way to deploy is to let **GitHub Actions** compile everything for you automatically!

1. Because the `.github/workflows/build-release.yml` pipeline is installed, whenever you push a tag (e.g. `v2.2`), GitHub cloud servers will automatically compile the Nuitka `.exe` binaries and Inno Setup installers.
2. Wait a few minutes for the GitHub Action to finish.
3. Go to your repository's **Releases** page on GitHub.
4. Download the freshly built `CorsaConnect-Orchestrator-Setup.exe` and `CorsaConnect-Sled-Setup.exe`!

*(Advanced / Local Build)*
If you ever want to compile them manually on your Admin PC instead, you must install Python 3.11+, Node 18+, Inno Setup 6 (in PATH), and Visual Studio Build Tools. Then simply run `make build-all` and `iscc deploy/setup_sled.iss` from the project root. Your installers will be in the `build/installer/` directory.

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
