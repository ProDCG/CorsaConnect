import React, { useState, useEffect } from 'react'
import { MessageSquare, Send, CheckCircle2, AlertTriangle, Bell, Sparkles, Terminal, Filter, Sliders } from 'lucide-react'
import { GlobalSettings } from '../../types'

export const DiscordModule: React.FC = () => {
    const [settings, setSettings] = useState<GlobalSettings | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isTesting, setIsTesting] = useState(false)
    const [isTestingDebug, setIsTestingDebug] = useState(false)
    const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // Community / Records Webhook state
    const [webhookUrl, setWebhookUrl] = useState('')
    const [channelName, setChannelName] = useState('#leaderboard-live')
    const [notifyRecords, setNotifyRecords] = useState(true)
    const [notifyPodiums, setNotifyPodiums] = useState(true)

    // Debug Webhook & Granular Filter state
    const [debugWebhookUrl, setDebugWebhookUrl] = useState('')
    const [debugChannelName, setDebugChannelName] = useState('#debug-logs')
    const [debugRaceStart, setDebugRaceStart] = useState(true)
    const [debugRaceStop, setDebugRaceStop] = useState(true)
    const [debugLapComplete, setDebugLapComplete] = useState(true)
    const [debugInvalidLaps, setDebugInvalidLaps] = useState(false)
    const [debugCheckin, setDebugCheckin] = useState(true)
    const [debugApiSync, setDebugApiSync] = useState(true)
    const [debugIncludeTelemetry, setDebugIncludeTelemetry] = useState(true)
    const [debugIncludeDriver, setDebugIncludeDriver] = useState(true)
    const [debugIncludeSession, setDebugIncludeSession] = useState(true)

    const fetchSettings = async () => {
        setIsLoading(true)
        try {
            const res = await fetch('/settings')
            if (res.ok) {
                const data: GlobalSettings = await res.json()
                setSettings(data)
                setWebhookUrl(data.discord_webhook_url || '')
                setChannelName(data.discord_channel_name || '#leaderboard-live')
                setNotifyRecords(data.discord_notify_records !== false)
                setNotifyPodiums(data.discord_notify_podiums !== false)

                setDebugWebhookUrl(data.discord_debug_webhook_url || '')
                setDebugChannelName(data.discord_debug_channel_name || '#debug-logs')
                setDebugRaceStart(data.discord_debug_race_start !== false)
                setDebugRaceStop(data.discord_debug_race_stop !== false)
                setDebugLapComplete(data.discord_debug_lap_complete !== false)
                setDebugInvalidLaps(Boolean(data.discord_debug_invalid_laps))
                setDebugCheckin(data.discord_debug_checkin !== false)
                setDebugApiSync(data.discord_debug_api_sync !== false)
                setDebugIncludeTelemetry(data.discord_debug_include_telemetry !== false)
                setDebugIncludeDriver(data.discord_debug_include_driver !== false)
                setDebugIncludeSession(data.discord_debug_include_session !== false)
            }
        } catch (e) {
            console.error('Failed to load discord settings:', e)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchSettings()
    }, [])

    const handleSave = async () => {
        if (!settings) return
        setIsSaving(true)
        try {
            const updated: GlobalSettings = {
                ...settings,
                discord_webhook_url: webhookUrl.trim() || null,
                discord_channel_name: channelName.trim() || null,
                discord_notify_records: notifyRecords,
                discord_notify_podiums: notifyPodiums,
                discord_debug_webhook_url: debugWebhookUrl.trim() || null,
                discord_debug_channel_name: debugChannelName.trim() || null,
                discord_debug_race_start: debugRaceStart,
                discord_debug_race_stop: debugRaceStop,
                discord_debug_lap_complete: debugLapComplete,
                discord_debug_invalid_laps: debugInvalidLaps,
                discord_debug_checkin: debugCheckin,
                discord_debug_api_sync: debugApiSync,
                discord_debug_include_telemetry: debugIncludeTelemetry,
                discord_debug_include_driver: debugIncludeDriver,
                discord_debug_include_session: debugIncludeSession,
            }
            const res = await fetch('/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated),
            })
            if (res.ok) {
                setSettings(updated)
                setStatusMsg({ type: 'success', text: 'Discord Community & Debug Webhook configurations saved successfully.' })
                setTimeout(() => setStatusMsg(null), 4000)
            } else {
                setStatusMsg({ type: 'error', text: 'Failed to save settings.' })
            }
        } catch (e) {
            setStatusMsg({ type: 'error', text: 'Network error saving settings.' })
        } finally {
            setIsSaving(false)
        }
    }

    const handleTestWebhook = async () => {
        if (!webhookUrl.trim()) {
            setStatusMsg({ type: 'error', text: 'Please enter a valid Community Discord Webhook URL first.' })
            return
        }
        setIsTesting(true)
        try {
            const res = await fetch('/settings/discord/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ webhook_url: webhookUrl }),
            })
            const data = await res.json()
            if (res.ok && data.status === 'success') {
                setStatusMsg({ type: 'success', text: 'Community test embed sent! Check your Discord channel.' })
                setTimeout(() => setStatusMsg(null), 5000)
            } else {
                setStatusMsg({ type: 'error', text: data.message || 'Discord rejected the webhook payload.' })
            }
        } catch (e: any) {
            setStatusMsg({ type: 'error', text: `Test failed: ${e.message}` })
        } finally {
            setIsTesting(false)
        }
    }

    const handleTestDebugWebhook = async () => {
        if (!debugWebhookUrl.trim()) {
            setStatusMsg({ type: 'error', text: 'Please enter a valid Debug Webhook URL first.' })
            return
        }
        setIsTestingDebug(true)
        try {
            const res = await fetch('/settings/discord/test_debug', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ webhook_url: debugWebhookUrl }),
            })
            const data = await res.json()
            if (res.ok && data.status === 'success') {
                setStatusMsg({ type: 'success', text: 'Debug test embed sent! Check your Discord debug channel.' })
                setTimeout(() => setStatusMsg(null), 5000)
            } else {
                setStatusMsg({ type: 'error', text: data.message || 'Discord rejected the debug webhook payload.' })
            }
        } catch (e: any) {
            setStatusMsg({ type: 'error', text: `Debug test failed: ${e.message}` })
        } finally {
            setIsTestingDebug(false)
        }
    }

    if (isLoading) {
        return <div className="p-8 text-center text-white/40 text-xs">Loading Discord configurations...</div>
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black uppercase tracking-wider text-white flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-indigo-400" />
                        Discord Community &amp; Debug Webhooks
                    </h2>
                    <p className="text-xs text-white/50">
                        Configure public record/podium announcements and a dedicated operator debug webhook with granular event and field filters.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={handleTestWebhook}
                        disabled={isTesting || !webhookUrl}
                        className="px-3 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-xl text-indigo-300 hover:text-white transition-all text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
                    >
                        <Send className={`w-3.5 h-3.5 ${isTesting ? 'animate-pulse' : ''}`} />
                        Test Public Webhook
                    </button>
                    <button
                        onClick={handleTestDebugWebhook}
                        disabled={isTestingDebug || !debugWebhookUrl}
                        className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-xl text-amber-300 hover:text-white transition-all text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
                    >
                        <Terminal className={`w-3.5 h-3.5 ${isTestingDebug ? 'animate-pulse' : ''}`} />
                        Test Debug Webhook
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
                    >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {isSaving ? 'Saving...' : 'Save Settings'}
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 Columns: Community Webhook + Debug Webhook */}
                <div className="lg:col-span-2 space-y-6">
                    {/* 1. Community & Records Webhook */}
                    <div className="bg-ridge-panel/80 border border-white/10 rounded-2xl p-5 space-y-5 backdrop-blur-md">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                            <Bell className="w-4 h-4 text-indigo-400" />
                            1. Public Community &amp; Records Webhook
                        </h3>

                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="sm:col-span-2">
                                    <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1">
                                        Community Webhook URL
                                    </label>
                                    <input
                                        type="url"
                                        value={webhookUrl}
                                        onChange={e => setWebhookUrl(e.target.value)}
                                        placeholder="https://discord.com/api/webhooks/1234567890/abcdefg..."
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500 font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1">
                                        Channel Label
                                    </label>
                                    <input
                                        type="text"
                                        value={channelName}
                                        onChange={e => setChannelName(e.target.value)}
                                        placeholder="#racing-records"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500 font-mono"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <label className="flex items-start gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 cursor-pointer transition-all">
                                    <input
                                        type="checkbox"
                                        checked={notifyRecords}
                                        onChange={e => setNotifyRecords(e.target.checked)}
                                        className="rounded border-white/20 text-indigo-500 focus:ring-0 mt-0.5"
                                    />
                                    <div>
                                        <div className="text-xs font-bold text-white">New All-Time P1 Track Record</div>
                                        <div className="text-[11px] text-white/50">
                                            Post embed when a driver sets the all-time fastest lap on any circuit.
                                        </div>
                                    </div>
                                </label>

                                <label className="flex items-start gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 cursor-pointer transition-all">
                                    <input
                                        type="checkbox"
                                        checked={notifyPodiums}
                                        onChange={e => setNotifyPodiums(e.target.checked)}
                                        className="rounded border-white/20 text-indigo-500 focus:ring-0 mt-0.5"
                                    />
                                    <div>
                                        <div className="text-xs font-bold text-white">Session Podium Completions</div>
                                        <div className="text-[11px] text-white/50">
                                            Post Top 3 podium drivers and lap times when a race session concludes.
                                        </div>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* 2. Debug & Operator Telemetry Webhook */}
                    <div className="bg-ridge-panel/80 border border-amber-500/20 rounded-2xl p-5 space-y-5 backdrop-blur-md">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300 flex items-center gap-2">
                                <Terminal className="w-4 h-4 text-amber-400" />
                                2. Operator Debug Logs Webhook &amp; Event Filters
                            </h3>
                            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">
                                Granular Controls
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-2">
                                <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1">
                                    Debug Webhook URL
                                </label>
                                <input
                                    type="url"
                                    value={debugWebhookUrl}
                                    onChange={e => setDebugWebhookUrl(e.target.value)}
                                    placeholder="https://discord.com/api/webhooks/9876543210/debug-hook..."
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-amber-500 font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1">
                                    Debug Channel Label
                                </label>
                                <input
                                    type="text"
                                    value={debugChannelName}
                                    onChange={e => setDebugChannelName(e.target.value)}
                                    placeholder="#debug-logs"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-amber-500 font-mono"
                                />
                            </div>
                        </div>

                        <hr className="border-white/10" />

                        {/* Event Trigger Checkboxes */}
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-white/80 mb-2.5 flex items-center gap-1.5">
                                <Filter className="w-3.5 h-3.5 text-amber-400" />
                                Which Events Should Trigger Debug Messages?
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <label className="flex items-start gap-2.5 p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={debugRaceStart}
                                        onChange={e => setDebugRaceStart(e.target.checked)}
                                        className="rounded border-white/20 text-amber-500 focus:ring-0 mt-0.5"
                                    />
                                    <div>
                                        <div className="text-xs font-bold text-white">Race Started (`LAUNCH_RACE`)</div>
                                        <div className="text-[10px] text-white/50">Logs session ID, track, layout, and participating rigs</div>
                                    </div>
                                </label>

                                <label className="flex items-start gap-2.5 p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={debugRaceStop}
                                        onChange={e => setDebugRaceStop(e.target.checked)}
                                        className="rounded border-white/20 text-amber-500 focus:ring-0 mt-0.5"
                                    />
                                    <div>
                                        <div className="text-xs font-bold text-white">Race Stopped (`KILL_RACE`)</div>
                                        <div className="text-[10px] text-white/50">Logs when a single rig, group, or global session ends</div>
                                    </div>
                                </label>

                                <label className="flex items-start gap-2.5 p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={debugLapComplete}
                                        onChange={e => setDebugLapComplete(e.target.checked)}
                                        className="rounded border-white/20 text-amber-500 focus:ring-0 mt-0.5"
                                    />
                                    <div>
                                        <div className="text-xs font-bold text-white">Every Valid Lap Completed</div>
                                        <div className="text-[10px] text-white/50">Streams each lap completion as it crosses the line</div>
                                    </div>
                                </label>

                                <label className="flex items-start gap-2.5 p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={debugInvalidLaps}
                                        onChange={e => setDebugInvalidLaps(e.target.checked)}
                                        className="rounded border-white/20 text-amber-500 focus:ring-0 mt-0.5"
                                    />
                                    <div>
                                        <div className="text-xs font-bold text-white">Invalid / Cut Laps</div>
                                        <div className="text-[10px] text-white/50">Logs out-laps and off-track cut laps when flagged</div>
                                    </div>
                                </label>

                                <label className="flex items-start gap-2.5 p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={debugCheckin}
                                        onChange={e => setDebugCheckin(e.target.checked)}
                                        className="rounded border-white/20 text-amber-500 focus:ring-0 mt-0.5"
                                    />
                                    <div>
                                        <div className="text-xs font-bold text-white">QR Check-in Claimed</div>
                                        <div className="text-[10px] text-white/50">Logs when a racer claims a rig via mobile QR check-in</div>
                                    </div>
                                </label>

                                <label className="flex items-start gap-2.5 p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={debugApiSync}
                                        onChange={e => setDebugApiSync(e.target.checked)}
                                        className="rounded border-white/20 text-amber-500 focus:ring-0 mt-0.5"
                                    />
                                    <div>
                                        <div className="text-xs font-bold text-white">Ridge API Sync &amp; Errors</div>
                                        <div className="text-[10px] text-white/50">Logs token registrations, lap batch uploads, and HTTP errors</div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <hr className="border-white/10" />

                        {/* Payload Data Field Checkboxes */}
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-white/80 mb-2.5 flex items-center gap-1.5">
                                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                                What Data Fields Should Be Included in Each Debug Message?
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                <label className="flex items-start gap-2.5 p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={debugIncludeTelemetry}
                                        onChange={e => setDebugIncludeTelemetry(e.target.checked)}
                                        className="rounded border-white/20 text-amber-500 focus:ring-0 mt-0.5"
                                    />
                                    <div>
                                        <div className="text-xs font-bold text-white">Telemetry Details</div>
                                        <div className="text-[10px] text-white/50">Lap time, lap #, car, track, layout, validity</div>
                                    </div>
                                </label>

                                <label className="flex items-start gap-2.5 p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={debugIncludeDriver}
                                        onChange={e => setDebugIncludeDriver(e.target.checked)}
                                        className="rounded border-white/20 text-amber-500 focus:ring-0 mt-0.5"
                                    />
                                    <div>
                                        <div className="text-xs font-bold text-white">Driver &amp; Rig Identity</div>
                                        <div className="text-[10px] text-white/50">Rig ID, display name, driver UUID, email</div>
                                    </div>
                                </label>

                                <label className="flex items-start gap-2.5 p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={debugIncludeSession}
                                        onChange={e => setDebugIncludeSession(e.target.checked)}
                                        className="rounded border-white/20 text-amber-500 focus:ring-0 mt-0.5"
                                    />
                                    <div>
                                        <div className="text-xs font-bold text-white">Session Metadata</div>
                                        <div className="text-[10px] text-white/50">Session ID, group name, batch counts</div>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Discord Embed Preview */}
                <div className="bg-ridge-panel/80 border border-white/10 rounded-2xl p-5 space-y-4 backdrop-blur-md h-fit">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        Live Embed Visualizer
                    </h3>
                    <p className="text-[11px] text-white/40">
                        Preview of rich embeds formatted and dispatched to your Discord channels.
                    </p>

                    {/* Public Record Preview */}
                    <div className="bg-[#313338] rounded-xl p-4 text-white text-xs space-y-3 border border-white/5 shadow-inner">
                        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                            <span className="font-bold text-indigo-400 text-[11px]">#</span>
                            <span className="font-bold text-white text-[11px]">{channelName.replace('#', '') || 'leaderboard-live'}</span>
                        </div>

                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-black text-xs text-white flex-shrink-0">
                                CC
                            </div>
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-white text-xs">CorsaConnect Bot</span>
                                    <span className="bg-indigo-600 text-white text-[9px] font-bold px-1 rounded uppercase">BOT</span>
                                </div>

                                <div className="border-l-4 border-indigo-500 bg-[#2b2d31] p-3 rounded space-y-2">
                                    <div className="font-black text-indigo-300 text-xs">
                                        🏁 NEW ALL-TIME TRACK RECORD!
                                    </div>
                                    <div className="text-[11px] text-white/80">
                                        Driver <strong>Alex Johnson</strong> just demolished the record at <strong>Spa Francorchamps</strong>!
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-[10px]">
                                        <div>
                                            <span className="text-white/40 block">LAP TIME</span>
                                            <span className="font-bold font-mono text-emerald-400">2:17.382</span>
                                        </div>
                                        <div>
                                            <span className="text-white/40 block">VEHICLE</span>
                                            <span className="font-bold font-mono text-white/80">Ferrari 488 GT3</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Debug Webhook Preview */}
                    <div className="bg-[#313338] rounded-xl p-4 text-white text-xs space-y-3 border border-amber-500/20 shadow-inner">
                        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                            <span className="font-bold text-amber-400 text-[11px]">#</span>
                            <span className="font-bold text-white text-[11px]">{debugChannelName.replace('#', '') || 'debug-logs'}</span>
                        </div>

                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center font-black text-xs text-white flex-shrink-0">
                                DBG
                            </div>
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-white text-xs">Ridge Telemetry Debug</span>
                                    <span className="bg-amber-600 text-white text-[9px] font-bold px-1 rounded uppercase">BOT</span>
                                </div>

                                <div className="border-l-4 border-amber-500 bg-[#2b2d31] p-3 rounded space-y-2">
                                    <div className="font-black text-amber-300 text-xs">
                                        ⏱️ Lap #4 Completed — RIG-01
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 pt-1 text-[10px]">
                                        {debugIncludeDriver && (
                                            <div>
                                                <span className="text-white/40 block">DRIVER / UUID</span>
                                                <span className="font-bold font-mono text-white/90">Alex (drv_8a9f)</span>
                                            </div>
                                        )}
                                        {debugIncludeTelemetry && (
                                            <div>
                                                <span className="text-white/40 block">LAP TIME</span>
                                                <span className="font-bold font-mono text-emerald-400">1:48.210</span>
                                            </div>
                                        )}
                                        {debugIncludeSession && (
                                            <div className="col-span-2">
                                                <span className="text-white/40 block">SESSION ID</span>
                                                <span className="font-bold font-mono text-white/70">sess_89a1b2c3</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
