import React, { useState, useEffect } from 'react'
import { FolderSync, Server, CheckCircle2, AlertTriangle, RefreshCw, HardDrive, Check, ShieldCheck, Zap } from 'lucide-react'
import { useLiveStream } from '../../context/LiveStreamContext'
import { GlobalSettings } from '../../types'

export const ContentSyncModule: React.FC = () => {
    const { rigs } = useLiveStream()
    const [settings, setSettings] = useState<GlobalSettings | null>(null)
    const [isLoadingSettings, setIsLoadingSettings] = useState(true)
    const [catalogs, setCatalogs] = useState<{ cars?: any[]; tracks?: any[] }>({})
    
    // Sync configuration state
    const [sourcePath, setSourcePath] = useState('')
    const [targetPath, setTargetPath] = useState('')
    const [syncCars, setSyncCars] = useState(true)
    const [syncTracks, setSyncTracks] = useState(true)
    const [syncCsp, setSyncCsp] = useState(true)
    const [syncWeather, setSyncWeather] = useState(true)
    
    // Selected rigs to sync (default: all online non-web rigs)
    const [selectedRigIds, setSelectedRigIds] = useState<string[]>([])
    
    // Sync execution state
    const [isSyncing, setIsSyncing] = useState(false)
    const [syncStatusMsg, setSyncStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
    const [syncedRigsList, setSyncedRigsList] = useState<string[]>([])

    const fetchInitialData = async () => {
        setIsLoadingSettings(true)
        try {
            const [setRes, catRes] = await Promise.all([
                fetch('/settings'),
                fetch('/catalogs'),
            ])
            if (setRes.ok) {
                const s = await setRes.json()
                setSettings(s)
                setSourcePath(s.sync_source_path || s.content_folder || '')
                setTargetPath(s.sync_target_path || 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\assettocorsa')
            }
            if (catRes.ok) {
                const c = await catRes.json()
                setCatalogs(c)
            }
        } catch (e) {
            console.error('Failed to load sync configurations:', e)
        } finally {
            setIsLoadingSettings(false)
        }
    }

    useEffect(() => {
        fetchInitialData()
    }, [])

    const onlineRigs = rigs.filter(r => r.status !== 'offline' && r.ip !== 'web-kiosk')

    useEffect(() => {
        if (selectedRigIds.length === 0 && onlineRigs.length > 0) {
            setSelectedRigIds(onlineRigs.map(r => r.rig_id))
        }
    }, [onlineRigs.length])

    const toggleRigSelection = (rid: string) => {
        setSelectedRigIds(prev =>
            prev.includes(rid) ? prev.filter(x => x !== rid) : [...prev, rid]
        )
    }

    const selectAllRigs = () => {
        setSelectedRigIds(onlineRigs.map(r => r.rig_id))
    }

    const deselectAllRigs = () => {
        setSelectedRigIds([])
    }

    const handleSavePaths = async () => {
        if (!settings) return
        try {
            const updated: GlobalSettings = {
                ...settings,
                sync_source_path: sourcePath,
                sync_target_path: targetPath,
            }
            const res = await fetch('/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated),
            })
            if (res.ok) {
                setSettings(updated)
                setSyncStatusMsg({ type: 'success', text: 'Sync path configuration updated and saved.' })
                setTimeout(() => setSyncStatusMsg(null), 4000)
            }
        } catch (e) {
            setSyncStatusMsg({ type: 'error', text: 'Failed to update settings.' })
        }
    }

    const handleTriggerSync = async () => {
        if (!sourcePath.trim()) {
            setSyncStatusMsg({ type: 'error', text: 'Error: Master sync source folder path cannot be empty.' })
            return
        }

        setIsSyncing(true)
        setSyncStatusMsg({ type: 'info', text: 'Dispatched network Robocopy sync command to rigs...' })
        setSyncedRigsList([])

        try {
            const payload = {
                sync_source_path: sourcePath,
                sync_target_path: targetPath,
                sync_cars: syncCars,
                sync_tracks: syncTracks,
                sync_csp: syncCsp,
                sync_weather: syncWeather,
            }

            const res = await fetch('/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            const data = await res.json()
            if (res.ok && data.status === 'success') {
                const synced = data.synced_rigs || []
                setSyncedRigsList(synced)
                setSyncStatusMsg({
                    type: 'success',
                    text: `Safe sync command dispatched to ${synced.length} rigs using robocopy /E!`,
                })
            } else {
                setSyncStatusMsg({
                    type: 'error',
                    text: data.message || 'Failed to trigger sync command.',
                })
            }
        } catch (e: any) {
            setSyncStatusMsg({
                type: 'error',
                text: `Network dispatch error: ${e.message}`,
            })
        } finally {
            setIsSyncing(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black uppercase tracking-wider text-white flex items-center gap-2">
                        <FolderSync className="w-5 h-5 text-indigo-400" />
                        Assetto Corsa Content & Mod Synchronization
                    </h2>
                    <p className="text-xs text-white/50">
                        Distribute master cars, tracks, and CSP configs across all connected sim rigs via multi-threaded LAN sync.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchInitialData}
                        disabled={isLoadingSettings}
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white/70 hover:text-white transition-all text-xs flex items-center gap-1.5"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSettings ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <button
                        onClick={handleTriggerSync}
                        disabled={isSyncing || selectedRigIds.length === 0}
                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all ${
                            isSyncing || selectedRigIds.length === 0
                                ? 'bg-white/10 text-white/30 cursor-not-allowed'
                                : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-indigo-500/25'
                        }`}
                    >
                        {isSyncing ? (
                            <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                Syncing Rigs...
                            </>
                        ) : (
                            <>
                                <Zap className="w-3.5 h-3.5" />
                                Execute LAN Sync
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Status Alert Banner */}
            {syncStatusMsg && (
                <div
                    className={`p-4 rounded-xl text-xs flex items-center gap-3 border ${
                        syncStatusMsg.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : syncStatusMsg.type === 'error'
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                            : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                    }`}
                >
                    {syncStatusMsg.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    ) : syncStatusMsg.type === 'error' ? (
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    ) : (
                        <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />
                    )}
                    <span>{syncStatusMsg.text}</span>
                </div>
            )}

            {/* Sync Configuration Panels Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Path Configuration */}
                <div className="lg:col-span-2 bg-ridge-panel/80 border border-white/10 rounded-2xl p-5 space-y-4 backdrop-blur-md">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-indigo-400" />
                        Master File Paths & Robocopy Settings
                    </h3>

                    <div className="space-y-3">
                        <div>
                            <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1">
                                Master Source Path (Admin PC / NAS Content Store)
                            </label>
                            <input
                                type="text"
                                value={sourcePath}
                                onChange={e => setSourcePath(e.target.value)}
                                placeholder="C:\AssettoCorsa_Master_Content or \\ADMIN-PC\AC_Content"
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500 font-mono"
                            />
                            <p className="text-[10px] text-white/40 mt-1">
                                Safe validation is enabled: Robocopy uses <code className="text-indigo-400">/E</code> instead of <code className="text-rose-400">/MIR</code> to prevent local asset deletion.
                            </p>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1">
                                Target Path on Sim Rigs
                            </label>
                            <input
                                type="text"
                                value={targetPath}
                                onChange={e => setTargetPath(e.target.value)}
                                placeholder="C:\Program Files (x86)\Steam\steamapps\common\assettocorsa"
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500 font-mono"
                            />
                            <p className="text-[10px] text-white/40 mt-1">
                                The Assetto Corsa root installation directory on each physical cockpit PC.
                            </p>
                        </div>

                        <div className="pt-2 flex justify-end">
                            <button
                                onClick={handleSavePaths}
                                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                            >
                                <Check className="w-3.5 h-3.5" />
                                Save Paths
                            </button>
                        </div>
                    </div>

                    <hr className="border-white/10" />

                    {/* Sync Category Toggles */}
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-white/70 mb-3">
                            Content Categories to Synchronize
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <label className="flex items-center gap-2 p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 cursor-pointer transition-all">
                                <input
                                    type="checkbox"
                                    checked={syncCars}
                                    onChange={e => setSyncCars(e.target.checked)}
                                    className="rounded border-white/20 text-indigo-500 focus:ring-0"
                                />
                                <span className="text-xs font-bold text-white">Cars Folder</span>
                            </label>
                            <label className="flex items-center gap-2 p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 cursor-pointer transition-all">
                                <input
                                    type="checkbox"
                                    checked={syncTracks}
                                    onChange={e => setSyncTracks(e.target.checked)}
                                    className="rounded border-white/20 text-indigo-500 focus:ring-0"
                                />
                                <span className="text-xs font-bold text-white">Tracks Folder</span>
                            </label>
                            <label className="flex items-center gap-2 p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 cursor-pointer transition-all">
                                <input
                                    type="checkbox"
                                    checked={syncCsp}
                                    onChange={e => setSyncCsp(e.target.checked)}
                                    className="rounded border-white/20 text-indigo-500 focus:ring-0"
                                />
                                <span className="text-xs font-bold text-white">CSP & Extension</span>
                            </label>
                            <label className="flex items-center gap-2 p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 cursor-pointer transition-all">
                                <input
                                    type="checkbox"
                                    checked={syncWeather}
                                    onChange={e => setSyncWeather(e.target.checked)}
                                    className="rounded border-white/20 text-indigo-500 focus:ring-0"
                                />
                                <span className="text-xs font-bold text-white">Weather FX</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* 2. Detected Content Overview */}
                <div className="bg-ridge-panel/80 border border-white/10 rounded-2xl p-5 space-y-4 backdrop-blur-md">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        Admin Content Library
                    </h3>

                    <div className="space-y-3">
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
                            <span className="text-xs text-white/60 font-medium">Cars Catalog</span>
                            <span className="text-sm font-black text-indigo-400">
                                {catalogs.cars?.length ?? 0} Detected
                            </span>
                        </div>
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
                            <span className="text-xs text-white/60 font-medium">Tracks Catalog</span>
                            <span className="text-sm font-black text-purple-400">
                                {catalogs.tracks?.length ?? 0} Detected
                            </span>
                        </div>
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
                            <span className="text-xs text-white/60 font-medium">Custom Shaders Patch</span>
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                                {settings?.enable_csp ? 'Active (v0.2.3)' : 'Standard'}
                            </span>
                        </div>
                    </div>

                    <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-[11px] text-indigo-300 space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Multi-Threaded LAN Push
                        </div>
                        <p className="text-indigo-200/80 leading-relaxed">
                            Sync commands are dispatched in parallel with <code className="text-indigo-300">/MT:8 /Z</code> for resume-on-disconnect resilience.
                        </p>
                    </div>
                </div>
            </div>

            {/* Target Rigs Selector */}
            <div className="bg-ridge-panel/80 border border-white/10 rounded-2xl p-5 space-y-4 backdrop-blur-md">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                        <Server className="w-4 h-4 text-indigo-400" />
                        Target Cockpit PCs ({selectedRigIds.length} of {onlineRigs.length} Selected)
                    </h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={selectAllRigs}
                            className="px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] font-bold text-white/70 hover:text-white transition-all"
                        >
                            Select All
                        </button>
                        <button
                            onClick={deselectAllRigs}
                            className="px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] font-bold text-white/70 hover:text-white transition-all"
                        >
                            Deselect All
                        </button>
                    </div>
                </div>

                {onlineRigs.length === 0 ? (
                    <div className="text-center py-8 text-xs text-white/40">
                        No online rigs detected. Ensure rigs are connected to the LAN dispatcher.
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
                        {onlineRigs.map(rig => {
                            const isSelected = selectedRigIds.includes(rig.rig_id)
                            const wasSynced = syncedRigsList.includes(rig.rig_id)
                            return (
                                <button
                                    key={rig.rig_id}
                                    onClick={() => toggleRigSelection(rig.rig_id)}
                                    className={`p-3 rounded-xl border text-left transition-all relative ${
                                        isSelected
                                            ? 'bg-indigo-500/20 border-indigo-500/60 shadow-lg shadow-indigo-500/10'
                                            : 'bg-white/5 border-white/10 hover:border-white/20 opacity-60'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-black text-white">{rig.rig_id}</span>
                                        {wasSynced && (
                                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Synced" />
                                        )}
                                    </div>
                                    <div className="text-[10px] text-white/50 font-mono truncate">{rig.ip}</div>
                                    <div className="text-[9px] uppercase tracking-wider font-bold text-white/40 mt-1">
                                        {rig.status}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
