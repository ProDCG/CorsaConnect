import React, { useState } from 'react'
import { Trophy, Palette, Eye, Filter, Trash, Search, Clock, RotateCcw } from 'lucide-react'
import { useLiveStream } from '../../context/LiveStreamContext'
import { LeaderboardEntry } from '../../types'

export const LeaderboardModule: React.FC<{
    leaderboard?: LeaderboardEntry[]
    onDeleteLap?: (id: number) => void
}> = ({ leaderboard = [], onDeleteLap }) => {
    const { top10Today, top10AllTime, refresh } = useLiveStream()
    const [selectedView, setSelectedView] = useState<'today' | 'all' | 'custom'>('today')
    const [searchQuery, setSearchQuery] = useState<string>('')
    const [selectedTheme, setSelectedTheme] = useState<'dark' | 'neon' | 'clean'>('dark')
    const [selectedTrack, setSelectedTrack] = useState<string>('all')

    const currentList = selectedView === 'today' ? top10Today : top10AllTime

    const filteredLaps = currentList.filter(entry => {
        if (selectedTrack !== 'all' && entry.track !== selectedTrack) return false
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            const nameMatch = (entry.driver_name || '').toLowerCase().includes(q)
            const carMatch = (entry.car || '').toLowerCase().includes(q)
            const rigMatch = (entry.rig_id || '').toLowerCase().includes(q)
            if (!nameMatch && !carMatch && !rigMatch) return false
        }
        return true
    })

    const uniqueTracks = Array.from(new Set(currentList.map(e => e.track).filter(Boolean)))

    return (
        <div className="space-y-6">
            {/* Top Toolbar: View Selection & Theme Customizer */}
            <div className="bg-ridge-panel/60 border border-white/10 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-white/50 mr-2">Mode:</span>
                    <button
                        onClick={() => setSelectedView('today')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                            selectedView === 'today'
                                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                                : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white'
                        }`}
                    >
                        Today's Best ({top10Today.length})
                    </button>
                    <button
                        onClick={() => setSelectedView('all')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                            selectedView === 'all'
                                ? 'bg-ridge-brand text-white shadow-lg shadow-ridge-brand/30'
                                : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white'
                        }`}
                    >
                        All-Time Records ({top10AllTime.length})
                    </button>
                </div>

                {/* Theme Selector for Venue Displays */}
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-1 text-xs">
                    <Palette size={14} className="text-white/40 ml-2" />
                    <span className="text-white/40 text-[11px] font-bold uppercase">Theme:</span>
                    {(['dark', 'neon', 'clean'] as const).map(theme => (
                        <button
                            key={theme}
                            onClick={() => setSelectedTheme(theme)}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all ${
                                selectedTheme === theme
                                    ? 'bg-ridge-brand text-white'
                                    : 'text-white/60 hover:text-white'
                            }`}
                        >
                            {theme}
                        </button>
                    ))}
                </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                    <Search size={16} className="absolute left-3.5 top-3.5 text-white/40" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by driver, car, or rig ID..."
                        className="w-full bg-ridge-panel/60 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-ridge-brand"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Filter size={16} className="text-white/40 ml-2" />
                    <select
                        value={selectedTrack}
                        onChange={(e) => setSelectedTrack(e.target.value)}
                        className="w-full bg-ridge-panel/60 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ridge-brand"
                    >
                        <option value="all">All Tracks ({uniqueTracks.length})</option>
                        {uniqueTracks.map(t => (
                            <option key={t as string} value={t as string}>{t}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Main Content: Leaderboard Grid + Live TV Preview Pane */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Table View */}
                <div className="lg:col-span-2 bg-ridge-panel/60 border border-white/10 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Trophy size={18} className="text-amber-400" />
                            <h3 className="text-sm font-black text-white uppercase tracking-wider">
                                {selectedView === 'today' ? "Today's Podium" : "Hall of Fame Records"}
                            </h3>
                        </div>
                        <span className="text-[11px] text-white/40">{filteredLaps.length} Results</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-white/5 text-white/40 uppercase tracking-wider text-[10px]">
                                <tr>
                                    <th className="py-3 px-4">Pos</th>
                                    <th className="py-3 px-4">Driver</th>
                                    <th className="py-3 px-4">Car</th>
                                    <th className="py-3 px-4">Track</th>
                                    <th className="py-3 px-4 text-right">Best Lap</th>
                                    <th className="py-3 px-4 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredLaps.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-center text-white/30 text-xs">
                                            No lap records match the selected filters.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLaps.map((lap, idx) => {
                                        const ms = lap.lap_time_ms || 0
                                        const mins = Math.floor(ms / 60000)
                                        const secs = ((ms % 60000) / 1000).toFixed(3)
                                        const formattedTime = `${mins}:${Number(secs) < 10 ? '0' : ''}${secs}`

                                        return (
                                            <tr key={lap.id || idx} className="hover:bg-white/5 transition-colors">
                                                <td className="py-3 px-4 font-black">
                                                    {idx === 0 ? (
                                                        <span className="text-amber-400 font-bold">🥇 1</span>
                                                    ) : idx === 1 ? (
                                                        <span className="text-slate-300 font-bold">🥈 2</span>
                                                    ) : idx === 2 ? (
                                                        <span className="text-amber-600 font-bold">🥉 3</span>
                                                    ) : (
                                                        <span className="text-white/40">#{idx + 1}</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 font-bold text-white">
                                                    {lap.driver_name || 'Driver'}
                                                    <span className="text-white/30 block text-[10px] font-normal">{lap.rig_id}</span>
                                                </td>
                                                <td className="py-3 px-4 text-white/70 truncate max-w-[140px]">
                                                    {lap.car || 'GT3'}
                                                </td>
                                                <td className="py-3 px-4 text-white/60 capitalize">
                                                    {lap.track || 'Monza'}
                                                </td>
                                                <td className="py-3 px-4 text-right font-mono font-black text-emerald-400">
                                                    {formattedTime}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    {lap.id && onDeleteLap && (
                                                        <button
                                                            onClick={() => onDeleteLap(lap.id!)}
                                                            className="text-red-400/60 hover:text-red-400 p-1 rounded transition-colors"
                                                            title="Delete Lap"
                                                        >
                                                            <Trash size={13} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Live Preview Pane (Simulating Venue TV Screen) */}
                <div className="lg:col-span-1 bg-ridge-panel/60 border border-white/10 rounded-2xl p-5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Eye size={16} className="text-indigo-400" />
                            <h4 className="text-xs font-black text-white uppercase tracking-wider">Lobby TV Live Preview</h4>
                        </div>
                        <p className="text-[11px] text-white/50 mb-4">
                            Simulated real-time viewport of the venue's lounge TV display running theme: <strong>{selectedTheme.toUpperCase()}</strong>.
                        </p>

                        <div className={`rounded-xl border p-4 space-y-3 font-mono text-xs ${
                            selectedTheme === 'neon'
                                ? 'bg-indigo-950/80 border-cyan-500/50 text-cyan-300'
                                : selectedTheme === 'clean'
                                ? 'bg-slate-900 border-white/20 text-white'
                                : 'bg-black/90 border-white/10 text-white'
                        }`}>
                            <div className="flex items-center justify-between border-b border-white/10 pb-2 text-[10px] uppercase font-black">
                                <span>THE RIDGE RACING</span>
                                <span className="text-emerald-400">● LIVE</span>
                            </div>

                            <div className="space-y-1.5 text-[11px]">
                                {filteredLaps.slice(0, 5).map((l, i) => (
                                    <div key={i} className="flex justify-between items-center py-1 border-b border-white/5">
                                        <span>#{i + 1} {l.driver_name || 'Driver'}</span>
                                        <span className="text-emerald-400 font-bold">
                                            {l.lap_time_ms ? `${(l.lap_time_ms / 1000).toFixed(2)}s` : '--'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5">
                        <a
                            href="/lobby"
                            target="_blank"
                            rel="noreferrer"
                            className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-center text-xs font-bold text-white block uppercase tracking-wider transition-all"
                        >
                            Open Dedicated TV Feed (/lobby)
                        </a>
                    </div>
                </div>
            </div>
        </div>
    )
}
