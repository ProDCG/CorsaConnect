import re

with open("apps/orchestrator/frontend/src/App.tsx", "r") as f:
    content = f.read()

# 1. Restore the Maps header
maps_header_original = """                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h2 className="text-xl font-black italic uppercase">Track Authorization</h2>
                                    <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Enable or disable tracks available across all groups</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={async () => {
                                            const allIds = catalogTracks.map(t => t.id)
                                            const allSelected = allIds.every(id => activeMapPool.includes(id))
                                            const newPool = allSelected ? [] : allIds
                                            setActiveMapPool(newPool)
                                            try {
                                                await fetch('/api/mappool', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ maps: newPool })
                                                })
                                            } catch {}
                                        }}
                                        className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border bg-white/5 border-white/10 text-white/50 hover:border-ridge-brand/50 hover:text-ridge-brand"
                                    >
                                        {catalogTracks.map(t => t.id).every(id => activeMapPool.includes(id)) ? 'Deselect All' : 'Select All'}
                                    </button>
                                    <div className="text-right">
                                        <p className="text-xs font-black uppercase text-white/40">Authorized</p>
                                        <p className="text-2xl font-black italic text-ridge-brand">{activeMapPool.length} / {catalogTracks.length}</p>
                                    </div>
                                </div>
                            </div>"""
                            
# Find the start of MAP POOL VIEW and replace the messed up header until the grid
maps_view_start = content.find("{/* MAP POOL VIEW — globally available tracks for all groups */}")
grid_start = content.find('<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">', maps_view_start)

if maps_view_start != -1 and grid_start != -1:
    header_end = content.rfind("</div>", maps_view_start, grid_start)
    # The header is from `<div className="flex items-center justify-between mb-8">` to the `</div>` before `<div className="grid...`
    start_idx = content.find('<div className="flex items-center justify-between mb-8">', maps_view_start)
    end_idx = grid_start
    content = content[:start_idx] + maps_header_original + "\n                            " + content[end_idx:]


# 2. Add setSelectedCarPresetId(newId) on preset creation
preset_creation = """                                            const name = prompt("Enter preset name:");
                                            if (name) {
                                                const newId = Math.random().toString(36).substring(7);
                                                const newPresets = [...carPresets, { id: newId, name, cars: [] }];
                                                setCarPresets(newPresets);
                                                setSelectedCarPresetId(newId);
                                                fetch('/api/car_presets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newPresets) });
                                            }"""
content = re.sub(r'                                            const name = prompt\("Enter preset name:"\);\n                                            if \(name\) {\n                                                const newPresets = \[\.\.\.carPresets, { id: Math\.random\(\)\.toString\(36\)\.substring\(7\), name, cars: \[\] }\];\n                                                setCarPresets\(newPresets\);\n                                                fetch\(\'/api/car_presets\', { method: \'POST\', headers: { \'Content-Type\': \'application/json\' }, body: JSON.stringify\(newPresets\) }\);\n                                            }', preset_creation, content)

with open("apps/orchestrator/frontend/src/App.tsx", "w") as f:
    f.write(content)

