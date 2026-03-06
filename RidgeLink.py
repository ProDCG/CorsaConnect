import ac, acsys, os, sys

# --- 1. THE PATH FIX ---
def setup_paths():
    try:
        # Get the directory where THIS file is located
        plugin_dir = os.path.dirname(__file__)
        
        # Go up 4 levels to get to the Assetto Corsa Root
        # 1: RidgeLink -> 2: python -> 3: apps -> 4: AC Root
        ac_root = plugin_dir
        for _ in range(4):
            ac_root = os.path.dirname(ac_root)
        
        # Construct path to the zip you found
        zip_path = os.path.join(ac_root, 'system', 'x86', 'python33.zip')
        dll_path = os.path.join(ac_root, 'system', 'x86')
        
        # Verify and add to sys.path
        if os.path.exists(zip_path):
            if zip_path not in sys.path:
                sys.path.insert(0, zip_path) # Insert at start to override
            ac.log("RidgeLink: SUCCESS! Found zip at: " + zip_path)
        else:
            ac.log("RidgeLink ERROR: Could not find zip at " + zip_path)
            
        if os.path.exists(dll_path) and dll_path not in sys.path:
            sys.path.insert(0, dll_path)
            
    except Exception as e:
        ac.log("RidgeLink Path Logic Error: " + str(e))

setup_paths()

# --- 2. IMPORT AFTER PATHS ARE SET ---
try:
    import socket
    import json
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    SOCKET_OK = True
except Exception as e:
    ac.log("RidgeLink IMPORT ERROR: " + str(e))
    SOCKET_OK = False

# --- 3. LOGIC ---
UDP_IP = "127.0.0.1"
UDP_PORT = 9996
UPDATE_HZ = 0.1
TIMER = 0

def acMain(ac_version):
    if not SOCKET_OK:
        ac.log("RidgeLink: Plugin loaded but SOCKET was NOT found.")
    else:
        ac.log("RidgeLink: Plugin loaded and SOCKET is active.")
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
            "gear": ac.getCarState(0, acsys.CS.Gear) - 1,
            "rpms": int(ac.getCarState(0, acsys.CS.RPM)),
            "velocity": [ac.getCarState(0, acsys.CS.SpeedKMH), 0, 0],
            "gforce": [0, 0, 0],
            "status": 2,
            "completed_laps": ac.getCarState(0, acsys.CS.LapCount),
            "position": 0,
            "normalized_pos": ac.getCarState(0, acsys.CS.NormalizedSplinePosition)
        }
        
        msg = json.dumps(data).encode('utf-8')
        sock.sendto(msg, (UDP_IP, UDP_PORT))
    except:
        pass
