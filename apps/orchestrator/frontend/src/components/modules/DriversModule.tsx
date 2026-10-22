import React, { useState, useEffect } from 'react'
import {
    Users,
    UserPlus,
    Trash,
    Edit,
    Search,
    Monitor,
    QrCode,
    Eye,
    EyeOff,
    RefreshCw,
    CheckCircle2,
    UploadCloud,
    ExternalLink,
    Globe,
    ShieldCheck,
    AlertTriangle,
} from 'lucide-react'
import { useLiveStream } from '../../context/LiveStreamContext'
import { Driver } from '../../types'

interface CheckinRecord {
    rig_id: string
    raw_token: string
    checkin_url: string
    status: string
    driver_uuid?: string | null
    driver_name?: string | null
    driver_email?: string | null
    expires_at?: number | null
    claimed_at?: number | null
}

interface RidgeSessionRecord {
    session_id: string
    group_id?: string | null
    group_name?: string | null
    track?: string | null
    track_layout?: string | null
    status: string
    last_error?: string | null
    synced_laps?: number
    duplicate_laps?: number
    unsynced_laps_count?: number
    created_at: number
    checkins?: CheckinRecord[]
}

export const DriversModule: React.FC = () => {
    const { rigs, groups, refresh: refreshRigs } = useLiveStream()
    const [drivers, setDrivers] = useState<Driver[]>([])
    const [searchQuery, setSearchQuery] = useState<string>('')
    const [showAddModal, setShowAddModal] = useState<boolean>(false)
    const [editingDriver, setEditingDriver] = useState<Driver | null>(null)
    const [formName, setFormName] = useState<string>('')
    const [formEmail, setFormEmail] = useState<string>('')
    const [formPhone, setFormPhone] = useState<string>('')
    const [assignRigId, setAssignRigId] = useState<string>('')
    const [selectedDriverForRig, setSelectedDriverForRig] = useState<Driver | null>(null)

    // Ridge QR Check-in & API state
    const [ridgeSessions, setRidgeSessions] = useState<RidgeSessionRecord[]>([])
    const [activeSessionId, setActiveSessionId] = useState<string>('')
    const [selectedGroupId, setSelectedGroupId] = useState<string>('')
    const [testMode, setTestMode] = useState<boolean>(false)
    const [showQrOnRigs, setShowQrOnRigs] = useState<boolean>(false)
    const [hasApiKey, setHasApiKey] = useState<boolean>(false)
    const [isBusy, setIsBusy] = useState<boolean>(false)
    const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // Remote VPS Lookup Explorer state
    const [showExplorer, setShowExplorer] = useState<boolean>(false)
    const [lookupTrack, setLookupTrack] = useState<string>('spa')
    const [lookupLayout, setLookupLayout] = useState<string>('gp')
    const [lookupCar, setLookupCar] = useState<string>('')
    const [lookupDriverUuid, setLookupDriverUuid] = useState<string>('')
    const [explorerResult, setExplorerResult] = useState<any>(null)

    const fetchDrivers = async () => {
        try {
            const res = await fetch('/api/drivers')
            if (res.ok) {
                const data = await res.json()
                setDrivers(data)
            }
        } catch (e) {
            console.error('Failed to load drivers:', e)
        }
    }

    const fetchRidgeSessions = async () => {
        try {
            const res = await fetch('/api/ridge/sessions')
            if (res.ok) {
                const data = await res.json()
                const list: RidgeSessionRecord[] = data.sessions || []
                setRidgeSessions(list)
                setShowQrOnRigs(Boolean(data.show_qr_on_rigs))
                setTestMode(Boolean(data.ridge_test_mode))
                setHasApiKey(Boolean(data.has_api_key))
                if (!activeSessionId && list.length > 0) {
                    setActiveSessionId(list[0].session_id)
                }
            }
        } catch (e) {
            console.error('Failed to load Ridge sessions:', e)
        }
    }

    useEffect(() => {
        fetchDrivers()
        fetchRidgeSessions()
        const timer = setInterval(() => {
            fetchRidgeSessions()
            fetchDrivers()
        }, 4000)
        return () => clearInterval(timer)
    }, [])

    const handleStartCheckinSession = async (displayOnRigs: boolean) => {
        let targetRigs: string[] = []
        let groupName = 'Open Check-in'
        let track = 'monza'
        let trackLayout: string | null = null

        if (selectedGroupId) {
            const g = groups.find(gr => gr.id === selectedGroupId)
            if (g) {
                targetRigs = g.rig_ids
                groupName = g.name
                track = g.track
                trackLayout = g.track_layout || null
            }
        }
        if (targetRigs.length === 0) {
            targetRigs = rigs.map(r => r.rig_id)
        }
        if (targetRigs.length === 0) {
            targetRigs = ['RIG-01', 'RIG-02', 'RIG-03', 'RIG-04']
        }

        setIsBusy(true)
        try {
            const res = await fetch('/api/ridge/session/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rig_ids: targetRigs,
                    group_id: selectedGroupId || null,
                    group_name: groupName,
                    track,
                    track_layout: trackLayout,
                    test_mode: testMode,
                    show_qr_on_rigs: displayOnRigs,
                }),
            })
            const data = await res.json()
            if (data.session_id) {
                setActiveSessionId(data.session_id)
            }
            setStatusBanner({
                type: data.status === 'error' ? 'error' : 'success',
                text:
                    data.message ||
                    `Session ${data.session_id} created (${data.registered || targetRigs.length} QR tokens ready).`,
            })
            await fetchRidgeSessions()
            refreshRigs()
        } catch (e: any) {
            setStatusBanner({ type: 'error', text: `Failed to start check-in session: ${e.message}` })
        } finally {
            setIsBusy(false)
        }
    }

    const handlePollCheckins = async (sid: string) => {
        if (!sid) return
        setIsBusy(true)
        try {
            const res = await fetch(`/api/ridge/session/${encodeURIComponent(sid)}/checkins`)
            const data = await res.json()
            const claimedCount = (data.checkins || []).filter((c: any) => c.status === 'claimed').length
            setStatusBanner({
                type: data.status === 'error' ? 'error' : 'success',
                text: data.message || `Polled ${sid}: ${claimedCount} rig(s) claimed.`,
            })
            await fetchRidgeSessions()
            await fetchDrivers()
            refreshRigs()
        } catch (e: any) {
            setStatusBanner({ type: 'error', text: `Poll failed: ${e.message}` })
        } finally {
            setIsBusy(false)
        }
    }

    const handleSyncSession = async (sid: string, finalize: boolean) => {
        if (!sid) return
        setIsBusy(true)
        try {
            const res = await fetch(`/api/ridge/session/${encodeURIComponent(sid)}/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ finalize }),
            })
            const data = await res.json()
            if (data.status === 'success') {
                setStatusBanner({
                    type: 'success',
                    text: `${finalize ? 'Finalized' : 'Synced'} ${sid}: ${data.inserted_laps || 0} inserted, ${
                        data.duplicate_laps || 0
                    } duplicate, ${data.skipped_unclaimed_laps || 0} unclaimed skipped.`,
                })
            } else {
                setStatusBanner({
                    type: 'error',
                    text: `Sync error for ${sid}: ${(data.errors || [data.message]).join('; ')}`,
                })
            }
            await fetchRidgeSessions()
        } catch (e: any) {
            setStatusBanner({ type: 'error', text: `Sync request error: ${e.message}` })
        } finally {
            setIsBusy(false)
        }
    }

    const handleSyncAllDatabases = async () => {
        setIsBusy(true)
        try {
            const res = await fetch('/api/ridge/sync-all', { method: 'POST' })
            const data = await res.json()
            setStatusBanner({
                type: data.status === 'error' ? 'error' : 'success',
                text: `Database Sync Complete: Polled ${data.sessions_polled || 0} session(s), pushed ${
                    data.laps_pushed || 0
                } local lap(s), imported ${data.remote_drivers_imported || 0} remote driver(s) & ${
                    data.remote_laps_imported || 0
                } remote record(s).`,
            })
            await fetchRidgeSessions()
            await fetchDrivers()
            refreshRigs()
        } catch (e: any) {
            setStatusBanner({ type: 'error', text: `Database sync failed: ${e.message}` })
        } finally {
            setIsBusy(false)
        }
    }

    const handleSetQrVisibility = async (rigId: string | null, show: boolean) => {
        try {
            await fetch('/api/ridge/qr/visibility', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rig_id: rigId || 'ALL',
                    show_qr: show,
                }),
            })
            if (!rigId || rigId === 'ALL') {
                setShowQrOnRigs(show)
            }
            refreshRigs()
        } catch (e) {
            console.error('Failed to update QR visibility:', e)
        }
    }

    const handleSaveDriver = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formName.trim()) return

        try {
            await fetch('/drivers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    display_name: formName.trim(),
                    email: formEmail.trim() || null,
                    phone: formPhone.trim() || null,
                    driver_uuid: editingDriver?.driver_uuid || undefined,
                }),
            })
            setShowAddModal(false)
            setEditingDriver(null)
            setFormName('')
            setFormEmail('')
            setFormPhone('')
            fetchDrivers()
        } catch (e) {
            console.error('Failed to save driver:', e)
        }
    }

    const handleDeleteDriver = async (uuid: string) => {
        if (!confirm('Are you sure you want to remove this driver profile?')) return
        try {
            await fetch(`/drivers/${uuid}`, { method: 'DELETE' })
            fetchDrivers()
        } catch (e) {
            console.error('Failed to delete driver:', e)
        }
    }

    const handleAssignToRig = async () => {
        if (!selectedDriverForRig || !assignRigId) return

        try {
            await fetch('/drivers/assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rig_id: assignRigId,
                    driver_name: selectedDriverForRig.display_name,
                    driver_email: selectedDriverForRig.email,
                    driver_uuid: selectedDriverForRig.driver_uuid,
                }),
            })
            setSelectedDriverForRig(null)
            setAssignRigId('')
            refreshRigs()
        } catch (e) {
            console.error('Failed to assign driver to rig:', e)
        }
    }

    const activeSessionObj = ridgeSessions.find(s => s.session_id === activeSessionId) || ridgeSessions[0] || null

    const filteredDrivers = drivers.filter(d => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return (
            d.display_name.toLowerCase().includes(q) ||
            (d.email && d.email.toLowerCase().includes(q)) ||
            (d.phone && d.phone.includes(q)) ||
            (d.driver_uuid && d.driver_uuid.toLowerCase().includes(q))
        )
    })

    return (
        <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="bg-ridge-panel/60 border border-white/10 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-ridge-brand/10 border border-ridge-brand/20 rounded-xl text-ridge-brand">
                        <Users size={24} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">
                            Driver Profiles, QR Check-In &amp; Ridge API Sync
                        </h3>
                        <p className="text-xs text-white/50">
                            Generate per-rig QR check-in codes, control when QR overlays appear on simulator screens, and sync laps to `theridge.fun`.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <button
                        disabled={isBusy}
                        onClick={handleSyncAllDatabases}
                        className="px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 rounded-xl text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5 transition-all disabled:opacity-50"
                        title="Sync local SQLite database with remote Ridge VPS database"
                    >
                        <UploadCloud size={15} className={isBusy ? 'animate-bounce' : ''} />
                        Sync Local &amp; Remote DB
                    </button>
                    <button
                        onClick={() => setShowExplorer(!showExplorer)}
                        className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider text-white/80 flex items-center gap-1.5 transition-all"
                    >
                        <Globe size={15} className="text-indigo-400" />
                        {showExplorer ? 'Hide VPS Explorer' : 'VPS Leaderboard & Driver Lookup'}
                    </button>
                    <button
                        onClick={() => {
                            setEditingDriver(null)
                            setFormName('')
                            setFormEmail('')
                            setFormPhone('')
                            setShowAddModal(true)
                        }}
                        className="px-4 py-2 bg-ridge-brand hover:bg-ridge-brand/90 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-ridge-brand/30 transition-all"
                    >
                        <UserPlus size={16} /> Quick Add Driver
                    </button>
                </div>
            </div>

            {statusBanner && (
                <div
                    className={`p-3 rounded-xl text-xs flex items-center justify-between border ${
                        statusBanner.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        {statusBanner.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                        <span>{statusBanner.text}</span>
                    </div>
                    <button onClick={() => setStatusBanner(null)} className="text-white/40 hover:text-white text-[10px] uppercase font-bold">
                        Dismiss
                    </button>
                </div>
            )}

            {/* Ridge QR Check-In & Rig Screen Visibility Control Center */}
            <div className="bg-ridge-panel/70 border border-indigo-500/20 rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-2.5">
                        <QrCode className="w-5 h-5 text-indigo-400" />
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                                Ridge QR Check-In &amp; Screen Display Controller
                                <span
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                        hasApiKey
                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    }`}
                                >
                                    {hasApiKey ? 'API Key Configured' : 'Local Preview Mode (Add Key in Settings)'}
                                </span>
                            </h4>
                            <p className="text-[11px] text-white/50">
                                Generate secure `chk_` tokens for rigs and toggle whether QR overlays are displayed on the physical rig screens.
                            </p>
                        </div>
                    </div>

                    {/* Global Show / Hide QR on All Rigs Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => handleSetQrVisibility('ALL', true)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                                showQrOnRigs
                                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/30'
                                    : 'bg-white/5 hover:bg-white/10 text-white/80 border-white/10'
                            }`}
                        >
                            <Eye size={14} /> Show QR on All Rigs
                        </button>
                        <button
                            onClick={() => handleSetQrVisibility('ALL', false)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                                !showQrOnRigs
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                    : 'bg-white/5 hover:bg-white/10 text-white/80 border-white/10'
                            }`}
                        >
                            <EyeOff size={14} /> Hide QR on All Rigs
                        </button>
                    </div>
                </div>

                {/* Session Controls Row */}
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="flex flex-wrap items-end gap-3">
                        <div>
                            <label className="block text-[10px] font-bold uppercase text-white/50 mb-1">Target Group / Rigs</label>
                            <select
                                value={selectedGroupId}
                                onChange={e => setSelectedGroupId(e.target.value)}
                                className="bg-[#181818] border border-white/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                            >
                                <option value="">All Connected Rigs ({rigs.length || 4})</option>
                                {groups.map(g => (
                                    <option key={g.id} value={g.id}>
                                        {g.name} ({g.rig_ids.length} rigs — {g.track})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <label className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl border border-white/10 cursor-pointer text-xs text-white/80">
                            <input
                                type="checkbox"
                                checked={testMode}
                                onChange={e => setTestMode(e.target.checked)}
                                className="rounded border-white/20 text-indigo-500 focus:ring-0"
                            />
                            <span>Use `test_` Session Prefix</span>
                        </label>

                        <button
                            disabled={isBusy}
                            onClick={() => handleStartCheckinSession(true)}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
                        >
                            <QrCode size={14} /> Generate &amp; Show QR on Rigs
                        </button>

                        <button
                            disabled={isBusy}
                            onClick={() => handleStartCheckinSession(false)}
                            className="px-3.5 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all disabled:opacity-50"
                        >
                            Generate Silently (Admin Only)
                        </button>
                    </div>

                    {/* Session Selector & Actions */}
                    {ridgeSessions.length > 0 && (
                        <div className="flex flex-wrap items-end gap-2">
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-white/50 mb-1">Active Session</label>
                                <select
                                    value={activeSessionObj?.session_id || ''}
                                    onChange={e => setActiveSessionId(e.target.value)}
                                    className="bg-[#181818] border border-white/20 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                                >
                                    {ridgeSessions.map(s => (
                                        <option key={s.session_id} value={s.session_id}>
                                            {s.session_id} [{s.status}] ({s.synced_laps || 0} synced)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {activeSessionObj && (
                                <>
                                    <button
                                        disabled={isBusy}
                                        onClick={() => handlePollCheckins(activeSessionObj.session_id)}
                                        className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white flex items-center gap-1.5"
                                        title="Poll index.php?r=api/session-checkins"
                                    >
                                        <RefreshCw size={13} className={isBusy ? 'animate-spin' : ''} />
                                        Poll Claims
                                    </button>
                                    <button
                                        disabled={isBusy}
                                        onClick={() => handleSyncSession(activeSessionObj.session_id, false)}
                                        className="px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-300 flex items-center gap-1.5"
                                        title="Upload unsynced laps (final_batch: false)"
                                    >
                                        <UploadCloud size={13} />
                                        Sync Laps ({activeSessionObj.unsynced_laps_count || 0})
                                    </button>
                                    <button
                                        disabled={isBusy || activeSessionObj.status === 'completed'}
                                        onClick={() => handleSyncSession(activeSessionObj.session_id, true)}
                                        className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-xl text-xs font-bold text-amber-300 flex items-center gap-1.5 disabled:opacity-40"
                                        title="Send final_batch: true to lock and complete session"
                                    >
                                        <ShieldCheck size={13} />
                                        Finalize Session
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Active Session QR Cards Grid */}
                {activeSessionObj && activeSessionObj.checkins && activeSessionObj.checkins.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                        {activeSessionObj.checkins.map(chk => {
                            const liveRig = rigs.find(r => r.rig_id === chk.rig_id)
                            const isRigShowingQr = Boolean(liveRig?.show_qr)
                            const isClaimed = chk.status === 'claimed'

                            return (
                                <div
                                    key={chk.rig_id}
                                    className={`rounded-2xl p-4 border flex flex-col justify-between gap-3 ${
                                        isClaimed
                                            ? 'bg-emerald-500/10 border-emerald-500/30'
                                            : 'bg-black/40 border-white/10'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-black text-sm text-white uppercase tracking-wider">
                                            {chk.rig_id}
                                        </span>
                                        <span
                                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                                isClaimed
                                                    ? 'bg-emerald-500 text-black'
                                                    : chk.status === 'expired'
                                                    ? 'bg-rose-500/20 text-rose-300'
                                                    : 'bg-amber-500/20 text-amber-300'
                                            }`}
                                        >
                                            {chk.status}
                                        </span>
                                    </div>

                                    {/* Scannable SVG QR Code */}
                                    <div className="bg-white p-2.5 rounded-xl mx-auto shadow-md">
                                        <img
                                            src={`/api/ridge/qr.svg?url=${encodeURIComponent(chk.checkin_url)}`}
                                            alt={`QR for ${chk.rig_id}`}
                                            className="w-36 h-36 object-contain"
                                        />
                                    </div>

                                    {isClaimed ? (
                                        <div className="text-center space-y-0.5">
                                            <div className="text-xs font-black text-emerald-300 truncate">
                                                ✓ {chk.driver_name || chk.driver_uuid}
                                            </div>
                                            <div className="text-[10px] font-mono text-white/50 truncate">
                                                {chk.driver_email || chk.driver_uuid}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center text-[11px] text-white/50">
                                            Waiting for racer scan &amp; PIN...
                                        </div>
                                    )}

                                    {/* Per-Rig QR Screen Toggle + Direct Check-in Link */}
                                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                                        <button
                                            onClick={() => handleSetQrVisibility(chk.rig_id, !isRigShowingQr)}
                                            className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-1 transition-all ${
                                                isRigShowingQr
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-white/5 hover:bg-white/10 text-white/60'
                                            }`}
                                        >
                                            {isRigShowingQr ? <Eye size={12} /> : <EyeOff size={12} />}
                                            {isRigShowingQr ? 'Showing on Rig' : 'Hidden on Rig'}
                                        </button>
                                        <a
                                            href={chk.checkin_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
                                            title="Open public check-in URL in browser"
                                        >
                                            <ExternalLink size={12} />
                                        </a>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Optional Remote VPS Leaderboard & Driver Statistics Explorer */}
            {showExplorer && (
                <div className="bg-ridge-panel/80 border border-white/15 rounded-2xl p-5 space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-indigo-300 flex items-center gap-2">
                        <Globe size={15} /> Ridge VPS Public API Explorer (`api/leaderboard` &amp; `api/driver`)
                    </h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-black/30 p-4 rounded-xl border border-white/10 space-y-3">
                            <div className="text-xs font-bold text-white">Query Remote Leaderboard</div>
                            <div className="grid grid-cols-3 gap-2">
                                <input
                                    type="text"
                                    value={lookupTrack}
                                    onChange={e => setLookupTrack(e.target.value)}
                                    placeholder="track (e.g. spa)"
                                    className="bg-[#181818] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                                />
                                <input
                                    type="text"
                                    value={lookupLayout}
                                    onChange={e => setLookupLayout(e.target.value)}
                                    placeholder="layout (e.g. gp)"
                                    className="bg-[#181818] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                                />
                                <input
                                    type="text"
                                    value={lookupCar}
                                    onChange={e => setLookupCar(e.target.value)}
                                    placeholder="car (optional)"
                                    className="bg-[#181818] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                                />
                            </div>
                            <button
                                onClick={async () => {
                                    const params = new URLSearchParams({
                                        track: lookupTrack,
                                        layout: lookupLayout,
                                        car: lookupCar,
                                        limit: '10',
                                    })
                                    const res = await fetch(`/api/ridge/leaderboard?${params.toString()}`)
                                    setExplorerResult(await res.json())
                                }}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold"
                            >
                                Fetch VPS Leaderboard
                            </button>
                        </div>

                        <div className="bg-black/30 p-4 rounded-xl border border-white/10 space-y-3">
                            <div className="text-xs font-bold text-white">Query Remote Driver Statistics (`drv_...`)</div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={lookupDriverUuid}
                                    onChange={e => setLookupDriverUuid(e.target.value)}
                                    placeholder="drv_a1b2c3d4e5f6"
                                    className="flex-1 bg-[#181818] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                                />
                                <button
                                    onClick={async () => {
                                        if (!lookupDriverUuid.trim()) return
                                        const res = await fetch(`/api/ridge/driver/${encodeURIComponent(lookupDriverUuid.trim())}`)
                                        setExplorerResult(await res.json())
                                    }}
                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold"
                                >
                                    Fetch Driver Stats
                                </button>
                            </div>
                        </div>
                    </div>

                    {explorerResult && (
                        <pre className="bg-black/70 border border-white/10 rounded-xl p-3 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-60">
                            {JSON.stringify(explorerResult, null, 2)}
                        </pre>
                    )}
                </div>
            )}

            {/* Search Bar */}
            <div className="relative">
                <Search size={16} className="absolute left-3.5 top-3.5 text-white/40 pointer-events-none" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by driver name, email, phone, or server UUID (drv_...)..."
                    className="w-full bg-[#181818] border border-white/20 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-ridge-brand transition-colors"
                />
            </div>

            {/* Drivers Table */}
            <div className="bg-ridge-panel/60 border border-white/10 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-white/5 text-white/40 uppercase tracking-wider text-[10px]">
                            <tr>
                                <th className="py-3 px-4">Driver Name</th>
                                <th className="py-3 px-4">Email</th>
                                <th className="py-3 px-4">Phone</th>
                                <th className="py-3 px-4">Driver UUID</th>
                                <th className="py-3 px-4 text-center">Assign to Rig</th>
                                <th className="py-3 px-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredDrivers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-white/30 text-xs">
                                        No registered drivers found. Racers who scan QR check-ins are automatically added here.
                                    </td>
                                </tr>
                            ) : (
                                filteredDrivers.map(d => {
                                    const currentlyAssignedRig = rigs.find(
                                        r => r.driver_uuid === d.driver_uuid || r.driver_name === d.display_name
                                    )

                                    return (
                                        <tr key={d.driver_uuid} className="hover:bg-white/5 transition-colors">
                                            <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                                                <span>{d.display_name}</span>
                                                {currentlyAssignedRig && (
                                                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                                                        Active on {currentlyAssignedRig.rig_id}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-white/70">
                                                {d.email || <span className="text-white/30 italic">No email</span>}
                                            </td>
                                            <td className="py-3 px-4 text-white/60 font-mono">
                                                {d.phone || <span className="text-white/30 italic">No phone</span>}
                                            </td>
                                            <td className="py-3 px-4 text-white/40 font-mono text-[10px]">
                                                <button
                                                    onClick={() => {
                                                        setLookupDriverUuid(d.driver_uuid)
                                                        setShowExplorer(true)
                                                    }}
                                                    className="hover:text-indigo-400 underline decoration-dotted"
                                                    title="Inspect driver in VPS Explorer"
                                                >
                                                    {d.driver_uuid}
                                                </button>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <button
                                                    onClick={() => {
                                                        setSelectedDriverForRig(d)
                                                        setAssignRigId(rigs[0]?.rig_id || '')
                                                    }}
                                                    className="px-2.5 py-1 bg-white/5 hover:bg-ridge-brand border border-white/10 hover:border-ridge-brand rounded-lg text-[10px] font-bold uppercase tracking-wider text-white transition-all"
                                                >
                                                    Assign Rig
                                                </button>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setEditingDriver(d)
                                                            setFormName(d.display_name)
                                                            setFormEmail(d.email || '')
                                                            setFormPhone(d.phone || '')
                                                            setShowAddModal(true)
                                                        }}
                                                        className="text-white/50 hover:text-white p-1"
                                                    >
                                                        <Edit size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteDriver(d.driver_uuid)}
                                                        className="text-red-400/60 hover:text-red-400 p-1"
                                                    >
                                                        <Trash size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Quick Add / Edit Driver Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                    <div className="bg-ridge-panel border border-white/20 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
                        <div className="flex items-center gap-2">
                            <UserPlus size={20} className="text-ridge-brand" />
                            <h3 className="text-base font-black text-white uppercase tracking-wider">
                                {editingDriver ? 'Edit Driver Profile' : 'Quick Add Driver'}
                            </h3>
                        </div>

                        <form onSubmit={handleSaveDriver} className="space-y-3">
                            <div>
                                <label className="text-white/60 text-[11px] font-bold uppercase block mb-1">
                                    Display / Racing Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="e.g. Mason Stuart"
                                    className="w-full bg-[#181818] border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-ridge-brand transition-colors"
                                />
                            </div>

                            <div>
                                <label className="text-white/60 text-[11px] font-bold uppercase block mb-1">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    value={formEmail}
                                    onChange={(e) => setFormEmail(e.target.value)}
                                    placeholder="e.g. mason@example.com"
                                    className="w-full bg-[#181818] border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-ridge-brand transition-colors"
                                />
                            </div>

                            <div>
                                <label className="text-white/60 text-[11px] font-bold uppercase block mb-1">
                                    Phone Number
                                </label>
                                <input
                                    type="tel"
                                    value={formPhone}
                                    onChange={(e) => setFormPhone(e.target.value)}
                                    placeholder="e.g. 555-123-4567"
                                    className="w-full bg-[#181818] border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-ridge-brand transition-colors"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white/70"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-ridge-brand hover:bg-ridge-brand/90 text-white rounded-xl text-xs font-black uppercase tracking-wider"
                                >
                                    Save Driver
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Assign Driver to Rig Modal */}
            {selectedDriverForRig && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                    <div className="bg-ridge-panel border border-white/20 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
                        <div className="flex items-center gap-2">
                            <Monitor size={20} className="text-emerald-400" />
                            <h3 className="text-sm font-black text-white uppercase tracking-wider">
                                Assign to Simulator
                            </h3>
                        </div>

                        <p className="text-xs text-white/70">
                            Assign <strong>{selectedDriverForRig.display_name}</strong> to a simulator rig:
                        </p>

                        <div>
                            <label className="text-white/50 text-[10px] font-bold uppercase block mb-1">Target Rig</label>
                            <select
                                value={assignRigId}
                                onChange={(e) => setAssignRigId(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-ridge-brand"
                            >
                                {rigs.map(r => (
                                    <option key={r.rig_id} value={r.rig_id}>
                                        {r.rig_id} ({r.status}) {r.driver_name ? `- currently ${r.driver_name}` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                onClick={() => setSelectedDriverForRig(null)}
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white/70"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAssignToRig}
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider"
                            >
                                Confirm Assignment
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
