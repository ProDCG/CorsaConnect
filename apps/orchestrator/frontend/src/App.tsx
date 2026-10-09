import React from 'react'
import Kiosk from './Kiosk'
import Lobby from './Lobby'
import { LiveStreamProvider, useLiveStream } from './context/LiveStreamContext'
import { Router, useLocation, useNavigate, Routes, Route } from './components/navigation/Router'
import { Sidebar } from './components/navigation/Sidebar'
import SessionTimerBar from './components/SessionTimerBar'

// 10 Modular Components
import { DashboardModule } from './components/modules/DashboardModule'
import { LauncherModule } from './components/modules/LauncherModule'
import { GroupsModule } from './components/modules/GroupsModule'
import { LeaderboardModule } from './components/modules/LeaderboardModule'
import { DriversModule } from './components/modules/DriversModule'
import { ContentSyncModule } from './components/modules/ContentSyncModule'
import { LapsModule } from './components/modules/LapsModule'
import { ReportsModule } from './components/modules/ReportsModule'
import { DiscordModule } from './components/modules/DiscordModule'
import { SettingsModule } from './components/modules/SettingsModule'

const AdminLayout: React.FC = () => {
    const { pathname } = useLocation()
    const navigate = useNavigate()
    const { isConnected, serverStatus, rigs, groups } = useLiveStream()
    const activeRigs = rigs.filter(r => r.status === 'racing')

    const getModuleTitle = () => {
        switch (pathname) {
            case '/':
            case '/dashboard':
                return 'Command Dashboard'
            case '/launcher':
                return 'Sim Rig Launcher & Fleet Control'
            case '/groups':
                return 'Race Groups & Lineup Manager'
            case '/leaderboard':
                return 'Live Leaderboard & Display Appearance'
            case '/drivers':
                return 'Driver Registry & Check-in'
            case '/sync':
                return 'Content & Mod Synchronization'
            case '/laps':
                return 'Telemetry Lap Audits'
            case '/reports':
                return 'Facility Analytics & Reports'
            case '/discord':
                return 'Discord Webhook Integration'
            case '/settings':
                return 'Settings & Physical Infrastructure'
            default:
                return 'CorsaConnect Orchestrator'
        }
    }

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-ridge-dark text-white font-sans">
            {/* Global Session Timer Bar for active races */}
            <SessionTimerBar />

            {/* Sidebar Navigation (10 Modules) */}
            <Sidebar currentPath={pathname} onNavigate={navigate} />

            {/* Main Application Container */}
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                {/* Header Bar */}
                <header className="h-16 border-b border-white/10 bg-ridge-panel/40 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-20">
                    <div className="flex items-center gap-3">
                        <h1 className="text-base font-black uppercase tracking-wider text-white">
                            {getModuleTitle()}
                        </h1>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/50">
                            {activeRigs.length} Active / {rigs.length} Sims
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Server Status Pill */}
                        <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl text-xs font-bold">
                            <span className={`w-2 h-2 rounded-full ${serverStatus === 'online' ? 'bg-emerald-400' : 'bg-white/30'}`} />
                            <span className="text-white/70">AC Server:</span>
                            <span className={serverStatus === 'online' ? 'text-emerald-400 uppercase text-[10px]' : 'text-white/40 uppercase text-[10px]'}>
                                {serverStatus}
                            </span>
                        </div>

                        {/* Stream Heartbeat */}
                        <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl text-xs font-bold">
                            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
                            <span className="text-white/50 text-[11px] font-mono">SSE Stream</span>
                        </div>
                    </div>
                </header>

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-ridge-dark to-black/60">
                    <div className="max-w-7xl mx-auto pb-12">
                        {pathname === '/' || pathname === '/dashboard' || pathname === '' ? (
                            <DashboardModule onNavigateTab={(tab) => navigate('/' + tab)} />
                        ) : pathname === '/launcher' ? (
                            <LauncherModule />
                        ) : pathname === '/groups' ? (
                            <GroupsModule />
                        ) : pathname === '/leaderboard' ? (
                            <LeaderboardModule />
                        ) : pathname === '/drivers' ? (
                            <DriversModule />
                        ) : pathname === '/sync' ? (
                            <ContentSyncModule />
                        ) : pathname === '/laps' ? (
                            <LapsModule />
                        ) : pathname === '/reports' ? (
                            <ReportsModule />
                        ) : pathname === '/discord' ? (
                            <DiscordModule />
                        ) : pathname === '/settings' ? (
                            <SettingsModule />
                        ) : (
                            <DashboardModule onNavigateTab={(tab) => navigate('/' + tab)} />
                        )}
                    </div>
                </main>
            </div>
        </div>
    )
}

export default function App() {
    const isKiosk = window.location.pathname === '/kiosk'
    const isLobby = window.location.pathname === '/lobby'

    if (isKiosk) {
        return <Kiosk />
    }
    if (isLobby) {
        return <Lobby />
    }

    return (
        <LiveStreamProvider>
            <Router>
                <AdminLayout />
            </Router>
        </LiveStreamProvider>
    )
}
