import re

with open("apps/orchestrator/frontend/src/components/GroupManager.tsx", "r") as f:
    content = f.read()

# 1. Add carPresets state
state_vars = """    const [weather, setWeather] = useState<CatalogWeather[]>([])
    const [carPresets, setCarPresets] = useState<any[]>([])"""
content = content.replace("    const [weather, setWeather] = useState<CatalogWeather[]>([])", state_vars)

# 2. Fetch car presets
fetch_presets = """            setWeather(data.weather || [])
            
            const presetRes = await fetch('/api/car_presets')
            if (presetRes.ok) {
                const presetData = await presetRes.json()
                if (Array.isArray(presetData)) setCarPresets(presetData)
            }"""
content = content.replace("            setWeather(data.weather || [])", fetch_presets)

# 3. Add UI for applying preset and assigning a single car to all rigs
ui_injection = """                            {/* Group Car Preset & Bulk Assign */}
                            <div className="flex gap-4 mb-4 mt-2">
                                <div className="flex-1 bg-white/5 p-3 rounded-xl border border-white/10">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-white/50 block mb-2">Apply Car Preset to Group</label>
                                    <div className="flex gap-2">
                                        <select
                                            className="bg-black border border-white/10 rounded-lg px-2 py-1 text-xs font-bold w-full"
                                            onChange={async (e) => {
                                                if (!e.target.value) return;
                                                const preset = carPresets.find(p => p.id === e.target.value);
                                                if (preset) {
                                                    await updateGroup(selectedGroup.id, { car_pool: preset.cars });
                                                    e.target.value = "";
                                                }
                                            }}
                                        >
                                            <option value="">-- Select Preset --</option>
                                            {carPresets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex-1 bg-white/5 p-3 rounded-xl border border-white/10">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-white/50 block mb-2">Assign Car to All Rigs</label>
                                    <div className="flex gap-2">
                                        <select
                                            className="bg-black border border-white/10 rounded-lg px-2 py-1 text-xs font-bold w-full"
                                            onChange={async (e) => {
                                                if (!e.target.value) return;
                                                await fetch(`/api/groups/${selectedGroup.id}/select_car`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ car: e.target.value })
                                                });
                                                e.target.value = "";
                                                fetchGroups();
                                            }}
                                        >
                                            <option value="">-- Select Car --</option>
                                            {(() => {
                                                let enabledCars = activeCarPool.length > 0 ? cars.filter(c => activeCarPool.includes(c.id)) : cars;
                                                if (selectedGroup.car_pool && selectedGroup.car_pool.length > 0) {
                                                    enabledCars = cars.filter(c => selectedGroup.car_pool.includes(c.id));
                                                }
                                                return enabledCars.map(c => <option key={c.id} value={c.id}>{c.name}</option>);
                                            })()}
                                        </select>
                                    </div>
                                </div>
                            </div>
"""
# We'll inject this right above {/* Car Filters */} which is around line 727
content = content.replace("{/* Car Filters */}", ui_injection + "                            {/* Car Filters */}")

with open("apps/orchestrator/frontend/src/components/GroupManager.tsx", "w") as f:
    f.write(content)
