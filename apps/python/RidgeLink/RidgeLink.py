import os
import sys
import platform
import ac
import acsys

# --- 1. ROBUST LIBRARY IMPORT (As per AC-SimInfo instructions) ---
try:
    # Assetto Corsa's Python doesn't include _ctypes, so we load it from third_party
    if platform.architecture()[0] == "64bit":
        sysdir = "stdlib64"
    else:
        sysdir = "stdlib"
        
    # Add third_party to path
    # We assume RidgeLink is in assettocorsa/apps/python/RidgeLink/
    # And third_party is in assettocorsa/apps/python/third_party/
    sys.path.insert(len(sys.path), 'apps/python/third_party')
    os.environ['PATH'] += ";."
    sys.path.insert(len(sys.path), os.path.join('apps/python/third_party', sysdir))
    os.environ['PATH'] += ";."
    
    from sim_info import info
    LIBRARY_OK = True
except Exception as e:
    ac.log("RidgeLink [ERROR] Error importing libraries: %s" % e)
    LIBRARY_OK = False

# --- 2. UDP SOCKET SETUP ---
try:
    import socket
    import json
    # Use non-blocking UDP for performance
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    UDP_OK = True
except Exception as e:
    ac.log("RidgeLink [ERROR] Socket setup failed: %s" % e)
    UDP_OK = False

# --- 3. CONFIGURATION ---
UDP_IP = "127.0.0.1"
UDP_PORT = 9996
SEND_INTERVAL = 0.1 # 10Hz
timer = 0

# UI Globals
speedLabel = None
rpmLabel = None
gearLabel = None

def acMain(ac_version):
    global speedLabel, rpmLabel, gearLabel
    
    appWindow = ac.newApp("Ridge Link")
    ac.setSize(appWindow, 200, 150)
    
    ac.log("RidgeLink: App Initialized")
    
    # Simple UI for rig health check
    speedLabel = ac.addLabel(appWindow, "Speed: 0 km/h")
    ac.setPosition(speedLabel, 10, 40)
    
    rpmLabel = ac.addLabel(appWindow, "RPM: 0")
    ac.setPosition(rpmLabel, 10, 70)
    
    gearLabel = ac.addLabel(appWindow, "Gear: N")
    ac.setPosition(gearLabel, 10, 100)
    
    if not LIBRARY_OK:
        ac.setText(speedLabel, "ERROR: SimInfo missing")
    
    return "Ridge Link"

def acUpdate(deltaT):
    global timer
    if not LIBRARY_OK: return
    
    # Update UI every frame
    speed = info.physics.speedKmh
    rpms = info.physics.rpms
    gear = info.physics.gear - 1 # AC Shared Memory: 0=R, 1=N, 2=1...
    
    gear_text = "N"
    if gear == -1: gear_text = "R"
    elif gear > 0: gear_text = str(gear)
    
    ac.setText(speedLabel, "Speed: {:.1f} km/h".format(speed))
    ac.setText(rpmLabel, "RPM: {}".format(int(rpms)))
    ac.setText(gearLabel, "Gear: {}".format(gear_text))
    
    # Send UDP Telemetry at throttled interval
    timer += deltaT
    if timer < SEND_INTERVAL: return
    timer = 0
    
    if UDP_OK:
        try:
            # Build payload matching the Ridge Dashboard schema
            payload = {
                "packet_id": info.physics.packetId,
                "gas": round(info.physics.gas, 3),
                "brake": round(info.physics.brake, 3),
                "gear": gear,
                "rpms": int(rpms),
                "velocity": [round(v * 3.6, 1) for v in info.physics.velocity], # Convert m/s to km/h
                "gforce": [round(g, 2) for g in info.physics.accG],
                "status": info.graphics.status,
                "completed_laps": info.graphics.completedLaps,
                "position": info.graphics.position,
                "normalized_pos": round(info.graphics.normalizedCarPosition, 4)
            }
            
            msg = json.dumps(payload).encode('utf-8')
            sock.sendto(msg, (UDP_IP, UDP_PORT))
        except:
            pass # Prevent game freezing if network blips
