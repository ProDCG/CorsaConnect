import ac, acsys, json

def acMain(ac_version):
    ac.console("Ridge Link Bridge - Log Mode Active")
    return "Ridge Link"

def acUpdate(deltaT):
    try:
        data = {
            "packet_id": ac.getCarState(0, acsys.CS.LapCount),
            "gas": ac.getCarState(0, acsys.CS.Gas),
            "brake": ac.getCarState(0, acsys.CS.Brake),
            "gear": ac.getCarState(0, acsys.CS.Gear) - 1,
            "rpms": ac.getCarState(0, acsys.CS.RPM),
            "velocity": [ac.getCarState(0, acsys.CS.SpeedKMH), 0, 0],
            "gforce": [0, 0, 0],
            "status": 2, # Racing
            "completed_laps": ac.getCarState(0, acsys.CS.LapCount),
            "position": 0,
            "normalized_pos": ac.getCarState(0, acsys.CS.NormalizedSplinePosition)
        }
        # This will write to Documents/Assetto Corsa/logs/py_log.txt
        ac.console("RIDGELINK:" + json.dumps(data))
    except:
        pass
