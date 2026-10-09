import React, { useState, useEffect } from 'react'
import { Play, Square, Wrench, ShieldAlert, Tv, RotateCcw, Monitor, CheckCircle, AlertCircle, Fuel, Gauge, Thermometer, UserCheck, User, Search, X, UserMinus } from 'lucide-react'
import { useLiveStream } from '../../context/LiveStreamContext'
import { Rig, Driver } from '../../types'

export const LauncherModule: React.FC<{
    onAssignDriver?: (rigId: string) => void
}> = ({ onAssignDriver }) => {
    const { rigs, refresh } = useLiveStream()
    const [selectedCategory, setSelectedCategory] = useState<'all' | 'idle' | 'racing' | 'setup' | 'offline'>('all')
    const [showPanicModal, setShowPanicModal] = useState<boolean>(false)
    const [isKilling, setIsKilling] = useState<boolean>(false)
    const [spectatorStatus, setSpectatorStatus] = useState<'idle' | 'auto' | 'rig'>('idle')

    // Account Search & Binding State
    const [selectedRigForDriver, setSelectedRigForDriver] = useState<Rig | null>(null)
    const [driversList, setDriversList] = useState<Driver[]>([])
    const [driverSearch, setDriverSearch] = useState<string>('')
    const [manualDriverName, setManualDriverName] = useState<string>('')
    const [isSubmittingDriver, setIsSubmittingDriver] = useState<boolean>(false)

    const fetchDrivers = async () => {
        try {
            const res = await fetch('/drivers')
            if (res.ok) {
                const data = await res.json()
                if (Array.isArray(data)) setDriversList(data)
            }
        } catch (e) {
            console.error('Failed to load drivers:', e)
        }
    }

    React.useEffect(() => {
        if (selectedRigForDriver) {
            fetchDrivers()
            setDriverSearch('')
            setManualDriverName(selectedRigForDriver.driver_name || '')
        }
    }, [selectedRigForDriver])

    const handleAssignDriver = async (driver: Driver) => {
        if (!selectedRigForDriver) return
        setIsSubmittingDriver(true)
        try {
            await fetch('/drivers/assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rig_id: selectedRigForDriver.rig_id,
                    driver_name: driver.display_name,
                    driver_email: driver.email || null,
                    driver_uuid: driver.driver_uuid,
                }),
            })
            setSelectedRigForDriver(null)
            refresh()
        } catch (e) {
            console.error('Failed to assign driver:', e)
        } finally {
            setIsSubmittingDriver(false)
        }
    }

    const handleAssignManualName = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedRigForDriver) return
        setIsSubmittingDriver(true)
        try {
            await fetch(`/rigs/${selectedRigForDriver.rig_id}/driver_name`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ driver_name: manualDriverName.trim() }),
            })
            setSelectedRigForDriver(null)
            refresh()
        } catch (e) {
            console.error('Failed to set manual driver name:', e)
        } finally {
            setIsSubmittingDriver(false)
        }
    }

    const handleUnbindDriver = async (rigId: string) => {
        setIsSubmittingDriver(true)
        try {
            await fetch(`/rigs/${rigId}/driver_name`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ driver_name: '' }),
            })
            setSelectedRigForDriver(null)
            refresh()
        } catch (e) {
            console.error('Failed to unbind driver:', e)
        } finally {
            setIsSubmittingDriver(false)
        }
    }

    const filteredDrivers = driversList.filter(d => {
        if (!driverSearch.trim()) return true
        const q = driverSearch.toLowerCase()
        return (
            d.display_name.toLowerCase().includes(q) ||
            (d.email && d.email.toLowerCase().includes(q)) ||
            (d.phone && d.phone.includes(q))
        )
    })

    // Categorized lists
    const categorizedRigs = {
        racing: rigs.filter(r => r.status === 'racing'),
        idle: rigs.filter(r => r.status === 'idle'),
        setup: rigs.filter(r => r.status === 'setup' || r.status === 'ready'),
        offline: rigs.filter(r => r.status === 'offline'),
    }

    const filteredRigs = selectedCategory === 'all'
        ? rigs
        : rigs.filter(r => {
            if (selectedCategory === 'setup') return r.status === 'setup' || r.status === 'ready'
            return r.status === selectedCategory
        })

    // Panic Kill Switch
    const handlePanicKillAll = async () => {
        setIsKilling(true)
        try {
            await fetch('/command/kill_all', { method: 'POST' })
            setShowPanicModal(false)
            refresh()
        } catch (e) {
            console.error('Failed to execute panic kill:', e)
        } finally {
            setIsKilling(false)
        }
    }

    // Single Rig Actions
    const handleRigAction = async (rigId: string, action: 'LAUNCH_RACE' | 'KILL_RACE' | 'SETUP_MODE') => {
        try {
            await fetch('/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rig_id: rigId, action }),
            })
            refresh()
        } catch (e) {
            console.error(`Failed to send ${action} to ${rigId}:`, e)
        }
    }

    // Spectator Controls
    const handleSpectatorToggle = async (mode: 'auto' | 'kill') => {
        try {
            if (mode === 'auto') {
                await fetch('/server/spectator/launch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mode: 'auto' }),
                })
                setSpectatorStatus('auto')
            } else {
                await fetch('/server/spectator/kill', { method: 'POST' })
                setSpectatorStatus('idle')
            }
        } catch (e) {
            console.error('Spectator action failed:', e)
        }
    }

    return (
        <div className="space-y-6">
            {/* Top Toolbar: Categories & Panic Switch */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-ridge-panel/60 border border-white/10 rounded-2xl p-4">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-white/50 mr-2">Filter State:</span>
                    {(['all', 'idle', 'racing', 'setup', 'offline'] as const).map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                                selectedCategory === cat
                                    ? 'bg-ridge-brand text-white shadow-lg shadow-ridge-brand/30'
                                    : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white'
                            }`}
                        >
                            {cat} ({cat === 'all' ? rigs.length : (categorizedRigs as any)[cat]?.length || 0})
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3">
                    {/* Panic Kill Switch */}
                    <button
                        onClick={() => setShowPanicModal(true)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2 shadow-lg shadow-red-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        <ShieldAlert size={16} />
                        <span>Panic: End All Sessions</span>
                    </button>
                </div>
            </div>

            {/* Broadcast TV Management Section */}
            <div className="bg-ridge-panel/60 border border-white/10 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                        <Tv size={24} />
                    </div>
                    <div>
                        <h4 className="text-sm font-black text-white uppercase tracking-wider">Broadcast TV Director (Monitor 2)</h4>
                        <p className="text-xs text-white/50">Autonomous broadcast director cycling cameras and leaderboards on venue displays.</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleSpectatorToggle('auto')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${
                            spectatorStatus === 'auto'
                                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                : 'bg-white/10 hover:bg-white/20 text-white'
                        }`}
                    >
                        <Play size={14} /> Auto Director
                    </button>
                    <button
                        onClick={() => handleSpectatorToggle('kill')}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all"
                    >
                        <Square size={14} /> Stop Spectator
                    </button>
                </div>
            </div>

            {/* Rig Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredRigs.map(rig => {
                    const isRacing = rig.status === 'racing'
                    const isIdle = rig.status === 'idle'
                    const isSetup = rig.status === 'setup' || rig.status === 'ready'

                    return (
                        <div
                            key={rig.rig_id}
                            className={`border rounded-2xl p-5 bg-ridge-panel/70 flex flex-col justify-between transition-all hover:border-white/20 ${
                                isRacing
                                    ? 'border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                                    : isSetup
                                    ? 'border-indigo-500/40'
                                    : 'border-white/10'
                            }`}
                        >
                            <div>
                                {/* Header: Rig ID & Status Badge */}
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Monitor size={18} className={isRacing ? 'text-emerald-400' : 'text-white/40'} />
                                        <span className="font-black text-white text-base tracking-wide">{rig.rig_id}</span>
                                    </div>
                                    <span
                                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                            isRacing
                                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                                : isSetup
                                                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                                                : isIdle
                                                ? 'bg-white/5 border-white/10 text-white/60'
                                                : 'bg-red-500/10 border-red-500/30 text-red-300'
                                        }`}
                                    >
                                        {rig.status}
                                    </span>
                                </div>

                                {/* Driver & Car Info */}
                                <div className="space-y-1.5 mb-4 text-xs">
                                    <div className="flex items-center justify-between text-white/80">
                                        <span className="text-white/40 text-[11px]">Driver:</span>
                                        <button
                                            onClick={() => setSelectedRigForDriver(rig)}
                                            className="font-bold flex items-center gap-1.5 hover:text-ridge-brand transition-colors text-right"
                                            title="Click to search accounts or change driver"
                                        >
                                            <span>{rig.driver_name || <span className="text-white/30 italic">Click to bind</span>}</span>
                                            <User size={12} className={rig.driver_name ? 'text-ridge-brand' : 'text-white/30'} />
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between text-white/80">
                                        <span className="text-white/40 text-[11px]">Assigned Car:</span>
                                        <span className="font-medium truncate max-w-[140px] text-[11px] text-white/90">
                                            {rig.selected_car || 'Default (GT3)'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-white/80">
                                        <span className="text-white/40 text-[11px]">IP Address:</span>
                                        <span className="font-mono text-[11px] text-white/50">{rig.ip}</span>
                                    </div>
                                </div>

                                {/* Telemetry snapshot if active */}
                                {isRacing && rig.telemetry && (
                                    <div className="p-3 bg-white/5 border border-white/5 rounded-xl grid grid-cols-2 gap-2 text-xs mb-4">
                                        <div>
                                            <span className="text-[10px] text-white/40 block">Speed</span>
                                            <span className="font-mono font-bold text-white">
                                                {Math.round(rig.telemetry.velocity?.[0] || 0)} km/h
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-white/40 block">Lap / Time</span>
                                            <span className="font-mono font-bold text-emerald-400">
                                                {rig.telemetry.completed_laps || 0} / {rig.telemetry.last_lap_time || '--:--'}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Rig Controls */}
                            <div className="pt-3 border-t border-white/5 flex flex-wrap gap-2">
                                {isRacing ? (
                                    <button
                                        onClick={() => handleRigAction(rig.rig_id, 'KILL_RACE')}
                                        className="flex-1 py-1.5 bg-red-600/20 hover:bg-red-600 border border-red-600/40 hover:border-red-600 text-red-200 hover:text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                                    >
                                        <Square size={13} /> Abort
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleRigAction(rig.rig_id, 'LAUNCH_RACE')}
                                        className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/20"
                                    >
                                        <Play size={13} /> Launch
                                    </button>
                                )}

                                <button
                                    onClick={() => handleRigAction(rig.rig_id, 'SETUP_MODE')}
                                    className="p-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-lg transition-all"
                                    title="Switch to Setup/Car selection mode"
                                >
                                    <Wrench size={14} />
                                </button>

                                {onAssignDriver && (
                                    <button
                                        onClick={() => onAssignDriver(rig.rig_id)}
                                        className="p-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-lg transition-all"
                                        title="Quick Assign Driver"
                                    >
                                        <UserCheck size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Panic Kill Confirmation Modal */}
            {showPanicModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                    <div className="bg-ridge-panel border border-red-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
                        <div className="flex items-center gap-3 text-red-400">
                            <ShieldAlert size={28} />
                            <h3 className="text-lg font-black text-white uppercase tracking-wider">Confirm Global Panic Stop</h3>
                        </div>
                        <p className="text-xs text-white/70 leading-relaxed">
                            This will immediately send emergency kill commands to <strong>ALL {rigs.length} simulators</strong>, abort active sessions, and return rigs to standby.
                        </p>
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                onClick={() => setShowPanicModal(false)}
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white/70"
                            >
                                Cancel
                            </button>
                            <button
                                disabled={isKilling}
                                onClick={handlePanicKillAll}
                                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-red-600/30"
                            >
                                {isKilling ? 'Aborting...' : 'Yes, End All Sessions'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Account Binding Modal */}
            {selectedRigForDriver && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                    <div className="bg-ridge-panel border border-white/20 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-white/10">
                            <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                                    Bind Driver to {selectedRigForDriver.rig_id}
                                </h3>
                                <p className="text-[11px] text-white/50">
                                    Search registered account or manually enter a custom racer name.
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedRigForDriver(null)}
                                className="text-white/40 hover:text-white p-1 rounded"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Search Accounts DB */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-white/40 block">
                                1. Search Accounts Database
                            </label>
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-2.5 text-white/40 pointer-events-none" />
                                <input
                                    type="text"
                                    value={driverSearch}
                                    onChange={e => setDriverSearch(e.target.value)}
                                    placeholder="Search driver accounts by name, email, phone..."
                                    className="w-full bg-[#181818] border border-white/20 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-ridge-brand transition-colors"
                                />
                            </div>

                            {/* Driver results */}
                            <div className="max-h-40 overflow-y-auto space-y-1 bg-black/30 p-2 rounded-xl border border-white/5">
                                {filteredDrivers.length === 0 ? (
                                    <div className="text-center py-4 text-[11px] text-white/30">
                                        No registered accounts found
                                    </div>
                                ) : (
                                    filteredDrivers.slice(0, 8).map(d => (
                                        <button
                                            key={d.driver_uuid}
                                            disabled={isSubmittingDriver}
                                            onClick={() => handleAssignDriver(d)}
                                            className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-ridge-brand/20 border border-transparent hover:border-ridge-brand/40 flex items-center justify-between transition-colors group"
                                        >
                                            <div className="truncate">
                                                <div className="text-xs font-bold text-white group-hover:text-ridge-brand transition-colors">
                                                    {d.display_name}
                                                </div>
                                                <div className="text-[10px] text-white/40 font-mono truncate">
                                                    {d.email || d.phone || d.driver_uuid}
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-bold text-ridge-brand opacity-0 group-hover:opacity-100 transition-opacity">
                                                Select
                                            </span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Manual Name Input */}
                        <form onSubmit={handleAssignManualName} className="space-y-2 pt-2 border-t border-white/10">
                            <label className="text-[10px] font-black uppercase text-white/40 block">
                                2. Or Manually Enter Guest Name
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={manualDriverName}
                                    onChange={e => setManualDriverName(e.target.value)}
                                    placeholder="e.g. Mason (Guest)"
                                    className="flex-1 bg-[#181818] border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-ridge-brand transition-colors"
                                />
                                <button
                                    type="submit"
                                    disabled={isSubmittingDriver || !manualDriverName.trim()}
                                    className="px-4 py-2 bg-white/10 hover:bg-ridge-brand text-white text-xs font-bold uppercase rounded-xl transition-all"
                                >
                                    Set Name
                                </button>
                            </div>
                        </form>

                        {/* Unbind button */}
                        {selectedRigForDriver.driver_name && (
                            <div className="pt-2 border-t border-white/10 flex justify-between items-center">
                                <span className="text-[10px] text-white/40">
                                    Current: <strong className="text-white">{selectedRigForDriver.driver_name}</strong>
                                </span>
                                <button
                                    onClick={() => handleUnbindDriver(selectedRigForDriver.rig_id)}
                                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold transition-colors"
                                >
                                    Remove Account
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
