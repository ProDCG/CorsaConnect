import re
import os

with open("apps/orchestrator/frontend/src/App.tsx", "r") as f:
    content = f.read()

# Replace activeCarPool in the UI with a helper variable
ui_replacement = """                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h2 className="text-xl font-black italic uppercase">Fleet Authorization & Presets</h2>
                                    <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Enable or disable cars available across all groups or manage presets</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <select 
                                        className="bg-black border border-white/10 rounded-xl px-4 py-2 text-sm font-bold uppercase"
                                        value={selectedCarPresetId || ""}
                                        onChange={(e) => setSelectedCarPresetId(e.target.value || null)}
                                    >
                                        <option value="">Global Active Pool</option>
                                        {carPresets.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => {
                                            const name = prompt("Enter preset name:");
                                            if (name) {
                                                const newPresets = [...carPresets, { id: Math.random().toString(36).substring(7), name, cars: [] }];
                                                setCarPresets(newPresets);
                                                fetch('/api/car_presets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newPresets) });
                                            }
                                        }}
                                        className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border bg-white/5 border-white/10 text-white/50 hover:border-ridge-brand/50 hover:text-ridge-brand"
                                    >
                                        New Preset
                                    </button>
                                    {selectedCarPresetId && (
                                        <>
                                            <button
                                                onClick={() => {
                                                    const newPresets = carPresets.filter(p => p.id !== selectedCarPresetId);
                                                    setSelectedCarPresetId(null);
                                                    setCarPresets(newPresets);
                                                    fetch('/api/car_presets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newPresets) });
                                                }}
                                                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border bg-red-500/10 border-red-500/20 text-red-500 hover:border-red-500 hover:text-white"
                                            >
                                                Delete Preset
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    const preset = carPresets.find(p => p.id === selectedCarPresetId);
                                                    if (preset) {
                                                        setActiveCarPool(preset.cars);
                                                        try {
                                                            await fetch('/api/carpool', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ cars: preset.cars })
                                                            })
                                                        } catch {}
                                                    }
                                                }}
                                                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border bg-ridge-brand/20 border-ridge-brand/50 text-white hover:bg-ridge-brand/40"
                                            >
                                                Apply to Global Pool
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={async () => {
                                            const allIds = (catalogCars.length > 0 ? catalogCars : ALL_CARS).map(c => c.id)
                                            const currentPool = selectedCarPresetId ? (carPresets.find(p => p.id === selectedCarPresetId)?.cars || []) : activeCarPool;
                                            const allSelected = allIds.every(id => currentPool.includes(id))
                                            const newPool = allSelected ? [] : allIds
                                            
                                            if (selectedCarPresetId) {
                                                const updatedPresets = carPresets.map(p => p.id === selectedCarPresetId ? { ...p, cars: newPool } : p)
                                                setCarPresets(updatedPresets)
                                                try {
                                                    await fetch('/api/car_presets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedPresets) })
                                                } catch {}
                                            } else {
                                                setActiveCarPool(newPool)
                                                try {
                                                    await fetch('/api/carpool', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cars: newPool }) })
                                                } catch {}
                                            }
                                        }}
                                        className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border bg-white/5 border-white/10 text-white/50 hover:border-ridge-brand/50 hover:text-ridge-brand"
                                    >
                                        {((catalogCars.length > 0 ? catalogCars : ALL_CARS).map(c => c.id)).every(id => (selectedCarPresetId ? (carPresets.find(p => p.id === selectedCarPresetId)?.cars || []) : activeCarPool).includes(id)) ? 'Deselect All' : 'Select All'}
                                    </button>
                                    <div className="text-right">
                                        <p className="text-xs font-black uppercase text-white/40">{selectedCarPresetId ? 'Preset Cars' : 'Authorized'}</p>
                                        <p className="text-2xl font-black italic text-ridge-brand">{(selectedCarPresetId ? (carPresets.find(p => p.id === selectedCarPresetId)?.cars || []) : activeCarPool).length} / {catalogCars.length || ALL_CARS.length}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {(catalogCars.length > 0 ? catalogCars : ALL_CARS.map(c => ({...c, brand: '', car_class: ''}))).map((car) => {
                                    const isSelected = (selectedCarPresetId ? (carPresets.find(p => p.id === selectedCarPresetId)?.cars || []) : activeCarPool).includes(car.id);
                                    return (
                                    <button
                                        key={car.id}
                                        onClick={() => toggleCarInPool(car.id)}
                                        className={`group text-left p-4 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between h-32 ${isSelected
                                            ? 'bg-ridge-brand/10 border-ridge-brand/50 text-white'
                                            : 'bg-white/5 border-white/5 text-white/20'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <Car size={32} className={`transition-all ${isSelected ? 'text-ridge-brand' : 'opacity-20'}`} />
                                            {isSelected ? <Check className="text-ridge-brand" size={16} /> : <Zap size={16} className="opacity-10" />}
                                        </div>
                                        <div>
                                            {car.brand && <span className="text-[8px] font-bold uppercase text-white/30 block">{car.brand}</span>}
                                            <span className={`font-black italic uppercase text-xs tracking-tighter ${isSelected ? 'text-white' : 'group-hover:text-white/40 transition-colors'}`}>{car.name}</span>
                                        </div>
                                        {isSelected && <div className="absolute -right-2 -bottom-2 w-12 h-12 bg-ridge-brand/20 blur-xl rounded-full" />}
                                    </button>
                                )})}
                            </div>"""
                            
content = re.sub(r'                            <div className="flex items-center justify-between mb-8">.*?</div>\n                        </div>', ui_replacement + "\n                        </div>", content, flags=re.DOTALL)

with open("apps/orchestrator/frontend/src/App.tsx", "w") as f:
    f.write(content)
