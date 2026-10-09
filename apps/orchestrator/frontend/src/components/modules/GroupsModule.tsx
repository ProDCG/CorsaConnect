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

export const GroupsModule: React.FC<{
    catalogCars?: any[]
    catalogTracks?: any[]
    onQuickLaunchGroup?: (preset: any) => void
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

            {/* Quick Starts & Saved Lineups Section */}
            <div className="bg-ridge-panel border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Sparkles size={18} className="text-ridge-brand" />
                        <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-wider">
                                Quick Starts & Saved Lineups
                            </h3>
                            <p className="text-xs text-white/40">1-click arm saved presets to active racing groups</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowSaveLineupModal(true)}
                        className="px-3.5 py-1.5 bg-ridge-brand hover:bg-ridge-brand/90 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-lg shadow-ridge-brand/20"
                    >
                        <Plus size={14} /> Save Current Lineup As Preset
                    </button>
                </div>

                {savedLineups.length === 0 ? (
                    <div className="py-8 px-4 text-center bg-black/20 border border-dashed border-white/10 rounded-xl">
                        <Sparkles className="w-6 h-6 text-white/20 mx-auto mb-2" />
                        <p className="text-xs text-white/50 font-bold uppercase tracking-wider">No presets saved</p>
                        <p className="text-[11px] text-white/30 mt-1">Configure a group below and click "Save Current Lineup As Preset" to create your first quick-start preset.</p>
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
