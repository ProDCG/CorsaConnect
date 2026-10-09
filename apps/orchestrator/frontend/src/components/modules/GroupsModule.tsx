import React, { useState } from 'react'
import { Zap, Play, Flag, Users, Check, Sparkles } from 'lucide-react'
import GroupManager from '../GroupManager'
import { useLiveStream } from '../../context/LiveStreamContext'

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
}> = ({ catalogCars, catalogTracks, onQuickLaunchGroup }) => {
    const { groups, rigs, refresh } = useLiveStream()
    const [launchingPreset, setLaunchingPreset] = useState<string | null>(null)

    const handleApplyPreset = async (preset: QuickPreset) => {
        setLaunchingPreset(preset.id)
        try {
            // If groups exist, update the first group or create a new group
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
        } catch (e) {
            console.error('Failed to apply quick start preset:', e)
        } finally {
            setTimeout(() => setLaunchingPreset(null), 1000)
        }
    }

    const [carPool, setCarPool] = useState<string[]>([])
    const [mapPool, setMapPool] = useState<string[]>([])

    React.useEffect(() => {
        Promise.all([
            fetch('/carpool').then(r => (r.ok ? r.json() : [])).catch(() => []),
            fetch('/mappool').then(r => (r.ok ? r.json() : [])).catch(() => []),
        ]).then(([cars, maps]) => {
            if (Array.isArray(cars)) setCarPool(cars)
            if (Array.isArray(maps)) setMapPool(maps)
        })
    }, [])

    return (
        <div className="space-y-6">
            {/* Quick Starts UI Header */}
            <div className="bg-ridge-panel/60 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Sparkles size={18} className="text-ridge-brand" />
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">Quick Starts — 1-Click Session Presets</h3>
                    </div>
                    <span className="text-xs text-white/40">Select a pre-configured battle to arm rigs</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {POPULAR_PRESETS.map(preset => {
                        const isApplying = launchingPreset === preset.id

                        return (
                            <div
                                key={preset.id}
                                className="bg-white/5 border border-white/10 hover:border-ridge-brand/50 rounded-xl p-4 flex flex-col justify-between transition-all group"
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

            {/* Embedded GroupManager component */}
            <GroupManager
                rigs={rigs}
                activeCarPool={carPool}
                activeMapPool={mapPool}
            />
        </div>
    )
}
