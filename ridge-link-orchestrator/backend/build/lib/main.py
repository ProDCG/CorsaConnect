import socket
import threading
import json
import time
from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
from typing import Dict, Optional

app = FastAPI(title="Ridge-Link Orchestrator")

# Default Configuration
CONFIG = {
    "heartbeat_port": 5001,
    "command_port": 5000,
    "ui_port": 8000
}

# Load local config if exists
if os.path.exists("config.json"):
    try:
        with open("config.json", "r") as f:
            CONFIG.update(json.load(f))
    except:
        pass

# In-memory store for rig states
rigs: Dict[str, dict] = {}

class Command(BaseModel):
    rig_id: str
    action: str
    track: Optional[str] = None
    car: Optional[str] = None
    session_time: Optional[int] = None
    server_ip: Optional[str] = None

@app.get("/rigs")
async def get_rigs():
    return list(rigs.values())

@app.post("/command")
async def send_command(command: Command, background_tasks: BackgroundTasks):
    rig = rigs.get(command.rig_id)
    if not rig:
        return {"status": "error", "message": "Rig not found"}
    
    # In a real scenario, we'd send a TCP packet or HTTP request to the Sled
    # For now, we simulate the "Mission Packet" launch
    ip = rig["ip"]
    port = CONFIG["command_port"]
    
    background_tasks.add_task(dispatch_command, ip, port, command.model_dump())
    return {"status": "success", "message": f"Command sent to {command.rig_id}"}

def dispatch_command(ip: str, port: int, payload: dict):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(2.0)
            s.connect((ip, port))
            s.sendall(json.dumps(payload).encode('utf-8'))
    except Exception as e:
        print(f"Failed to send command to {ip}: {e}")

def udp_heartbeat_listener():
    """Listens for UDP broadasts from Rig Sleds"""
    UDP_IP = "0.0.0.0"
    UDP_PORT = CONFIG["heartbeat_port"]
    
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind((UDP_IP, UDP_PORT))
    
    print(f"UDP Heartbeat Listener started on port {UDP_PORT}")
    
    while True:
        try:
            data, addr = sock.recvfrom(1024)
            payload = json.loads(data.decode('utf-8'))
            
            rig_id = payload.get("rig_id")
            if rig_id:
                rigs[rig_id] = {
                    "rig_id": rig_id,
                    "ip": addr[0],
                    "status": payload.get("status", "unknown"),
                    "cpu_temp": payload.get("cpu_temp", 0),
                    "mod_version": payload.get("mod_version", "unknown"),
                    "last_seen": time.time()
                }
        except Exception as e:
            print(f"Error in UDP listener: {e}")

# Start the UDP listener in a background thread
threading.Thread(target=udp_heartbeat_listener, daemon=True).start()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=CONFIG["ui_port"])
