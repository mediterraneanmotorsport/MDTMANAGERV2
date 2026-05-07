import sys
import json
import time
import ctypes

try:
    sys.path.append(r'C:\Users\Rescate\Downloads\pyLMUSharedMemory-e5781c61162c8b0751c8a560e1cf9374381b724d\pyLMUSharedMemory-e5781c61162c8b0751c8a560e1cf9374381b724d')
    from lmu_mmap import MMapControl
    from lmu_data import LMUObjectOut, LMUConstants

    info = MMapControl(LMUConstants.LMU_SHARED_MEMORY_FILE, LMUObjectOut)
    info.create(1)
except Exception as e:
    print(json.dumps({"error": str(e)}), flush=True)
    sys.exit(1)

while True:
    try:
        info.update()
        data = info.data
        
        vehicles = []
        num_vehicles = data.scoring.scoringInfo.mNumVehicles
        
        for i in range(min(num_vehicles, 104)):
            score = data.scoring.vehScoringInfo[i]
            telem = data.telemetry.telemInfo[i]
            
            drv_name = score.mDriverName.decode('utf-8', 'ignore').strip()
            if not drv_name: continue
            
            wheels = []
            for w in range(4):
                wheel = telem.mWheels[w]
                wheels.append({
                    "temp": [float(wheel.mTemperature[0]) - 273.15, float(wheel.mTemperature[1]) - 273.15, float(wheel.mTemperature[2]) - 273.15],
                    "wear": float(wheel.mWear),
                })
            
            vehicles.append({
                "name": drv_name,
                "gear": telem.mGear,
                "rpm": int(telem.mEngineRPM),
                "maxRpm": int(telem.mEngineMaxRPM),
                "throttle": float(telem.mUnfilteredThrottle),
                "brake": float(telem.mUnfilteredBrake),
                "energy": float(telem.mVirtualEnergy) * 100.0 if float(telem.mVirtualEnergy) > 0 else 0.0,
                "fuel": (int(score.mFuelFraction) / 255.0) * 100.0,
                "isPlayer": score.mIsPlayer == 1,
                "mgukState": int(telem.mElectricBoostMotorState),
                "wheels": wheels
            })
            
        print(json.dumps({"type": "telemetry", "data": vehicles}), flush=True)
        time.sleep(0.05) # 20fps for responsive telemetry without overloading node
    except Exception as e:
        print(json.dumps({"error": str(e)}), flush=True)
        time.sleep(1.0)
