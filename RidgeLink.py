import ac, acsys, os, sys

# --- 1. THE ZIP FIX: SEARCH FOR PYTHON33.ZIP ---
def setup_paths():
    try:
        # Find AC Root starting from apps/python/RidgeLink/RidgeLink.py
        # Up 4 levels: RidgeLink -> python -> apps -> AC Root
        ac_root = os.path.dirname(__file__)
        for _ in range(3): ac_root = os.path.dirname(ac_root)
        
        # Path to the zip file you found
        zip_path = os.path.join(ac_root, 'system', 'x86', 'python33.zip')
        dll_dir = os.path.join(ac_root, 'system', 'x86')
        
        # Add the zip and the DLL folder to the search path
        if os.path.exists(zip_path) and zip_path not in sys.path:
            sys.path.append(zip_path)
        if os.path.exists(dll_dir) and dll_dir not in sys.path:
            sys.path.append(dll_dir)
            
        ac.log("RidgeLink: Added library path: " + zip_path)
    except Exception as e:
        ac.log("RidgeLink Path Error: " + str(e))

setup_paths()

# --- 2. NOW WE CAN IMPORT ---
try:
    import socket
    import json
    # Initialize UDP socket (non-blocking)
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    SOCKET_OK = True
except Exception as e:
    ac.log("RidgeLink Import Error: " + str(e))
    SOCKET_OK = False

# --- 3. CONFIGURATION ---
UDP_IP = "127.0.0.1"
UDP_PORT = 9996
UPDATE_HZ = 0.1 # 10 times per second
TIMER = 0

def acMain(ac_version):
    if not SOCKET_OK:
        ac.log("RidgeLink ERROR: Still could not find 'socket' library.")
    else:
        ac.log("RidgeLink: Python UDP Bridge is LIVE.")
    return "RidgeLink"

def acUpdate(deltaT):
    global TIMER
    if not SOCKET_OK: return
    
    TIMER += deltaT
    if TIMER < UPDATE_HZ: return
    TIMER = 0
    
    try:
        data = {
            "packet_id": ac.getCarState(0, acsys.CS.LapCount),
            "gas": ac.getCarState(0, acsys.CS.Gas),
            "brake": ac.getCarState(0, acsys.CS.Brake),
            "gear": ac.getCarState(0, acsys.CS.Gear) - 1, # -1 for Reverse
            "rpms": int(ac.getCarState(0, acsys.CS.RPM)),
            "velocity": [ac.getCarState(0, acsys.CS.SpeedKMH), 0, 0],
            "gforce": [0, 0, 0],
            "status": 2, # Racing
            "completed_laps": ac.getCarState(0, acsys.CS.LapCount),
            "position": 0,
            "normalized_pos": ac.getCarState(0, acsys.CS.NormalizedSplinePosition)
        }
        
        # Send via UDP (No blocking, no lag)
        msg = json.dumps(data).encode('utf-8')
        sock.sendto(msg, (UDP_IP, UDP_PORT))
    except:
        pass
