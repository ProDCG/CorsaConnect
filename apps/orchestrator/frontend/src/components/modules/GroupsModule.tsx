import React, { useState, useEffect } from 'react'
import { Zap, Play, Flag, Users, Check, Sparkles, Plus, Trash2, ShieldCheck, CheckCircle2 } from 'lucide-react'
import GroupManager from '../GroupManager'
import { useLiveStream } from '../../context/LiveStreamContext'
import { Preset } from '../../types'

interface QuickPreset {
    id: string
    title: string
    track: string
    carClass: string
    laps: number
    desc: string
    car: string
}

const POPULAR_PRESETS: QuickPreset[] = [
    {
        id: 'gt3_spa',
        title: 'GT3 Sprint at Spa',
        track: 'spa',
        carClass: 'GT3 Class',
        laps: 8,
        desc: 'High speed competitive racing through Eau Rouge and Blanchimont.',
        car: 'ks_ferrari_488_gt3',
    },
    {
        id: 'monza_shootout',
        title: 'Monza Temple of Speed',
        track: 'monza',
        carClass: 'Supercars',
        laps: 5,
        desc: 'Maximum top-speed braking battles into the Prima Variante.',
        car: 'ks_porsche_911_gt3_rs',
    },
    {
        id: 'nordschleife_hotlap',
        title: 'Nordschleife Hotlap',
        track: 'nurburgring',
        carClass: 'Hypercars',
        laps: 1,
        desc: 'The Green Hell. 20.8 km of pure adrenaline and technical precision.',
        car: 'ks_ferrari_488_gt3',
    },
    {
        id: 'silverstone_drift',
        title: 'Silverstone Grand Prix',
        track: 'silverstone',
        carClass: 'Open GT',
        laps: 6,
        desc: 'Historic sweeping corners: Copse, Maggotts, and Becketts.',
        car: 'ks_mercedes_amg_gt3',
    },
]

export const GroupsModule: React.FC<{
    catalogCars?: any[]
    catalogTracks?: any[]
    onQuickLaunchGroup?: (preset: QuickPreset) => void
}> = () => {
    const { groups, rigs, refresh } = useLiveStream()
    const [launchingPreset, setLaunchingPreset] = useState<string | null>(null)
    const [carPool, setCarPool] = useState<string[]>([])
    const [mapPool, setMapPool] = useState<string[]>([])
    const [savedLineups, setSavedLineups] = useState<Preset[]>([])
    const [showSaveLineupModal, setShowSaveLineupModal] = useState<boolean>(false)
    const [newLineupName, setNewLineupName] = useState<string>('')
    const [statusMsg, setStatusMsg] = useState<string | null>(null)

    const fetchLineupsAndPools = () => {
        Promise.all([
            fetch('/carpool').then(r => (r.ok ? r.json() : [])).catch(() => []),
            fetch('/mappool').then(r => (r.ok ? r.json() : [])).catch(() => []),
            fetch('/presets').then(r => (r.ok ? r.json() : [])).catch(() => []),
        ]).then(([cars, maps, presetsData]) => {
            if (Array.isArray(cars)) setCarPool(cars)
            if (Array.isArray(maps)) setMapPool(maps)
            if (Array.isArray(presetsData)) setSavedLineups(presetsData)
        })
    }

    useEffect(() => {
        fetchLineupsAndPools()
    }, [])

    const handleApplyPreset = async (preset: QuickPreset) => {
        setLaunchingPreset(preset.id)
        try {
            if (groups.length > 0) {
                const targetGroup = groups[0]
                await fetch(`/groups/${targetGroup.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        track: preset.track,
                        race_laps: preset.laps,
                        car_pool: [preset.car],
                    }),
                })
            } else {
                const res = await fetch('/groups', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: preset.title,
                        mode: 'multiplayer',
                    }),
                })
                if (res.ok) {
                    const newGroup = await res.json()
                    await fetch(`/groups/${newGroup.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            track: preset.track,
                            race_laps: preset.laps,
                            car_pool: [preset.car],
                        }),
                    })
                }
            }
            refresh()
            setStatusMsg(`Armed quick start: "${preset.title}"`)
            setTimeout(() => setStatusMsg(null), 3000)
        } catch (e) {
            console.error('Failed to apply quick start preset:', e)
        } finally {
            setTimeout(() => setLaunchingPreset(null), 1000)
        }
    }

    const handleSaveCurrentLineup = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newLineupName.trim()) return

        const activeGroup = groups.length > 0 ? groups[0] : null
        const newPreset: Preset = {
            id: `lineup_${Date.now()}`,
            name: newLineupName.trim(),
            track: activeGroup?.track || 'spa',
            weather: activeGroup?.weather || '3_clear',
            practice_time: activeGroup?.practice_time || 10,
            qualy_time: activeGroup?.qualy_time || 10,
            race_laps: activeGroup?.race_laps || 5,
            race_time: activeGroup?.session_duration_min || 15,
            allow_drs: true,
            car_pool: activeGroup?.car_pool && activeGroup.car_pool.length > 0 ? activeGroup.car_pool : carPool,
        }

        const updated = [...savedLineups, newPreset]
        setSavedLineups(updated)
        try {
            await fetch('/presets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated),
            })
            setNewLineupName('')
            setShowSaveLineupModal(false)
            setStatusMsg(`Saved lineup preset: "${newPreset.name}"`)
            setTimeout(() => setStatusMsg(null), 3000)
        } catch (err) {
            console.error('Failed to save preset:', err)
        }
    }

    const handleApplySavedLineup = async (preset: Preset) => {
        try {
            if (groups.length > 0) {
                const targetGroup = groups[0]
                await fetch(`/groups/${targetGroup.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        track: preset.track,
                        weather: preset.weather,
                        race_laps: preset.race_laps,
                        qualy_time: preset.qualy_time,
                        practice_time: preset.practice_time,
                        car_pool: preset.car_pool,
                    }),
                })
            } else {
                const res = await fetch('/groups', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: preset.name,
                        mode: 'multiplayer',
                    }),
                })
                if (res.ok) {
                    const newGroup = await res.json()
                    await fetch(`/groups/${newGroup.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            track: preset.track,
                            weather: preset.weather,
                            race_laps: preset.race_laps,
                            qualy_time: preset.qualy_time,
                            practice_time: preset.practice_time,
                            car_pool: preset.car_pool,
                        }),
                    })
                }
            }
            refresh()
            setStatusMsg(`Armed lineup: "${preset.name}"`)
            setTimeout(() => setStatusMsg(null), 3000)
        } catch (e) {
            console.error('Failed to apply saved lineup:', e)
        }
    }

    const handleDeleteSavedLineup = async (presetId: string) => {
        const updated = savedLineups.filter(p => p.id !== presetId)
        setSavedLineups(updated)
        try {
            await fetch('/presets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated),
            })
        } catch (e) {
            console.error('Failed to delete preset:', e)
        }
    }

    return (
        <div className="space-y-6">
            {/* Status Alert Banner */}
            {statusMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <span>{statusMsg}</span>
                </div>
            )}

            {/* Quick Starts UI Header */}
            <div className="bg-ridge-panel border border-white/10 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Sparkles size={18} className="text-ridge-brand" />
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">Quick Starts</h3>
                    </div>
                    <span className="text-xs text-white/40">Select a pre-configured battle to arm rigs</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {POPULAR_PRESETS.map(preset => {
                        const isApplying = launchingPreset === preset.id

                        return (
                            <div
                                key={preset.id}
                                className="bg-[#181818] border border-white/10 hover:border-ridge-brand/50 rounded-xl p-4 flex flex-col justify-between transition-all group"
                            >
                                <div>
                                    <div className="flex items-center justify-between text-xs mb-2">
                                        <span className="px-2 py-0.5 rounded bg-ridge-brand/20 text-ridge-brand text-[10px] font-black uppercase tracking-wider">
                                            {preset.carClass}
                                        </span>
                                        <span className="text-white/40 font-mono text-[11px]">{preset.laps} Laps</span>
                                    </div>
                                    <h4 className="font-bold text-white text-sm mb-1 group-hover:text-ridge-brand transition-colors">
                                        {preset.title}
                                    </h4>
                                    <p className="text-[11px] text-white/50 leading-relaxed mb-4">
                                        {preset.desc}
                                    </p>
                                </div>

                                <button
                                    disabled={isApplying}
                                    onClick={() => handleApplyPreset(preset)}
                                    className={`w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                                        isApplying
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-white/10 hover:bg-ridge-brand text-white'
                                    }`}
                                >
                                    {isApplying ? (
                                        <>
                                            <Check size={14} /> Armed to Group!
                                        </>
                                    ) : (
                                        <>
                                            <Zap size={14} /> Arm Preset
                                        </>
                                    )}
                                </button>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Saved Lineups & Group Presets Section */}
            <div className="bg-ridge-panel border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <ShieldCheck size={18} className="text-emerald-400" />
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">
                            Saved Lineups & Group Presets
                        </h3>
                    </div>
                    <button
                        onClick={() => setShowSaveLineupModal(true)}
                        className="px-3.5 py-1.5 bg-ridge-brand hover:bg-ridge-brand/90 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-lg shadow-ridge-brand/20"
                    >
                        <Plus size={14} /> Save Current Lineup As Preset
                    </button>
                </div>

                {savedLineups.length === 0 ? (
                    <div className="py-8 text-center text-white/40 border border-dashed border-white/10 rounded-xl text-xs">
                        No saved lineups found. Configure a group below and click "Save Current Lineup As Preset".
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {savedLineups.map(lineup => (
                            <div
                                key={lineup.id}
                                className="bg-[#181818] border border-white/10 hover:border-white/20 rounded-xl p-4 flex flex-col justify-between transition-all group"
                            >
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <h4 className="font-black text-white text-sm group-hover:text-emerald-400 transition-colors">
                                            {lineup.name}
                                        </h4>
                                        <button
                                            onClick={() => handleDeleteSavedLineup(lineup.id)}
                                            className="text-white/30 hover:text-red-400 p-1 rounded transition-colors"
                                            title="Delete lineup"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                    <div className="text-[11px] text-white/50 space-y-1 mb-3">
                                        <div>Circuit: <strong className="text-white/80 uppercase">{lineup.track}</strong></div>
                                        <div>Laps: <strong className="text-white/80">{lineup.race_laps}</strong> | Qualy: <strong className="text-white/80">{lineup.qualy_time}m</strong></div>
                                        <div>Cars: <strong className="text-white/80">{lineup.car_pool?.length || 0} vehicle models</strong></div>
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-white/5 flex justify-end">
                                    <button
                                        onClick={() => handleApplySavedLineup(lineup)}
                                        className="px-3 py-1.5 bg-white/10 hover:bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition-all"
                                    >
                                        <Zap size={13} /> Arm Lineup
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Embedded GroupManager component */}
            <GroupManager
                rigs={rigs}
                activeCarPool={carPool}
                activeMapPool={mapPool}
            />

            {/* Modal: Save Current Lineup */}
            {showSaveLineupModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                    <div className="bg-ridge-panel border border-white/20 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
                        <div className="flex items-center gap-2">
                            <Plus size={20} className="text-ridge-brand" />
                            <h3 className="text-base font-black text-white uppercase tracking-wider">
                                Save Current Lineup Preset
                            </h3>
                        </div>
                        <p className="text-xs text-white/60">
                            Save current track, laps, weather, and car pool configuration into a named lineup preset for rapid future race deployment.
                        </p>

                        <form onSubmit={handleSaveCurrentLineup} className="space-y-3">
                            <div>
                                <label className="text-white/60 text-[11px] font-bold uppercase block mb-1">
                                    Lineup Preset Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={newLineupName}
                                    onChange={e => setNewLineupName(e.target.value)}
                                    placeholder="e.g. VIP Sprint Challenge"
                                    className="w-full bg-[#181818] border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-ridge-brand transition-colors"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowSaveLineupModal(false)}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white/70"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-ridge-brand hover:bg-ridge-brand/90 text-white rounded-xl text-xs font-black uppercase tracking-wider"
                                >
                                    Save Lineup
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
