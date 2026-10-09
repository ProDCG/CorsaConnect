import React, { useState, useEffect } from 'react'
import { MessageSquare, Send, CheckCircle2, AlertTriangle, RefreshCw, Bell, Shield, Sparkles } from 'lucide-react'
import { GlobalSettings } from '../../types'

export const DiscordModule: React.FC = () => {
    const [settings, setSettings] = useState<GlobalSettings | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isTesting, setIsTesting] = useState(false)
    const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // Form state
    const [webhookUrl, setWebhookUrl] = useState('')
    const [channelName, setChannelName] = useState('#leaderboard-live')
    const [notifyRecords, setNotifyRecords] = useState(true)
    const [notifyPodiums, setNotifyPodiums] = useState(true)

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
            }
            const res = await fetch('/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated),
            })
            if (res.ok) {
                setSettings(updated)
                setStatusMsg({ type: 'success', text: 'Discord webhook configuration saved successfully.' })
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
            setStatusMsg({ type: 'error', text: 'Please enter a valid Discord Webhook URL first.' })
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
                setStatusMsg({ type: 'success', text: 'Test embed sent! Check your Discord channel.' })
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black uppercase tracking-wider text-white flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-indigo-400" />
                        Discord Community & Venue Integration
                    </h2>
                    <p className="text-xs text-white/50">
                        Dispatch real-time lap record breakthroughs, session podiums, and facility events directly into your Discord server.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleTestWebhook}
                        disabled={isTesting || !webhookUrl}
                        className="px-3 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-xl text-indigo-300 hover:text-white transition-all text-xs font-bold flex items-center gap-1.5"
                    >
                        <Send className={`w-3.5 h-3.5 ${isTesting ? 'animate-pulse' : ''}`} />
                        Send Test Ping
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
                    >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Save Settings
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
                {/* Configuration form */}
                <div className="lg:col-span-2 bg-ridge-panel/80 border border-white/10 rounded-2xl p-5 space-y-5 backdrop-blur-md">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                        <Bell className="w-4 h-4 text-indigo-400" />
                        Webhook Destination & Events
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1">
                                Discord Webhook URL
                            </label>
                            <input
                                type="url"
                                value={webhookUrl}
                                onChange={e => setWebhookUrl(e.target.value)}
                                placeholder="https://discord.com/api/webhooks/1234567890/abcdefg..."
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500 font-mono"
                            />
                            <p className="text-[10px] text-white/40 mt-1">
                                In Discord: Channel Settings &gt; Integrations &gt; Webhooks &gt; New Webhook &gt; Copy Webhook URL.
                            </p>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1">
                                Display Channel Reference / Note
                            </label>
                            <input
                                type="text"
                                value={channelName}
                                onChange={e => setChannelName(e.target.value)}
                                placeholder="#racing-records"
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500 font-mono"
                            />
                        </div>

                        <hr className="border-white/10" />

                        {/* Event toggles */}
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-white/70 mb-3">
                                Automated Notification Triggers
                            </h4>
                            <div className="space-y-3">
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
                                            Immediately dispatch an embed when a driver sets the all-time fastest lap on any circuit.
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
                                            Post the Top 3 podium drivers and lap times when a multiplayer race session concludes.
                                        </div>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Discord Embed Preview */}
                <div className="bg-ridge-panel/80 border border-white/10 rounded-2xl p-5 space-y-4 backdrop-blur-md">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        Live Embed Visualizer
                    </h3>
                    <p className="text-[11px] text-white/40">
                        Preview of rich embeds formatted and dispatched to your server.
                    </p>

                    {/* Discord Mock UI */}
                    <div className="bg-[#313338] rounded-xl p-4 text-white text-xs space-y-3 border border-white/5 shadow-inner">
                        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                            <span className="font-bold text-indigo-400 text-[11px]">#</span>
                            <span className="font-bold text-white text-[11px]">{channelName || 'general'}</span>
                        </div>

                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-black text-xs text-white flex-shrink-0">
                                CC
                            </div>
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-white text-xs">CorsaConnect Bot</span>
                                    <span className="bg-indigo-600 text-white text-[9px] font-bold px-1 rounded uppercase">BOT</span>
                                    <span className="text-[10px] text-white/40">Today at 7:42 PM</span>
                                </div>

                                {/* Discord Embed Box */}
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
                                        <div>
                                            <span className="text-white/40 block">RIG</span>
                                            <span className="font-bold font-mono text-white/80">RIG-04</span>
                                        </div>
                                        <div>
                                            <span className="text-white/40 block">GAP TO PREVIOUS</span>
                                            <span className="font-bold font-mono text-indigo-300">-0.412s</span>
                                        </div>
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
