import React from 'react'
import { Activity, Cpu, Monitor, Radio, AlertTriangle, CheckCircle, Clock, Trophy, Users, ShieldAlert, Flag } from 'lucide-react'
import { useLiveStream } from '../../context/LiveStreamContext'

export const DashboardModule: React.FC<{
    onNavigateTab?: (tab: string) => void
}> = ({ onNavigateTab }) => {
    const { rigs, groups, serverStatus, isConnected, activeSession, top10Today, snapshot } = useLiveStream()

    const activeRigs = rigs.filter(r => r.status === 'racing')
    const idleRigs = rigs.filter(r => r.status === 'idle')
    const offlineRigs = rigs.filter(r => r.status === 'offline')

    // Collect "Needs Attention" items
    const attentionItems: { id: string; title: string; desc: string; severity: 'warning' | 'danger'; actionTab?: string }[] = []

    rigs.forEach(r => {
        if (r.status === 'racing' && !r.driver_name) {
            attentionItems.push({
                id: `unassigned-${r.rig_id}`,
                title: `Unassigned Driver on ${r.rig_id}`,
                desc: 'Rig is actively racing but no driver profile has been attached.',
                severity: 'warning',
                actionTab: 'drivers',
            })
        }
        if (r.cpu_temp && r.cpu_temp > 80) {
            attentionItems.push({
                id: `temp-${r.rig_id}`,
                title: `High CPU Temp on ${r.rig_id} (${r.cpu_temp}°C)`,
                desc: 'Rig CPU temperature is nearing thermal throttling limits.',
                severity: 'danger',
                actionTab: 'launcher',
            })
        }
    })

    if (serverStatus === 'offline' && activeRigs.length > 0) {
        attentionItems.push({
            id: 'server-offline',
            title: 'Dedicated AC Server is Offline',
            desc: 'Active rigs are detected but dedicated multiplayer instance is stopped.',
            severity: 'danger',
            actionTab: 'launcher',
        })
    }

    return (
        <div className="space-y-6">
            {/* 1. System Health Bar */}
            <div className="bg-ridge-panel/80 border border-white/10 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-black uppercase tracking-wider text-white/50">System Status:</span>
                    <div className="flex items-center gap-2">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
                        <span className="text-xs font-bold text-white">
                            {isConnected ? 'Real-time Live Stream Active' : 'Connecting to Server...'}
                        </span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Server status pill */}
                    <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
                        serverStatus === 'online'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    }`}>
                        <Radio size={14} />
                        <span>AC Server: {serverStatus.toUpperCase()}</span>
                    </div>

                    {/* Sleds health pill */}
                    <div className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 flex items-center gap-2 text-xs font-semibold text-white/80">
                        <Monitor size={14} className="text-ridge-brand" />
                        <span>Sleds: {activeRigs.length + idleRigs.length} / {rigs.length} Online</span>
                    </div>

                    {/* Telemetry status pill */}
                    <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
                        snapshot?.health.telemetry_ok !== false
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-red-500/10 border-red-500/30 text-red-300'
                    }`}>
                        <Activity size={14} />
                        <span>Telemetry: {snapshot?.health.telemetry_ok !== false ? 'Healthy' : 'Stalled'}</span>
                    </div>
                </div>
            </div>

            {/* 2. Top-Level Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-ridge-panel/60 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all">
                    <div className="flex items-center justify-between text-white/50 mb-3">
                        <span className="text-xs font-black uppercase tracking-wider">Active Simulators</span>
                        <Monitor size={18} className="text-ridge-brand" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-white">{activeRigs.length}</span>
                        <span className="text-xs font-medium text-white/40">of {rigs.length} total rigs</span>
                    </div>
                    <div className="mt-3 text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                        <CheckCircle size={12} /> {idleRigs.length} rigs standby & ready
                    </div>
                </div>

                <div className="bg-ridge-panel/60 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all">
                    <div className="flex items-center justify-between text-white/50 mb-3">
                        <span className="text-xs font-black uppercase tracking-wider">Active Groups</span>
                        <Flag size={18} className="text-indigo-400" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-white">{groups.length}</span>
                        <span className="text-xs font-medium text-white/40">rig groups assigned</span>
                    </div>
                    <div className="mt-3 text-xs text-white/50">
                        {activeSession ? `Active Track: ${activeSession.track || 'Monza'}` : 'No active session'}
                    </div>
                </div>

                <div className="bg-ridge-panel/60 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all">
                    <div className="flex items-center justify-between text-white/50 mb-3">
                        <span className="text-xs font-black uppercase tracking-wider">Laps Recorded Today</span>
                        <Trophy size={18} className="text-amber-400" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-white">{top10Today.length}</span>
                        <span className="text-xs font-medium text-white/40">fastest laps logged</span>
                    </div>
                    <div className="mt-3 text-xs text-amber-400/80 font-semibold truncate">
                        {top10Today[0] ? `Leader: ${top10Today[0].driver_name || 'Driver'} (${Math.floor((top10Today[0].lap_time_ms || 0)/1000)}s)` : 'Awaiting first lap'}
                    </div>
                </div>

                <div className="bg-ridge-panel/60 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all">
                    <div className="flex items-center justify-between text-white/50 mb-3">
                        <span className="text-xs font-black uppercase tracking-wider">Registered Drivers</span>
                        <Users size={18} className="text-cyan-400" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-white">
                            {new Set(rigs.map(r => r.driver_name).filter(Boolean)).size || 1}
                        </span>
                        <span className="text-xs font-medium text-white/40">in active lounge</span>
                    </div>
                    <div className="mt-3 text-xs text-cyan-400/80 font-semibold">
                        Ready for instant assignment
                    </div>
                </div>
            </div>

            {/* 3. Needs Attention Queue & Recent Activity Feed */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Needs Attention Queue */}
                <div className="lg:col-span-1 bg-ridge-panel/60 border border-white/10 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <ShieldAlert size={18} className="text-amber-400" />
                            <h3 className="text-sm font-black text-white uppercase tracking-wider">Needs Attention</h3>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            attentionItems.length > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                        }`}>
                            {attentionItems.length}
                        </span>
                    </div>

                    {attentionItems.length === 0 ? (
                        <div className="py-8 text-center text-white/40">
                            <CheckCircle size={32} className="mx-auto mb-2 text-emerald-400 opacity-60" />
                            <p className="text-xs font-medium">All rigs and servers operating smoothly.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {attentionItems.map(item => (
                                <div
                                    key={item.id}
                                    className={`p-3.5 rounded-xl border text-xs ${
                                        item.severity === 'danger'
                                            ? 'bg-red-500/10 border-red-500/30 text-red-200'
                                            : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 font-bold mb-1">
                                        <AlertTriangle size={14} />
                                        <span>{item.title}</span>
                                    </div>
                                    <p className="text-[11px] text-white/60 mb-2">{item.desc}</p>
                                    {item.actionTab && onNavigateTab && (
                                        <button
                                            onClick={() => onNavigateTab(item.actionTab!)}
                                            className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[10px] font-black uppercase tracking-wider text-white transition-all"
                                        >
                                            Resolve in {item.actionTab}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Activity Feed */}
                <div className="lg:col-span-2 bg-ridge-panel/60 border border-white/10 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Clock size={18} className="text-ridge-brand" />
                            <h3 className="text-sm font-black text-white uppercase tracking-wider">Live Activity Stream</h3>
                        </div>
                        <span className="text-[11px] text-white/40">Real-time Telemetry Events</span>
                    </div>

                    <div className="space-y-2.5">
                        {activeRigs.length === 0 && top10Today.length === 0 ? (
                            <div className="py-12 text-center text-white/30 text-xs">
                                No live telemetry stream active. Launch a session to start tracking.
                            </div>
                        ) : (
                            <>
                                {activeRigs.map(rig => (
                                    <div
                                        key={rig.rig_id}
                                        className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between gap-4 text-xs hover:border-white/15 transition-all"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                                            <div>
                                                <div className="font-bold text-white flex items-center gap-2">
                                                    <span>{rig.rig_id}</span>
                                                    <span className="text-white/40 text-[11px]">({rig.driver_name || 'Unassigned'})</span>
                                                </div>
                                                <div className="text-[11px] text-white/50">
                                                    Car: {rig.selected_car || 'GT3'} • Speed: {Math.round(rig.telemetry?.velocity?.[0] || 0)} km/h
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <div className="font-mono font-bold text-emerald-400">
                                                Lap {rig.telemetry?.completed_laps || 0}
                                            </div>
                                            <div className="text-[10px] text-white/40">
                                                Last: {rig.telemetry?.last_lap_time || '--:--'}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {top10Today.slice(0, 3).map((lap, idx) => (
                                    <div
                                        key={lap.id || idx}
                                        className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-center justify-between gap-4 text-xs"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Trophy size={14} className="text-amber-400" />
                                            <div>
                                                <span className="font-bold text-white">#{idx + 1} {lap.driver_name || 'Driver'}</span>
                                                <span className="text-white/40 text-[11px]"> set a top lap on {lap.track || 'Track'}</span>
                                            </div>
                                        </div>
                                        <span className="font-mono font-black text-amber-400">
                                            {lap.lap_time_ms ? `${(lap.lap_time_ms / 1000).toFixed(3)}s` : '--'}
                                        </span>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
