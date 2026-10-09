import React, { useState, useEffect } from 'react'
import { Timer, Search, Trash2, CheckCircle2, XCircle, RefreshCw, Plus, Filter, ShieldAlert, ArrowUpDown } from 'lucide-react'
import { LeaderboardEntry } from '../../types'

export const LapsModule: React.FC = () => {
    const [laps, setLaps] = useState<LeaderboardEntry[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterTrack, setFilterTrack] = useState('all')
    const [filterValidity, setFilterValidity] = useState<'all' | 'valid' | 'invalid'>('all')
    const [sortBy, setSortBy] = useState<'fastest' | 'recent' | 'oldest' | 'slowest'>('fastest')
    const [tracksList, setTracksList] = useState<string[]>([])
    const [actionMsg, setActionMsg] = useState<string | null>(null)

    const formatLapTime = (ms?: number | null) => {
        if (!ms || ms <= 0) return '--:--.---'
        const mins = Math.floor(ms / 60000)
        const secs = Math.floor((ms % 60000) / 1000)
        const millis = ms % 1000
        return `${mins}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`
    }

    const fetchLaps = async () => {
        setIsLoading(true)
        try {
            const res = await fetch('/leaderboard/laps?limit=150')
            if (res.ok) {
                const data: LeaderboardEntry[] = await res.json()
                setLaps(data)
                const uniqueTracks = Array.from(new Set(data.map(l => l.track).filter(Boolean))) as string[]
                setTracksList(uniqueTracks)
            }
        } catch (e) {
            console.error('Failed to fetch raw telemetry laps:', e)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchLaps()
    }, [])

    const handleToggleValid = async (id?: number) => {
        if (!id) return
        try {
            const res = await fetch(`/leaderboard/laps/${id}/toggle_valid`, { method: 'POST' })
            if (res.ok) {
                setLaps(prev =>
                    prev.map(l => (l.id === id ? { ...l, is_valid: !l.is_valid } : l))
                )
                setActionMsg(`Lap #${id} validity updated.`)
                setTimeout(() => setActionMsg(null), 3000)
            }
        } catch (e) {
            console.error('Failed to toggle lap validity:', e)
        }
    }

    const handleDeleteLap = async (id?: number) => {
        if (!id) return
        if (!window.confirm(`Delete lap #${id} from the database?`)) return
        try {
            const res = await fetch(`/leaderboard/${id}`, { method: 'DELETE' })
            if (res.ok) {
                setLaps(prev => prev.filter(l => l.id !== id))
                setActionMsg(`Lap #${id} deleted.`)
                setTimeout(() => setActionMsg(null), 3000)
            }
        } catch (e) {
            console.error('Failed to delete lap:', e)
        }
    }

    const handleInjectTestLap = async () => {
        try {
            const res = await fetch('/leaderboard/test_lap', { method: 'POST' })
            if (res.ok) {
                setActionMsg('Sample test lap generated and recorded.')
                setTimeout(() => setActionMsg(null), 3000)
                fetchLaps()
            }
        } catch (e) {
            console.error('Failed to inject test lap:', e)
        }
    }

    // Filter and Sort laps
    const processedLaps = laps
        .filter(lap => {
            const matchesSearch =
                (lap.driver_name && lap.driver_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (lap.rig_id && lap.rig_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (lap.car && lap.car.toLowerCase().includes(searchTerm.toLowerCase()))
            const matchesTrack = filterTrack === 'all' || lap.track === filterTrack
            const isValid = lap.is_valid !== false
            const matchesValidity =
                filterValidity === 'all' ||
                (filterValidity === 'valid' && isValid) ||
                (filterValidity === 'invalid' && !isValid)

            return matchesSearch && matchesTrack && matchesValidity
        })
        .sort((a, b) => {
            if (sortBy === 'fastest') {
                const timeA = a.lap_time_ms && a.lap_time_ms > 0 ? a.lap_time_ms : Infinity
                const timeB = b.lap_time_ms && b.lap_time_ms > 0 ? b.lap_time_ms : Infinity
                if (timeA !== timeB) return timeA - timeB
                return (b.timestamp || 0) - (a.timestamp || 0)
            }
            if (sortBy === 'slowest') {
                const timeA = a.lap_time_ms && a.lap_time_ms > 0 ? a.lap_time_ms : -Infinity
                const timeB = b.lap_time_ms && b.lap_time_ms > 0 ? b.lap_time_ms : -Infinity
                if (timeA !== timeB) return timeB - timeA
                return (b.timestamp || 0) - (a.timestamp || 0)
            }
            if (sortBy === 'recent') {
                return (b.timestamp || 0) - (a.timestamp || 0)
            }
            if (sortBy === 'oldest') {
                return (a.timestamp || 0) - (b.timestamp || 0)
            }
            return 0
        })

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black uppercase tracking-wider text-white flex items-center gap-2">
                        <Timer className="w-5 h-5 text-indigo-400" />
                        Telemetry Laps & Sector Logs
                    </h2>
                    <p className="text-xs text-white/50">
                        Inspect, audit, and invalidate telemetry-logged lap times from all physical racing cockpits.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleInjectTestLap}
                        className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-white/70 hover:text-white transition-all text-xs font-bold flex items-center gap-1.5"
                    >
                        <Plus className="w-3.5 h-3.5 text-indigo-400" />
                        Simulate Lap
                    </button>
                    <button
                        onClick={fetchLaps}
                        disabled={isLoading}
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white/70 hover:text-white transition-all text-xs flex items-center gap-1.5"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Notification alert */}
            {actionMsg && (
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-xs text-indigo-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>{actionMsg}</span>
                </div>
            )}

            {/* Search & Filter Toolbar */}
            <div className="bg-ridge-panel/80 border border-white/10 rounded-2xl p-4 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                    <div className="relative w-full max-w-sm">
                        <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Filter by driver, rig ID, or car..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <ArrowUpDown className="w-3.5 h-3.5 text-white/40" />
                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as any)}
                            className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                        >
                            <option value="fastest">Fastest Lap Time</option>
                            <option value="recent">Most Recent</option>
                            <option value="oldest">Oldest First</option>
                            <option value="slowest">Slowest Lap Time</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <Filter className="w-3.5 h-3.5 text-white/40" />
                        <select
                            value={filterTrack}
                            onChange={e => setFilterTrack(e.target.value)}
                            className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        >
                            <option value="all">All Tracks</option>
                            {tracksList.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                        <button
                            onClick={() => setFilterValidity('all')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                filterValidity === 'all' ? 'bg-indigo-500 text-white' : 'text-white/50 hover:text-white'
                            }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilterValidity('valid')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                filterValidity === 'valid' ? 'bg-emerald-500 text-white' : 'text-white/50 hover:text-white'
                            }`}
                        >
                            Valid
                        </button>
                        <button
                            onClick={() => setFilterValidity('invalid')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                filterValidity === 'invalid' ? 'bg-rose-500 text-white' : 'text-white/50 hover:text-white'
                            }`}
                        >
                            Invalid
                        </button>
                    </div>
                </div>
            </div>

            {/* Laps Table */}
            <div className="bg-ridge-panel/80 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5 text-[11px] font-black uppercase tracking-wider text-white/50">
                                <th className="p-3 pl-4">ID</th>
                                <th className="p-3">Driver / Rig</th>
                                <th className="p-3">Track</th>
                                <th className="p-3">Car</th>
                                <th className="p-3">Lap</th>
                                <th className="p-3">Lap Time</th>
                                <th className="p-3">Validity</th>
                                <th className="p-3">Logged</th>
                                <th className="p-3 text-right pr-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={9} className="text-center py-12 text-white/40">
                                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
                                        Loading recorded laps...
                                    </td>
                                </tr>
                            ) : processedLaps.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="text-center py-12 text-white/40">
                                        No telemetry laps found matching current filter criteria.
                                    </td>
                                </tr>
                            ) : (
                                processedLaps.map(lap => {
                                    const isValid = lap.is_valid !== false
                                    const dateStr = lap.timestamp
                                        ? new Date(lap.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                        : '--'

                                    return (
                                        <tr key={lap.id || `${lap.rig_id}-${lap.timestamp}`} className="hover:bg-white/5 transition-colors">
                                            <td className="p-3 pl-4 font-mono text-white/40">#{lap.id || '-'}</td>
                                            <td className="p-3">
                                                <div className="font-bold text-white">
                                                    {lap.driver_name || <span className="text-white/40 italic">Guest</span>}
                                                </div>
                                                <div className="text-[10px] font-mono text-indigo-400">{lap.rig_id}</div>
                                            </td>
                                            <td className="p-3 font-medium text-white/80">{lap.track || '—'}</td>
                                            <td className="p-3 font-mono text-[11px] text-white/60 truncate max-w-[140px]" title={lap.car || ''}>
                                                {lap.car || '—'}
                                            </td>
                                            <td className="p-3 font-mono text-white/70">L{lap.lap}</td>
                                            <td className="p-3 font-mono text-sm font-black">
                                                <span className={isValid ? 'text-amber-400' : 'text-white/30 line-through'}>
                                                    {formatLapTime(lap.lap_time_ms)}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <button
                                                    onClick={() => handleToggleValid(lap.id)}
                                                    className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-all ${
                                                        isValid
                                                            ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                                                            : 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                                                    }`}
                                                    title="Click to toggle lap validity"
                                                >
                                                    {isValid ? (
                                                        <>
                                                            <CheckCircle2 className="w-3 h-3" />
                                                            Valid
                                                        </>
                                                    ) : (
                                                        <>
                                                            <XCircle className="w-3 h-3" />
                                                            Invalid
                                                        </>
                                                    )}
                                                </button>
                                            </td>
                                            <td className="p-3 text-[11px] text-white/40 font-mono">{dateStr}</td>
                                            <td className="p-3 text-right pr-4">
                                                <button
                                                    onClick={() => handleDeleteLap(lap.id)}
                                                    className="p-1.5 text-white/40 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                                                    title="Delete lap entry"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
