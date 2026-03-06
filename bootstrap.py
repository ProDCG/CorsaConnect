import os
import socket
import subprocess
import sys

def setup_firewall():
    print("Setting up firewall rules...")
    if os.name == 'nt':
        # Assetto Corsa Ports
        subprocess.run(['netsh', 'advfirewall', 'firewall', 'add', 'rule', 'name="Ridge AC UDP"', 'dir=in', 'action=allow', 'protocol=UDP', 'localport=9600'], check=False)
        subprocess.run(['netsh', 'advfirewall', 'firewall', 'add', 'rule', 'name="Ridge AC TCP"', 'dir=in', 'action=allow', 'protocol=TCP', 'localport=9600'], check=False)
        subprocess.run(['netsh', 'advfirewall', 'firewall', 'add', 'rule', 'name="Ridge AC HTTP"', 'dir=in', 'action=allow', 'protocol=TCP', 'localport=8081'], check=False)
        # Ridge Link Ports
        subprocess.run(['netsh', 'advfirewall', 'firewall', 'add', 'rule', 'name="Ridge Link Heartbeat"', 'dir=in', 'action=allow', 'protocol=UDP', 'localport=5001'], check=False)
        subprocess.run(['netsh', 'advfirewall', 'firewall', 'add', 'rule', 'name="Ridge Link Command"', 'dir=in', 'action=allow', 'protocol=TCP', 'localport=5000'], check=False)
    else:
        print("Non-Windows detected. Please ensure ports 5000, 5001, 8000, and 9600 are open.")

def main():
    print("=== Ridge Racing Simulator Bootstrap ===")
    role = input("Is this the Admin PC or a Racing Rig? (admin/rig): ").strip().lower()

    if role == 'admin':
        print("\nConfiguring Admin PC...")
        master_folder = r"C:\RidgeContent"
        if not os.path.exists(master_folder):
            os.makedirs(master_folder)
            print(f"Created Master Content Folder at {master_folder}")
        
        setup_firewall()
        print("\nSetup Complete. Please share 'C:\\RidgeContent' on the network as 'RidgeContent'.")
        print("Run 'python main.py' in ridge-link-orchestrator/backend to start the controller.")

    elif role == 'rig':
        rig_id = socket.gethostname().upper()
        print(f"\nConfiguring Rig: {rig_id}")
        
        setup_firewall()
        
        # In a real scenario, we'd install dependencies here
        # subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        
        print("\nSetup Complete.")
        print("Run 'python sled.py' in ridge-link-sled to start the satellite agent.")
    
    else:
        print("Invalid role selected.")

if __name__ == "__main__":
    main()
