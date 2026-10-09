import React, { useState } from 'react'
import {
    LayoutDashboard,
    PlaySquare,
    Layers,
    Car,
    Gauge,
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
    ChevronLeft,
    ChevronRight,
} from 'lucide-react'
import { useLiveStream } from '../../context/LiveStreamContext'

export interface NavItem {
    id: string
    label: string
    path: string
    icon: any
    badge?: number | string
}

export const Sidebar: React.FC<{
    currentPath: string
    onNavigate: (path: string) => void
}> = ({ currentPath, onNavigate }) => {
    const { isConnected, rigs, groups } = useLiveStream()
    const [isCollapsed, setIsCollapsed] = useState<boolean>(false)
    const activeRigs = rigs.filter(r => r.status === 'racing')

    const navItems: NavItem[] = [
        { id: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard },
        { id: 'launcher', label: 'Launcher', path: '/launcher', icon: PlaySquare, badge: activeRigs.length > 0 ? activeRigs.length : undefined },
        { id: 'groups', label: 'Groups & Lineups', path: '/groups', icon: Layers, badge: groups.length > 0 ? groups.length : undefined },
        { id: 'cars', label: 'Fleet & Cars', path: '/cars', icon: Car },
        { id: 'monitor', label: 'Telemetry Monitor', path: '/monitor', icon: Gauge },
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
        <aside
            className={`${
                isCollapsed ? 'w-20' : 'w-64'
            } bg-ridge-dark/95 border-r border-white/10 flex flex-col justify-between shrink-0 h-screen sticky top-0 select-none z-30 transition-all duration-300`}
        >
            {/* Top Branding & Collapse Button */}
            <div>
                <div className={`p-4 border-b border-white/10 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between gap-2'}`}>
                    {!isCollapsed && (
                        <div className="flex items-center gap-3 overflow-hidden min-w-0">
                            <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                                <Zap className="w-5 h-5 text-white" />
                            </div>
                            <div className="overflow-hidden min-w-0">
                                <div className="text-sm font-black tracking-wider uppercase text-white truncate">
                                    CorsaConnect
                                </div>
                                <div className="text-[10px] text-white/40 tracking-wider uppercase font-semibold truncate">
                                    Ridge-Link Fleet
                                </div>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors shrink-0"
                        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={16} />}
                    </button>
                </div>

                {/* Nav items */}
                <nav className="p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-200px)]">
                    {navItems.map(item => {
                        const active = isCurrent(item.path)
                        const Icon = item.icon
                        return (
                            <button
                                key={item.id}
                                onClick={() => onNavigate(item.path)}
                                title={item.label}
                                className={`w-full flex items-center ${
                                    isCollapsed ? 'justify-center px-2 py-3' : 'justify-between px-3.5 py-2.5'
                                } rounded-xl text-xs font-bold transition-all relative group ${
                                    active
                                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/25'
                                        : 'text-white/60 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-white/50'}`} />
                                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                                </div>
                                {!isCollapsed && item.badge !== undefined && (
                                    <span
                                        className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                                            active ? 'bg-white/20 text-white' : 'bg-indigo-500/20 text-indigo-300'
                                        }`}
                                    >
                                        {item.badge}
                                    </span>
                                )}
                                {isCollapsed && item.badge !== undefined && (
                                    <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-indigo-400" />
                                )}
                            </button>
                        )
                    })}
                </nav>
            </div>

            {/* Bottom Status & Quick Display Links */}
            <div className="p-3 border-t border-white/10 space-y-2 bg-black/20">
                {!isCollapsed ? (
                    <>
                        <div className="flex items-center gap-2">
                            <a
                                href="/lobby"
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1 py-1.5 px-2 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] font-bold text-white/70 hover:text-white flex items-center justify-center gap-1.5 transition-all border border-white/5"
                                title="Open Lobby TV Display"
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
                                title="Open Driver Self-Kiosk"
                            >
                                <UserCheck className="w-3 h-3 text-emerald-400" />
                                Kiosk
                                <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                            </a>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-white/50 px-1 pt-1">
                            <span className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
                                <span>{isConnected ? 'Live Stream' : 'Offline'}</span>
                            </span>
                            <span className="font-mono text-[10px] text-white/30">1 Hz</span>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center gap-2 py-1">
                        <a
                            href="/lobby"
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-all"
                            title="Lobby TV"
                        >
                            <Tv size={16} className="text-indigo-400" />
                        </a>
                        <span
                            className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`}
                            title={isConnected ? 'Live Stream Active' : 'Disconnected'}
                        />
                    </div>
                )}
            </div>
        </aside>
    )
}
