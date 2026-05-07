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
            
            vehicles.append({
                "name": drv_name,
                "energy": float(telem.mVirtualEnergy),
                "fuel": int(score.mFuelFraction)
            })
            
        print(json.dumps({"type": "energy", "data": vehicles}), flush=True)
        time.sleep(1.0)
    except Exception as e:
        print(json.dumps({"error": str(e)}), flush=True)
        time.sleep(1.0)
