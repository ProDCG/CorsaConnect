import React, { useState, useEffect } from 'react'
import { BarChart3, Trophy, Medal, Car, MapPin, Users, Flame, RefreshCw, Zap, TrendingUp } from 'lucide-react'
import { useLiveStream } from '../../context/LiveStreamContext'

interface HallOfFameDriver {
    driver: string
    fastest_laps: number
}

export const ReportsModule: React.FC = () => {
    const { rigs, groups, top10Today, top10AllTime } = useLiveStream()
    const [hallOfFame, setHallOfFame] = useState<HallOfFameDriver[]>([])
    const [totalDriversCount, setTotalDriversCount] = useState<number>(0)
    const [totalLapsCount, setTotalLapsCount] = useState<number>(0)
    const [carPopularity, setCarPopularity] = useState<{ car: string; count: number }[]>([])
    const [trackPopularity, setTrackPopularity] = useState<{ track: string; count: number }[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const formatLapTime = (ms?: number | null) => {
        if (!ms || ms <= 0) return '--:--.---'
        const mins = Math.floor(ms / 60000)
        const secs = Math.floor((ms % 60000) / 1000)
        const millis = ms % 1000
        return `${mins}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`
    }

    const fetchReportData = async () => {
        setIsLoading(true)
        try {
            const [lobbyRes, driversRes, lapsRes] = await Promise.all([
                fetch('/api/lobby'),
                fetch('/drivers'),
                fetch('/leaderboard/laps?limit=300'),
            ])

            if (lobbyRes.ok) {
                const lData = await lobbyRes.json()
                if (lData.hall_of_fame) {
                    setHallOfFame(lData.hall_of_fame)
                }
            }

            if (driversRes.ok) {
                const dData = await driversRes.json()
                setTotalDriversCount(dData.length)
            }

            if (lapsRes.ok) {
                const lapsData = await lapsRes.json()
                setTotalLapsCount(lapsData.length)

                // Compute car and track popularity
                const carCounts: Record<string, number> = {}
                const trackCounts: Record<string, number> = {}

                lapsData.forEach((l: any) => {
                    if (l.car) carCounts[l.car] = (carCounts[l.car] || 0) + 1
                    if (l.track) trackCounts[l.track] = (trackCounts[l.track] || 0) + 1
                })

                setCarPopularity(
                    Object.entries(carCounts)
                        .map(([car, count]) => ({ car, count }))
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 5)
                )

                setTrackPopularity(
                    Object.entries(trackCounts)
                        .map(([track, count]) => ({ track, count }))
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 5)
                )
            }
        } catch (e) {
            console.error('Failed to load reports data:', e)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchReportData()
    }, [])

    const activeRigs = rigs.filter(r => r.status === 'racing')
    const onlineRigs = rigs.filter(r => r.status !== 'offline')
    const fleetUtilization = onlineRigs.length > 0 ? Math.round((activeRigs.length / onlineRigs.length) * 100) : 0

    const fastestLapToday = top10Today && top10Today.length > 0 ? top10Today[0] : null
    const fastestLapAllTime = top10AllTime && top10AllTime.length > 0 ? top10AllTime[0] : null

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black uppercase tracking-wider text-white flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-indigo-400" />
                        Facility Analytics & Leaderboard Reports
                    </h2>
                    <p className="text-xs text-white/50">
                        High-level insights into track usage, driver engagement, fleet utilization, and records.
                    </p>
                </div>
                <button
                    onClick={fetchReportData}
                    disabled={isLoading}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white/70 hover:text-white transition-all text-xs flex items-center gap-1.5"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh Stats
                </button>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-ridge-panel/80 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
                    <div className="flex items-center justify-between text-white/50 mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider">Registered Drivers</span>
                        <Users className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="text-2xl font-black text-white">{totalDriversCount}</div>
                    <div className="text-[10px] text-white/40 mt-1">Profile database entries</div>
                </div>

                <div className="bg-ridge-panel/80 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
                    <div className="flex items-center justify-between text-white/50 mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider">Total Laps Logged</span>
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-2xl font-black text-white">{totalLapsCount}</div>
                    <div className="text-[10px] text-white/40 mt-1">Telemetry recorded laps</div>
                </div>

                <div className="bg-ridge-panel/80 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
                    <div className="flex items-center justify-between text-white/50 mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider">Fleet Utilization</span>
                        <Zap className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-2xl font-black text-white">{fleetUtilization}%</div>
                    <div className="text-[10px] text-white/40 mt-1">{activeRigs.length} of {onlineRigs.length} online rigs active</div>
                </div>

                <div className="bg-ridge-panel/80 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
                    <div className="flex items-center justify-between text-white/50 mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider">Active Groups</span>
                        <Flame className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="text-2xl font-black text-white">{groups.length}</div>
                    <div className="text-[10px] text-white/40 mt-1">Concurrent race sessions</div>
                </div>
            </div>

            {/* Spotlight Grid: Fastest Today & All-Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 border border-indigo-500/20 rounded-2xl p-5 backdrop-blur-md relative overflow-hidden">
                    <div className="flex items-center gap-2 mb-3">
                        <Trophy className="w-5 h-5 text-amber-400" />
                        <span className="text-xs font-black uppercase tracking-wider text-amber-400">Fastest Lap Today</span>
                    </div>
                    {fastestLapToday ? (
                        <div className="space-y-2">
                            <div className="text-3xl font-black font-mono text-white">
                                {formatLapTime(fastestLapToday.lap_time_ms)}
                            </div>
                            <div className="text-sm font-bold text-white/90">
                                {fastestLapToday.driver_name || 'Anonymous Racer'} <span className="text-white/40 font-mono text-xs">({fastestLapToday.rig_id})</span>
                            </div>
                            <div className="text-xs text-white/60 flex items-center gap-3">
                                <span>Track: <strong className="text-white">{fastestLapToday.track}</strong></span>
                                <span>Car: <strong className="text-white">{fastestLapToday.car}</strong></span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-xs text-white/40 py-4">No laps recorded today yet.</div>
                    )}
                </div>

                <div className="bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border border-emerald-500/20 rounded-2xl p-5 backdrop-blur-md relative overflow-hidden">
                    <div className="flex items-center gap-2 mb-3">
                        <Medal className="w-5 h-5 text-emerald-400" />
                        <span className="text-xs font-black uppercase tracking-wider text-emerald-400">All-Time Facility Record</span>
                    </div>
                    {fastestLapAllTime ? (
                        <div className="space-y-2">
                            <div className="text-3xl font-black font-mono text-white">
                                {formatLapTime(fastestLapAllTime.lap_time_ms)}
                            </div>
                            <div className="text-sm font-bold text-white/90">
                                {fastestLapAllTime.driver_name || 'Anonymous Racer'} <span className="text-white/40 font-mono text-xs">({fastestLapAllTime.rig_id})</span>
                            </div>
                            <div className="text-xs text-white/60 flex items-center gap-3">
                                <span>Track: <strong className="text-white">{fastestLapAllTime.track}</strong></span>
                                <span>Car: <strong className="text-white">{fastestLapAllTime.car}</strong></span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-xs text-white/40 py-4">No all-time records in database.</div>
                    )}
                </div>
            </div>

            {/* Hall of Fame & Hot Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Hall of Fame */}
                <div className="bg-ridge-panel/80 border border-white/10 rounded-2xl p-5 space-y-4 backdrop-blur-md">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-amber-400" />
                        Driver Hall of Fame
                    </h3>
                    <p className="text-[11px] text-white/40">
                        Drivers with the highest number of session-best fastest lap victories.
                    </p>

                    {hallOfFame.length === 0 ? (
                        <div className="text-center py-6 text-xs text-white/40">
                            No Hall of Fame records yet.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {hallOfFame.map((entry, idx) => (
                                <div
                                    key={entry.driver}
                                    className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                                            idx === 0 ? 'bg-amber-400 text-black' : idx === 1 ? 'bg-slate-300 text-black' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-white/10 text-white/70'
                                        }`}>
                                            {idx + 1}
                                        </span>
                                        <span className="text-xs font-bold text-white">{entry.driver}</span>
                                    </div>
                                    <span className="text-xs font-mono font-bold text-amber-400">
                                        {entry.fastest_laps} Win{entry.fastest_laps > 1 ? 's' : ''}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Popular Cars */}
                <div className="bg-ridge-panel/80 border border-white/10 rounded-2xl p-5 space-y-4 backdrop-blur-md">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                        <Car className="w-4 h-4 text-indigo-400" />
                        Most Popular Cars
                    </h3>
                    <p className="text-[11px] text-white/40">
                        Vehicles selected most frequently by racers across logged sessions.
                    </p>

                    {carPopularity.length === 0 ? (
                        <div className="text-center py-6 text-xs text-white/40">
                            No vehicle session data yet.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {carPopularity.map((c, idx) => (
                                <div
                                    key={c.car}
                                    className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between"
                                >
                                    <span className="text-xs font-mono text-white/80 truncate max-w-[180px]" title={c.car}>
                                        {c.car}
                                    </span>
                                    <span className="text-xs font-bold text-indigo-400 font-mono">
                                        {c.count} Laps
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Popular Tracks */}
                <div className="bg-ridge-panel/80 border border-white/10 rounded-2xl p-5 space-y-4 backdrop-blur-md">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-purple-400" />
                        Most Raced Circuits
                    </h3>
                    <p className="text-[11px] text-white/40">
                        Circuits with the highest total lap volume.
                    </p>

                    {trackPopularity.length === 0 ? (
                        <div className="text-center py-6 text-xs text-white/40">
                            No circuit session data yet.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {trackPopularity.map((t, idx) => (
                                <div
                                    key={t.track}
                                    className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between"
                                >
                                    <span className="text-xs font-bold text-white">{t.track}</span>
                                    <span className="text-xs font-bold text-purple-400 font-mono">
                                        {t.count} Laps
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
