import { useState, useEffect } from 'react'
import { Flag, Zap, Activity, Trophy, Crown, Timer, Play, Pause, RefreshCw, CheckCircle2 } from 'lucide-react'

interface DriverSessionStats {
    position: number
    driver_name?: string | null
    rig_id: string
    car?: string | null
    track?: string | null
    group_name?: string | null
    best_lap_time_ms?: number | null
    gap_ms: number
    total_laps: number
    last_lap_time_ms?: number | null
    timestamp?: number | null
}

interface RaceSession {
    session_id: string
    track?: string | null
    group_name?: string | null
    started_at?: number | null
    status: string // "racing" | "finished"
    drivers: DriverSessionStats[]
}

interface LobbyData {
    top_10_all_time: Array<{
        rig_id: string
        driver_name?: string | null
        car: string | null
        track: string | null
        timestamp: number
        lap: number
        lap_time_ms?: number | null
    }>
    top_10_today: Array<{
        rig_id: string
        driver_name?: string | null
        car: string | null
        track: string | null
        timestamp: number
        lap: number
        lap_time_ms?: number | null
    }>
    hall_of_fame: Array<{
        driver: string
        fastest_laps: number
    }>
    active_rigs: Array<{
        rig_id: string
        driver_name?: string | null
        status: string
        selected_car: string | null
        telemetry: {
            velocity?: [number, number, number]
            gear?: number
            completed_laps?: number
            normalized_pos?: number
        } | null
    }>
    total_rigs: number
    server_status: string
    sessions?: RaceSession[]
    current_session?: RaceSession | null
}

const formatCarName = (id: string) => id ? id.split('_').slice(1).join(' ').toUpperCase() : '—'
const formatTrack = (id: string) => id ? id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, ' ') : '—'

const formatTime = (totalMs?: number | null) => {
    if (!totalMs || totalMs <= 0) return '—'
    const mins = Math.floor(totalMs / 60000)
    const secs = Math.floor((totalMs % 60000) / 1000)
    const ms = totalMs % 1000
    return `${mins}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

const formatGap = (gapMs: number) => {
    if (gapMs === 0) return 'LEADER'
    const secs = (gapMs / 1000).toFixed(3)
    return `+${secs}s`
}

export default function Lobby() {
    const [data, setData] = useState<LobbyData | null>(null)
    const [activeScreen, setActiveScreen] = useState<'sessions' | 'facility'>('sessions')
    const [autoRotate, setAutoRotate] = useState<boolean>(true)
    const [countdown, setCountdown] = useState<number>(15)

    const ROTATION_INTERVAL = 15 // seconds

    useEffect(() => {
        const fetchLobby = async () => {
            try {
                const res = await fetch('/api/lobby')
                const json = await res.json()
                setData(json)
            } catch (err) {
                console.error('Lobby fetch failed:', err)
            }
        }
        fetchLobby()
        const interval = setInterval(fetchLobby, 1000)
        return () => clearInterval(interval)
    }, [])

    // Auto-rotation timer
    useEffect(() => {
        if (!autoRotate) return

        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    setActiveScreen((curr) => (curr === 'sessions' ? 'facility' : 'sessions'))
                    return ROTATION_INTERVAL
                }
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(timer)
    }, [autoRotate])

    if (!data) {
        return (
            <div className="h-screen w-screen bg-black flex items-center justify-center">
                <div className="animate-pulse text-white/20 font-black italic uppercase text-4xl tracking-tighter">
                    Connecting to Track Systems...
                </div>
            </div>
        )
    }

    const sessions = data.sessions || []
    const hasActiveSessions = sessions.length > 0

    const renderLeaderboardList = (list: any[], title: string, icon: React.ReactNode, emptyMessage: string) => (
        <div className="flex-1 overflow-y-auto pr-4">
            <h2 className="text-xl font-black italic uppercase tracking-tighter mb-6 flex items-center gap-3 text-white/80">
                {icon} {title}
            </h2>
            <div className="space-y-3">
                {list.length > 0 ? (
                    list.map((entry, idx) => (
                        <div
                            key={idx}
                            className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${
                                idx === 0
                                    ? 'bg-ridge-brand/10 border-2 border-ridge-brand/50 shadow-lg shadow-ridge-brand/10'
                                    : idx < 3
                                        ? 'bg-white/5 border border-white/10'
                                        : 'bg-white/[0.02] border border-white/5'
                            }`}
                        >
                            <div className={`text-2xl font-black italic w-8 text-center ${
                                idx === 0 ? 'text-ridge-brand' : idx < 3 ? 'text-white/60' : 'text-white/25'
                            }`}>
                                {idx + 1}
                            </div>
                            <div className="flex-1">
                                <p className="text-xl font-black italic uppercase tracking-tighter leading-none">
                                    {entry.driver_name || entry.rig_id}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                    {entry.driver_name && (
                                        <span className="text-[9px] font-mono text-white/30">{entry.rig_id}</span>
                                    )}
                                    <span className="text-[9px] font-bold uppercase text-white/40 tracking-widest">
                                        {formatCarName(entry.car || '')}
                                    </span>
                                    {entry.track && (
                                        <span className="text-[9px] font-bold uppercase text-white/25 tracking-widest">
                                            {formatTrack(entry.track)}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xl font-black italic tabular-nums text-white">
                                    {entry.lap_time_ms ? formatTime(entry.lap_time_ms) : '—'}
                                </p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="py-16 text-center">
                        <Flag size={32} className="mx-auto mb-4 text-white/5" />
                        <p className="text-lg font-black italic uppercase opacity-10 tracking-tighter">
                            {emptyMessage}
                        </p>
                    </div>
                )}
            </div>
        </div>
    )

    return (
        <div className="h-screen w-screen bg-[#050505] text-white overflow-hidden font-sans flex flex-col justify-between">
            {/* Top Auto-Rotation Progress Bar */}
            <div className="w-full h-1 bg-white/5">
                <div
                    className="h-full bg-ridge-brand transition-all duration-1000 ease-linear"
                    style={{ width: autoRotate ? `${((ROTATION_INTERVAL - countdown) / ROTATION_INTERVAL) * 100}%` : '100%' }}
                />
            </div>

            {/* Header */}
            <div className="flex justify-between items-center px-12 py-5 border-b border-white/5 shrink-0">
                <div className="flex items-center gap-6">
                    <div>
                        <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-none">
                            <span className="text-ridge-brand">Ridge</span> Racing
                        </h1>
                        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/40 mt-1">
                            Live Facility Leaderboard
                        </p>
                    </div>

                    {/* Mode Toggle Pills */}
                    <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10 ml-6">
                        <button
                            onClick={() => {
                                setActiveScreen('sessions')
                                setCountdown(ROTATION_INTERVAL)
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black italic uppercase tracking-wider transition-all ${
                                activeScreen === 'sessions'
                                    ? 'bg-ridge-brand text-black shadow-md'
                                    : 'text-white/40 hover:text-white'
                            }`}
                        >
                            Race Standings
                        </button>
                        <button
                            onClick={() => {
                                setActiveScreen('facility')
                                setCountdown(ROTATION_INTERVAL)
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black italic uppercase tracking-wider transition-all ${
                                activeScreen === 'facility'
                                    ? 'bg-ridge-brand text-black shadow-md'
                                    : 'text-white/40 hover:text-white'
                            }`}
                        >
                            Facility Records
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    {/* Auto-Rotation Control Button */}
                    <button
                        onClick={() => setAutoRotate(!autoRotate)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                            autoRotate
                                ? 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                                : 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                        }`}
                        title={autoRotate ? 'Pause 15s screen rotation' : 'Resume 15s screen rotation'}
                    >
                        {autoRotate ? <Pause size={12} /> : <Play size={12} />}
                        <span>{autoRotate ? `Flip in ${countdown}s` : 'Rotation Paused'}</span>
                    </button>

                    <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5">
                        <div className={`w-2.5 h-2.5 rounded-full ${data.active_rigs.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-white/20'}`} />
                        <span className="text-[11px] font-black uppercase tracking-widest text-white/50">
                            {data.active_rigs.length} Racing / {data.total_rigs} Online
                        </span>
                    </div>
                </div>
            </div>

            {/* SCREEN 1: CURRENT / RECENT RACE SESSIONS */}
            {activeScreen === 'sessions' && (
                <div className="flex-1 p-8 overflow-y-auto animate-fadeIn">
                    {hasActiveSessions ? (
                        <div className={`grid gap-8 ${sessions.length > 1 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                            {sessions.map((sess) => {
                                const isRacing = sess.status === 'racing'
                                return (
                                    <div
                                        key={sess.session_id}
                                        className="bg-white/[0.02] border border-white/10 rounded-3xl p-7 flex flex-col justify-between shadow-2xl relative overflow-hidden"
                                    >
                                        {/* Session Top Bar */}
                                        <div className="flex justify-between items-start mb-6 border-b border-white/5 pb-4">
                                            <div>
                                                <div className="flex items-center gap-3">
                                                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                                                        isRacing 
                                                            ? 'bg-green-500/15 text-green-400 border-green-500/30 animate-pulse'
                                                            : 'bg-white/5 text-white/40 border-white/10'
                                                    }`}>
                                                        {isRacing ? '● LIVE SESSION' : '🏁 SESSION COMPLETED'}
                                                    </span>
                                                    <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">
                                                        {sess.group_name || 'Race Session'}
                                                    </h2>
                                                </div>
                                                <p className="text-xs font-bold uppercase tracking-widest text-white/40 mt-1">
                                                    Track: <span className="text-ridge-brand font-black">{formatTrack(sess.track || '')}</span>
                                                </p>
                                            </div>

                                            <div className="text-right">
                                                <span className="text-xs font-mono text-white/30">{sess.drivers.length} Drivers</span>
                                            </div>
                                        </div>

                                        {/* Drivers Standings Table */}
                                        <div className="space-y-3 flex-1">
                                            {sess.drivers.length > 0 ? (
                                                sess.drivers.map((d, idx) => (
                                                    <div
                                                        key={d.rig_id}
                                                        className={`flex items-center justify-between p-4 rounded-2xl transition-all ${
                                                            idx === 0
                                                                ? 'bg-ridge-brand/10 border-2 border-ridge-brand/60 shadow-lg shadow-ridge-brand/10'
                                                                : idx === 1
                                                                    ? 'bg-white/[0.04] border border-white/15'
                                                                    : idx === 2
                                                                        ? 'bg-white/[0.03] border border-white/10'
                                                                        : 'bg-white/[0.015] border border-white/5'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className={`text-2xl font-black italic w-8 text-center ${
                                                                idx === 0 ? 'text-ridge-brand' : idx < 3 ? 'text-white/60' : 'text-white/30'
                                                            }`}>
                                                                {idx === 0 ? <Crown className="inline text-ridge-brand mb-1" size={20} /> : `P${d.position}`}
                                                            </div>
                                                            <div>
                                                                <p className="text-xl font-black italic uppercase tracking-tight">
                                                                    {d.driver_name || d.rig_id}
                                                                </p>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    <span className="text-[9px] font-mono text-white/30">{d.rig_id}</span>
                                                                    {d.car && (
                                                                        <span className="text-[9px] font-bold uppercase text-white/40 tracking-wider">
                                                                            {formatCarName(d.car)}
                                                                        </span>
                                                                    )}
                                                                    <span className="text-[9px] font-mono text-white/30">
                                                                        • {d.total_laps} {d.total_laps === 1 ? 'Lap' : 'Laps'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Lap Times & Gap */}
                                                        <div className="text-right flex items-center gap-6">
                                                            <div>
                                                                <p className="text-xs font-black uppercase text-white/30 tracking-widest">Gap</p>
                                                                <p className={`text-sm font-black italic tabular-nums ${
                                                                    idx === 0 ? 'text-ridge-brand' : 'text-amber-400/90'
                                                                }`}>
                                                                    {formatGap(d.gap_ms)}
                                                                </p>
                                                            </div>

                                                            <div className="min-w-[100px]">
                                                                <p className="text-xs font-black uppercase text-white/30 tracking-widest">Best Lap</p>
                                                                <p className="text-2xl font-black italic tabular-nums text-white">
                                                                    {formatTime(d.best_lap_time_ms)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="py-12 text-center text-white/20">
                                                    <Timer size={32} className="mx-auto mb-2 opacity-40" />
                                                    <p className="text-sm font-black italic uppercase tracking-wider">Awaiting Lap Times</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center py-20">
                            <Flag size={48} className="text-white/10 mb-4" />
                            <h3 className="text-2xl font-black italic uppercase tracking-tight text-white/40">
                                No Active Race Sessions
                            </h3>
                            <p className="text-xs font-bold uppercase tracking-widest text-white/20 mt-2">
                                Start a race from the orchestrator dashboard to view live session standings.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* SCREEN 2: FACILITY RECORDS & HALL OF FAME */}
            {activeScreen === 'facility' && (
                <div className="flex-1 flex h-[calc(100vh-96px)] animate-fadeIn">
                    {/* Leaderboards */}
                    <div className="flex-1 p-8 flex gap-8">
                        {renderLeaderboardList(data.top_10_today || [], "Today's Fastest", <Activity className="text-amber-400" size={24}/>, "No Laps Today")}
                        <div className="w-px bg-white/5 h-full"></div>
                        {renderLeaderboardList(data.top_10_all_time || [], "All-Time Records", <Trophy className="text-ridge-brand" size={24}/>, "No Records Yet")}
                    </div>

                    {/* Sidebar */}
                    <div className="w-80 border-l border-white/5 p-8 flex flex-col overflow-y-auto">
                        {/* Live Ticker */}
                        <div className="mb-10">
                            <h2 className="text-sm font-black italic uppercase tracking-tighter mb-4 flex items-center gap-2">
                                <Activity size={16} className="text-green-500" /> Live Now
                            </h2>
                            <div className="space-y-3">
                                {data.active_rigs.map(rig => (
                                    <div key={rig.rig_id} className="bg-white/5 rounded-xl p-4 border border-white/5">
                                        <div className="flex justify-between items-center mb-2">
                                            <div>
                                                <span className="font-black italic uppercase text-sm">{rig.driver_name || rig.rig_id}</span>
                                            </div>
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                        </div>
                                        {rig.selected_car && (
                                            <p className="text-[9px] font-bold uppercase text-white/30 tracking-widest mb-2">
                                                {formatCarName(rig.selected_car)}
                                            </p>
                                        )}
                                        {rig.telemetry && (
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="bg-black/30 p-2 rounded-lg">
                                                    <p className="text-[7px] font-black uppercase text-white/40">Speed</p>
                                                    <p className="text-sm font-black italic tabular-nums">
                                                        {Math.round(rig.telemetry.velocity?.[0] || 0)}
                                                        <span className="text-[7px] text-ridge-brand ml-1">KM/H</span>
                                                    </p>
                                                </div>
                                                <div className="bg-black/30 p-2 rounded-lg">
                                                    <p className="text-[7px] font-black uppercase text-white/40">Gear</p>
                                                    <p className="text-sm font-black italic">
                                                        {rig.telemetry.gear === -1 ? 'R' : rig.telemetry.gear === 0 ? 'N' : rig.telemetry.gear}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {data.active_rigs.length === 0 && (
                                    <div className="py-6 text-center opacity-20">
                                        <Zap size={24} className="mx-auto mb-2" />
                                        <p className="text-[10px] uppercase font-black tracking-widest">No Active Races</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Hall of Fame */}
                        <div>
                            <h2 className="text-sm font-black italic uppercase tracking-tighter mb-4 flex items-center gap-2">
                                <Crown size={16} className="text-yellow-500" /> Hall of Fame
                            </h2>
                            <div className="space-y-2">
                                {(data.hall_of_fame || []).slice(0, 8).map((hof, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-white/[0.02] p-3 rounded-xl border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <span className={`text-xs font-black italic ${idx === 0 ? 'text-yellow-500' : 'text-white/30'}`}>#{idx + 1}</span>
                                            <span className="text-sm font-black italic uppercase tracking-tighter text-white/80">{hof.driver}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-black tabular-nums text-white/50">{hof.fastest_laps}</span>
                                            <span className="text-[8px] font-bold uppercase text-white/30 ml-1">Wins</span>
                                        </div>
                                    </div>
                                ))}
                                {(data.hall_of_fame || []).length === 0 && (
                                    <div className="py-6 text-center opacity-20">
                                        <p className="text-[10px] uppercase font-black tracking-widest">No Legends Yet</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
