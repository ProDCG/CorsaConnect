import React, { useState, useEffect } from 'react'
import {
    Activity,
    ChevronRight,
    ChevronLeft,
    Lock,
    Unlock,
    User,
    UserCheck,
    Search,
    X,
    UserMinus,
    Check,
    Cpu,
    Zap,
    Volume2,
} from 'lucide-react'
import { useLiveStream } from '../../context/LiveStreamContext'
import { Rig, Driver } from '../../types'

const VOICE_ROOMS = ['Room 1', 'Room 2', 'Room 3', 'Room 4', 'Room 5', 'Room 6']

export const RightRigDrawer: React.FC = () => {
    const { rigs, refresh } = useLiveStream()
    const [isOpen, setIsOpen] = useState<boolean>(true)
    const [selectedRigForDriver, setSelectedRigForDriver] = useState<Rig | null>(null)
    const [driversList, setDriversList] = useState<Driver[]>([])
    const [driverSearch, setDriverSearch] = useState<string>('')
    const [manualDriverName, setManualDriverName] = useState<string>('')
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

    const fetchDrivers = async () => {
        try {
            const res = await fetch('/drivers')
            if (res.ok) {
                const data = await res.json()
                if (Array.isArray(data)) {
                    setDriversList(data)
                }
            }
        } catch (e) {
            console.error('Failed to load drivers for drawer:', e)
        }
    }

    useEffect(() => {
        if (selectedRigForDriver) {
            fetchDrivers()
            setDriverSearch('')
            setManualDriverName(selectedRigForDriver.driver_name || '')
        }
    }, [selectedRigForDriver])

    const handleToggleMode = async (rig: Rig) => {
        const currentMode = rig.mode || 'lockout'
        const nextMode = currentMode === 'lockout' ? 'freeuse' : 'lockout'
        try {
            await fetch(`/rigs/${rig.rig_id}/mode`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: nextMode }),
            })
            refresh()
        } catch (e) {
            console.error('Failed to toggle rig mode:', e)
        }
    }

    const handleAssignDriver = async (driver: Driver) => {
        if (!selectedRigForDriver) return
        setIsSubmitting(true)
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
            setIsSubmitting(false)
        }
    }

    const handleAssignManualName = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedRigForDriver) return
        setIsSubmitting(true)
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
            setIsSubmitting(false)
        }
    }

    const handleUnbindDriver = async (rigId: string) => {
        setIsSubmitting(true)
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
            setIsSubmitting(false)
        }
    }

    const handleAssignVoice = async (rigId: string, channel: string) => {
        try {
            if (!channel || channel === 'none') {
                await fetch('/api/mumble/unassign', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rig_id: rigId }),
                })
            } else {
                await fetch('/api/mumble/assign', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rig_id: rigId, channel }),
                })
            }
            refresh()
        } catch (e) {
            console.error('Failed to assign voice room:', e)
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

    return (
        <>
            {/* Drawer Container */}
            {isOpen ? (
                <aside className="w-80 border-l border-white/10 bg-[#0d0d0d] flex flex-col shrink-0 h-screen sticky top-0 overflow-hidden z-20 select-none">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 bg-black/40">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span className="text-[11px] font-black uppercase tracking-wider text-white">
                                Connected Rigs ({rigs.length})
                            </span>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-white/40 hover:text-white p-1 hover:bg-white/5 rounded transition-colors"
                            title="Collapse panel"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* Rigs List */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                        {rigs.length === 0 ? (
                            <div className="px-4 py-16 text-center text-white/30 text-xs">
                                <Activity size={24} className="mx-auto mb-2 opacity-20" />
                                No rigs detected online
                            </div>
                        ) : (
                            rigs.map(rig => {
                                const isRacing = rig.status === 'racing'
                                const isReady = rig.status === 'ready'
                                const isLocked = (rig.mode || 'lockout') === 'lockout'

                                return (
                                    <div
                                        key={rig.rig_id}
                                        className={`rounded-xl p-3 border transition-all ${
                                            isRacing
                                                ? 'bg-ridge-brand/10 border-ridge-brand/40'
                                                : isReady
                                                ? 'bg-emerald-500/10 border-emerald-500/30'
                                                : 'bg-white/5 border-white/10'
                                        }`}
                                    >
                                        {/* Rig Row 1: ID, Status, Lock */}
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-xs text-white tracking-wider">
                                                    {rig.rig_id}
                                                </span>
                                                <code className="text-[10px] text-white/30 font-mono">
                                                    {rig.ip}
                                                </code>
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                <span
                                                    className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider ${
                                                        isRacing
                                                            ? 'bg-ridge-brand text-white animate-pulse'
                                                            : isReady
                                                            ? 'bg-emerald-500 text-black'
                                                            : rig.status === 'offline'
                                                            ? 'bg-red-500/20 text-red-400'
                                                            : 'bg-white/10 text-white/60'
                                                    }`}
                                                >
                                                    {rig.status}
                                                </span>

                                                <button
                                                    onClick={() => handleToggleMode(rig)}
                                                    className={`p-1 rounded transition-colors ${
                                                        isLocked
                                                            ? 'text-white/40 hover:text-amber-400 hover:bg-amber-500/10'
                                                            : 'text-emerald-400 hover:text-red-400 hover:bg-red-500/10'
                                                    }`}
                                                    title={isLocked ? 'Unlock rig' : 'Lock rig to lockout'}
                                                >
                                                    {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Rig Row 2: Driver Account Binding Button */}
                                        <div className="bg-black/40 rounded-lg p-2 border border-white/5 flex items-center justify-between gap-2">
                                            <button
                                                onClick={() => setSelectedRigForDriver(rig)}
                                                className="flex-1 text-left flex items-center gap-2 hover:opacity-80 transition-opacity overflow-hidden"
                                                title="Click to assign or change account"
                                            >
                                                <User size={13} className={rig.driver_name ? 'text-ridge-brand shrink-0' : 'text-white/30 shrink-0'} />
                                                <div className="truncate">
                                                    <span className={`text-[11px] font-bold block truncate ${rig.driver_name ? 'text-white' : 'text-white/40 italic'}`}>
                                                        {rig.driver_name || 'Unassigned (Click to bind)'}
                                                    </span>
                                                </div>
                                            </button>

                                            {rig.driver_name && (
                                                <button
                                                    onClick={() => handleUnbindDriver(rig.rig_id)}
                                                    className="text-white/30 hover:text-red-400 p-1 rounded transition-colors shrink-0"
                                                    title="Remove bound account"
                                                >
                                                    <UserMinus size={12} />
                                                </button>
                                            )}
                                        </div>

                                        {/* Rig Row 3: Voice Room Selector */}
                                        <div className="mt-1.5 flex items-center justify-between gap-1.5 bg-black/20 rounded-lg px-2 py-1 border border-white/5 text-[10px]">
                                            <div className="flex items-center gap-1.5 text-white/40 shrink-0">
                                                <Volume2 size={11} className={rig.mumble_channel ? 'text-indigo-400' : 'text-white/30'} />
                                                <span className="font-semibold text-[9px] uppercase tracking-wider">Voice</span>
                                            </div>
                                            <select
                                                value={rig.mumble_channel || ''}
                                                onChange={(e) => handleAssignVoice(rig.rig_id, e.target.value)}
                                                className={`bg-transparent text-right font-mono text-[10px] font-bold outline-none cursor-pointer hover:text-white transition-colors ${
                                                    rig.mumble_channel ? 'text-indigo-300 font-bold' : 'text-white/30'
                                                }`}
                                            >
                                                <option value="" className="bg-[#121212] text-white/50">Lobby (None)</option>
                                                {VOICE_ROOMS.map(room => (
                                                    <option key={room} value={room} className="bg-[#121212] text-white">
                                                        {room}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Telemetry snippet */}
                                        {rig.selected_car && (
                                            <div className="mt-1.5 text-[9px] text-white/40 font-mono truncate">
                                                Car: <span className="text-white/60">{rig.selected_car}</span>
                                            </div>
                                        )}
                                    </div>
                                )
                            })
                        )}
                    </div>
                </aside>
            ) : (
                /* Collapsed Tab Toggle Button */
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed top-1/2 right-0 -translate-y-1/2 z-40 bg-[#0d0d0d] border border-white/20 border-r-0 rounded-l-xl px-2 py-4 text-white/40 hover:text-white transition-colors shadow-2xl flex flex-col items-center gap-2"
                    title="Open Connected Rigs Drawer"
                >
                    <ChevronLeft size={16} />
                    <span className="text-[9px] font-black uppercase [writing-mode:vertical-lr] tracking-widest text-white/60">
                        Rigs ({rigs.length})
                    </span>
                </button>
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
                                            disabled={isSubmitting}
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
                                    disabled={isSubmitting || !manualDriverName.trim()}
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
        </>
    )
}
