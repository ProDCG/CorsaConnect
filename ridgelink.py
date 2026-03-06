import ac, acsys, os, sys

# --- THE PATH FIXER ---
# This tells AC where its own system libraries are located
ac_root = os.path.dirname(__file__) + "/../../../"
python_lib = os.path.normpath(ac_root + "system/python/Lib")
python_dll = os.path.normpath(ac_root + "system/python/DLLs")

if python_lib not in sys.path: sys.path.append(python_lib)
if python_dll not in sys.path: sys.path.append(python_dll)

# Now we can safely import everything
import socket
import json

# Configuration
SLED_PORT = 9996
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

def acMain(ac_version):
    ac.log("Ridge Link Bridge - Path Fix Applied")
    return "Ridge Link"

def acUpdate(deltaT):
    try:
        # This runs every frame
        data = {
            "packet_id": ac.getCarState(0, acsys.CS.LapCount),
            "gas": ac.getCarState(0, acsys.CS.Gas),
            "brake": ac.getCarState(0, acsys.CS.Brake),
            "gear": ac.getCarState(0, acsys.CS.Gear) - 1,
            "rpms": ac.getCarState(0, acsys.CS.RPM),
            "velocity": [ac.getCarState(0, acsys.CS.SpeedKMH), 0, 0],
            "gforce": [ac.getCarState(0, acsys.CS.GVertical), ac.getCarState(0, acsys.CS.GLat), ac.getCarState(0, acsys.CS.GLon)],
            "status": 2, # Racing
            "completed_laps": ac.getCarState(0, acsys.CS.LapCount),
            "position": 0,
            "normalized_pos": ac.getCarState(0, acsys.CS.NormalizedSplinePosition)
        }
        
        msg = json.dumps(data).encode('utf-8')
        sock.sendto(msg, ("127.0.0.1", SLED_PORT))
    except:
        pass # Keep driving even if telemetry fails
