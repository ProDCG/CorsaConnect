import re
import os

with open("apps/orchestrator/frontend/src/App.tsx", "r") as f:
    content = f.read()

# 1. Add CarPreset interface
interface = """interface CarPreset {
    id: string
    name: string
    cars: string[]
}

interface Rig {"""
content = content.replace("interface Rig {", interface)

# 2. Add state variables
state_vars = """    const [presets, setPresets] = useState<any[]>([])
    const [carPresets, setCarPresets] = useState<CarPreset[]>([])
    const [selectedCarPresetId, setSelectedCarPresetId] = useState<string | null>(null)"""
content = content.replace("    const [presets, setPresets] = useState<any[]>([])", state_vars)

# 3. Add fetch logic
fetch_presets = """        const fetchPresets = async () => {
            try {
                const res = await fetch('/api/presets')
                if (!res.ok) return
                const data = await res.json()
                if (Array.isArray(data)) setPresets(data)
            } catch { /* offline */ }
        }

        const fetchCarPresets = async () => {
            try {
                const res = await fetch('/api/car_presets')
                if (!res.ok) return
                const data = await res.json()
                if (Array.isArray(data)) setCarPresets(data)
            } catch { /* offline */ }
        }"""
content = content.replace("""        const fetchPresets = async () => {
            try {
                const res = await fetch('/api/presets')
                if (!res.ok) return
                const data = await res.json()
                if (Array.isArray(data)) setPresets(data)
            } catch { /* offline */ }
        }""", fetch_presets)

# 4. Add to useEffect
use_effect = """        fetchTelemConfig()
        fetchPresets()
        fetchCarPresets()"""
content = content.replace("""        fetchTelemConfig()
        fetchPresets()""", use_effect)

# 5. Modify toggleCarInPool
toggle = """    const toggleCarInPool = async (carId: string) => {
        if (selectedCarPresetId) {
            const preset = carPresets.find(p => p.id === selectedCarPresetId)
            if (!preset) return
            const newCars = preset.cars.includes(carId)
                ? preset.cars.filter(id => id !== carId)
                : [...preset.cars, carId]
            
            const updatedPresets = carPresets.map(p => p.id === selectedCarPresetId ? { ...p, cars: newCars } : p)
            setCarPresets(updatedPresets)
            try {
                await fetch('/api/car_presets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedPresets)
                })
            } catch {}
        } else {
            const newPool = activeCarPool.includes(carId)
                ? activeCarPool.filter((id: string) => id !== carId)
                : [...activeCarPool, carId]

            setActiveCarPool(newPool)
            try {
                await fetch('/api/carpool', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cars: newPool })
                })
            } catch {}
        }
    }"""
content = re.sub(r"    const toggleCarInPool = async \(carId: string\) => \{.*?\n    \}", toggle, content, flags=re.DOTALL)

with open("apps/orchestrator/frontend/src/App.tsx", "w") as f:
    f.write(content)
