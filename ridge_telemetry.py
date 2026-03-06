import ac
import acsys
from sim_info import info

def acMain(ac_version):
    appWindow = ac.newApp("Ridge Telemetry")
    ac.setSize(appWindow, 200, 200)
    
    # Create labels for the UI
    global speedLabel, gLabel
    speedLabel = ac.addLabel(appWindow, "Speed: 0 km/h")
    ac.setPosition(speedLabel, 10, 50)
    
    gLabel = ac.addLabel(appWindow, "G-Force: 0.0")
    ac.setPosition(gLabel, 10, 80)
    
    return "Ridge Telemetry"

def acUpdate(deltaT):
    # Fetch from info.physics (Shared Memory)
    # info.physics.speedKmh gives velocity
    # info.physics.accG gives a 3D vector for G-forces
    
    speed = info.physics.speedKmh
    g_force = info.physics.accG[0] # Lateral Gs
    
    ac.setText(speedLabel, "Speed: {:.1f} km/h".format(speed))
    ac.setText(gLabel, "G-Force: {:.2f}".format(g_force))