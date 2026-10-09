import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { Rig, RigGroup, LeaderboardEntry, StreamSnapshot } from '../types'

interface LiveStreamContextType {
    snapshot: StreamSnapshot | null
    rigs: Rig[]
    groups: RigGroup[]
    serverStatus: 'online' | 'offline'
    isConnected: boolean
    activeSession: any
    top10Today: LeaderboardEntry[]
    top10AllTime: LeaderboardEntry[]
    refresh: () => void
}

const LiveStreamContext = createContext<LiveStreamContextType>({
    snapshot: null,
    rigs: [],
    groups: [],
    serverStatus: 'offline',
    isConnected: false,
    activeSession: null,
    top10Today: [],
    top10AllTime: [],
    refresh: () => {},
})

export const LiveStreamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [snapshot, setSnapshot] = useState<StreamSnapshot | null>(null)
    const [isConnected, setIsConnected] = useState<boolean>(false)

    // Fallback manual fetch
    const fetchState = useCallback(async () => {
        try {
            const [rigsRes, groupsRes, serverRes] = await Promise.all([
                fetch('/rigs').then(r => r.ok ? r.json() : []).catch(() => []),
                fetch('/groups').then(r => r.ok ? r.json() : []).catch(() => []),
                fetch('/server/status').then(r => r.ok ? r.json() : { status: 'offline' }).catch(() => ({ status: 'offline' })),
            ])
            setSnapshot(prev => ({
                timestamp: Date.now() / 1000,
                server_status: serverRes.status || 'offline',
                rigs: rigsRes,
                active_rigs_count: (rigsRes as Rig[]).filter(r => r.status === 'racing').length,
                idle_rigs_count: (rigsRes as Rig[]).filter(r => r.status === 'idle').length,
                setup_rigs_count: (rigsRes as Rig[]).filter(r => r.status === 'setup').length,
                total_rigs_count: (rigsRes as Rig[]).length,
                groups: groupsRes,
                sessions: prev?.sessions || [],
                active_session: prev?.active_session || null,
                top_10_today: prev?.top_10_today || [],
                top_10_all_time: prev?.top_10_all_time || [],
                health: {
                    heartbeats_ok: true,
                    telemetry_ok: true,
                    server_status: serverRes.status || 'offline',
                },
            }))
        } catch (e) {
            console.error('Fallback state fetch error:', e)
        }
    }, [])

    useEffect(() => {
        let eventSource: EventSource | null = null
        let fallbackTimer: any = null

        const connectSSE = () => {
            try {
                eventSource = new EventSource('/stream/live')

                eventSource.addEventListener('state_update', (e) => {
                    try {
                        const data: StreamSnapshot = JSON.parse(e.data)
                        setSnapshot(data)
                        setIsConnected(true)
                    } catch (err) {
                        console.error('Failed to parse SSE payload:', err)
                    }
                })

                eventSource.onopen = () => {
                    setIsConnected(true)
                }

                eventSource.onerror = () => {
                    setIsConnected(false)
                    eventSource?.close()
                    // Try reconnecting in 5 seconds
                    setTimeout(connectSSE, 5000)
                }
            } catch (err) {
                console.warn('SSE not available, falling back to 5s poll:', err)
                setIsConnected(false)
            }
        }

        // Initial connection
        connectSSE()
        fetchState()

        // Keep a gentle 10s fallback ping only if SSE is disconnected
        fallbackTimer = setInterval(() => {
            if (!isConnected) {
                fetchState()
            }
        }, 10000)

        return () => {
            if (eventSource) {
                eventSource.close()
            }
            if (fallbackTimer) {
                clearInterval(fallbackTimer)
            }
        }
    }, [fetchState, isConnected])

    const rigs = snapshot?.rigs || []
    const groups = snapshot?.groups || []
    const serverStatus = snapshot?.server_status || 'offline'
    const activeSession = snapshot?.active_session || null
    const top10Today = snapshot?.top_10_today || []
    const top10AllTime = snapshot?.top_10_all_time || []

    return (
        <LiveStreamContext.Provider
            value={{
                snapshot,
                rigs,
                groups,
                serverStatus,
                isConnected,
                activeSession,
                top10Today,
                top10AllTime,
                refresh: fetchState,
            }}
        >
            {children}
        </LiveStreamContext.Provider>
    )
}

export const useLiveStream = () => useContext(LiveStreamContext)
