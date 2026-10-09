import React, { useState, useEffect } from 'react'
import { Car, Check, Zap, Plus, Trash2, Search, Filter, ShieldCheck, Sparkles, RefreshCw, CheckCircle2 } from 'lucide-react'

interface CatalogCar {
    id: string
    name: string
    brand?: string
    car_class?: string
}

interface CarPreset {
    id: string
    name: string
    car_ids: string[]
    description?: string
    isBuiltIn?: boolean
}

const DEFAULT_CAR_CLASSES = ['All', 'GT3', 'Hypercar', 'Supercar', 'GTE', 'Formula']

export const CarsModule: React.FC = () => {
    const [cars, setCars] = useState<CatalogCar[]>([])
    const [activePool, setActivePool] = useState<string[]>([])
    const [selectedClass, setSelectedClass] = useState<string>('All')
    const [searchQuery, setSearchQuery] = useState<string>('')
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [statusMsg, setStatusMsg] = useState<string | null>(null)

    // Car Subtype Presets
    const [presets, setPresets] = useState<CarPreset[]>([
        {
            id: 'gt3_pack',
            name: 'GT3 Competition Pack',
            car_ids: ['ks_ferrari_488_gt3', 'ks_porsche_911_gt3_rs', 'ks_mercedes_amg_gt3', 'ks_audi_r8_lms', 'ks_mclaren_650s_gt3', 'ks_lamborghini_huracan_gt3', 'ks_bmw_m6_gt3', 'ks_nissan_gt_r_gt3'],
            description: 'Balanced FIA GT3 homologated machinery for competitive grid racing.',
            isBuiltIn: true,
        },
        {
            id: 'hypercar_pack',
            name: 'Hypercar & Prototype Pack',
            car_ids: ['ks_ferrari_488_gte', 'ks_corvette_c7_r', 'ks_porsche_911_gt3_rs'],
            description: 'Ultimate downforce, extreme horsepower, and prototype endurance racers.',
            isBuiltIn: true,
        },
        {
            id: 'open_wheel_pack',
            name: 'Formula & Open Wheel',
            car_ids: ['tatuusfa1', 'ks_lotus_exos_125'],
            description: 'Lightweight high-downforce single seaters for pure open-wheel precision.',
            isBuiltIn: true,
        },
    ])

    const [showNewPresetModal, setShowNewPresetModal] = useState<boolean>(false)
    const [newPresetName, setNewPresetName] = useState<string>('')
    const [newPresetDesc, setNewPresetDesc] = useState<string>('')

    const fetchData = async () => {
        setIsLoading(true)
        try {
            const [catRes, poolRes] = await Promise.all([
                fetch('/catalogs'),
                fetch('/carpool'),
            ])

            if (catRes.ok) {
                const catData = await catRes.json()
                if (Array.isArray(catData.cars)) {
                    setCars(catData.cars)
                }
            }

            if (poolRes.ok) {
                const poolData = await poolRes.json()
                if (Array.isArray(poolData)) {
                    setActivePool(poolData)
                }
            }

            // Load saved custom presets from localStorage if available
            const savedCustom = localStorage.getItem('corsa_car_presets')
            if (savedCustom) {
                try {
                    const parsed = JSON.parse(savedCustom)
                    if (Array.isArray(parsed)) {
                        setPresets(prev => [
                            ...prev.filter(p => p.isBuiltIn),
                            ...parsed,
                        ])
                    }
                } catch {}
            }
        } catch (e) {
            console.error('Failed to load fleet data:', e)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const savePoolToBackend = async (newPool: string[]) => {
        setActivePool(newPool)
        try {
            await fetch('/carpool', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cars: newPool }),
            })
            setStatusMsg(`Fleet updated (${newPool.length} authorized)`)
            setTimeout(() => setStatusMsg(null), 3000)
        } catch (e) {
            console.error('Failed to sync car pool:', e)
        }
    }

    const toggleCar = (carId: string) => {
        const next = activePool.includes(carId)
            ? activePool.filter(id => id !== carId)
            : [...activePool, carId]
        savePoolToBackend(next)
    }

    const handleSelectAll = () => {
        const allIds = cars.map(c => c.id)
        savePoolToBackend(allIds)
    }

    const handleDeselectAll = () => {
        savePoolToBackend([])
    }

    const handleApplyPreset = (preset: CarPreset) => {
        // If built-in preset has IDs that match available catalog cars
        const availableIds = cars.map(c => c.id)
        const validIds = preset.car_ids.filter(id => availableIds.includes(id))
        const finalPool = validIds.length > 0 ? validIds : preset.car_ids
        savePoolToBackend(finalPool)
        setStatusMsg(`Applied "${preset.name}" preset (${finalPool.length} cars)`)
        setTimeout(() => setStatusMsg(null), 3000)
    }

    const handleCreatePreset = (e: React.FormEvent) => {
        e.preventDefault()
        if (!newPresetName.trim() || activePool.length === 0) return

        const newPreset: CarPreset = {
            id: `custom_${Date.now()}`,
            name: newPresetName.trim(),
            description: newPresetDesc.trim() || `${activePool.length} custom selected cars`,
            car_ids: [...activePool],
            isBuiltIn: false,
        }

        const updated = [...presets, newPreset]
        setPresets(updated)
        // Persist custom presets
        const customOnly = updated.filter(p => !p.isBuiltIn)
        localStorage.setItem('corsa_car_presets', JSON.stringify(customOnly))

        setNewPresetName('')
        setNewPresetDesc('')
        setShowNewPresetModal(false)
        setStatusMsg(`Saved custom preset: "${newPreset.name}"`)
        setTimeout(() => setStatusMsg(null), 3000)
    }

    const handleDeletePreset = (id: string) => {
        const updated = presets.filter(p => p.id !== id)
        setPresets(updated)
        const customOnly = updated.filter(p => !p.isBuiltIn)
        localStorage.setItem('corsa_car_presets', JSON.stringify(customOnly))
    }

    // Filter cars
    const filteredCars = cars.filter(car => {
        const matchesSearch =
            car.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            car.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (car.brand && car.brand.toLowerCase().includes(searchQuery.toLowerCase()))

        let matchesClass = true
        if (selectedClass !== 'All') {
            const cls = (car.car_class || '').toLowerCase()
            const target = selectedClass.toLowerCase()
            matchesClass = cls.includes(target) || car.name.toLowerCase().includes(target) || car.id.toLowerCase().includes(target)
        }

        return matchesSearch && matchesClass
    })

    return (
        <div className="space-y-6">
            {/* Header Toolbar */}
            <div className="bg-ridge-panel border border-white/10 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-ridge-brand/10 border border-ridge-brand/20 rounded-xl text-ridge-brand">
                        <Car size={24} />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-white uppercase tracking-wider">
                            Fleet Authorization & Vehicle Pool
                        </h2>
                        <p className="text-xs text-white/50">
                            Enable or disable cars available across all racing groups and manage class subtype presets.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="text-right mr-2">
                        <span className="text-[10px] font-black uppercase text-white/40 block">Authorized Fleet</span>
                        <span className="text-xl font-black font-mono text-emerald-400">
                            {activePool.length} <span className="text-white/40 text-xs">/ {cars.length}</span>
                        </span>
                    </div>

                    <button
                        onClick={activePool.length === cars.length ? handleDeselectAll : handleSelectAll}
                        className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white transition-all uppercase tracking-wider"
                    >
                        {activePool.length === cars.length ? 'Deselect All' : 'Select All'}
                    </button>

                    <button
                        onClick={() => setShowNewPresetModal(true)}
                        className="px-4 py-2 bg-ridge-brand hover:bg-ridge-brand/90 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-ridge-brand/30 transition-all"
                    >
                        <Plus size={16} /> Save Selection As Preset
                    </button>
                </div>
            </div>

            {/* Status Alert Banner */}
            {statusMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <span>{statusMsg}</span>
                </div>
            )}

            {/* 1. Car Subtype Presets Section */}
            <div className="bg-ridge-panel border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles size={18} className="text-amber-400" />
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">
                            Car Subtype Presets & Categories
                        </h3>
                    </div>
                    <span className="text-xs text-white/40">1-click switch between GT3, Hypercars, or custom packs</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {presets.map(preset => (
                        <div
                            key={preset.id}
                            className="bg-[#181818] border border-white/10 hover:border-white/20 rounded-xl p-4 flex flex-col justify-between transition-all group"
                        >
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <h4 className="font-black text-white text-sm group-hover:text-ridge-brand transition-colors">
                                        {preset.name}
                                    </h4>
                                    {!preset.isBuiltIn && (
                                        <button
                                            onClick={() => handleDeletePreset(preset.id)}
                                            className="text-white/30 hover:text-red-400 p-1 rounded transition-colors"
                                            title="Delete custom preset"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    )}
                                </div>
                                <p className="text-[11px] text-white/50 leading-relaxed mb-3">
                                    {preset.description || `${preset.car_ids.length} cars configured.`}
                                </p>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                <span className="text-[10px] font-mono text-white/40 font-bold">
                                    {preset.car_ids.length} Cars
                                </span>
                                <button
                                    onClick={() => handleApplyPreset(preset)}
                                    className="px-3 py-1.5 bg-white/10 hover:bg-ridge-brand text-white text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition-all"
                                >
                                    <Zap size={13} /> Activate Preset
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 2. Filter & Search Toolbar */}
            <div className="bg-ridge-panel border border-white/10 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
                {/* Search Bar */}
                <div className="relative flex-1 min-w-[240px] max-w-md">
                    <Search size={16} className="absolute left-3.5 top-3 text-white/40 pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search cars by name, brand, or ID..."
                        className="w-full bg-[#181818] border border-white/20 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-ridge-brand transition-colors"
                    />
                </div>

                {/* Class Filters */}
                <div className="flex items-center gap-1 bg-[#181818] p-1 rounded-xl border border-white/10 flex-wrap">
                    {DEFAULT_CAR_CLASSES.map(cls => (
                        <button
                            key={cls}
                            onClick={() => setSelectedClass(cls)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${
                                selectedClass === cls
                                    ? 'bg-ridge-brand text-white'
                                    : 'text-white/60 hover:text-white'
                            }`}
                        >
                            {cls}
                        </button>
                    ))}
                </div>
            </div>

            {/* 3. Cars Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {isLoading ? (
                    <div className="col-span-full py-16 text-center text-white/40">
                        <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-400" />
                        Scanning master content car catalogs...
                    </div>
                ) : filteredCars.length === 0 ? (
                    <div className="col-span-full py-16 text-center text-white/40">
                        No cars found matching current search/filter.
                    </div>
                ) : (
                    filteredCars.map(car => {
                        const isAuthorized = activePool.includes(car.id)
                        return (
                            <button
                                key={car.id}
                                onClick={() => toggleCar(car.id)}
                                className={`text-left p-4 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between h-36 ${
                                    isAuthorized
                                        ? 'bg-ridge-brand/10 border-ridge-brand/50 text-white shadow-lg shadow-ridge-brand/10'
                                        : 'bg-[#141414] border-white/5 text-white/30 hover:border-white/20 hover:text-white/60'
                                }`}
                            >
                                <div className="flex justify-between items-start w-full">
                                    <Car size={28} className={isAuthorized ? 'text-ridge-brand' : 'opacity-20'} />
                                    <div
                                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                            isAuthorized ? 'bg-ridge-brand text-white' : 'bg-white/5 border border-white/10 text-transparent'
                                        }`}
                                    >
                                        <Check size={14} />
                                    </div>
                                </div>

                                <div className="w-full">
                                    {car.brand && (
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-white/40 block">
                                            {car.brand}
                                        </span>
                                    )}
                                    <h4 className="font-black italic uppercase text-xs tracking-tight text-white truncate" title={car.name}>
                                        {car.name}
                                    </h4>
                                    <code className="text-[9px] font-mono text-white/30 truncate block mt-0.5">
                                        {car.id}
                                    </code>
                                </div>
                            </button>
                        )
                    })
                )}
            </div>

            {/* Modal to Save Current Selection as Preset */}
            {showNewPresetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                    <div className="bg-ridge-panel border border-white/20 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
                        <div className="flex items-center gap-2">
                            <Plus size={20} className="text-ridge-brand" />
                            <h3 className="text-base font-black text-white uppercase tracking-wider">
                                Save Car Subtype Preset
                            </h3>
                        </div>
                        <p className="text-xs text-white/60">
                            Save currently selected {activePool.length} cars into a named preset for quick 1-click loading.
                        </p>

                        <form onSubmit={handleCreatePreset} className="space-y-3">
                            <div>
                                <label className="text-white/60 text-[11px] font-bold uppercase block mb-1">
                                    Preset Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={newPresetName}
                                    onChange={e => setNewPresetName(e.target.value)}
                                    placeholder="e.g. GT3 Masters 2026"
                                    className="w-full bg-[#181818] border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-ridge-brand transition-colors"
                                />
                            </div>

                            <div>
                                <label className="text-white/60 text-[11px] font-bold uppercase block mb-1">
                                    Description (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={newPresetDesc}
                                    onChange={e => setNewPresetDesc(e.target.value)}
                                    placeholder="e.g. Approved vehicle list for GT3 events"
                                    className="w-full bg-[#181818] border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-ridge-brand transition-colors"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowNewPresetModal(false)}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white/70"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-ridge-brand hover:bg-ridge-brand/90 text-white rounded-xl text-xs font-black uppercase tracking-wider"
                                >
                                    Save Preset
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
