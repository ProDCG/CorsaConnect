import React from 'react'
import {
    LayoutDashboard,
    PlaySquare,
    Layers,
    Trophy,
    UserCheck,
    FolderSync,
    Timer,
    BarChart3,
    MessageSquare,
    Settings,
    Tv,
    ExternalLink,
    Zap,
} from 'lucide-react'
import { useLiveStream } from '../../context/LiveStreamContext'

export interface NavItem {
    id: string
    label: string
    path: string
    icon: React.ComponentType<{ className?: string }>
    badge?: number | string
}

export const Sidebar: React.FC<{
    currentPath: string
    onNavigate: (path: string) => void
}> = ({ currentPath, onNavigate }) => {
    const { isConnected, rigs, groups } = useLiveStream()
    const activeRigs = rigs.filter(r => r.status === 'racing')

    const navItems: NavItem[] = [
        { id: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard },
        { id: 'launcher', label: 'Launcher', path: '/launcher', icon: PlaySquare, badge: activeRigs.length > 0 ? activeRigs.length : undefined },
        { id: 'groups', label: 'Groups & Lineups', path: '/groups', icon: Layers, badge: groups.length > 0 ? groups.length : undefined },
        { id: 'leaderboard', label: 'Leaderboard', path: '/leaderboard', icon: Trophy },
        { id: 'drivers', label: 'Drivers & Check-in', path: '/drivers', icon: UserCheck },
        { id: 'sync', label: 'Content Sync', path: '/sync', icon: FolderSync },
        { id: 'laps', label: 'Telemetry Laps', path: '/laps', icon: Timer },
        { id: 'reports', label: 'Reports & Stats', path: '/reports', icon: BarChart3 },
        { id: 'discord', label: 'Discord Bot', path: '/discord', icon: MessageSquare },
        { id: 'settings', label: 'Settings', path: '/settings', icon: Settings },
    ]

    const isCurrent = (itemPath: string) => {
        if (itemPath === '/' && (currentPath === '/' || currentPath === '' || currentPath === '/dashboard')) {
            return true
        }
        return currentPath === itemPath
    }

    return (
        <aside className="w-64 bg-ridge-dark/95 border-r border-white/10 flex flex-col justify-between shrink-0 h-screen sticky top-0 select-none z-30">
            {/* Top Branding */}
            <div>
                <div className="p-5 border-b border-white/10 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                        <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <div className="text-sm font-black tracking-wider uppercase text-white flex items-center gap-1.5">
                            CorsaConnect
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold">
                                v2.0
                            </span>
                        </div>
                        <div className="text-[10px] text-white/40 tracking-wider uppercase font-semibold">
                            Ridge-Link Fleet Manager
                        </div>
                    </div>
                </div>

                {/* Nav items */}
                <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-220px)]">
                    {navItems.map(item => {
                        const active = isCurrent(item.path)
                        const Icon = item.icon
                        return (
                            <button
                                key={item.id}
                                onClick={() => onNavigate(item.path)}
                                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                    active
                                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/25'
                                        : 'text-white/60 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-white/50'}`} />
                                    <span>{item.label}</span>
                                </div>
                                {item.badge !== undefined && (
                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                                        active ? 'bg-white/20 text-white' : 'bg-indigo-500/20 text-indigo-300'
                                    }`}>
                                        {item.badge}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </nav>
            </div>

            {/* Bottom System Status & Displays */}
            <div className="p-4 border-t border-white/10 space-y-3 bg-black/20">
                {/* External Screens links */}
                <div className="flex items-center gap-2">
                    <a
                        href="/lobby"
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-1.5 px-2 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] font-bold text-white/70 hover:text-white flex items-center justify-center gap-1.5 transition-all border border-white/5"
                        title="Open Lobby TV Display in new tab"
                    >
                        <Tv className="w-3 h-3 text-indigo-400" />
                        Lobby TV
                        <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                    </a>
                    <a
                        href="/kiosk"
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-1.5 px-2 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] font-bold text-white/70 hover:text-white flex items-center justify-center gap-1.5 transition-all border border-white/5"
                        title="Open Driver Self-Kiosk in new tab"
                    >
                        <UserCheck className="w-3 h-3 text-emerald-400" />
                        Kiosk
                        <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                    </a>
                </div>

                {/* Connection status indicator */}
                <div className="flex items-center justify-between text-[11px] text-white/50 px-1">
                    <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
                        <span>{isConnected ? 'Live Stream Active' : 'Disconnected'}</span>
                    </span>
                    <span className="font-mono text-[10px] text-white/30">1 Hz SSE</span>
                </div>
            </div>
        </aside>
    )
}
