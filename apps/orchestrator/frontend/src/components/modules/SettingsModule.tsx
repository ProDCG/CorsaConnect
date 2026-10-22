import React, { useState, useEffect } from 'react'
import { Settings, Save, HardDrive, Shield, Video, Image, CheckCircle2, AlertTriangle, RefreshCw, Send, Trash2, RotateCcw, Globe, Key, Eye, EyeOff, QrCode } from 'lucide-react'
import { GlobalSettings, Branding } from '../../types'

export const SettingsModule: React.FC = () => {
    const [settings, setSettings] = useState<GlobalSettings | null>(null)
    const [branding, setBranding] = useState<Branding>({ logo_url: '', video_url: '' })
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [showClearConfirm, setShowClearConfirm] = useState(false)

    // Form inputs
    const [sourcePath, setSourcePath] = useState('')
    const [targetPath, setTargetPath] = useState('')
    const [contentFolder, setContentFolder] = useState('')
    const [enableCsp, setEnableCsp] = useState(true)
    const [practiceTime, setPracticeTime] = useState(10)
    const [qualyTime, setQualyTime] = useState(10)
    const [raceLaps, setRaceLaps] = useState(5)
    const [raceTime, setRaceTime] = useState(15)
    const [allowDrs, setAllowDrs] = useState(true)
    const [logoUrl, setLogoUrl] = useState('')
    const [videoUrl, setVideoUrl] = useState('')

    // Ridge Sim Racing API settings
    const [ridgeApiUrl, setRidgeApiUrl] = useState('https://theridge.fun/racing-api/')
    const [ridgeApiKey, setRidgeApiKey] = useState('')
    const [showApiKey, setShowApiKey] = useState(false)
    const [ridgeTestMode, setRidgeTestMode] = useState(false)
    const [ridgeAutoSync, setRidgeAutoSync] = useState(true)
    const [ridgePollInterval, setRidgePollInterval] = useState(3)
    const [ridgeQrTtl, setRidgeQrTtl] = useState(600)
    const [ridgeShowQrOnRigs, setRidgeShowQrOnRigs] = useState(false)
    const [isTestingRidge, setIsTestingRidge] = useState(false)

    const fetchData = async () => {
        setIsLoading(true)
        try {
            const [setRes, brandRes] = await Promise.all([
                fetch('/settings'),
                fetch('/branding'),
            ])

            if (setRes.ok) {
                const s: GlobalSettings = await setRes.json()
                setSettings(s)
                setSourcePath(s.sync_source_path || '')
                setTargetPath(s.sync_target_path || 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\assettocorsa')
                setContentFolder(s.content_folder || '')
                setEnableCsp(s.enable_csp !== false)
                setPracticeTime(s.practice_time || 10)
                setQualyTime(s.qualy_time || 10)
                setRaceLaps(s.race_laps || 5)
                setRaceTime(s.race_time || 15)
                setAllowDrs(s.allow_drs !== false)
                setRidgeApiUrl(s.ridge_api_url || 'https://theridge.fun/racing-api/')
                setRidgeApiKey(s.ridge_api_key || '')
                setRidgeTestMode(Boolean(s.ridge_test_mode))
                setRidgeAutoSync(s.ridge_auto_sync !== false)
                setRidgePollInterval(s.ridge_poll_interval_sec || 3)
                setRidgeQrTtl(s.ridge_qr_ttl_sec || 600)
                setRidgeShowQrOnRigs(Boolean(s.ridge_show_qr_on_rigs))
            }

            if (brandRes.ok) {
                const b: Branding = await brandRes.json()
                setBranding(b)
                setLogoUrl(b.logo_url || '')
                setVideoUrl(b.video_url || '')
            }
        } catch (e) {
            console.error('Failed to load settings:', e)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const handleSave = async () => {
        if (!settings) return
        setIsSaving(true)
        try {
            const updatedSettings: GlobalSettings = {
                ...settings,
                sync_source_path: sourcePath.trim(),
                sync_target_path: targetPath.trim(),
                content_folder: contentFolder.trim(),
                enable_csp: enableCsp,
                practice_time: practiceTime,
                qualy_time: qualyTime,
                race_laps: raceLaps,
                race_time: raceTime,
                allow_drs: allowDrs,
                ridge_api_url: ridgeApiUrl.trim() || 'https://theridge.fun/racing-api/',
                ridge_api_key: ridgeApiKey.trim() || null,
                ridge_test_mode: ridgeTestMode,
                ridge_auto_sync: ridgeAutoSync,
                ridge_poll_interval_sec: Math.max(2, Number(ridgePollInterval) || 3),
                ridge_qr_ttl_sec: Math.max(60, Math.min(3600, Number(ridgeQrTtl) || 600)),
                ridge_show_qr_on_rigs: ridgeShowQrOnRigs,
            }

            const updatedBranding: Branding = {
                logo_url: logoUrl.trim(),
                video_url: videoUrl.trim(),
            }

            const [setRes, brandRes] = await Promise.all([
                fetch('/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedSettings),
                }),
                fetch('/branding', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedBranding),
                }),
            ])

            if (setRes.ok && brandRes.ok) {
                setSettings(updatedSettings)
                setBranding(updatedBranding)
                setStatusMsg({ type: 'success', text: 'All global configuration and branding settings saved atomically!' })
                setTimeout(() => setStatusMsg(null), 4000)
            } else {
                setStatusMsg({ type: 'error', text: 'Failed to update settings.' })
            }
        } catch (e: any) {
            setStatusMsg({ type: 'error', text: `Save error: ${e.message}` })
        } finally {
            setIsSaving(false)
        }
    }

    const handleClearLeaderboard = async () => {
        try {
            const res = await fetch('/leaderboard', { method: 'DELETE' })
            if (res.ok) {
                setStatusMsg({ type: 'success', text: 'Leaderboard database cleared successfully.' })
                setShowClearConfirm(false)
                setTimeout(() => setStatusMsg(null), 4000)
            }
        } catch (e) {
            setStatusMsg({ type: 'error', text: 'Failed to clear leaderboard database.' })
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black uppercase tracking-wider text-white flex items-center gap-2">
                        <Settings className="w-5 h-5 text-indigo-400" />
                        System Settings & Venue Configuration
                    </h2>
                    <p className="text-xs text-white/50">
                        Manage file sync paths, default race session durations, CSP options, and lobby TV branding.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
                    >
                        <Save className="w-3.5 h-3.5" />
                        {isSaving ? 'Saving...' : 'Save All Changes'}
                    </button>
                </div>
            </div>

            {/* Notification alert banner */}
            {statusMsg && (
                <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                        statusMsg.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}
                >
                    {statusMsg.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    ) : (
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span>{statusMsg.text}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. File Synchronization & Storage Paths */}
                <div className="bg-ridge-panel/80 border border-white/10 rounded-2xl p-5 space-y-4 backdrop-blur-md">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-indigo-400" />
                        Storage & File Synchronization Paths
                    </h3>

                    <div className="space-y-3">
                        <div>
                            <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1">
                                Master Sync Source Path (Admin Storage)
                            </label>
                            <input
                                type="text"
                                value={sourcePath}
                                onChange={e => setSourcePath(e.target.value)}
                                placeholder="C:\AssettoCorsa_Master_Content"
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500 font-mono"
                            />
                            <p className="text-[10px] text-white/40 mt-1">
                                Root directory containing master cars, tracks, and CSP configs pushed to cockpits.
                            </p>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1">
                                Remote Cockpit Target Path
                            </label>
                            <input
                                type="text"
                                value={targetPath}
                                onChange={e => setTargetPath(e.target.value)}
                                placeholder="C:\Program Files (x86)\Steam\steamapps\common\assettocorsa"
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500 font-mono"
                            />
                            <p className="text-[10px] text-white/40 mt-1">
                                Assetto Corsa root path on physical Windows simulator rigs.
                            </p>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1">
                                Local Orchestrator Content Folder
                            </label>
                            <input
                                type="text"
                                value={contentFolder}
                                onChange={e => setContentFolder(e.target.value)}
                                placeholder="C:\Program Files (x86)\Steam\steamapps\common\assettocorsa\content"
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500 font-mono"
                            />
                            <p className="text-[10px] text-white/40 mt-1">
                                Scanned by orchestrator to populate cars and tracks catalogs.
                            </p>
                        </div>
                    </div>
                </div>

                {/* 2. Simulation & Physics Settings */}
                <div className="bg-ridge-panel/80 border border-white/10 rounded-2xl p-5 space-y-4 backdrop-blur-md">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                        <Shield className="w-4 h-4 text-emerald-400" />
                        Default Session Parameters & Physics
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1">
                                Practice Time (min)
                            </label>
                            <input
                                type="number"
                                value={practiceTime}
                                onChange={e => setPracticeTime(Number(e.target.value))}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1">
                                Qualifying Time (min)
                            </label>
                            <input
                                type="number"
                                value={qualyTime}
                                onChange={e => setQualyTime(Number(e.target.value))}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1">
                                Race Laps
                            </label>
                            <input
                                type="number"
                                value={raceLaps}
                                onChange={e => setRaceLaps(Number(e.target.value))}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1">
                                Race Time Limit (min)
                            </label>
                            <input
                                type="number"
                                value={raceTime}
                                onChange={e => setRaceTime(Number(e.target.value))}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                            />
                        </div>
                    </div>

                    <div className="pt-2 space-y-2">
                        <label className="flex items-center gap-2 p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 cursor-pointer transition-all">
                            <input
                                type="checkbox"
                                checked={enableCsp}
                                onChange={e => setEnableCsp(e.target.checked)}
                                className="rounded border-white/20 text-indigo-500 focus:ring-0"
                            />
                            <div>
                                <span className="text-xs font-bold text-white">Enable Custom Shaders Patch (CSP)</span>
                                <span className="text-[10px] text-white/50 block">Enables advanced physics, lighting, and weather effects</span>
                            </div>
                        </label>

                        <label className="flex items-center gap-2 p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 cursor-pointer transition-all">
                            <input
                                type="checkbox"
                                checked={allowDrs}
                                onChange={e => setAllowDrs(e.target.checked)}
                                className="rounded border-white/20 text-indigo-500 focus:ring-0"
                            />
                            <div>
                                <span className="text-xs font-bold text-white">Allow Drag Reduction System (DRS)</span>
                                <span className="text-[10px] text-white/50 block">Permits rear wing actuation in DRS zones</span>
                            </div>
                        </label>
                    </div>
                </div>

                {/* 3. Venue Media & Branding */}
                <div className="bg-ridge-panel/80 border border-white/10 rounded-2xl p-5 space-y-4 backdrop-blur-md">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                        <Image className="w-4 h-4 text-purple-400" />
                        Lobby TV Branding & Media
                    </h3>

                    <div className="space-y-3">
                        <div>
                            <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1">
                                Venue Logo URL
                            </label>
                            <input
                                type="text"
                                value={logoUrl}
                                onChange={e => setLogoUrl(e.target.value)}
                                placeholder="https://example.com/logo.png"
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500 font-mono"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1">
                                Idle Screensaver Video URL (MP4)
                            </label>
                            <input
                                type="text"
                                value={videoUrl}
                                onChange={e => setVideoUrl(e.target.value)}
                                placeholder="https://example.com/idle_loop.mp4"
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500 font-mono"
                            />
                        </div>
                    </div>
                </div>

                {/* 4. Ridge Sim Racing VPS API Integration */}
                <div className="bg-ridge-panel/80 border border-indigo-500/20 rounded-2xl p-5 space-y-4 backdrop-blur-md lg:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                            <Globe className="w-4 h-4 text-indigo-400" />
                            Ridge Sim Racing — VPS API Integration (`theridge.fun/racing-api`)
                        </h3>
                        <button
                            type="button"
                            disabled={isTestingRidge}
                            onClick={async () => {
                                setIsTestingRidge(true)
                                try {
                                    const res = await fetch('/api/ridge/test', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            api_url: ridgeApiUrl.trim(),
                                            api_key: ridgeApiKey.trim() || null,
                                        }),
                                    })
                                    const data = await res.json()
                                    if (data.status === 'success') {
                                        setStatusMsg({
                                            type: 'success',
                                            text: `Ridge VPS Connection Verified! Public HTTP ${data.public_endpoint?.http_status}, Auth HTTP ${data.authenticated_endpoint?.http_status || 'N/A'}.`,
                                        })
                                    } else {
                                        setStatusMsg({
                                            type: 'error',
                                            text: `Ridge VPS Test Warning: Public=${data.public_endpoint?.http_status}, Auth=${JSON.stringify(data.authenticated_endpoint)}`,
                                        })
                                    }
                                } catch (err: any) {
                                    setStatusMsg({ type: 'error', text: `Ridge API probe error: ${err.message}` })
                                } finally {
                                    setIsTestingRidge(false)
                                }
                            }}
                            className="px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 rounded-xl text-indigo-300 text-xs font-bold flex items-center gap-1.5 transition-all"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isTestingRidge ? 'animate-spin' : ''}`} />
                            Test Ridge API Connection
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1">
                                Service Base URL
                            </label>
                            <input
                                type="url"
                                value={ridgeApiUrl}
                                onChange={e => setRidgeApiUrl(e.target.value)}
                                placeholder="https://theridge.fun/racing-api/"
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500 font-mono"
                            />
                            <p className="text-[10px] text-white/40 mt-1">
                                Uses standalone PHP query routing (`index.php?r=api/...`).
                            </p>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1">
                                Machine API Key (`X-API-Key`)
                            </label>
                            <div className="relative">
                                <input
                                    type={showApiKey ? 'text' : 'password'}
                                    value={ridgeApiKey}
                                    onChange={e => setRidgeApiKey(e.target.value)}
                                    placeholder="Enter operator API key (checkins:write,checkins:read,sessions:sync)"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-3 pr-9 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500 font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    className="absolute right-2.5 top-2 text-white/40 hover:text-white"
                                >
                                    {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                            <p className="text-[10px] text-white/40 mt-1">
                                Kept strictly on the Admin PC backend; never exposed in QR URLs or logs.
                            </p>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1">
                                QR Claim Token Expiration (60–3600 sec)
                            </label>
                            <input
                                type="number"
                                min={60}
                                max={3600}
                                value={ridgeQrTtl}
                                onChange={e => setRidgeQrTtl(Number(e.target.value))}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1">
                                Check-in Poll Interval (sec)
                            </label>
                            <input
                                type="number"
                                min={2}
                                max={30}
                                value={ridgePollInterval}
                                onChange={e => setRidgePollInterval(Number(e.target.value))}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                        <label className="flex items-start gap-2.5 p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 cursor-pointer transition-all">
                            <input
                                type="checkbox"
                                checked={ridgeTestMode}
                                onChange={e => setRidgeTestMode(e.target.checked)}
                                className="rounded border-white/20 text-indigo-500 focus:ring-0 mt-0.5"
                            />
                            <div>
                                <span className="text-xs font-bold text-white block">Test Session Prefix (`test_`)</span>
                                <span className="text-[10px] text-white/50">
                                    Prefixes session IDs with `test_` so they are excluded from public leaderboards.
                                </span>
                            </div>
                        </label>

                        <label className="flex items-start gap-2.5 p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 cursor-pointer transition-all">
                            <input
                                type="checkbox"
                                checked={ridgeAutoSync}
                                onChange={e => setRidgeAutoSync(e.target.checked)}
                                className="rounded border-white/20 text-indigo-500 focus:ring-0 mt-0.5"
                            />
                            <div>
                                <span className="text-xs font-bold text-white block">Automatic Lap Sync &amp; Finalize</span>
                                <span className="text-[10px] text-white/50">
                                    Automatically uploads laps for claimed rigs and finalizes when races stop.
                                </span>
                            </div>
                        </label>

                        <label className="flex items-start gap-2.5 p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 cursor-pointer transition-all">
                            <input
                                type="checkbox"
                                checked={ridgeShowQrOnRigs}
                                onChange={e => setRidgeShowQrOnRigs(e.target.checked)}
                                className="rounded border-white/20 text-indigo-500 focus:ring-0 mt-0.5"
                            />
                            <div>
                                <span className="text-xs font-bold text-white block">Show QR on Rigs by Default</span>
                                <span className="text-[10px] text-white/50">
                                    Displays check-in QR overlay on rig screens when new tokens are generated.
                                </span>
                            </div>
                        </label>
                    </div>
                </div>

                {/* 5. Danger Zone */}
                <div className="bg-ridge-panel/80 border border-rose-500/20 rounded-2xl p-5 space-y-4 backdrop-blur-md">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
                        <Trash2 className="w-4 h-4 text-rose-400" />
                        Database Maintenance
                    </h3>
                    <p className="text-xs text-white/60">
                        Administrative actions for wiping historical records or testing resets.
                    </p>

                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between">
                        <div>
                            <div className="text-xs font-bold text-white">Clear All Leaderboard Laps</div>
                            <div className="text-[10px] text-white/40">Permanently erases all laps and session records from SQLite</div>
                        </div>
                        <button
                            onClick={() => setShowClearConfirm(true)}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-rose-600/30"
                        >
                            Clear Data
                        </button>
                    </div>
                </div>
            </div>

            {/* Full System Update */}
            <div className="bg-ridge-panel/80 border border-red-500/20 bg-red-500/[0.02] rounded-2xl p-6 backdrop-blur-md">
                <h3 className="text-sm font-bold uppercase tracking-wider text-red-400 flex items-center gap-2 mb-2">
                    <RotateCcw className="w-4 h-4 text-red-400" /> Full System Update
                </h3>
                <p className="text-xs text-white/50 mb-4 leading-relaxed">
                    Stops all active races and servers, pulls the latest code on all rigs and the admin PC,
                    then restarts everything. All console windows will be closed and reopened.
                </p>
                <div className="flex items-center gap-4">
                    <button
                        onClick={async () => {
                            if (!confirm('⚠️ FULL SYSTEM UPDATE\n\nThis will:\n• Stop ALL active races\n• Stop ALL servers\n• Pull latest code on ALL rigs\n• Pull latest code on this admin PC\n• Restart the entire system\n\nAll players will be disconnected.\n\nContinue?')) return
                            try {
                                const res = await fetch('/api/update', { method: 'POST' })
                                const data = await res.json()
                                alert(`Update initiated!\n\n${data.message || 'System will restart shortly.'}\n\nThe dashboard will go offline briefly while the system restarts.`)
                            } catch (err) {
                                alert('Failed to initiate update. Check the console.')
                                console.error(err)
                            }
                        }}
                        className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 hover:border-red-500/50 px-6 py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-lg shadow-red-500/10"
                    >
                        Deploy Full Update
                    </button>
                    <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider">Requires network access to Git</span>
                </div>
            </div>

            {/* Clear confirmation modal */}
            {showClearConfirm && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-ridge-panel border border-rose-500/30 rounded-2xl p-6 max-w-md w-full space-y-4">
                        <div className="flex items-center gap-3 text-rose-400">
                            <AlertTriangle className="w-6 h-6 flex-shrink-0" />
                            <h3 className="text-base font-black uppercase tracking-wider text-white">Confirm Leaderboard Wipe</h3>
                        </div>
                        <p className="text-xs text-white/70 leading-relaxed">
                            Are you completely sure you want to erase all leaderboard and lap time records? This cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setShowClearConfirm(false)}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleClearLeaderboard}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-rose-600/30"
                            >
                                Confirm Erase
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
