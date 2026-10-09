import React, { useState, useEffect } from 'react'
import {
    Gauge,
    Zap,
    Flag,
    Timer,
    Activity,
    Thermometer,
    Fuel,
    Check,
    Sliders,
    RefreshCw,
    CheckCircle2,
    RotateCcw,
} from 'lucide-react'
import { useLiveStream } from '../../context/LiveStreamContext'
import { Rig } from '../../types'

interface TelemField {
    id: string
    name: string
    unit?: string
}

interface TelemCategory {
    category: string
    icon: any
    fields: TelemField[]
}

const TELEM_CATEGORIES: TelemCategory[] = [
    {
        category: 'Driving Inputs',
        icon: Zap,
        fields: [
            { id: 'velocity', name: 'Speed', unit: 'km/h' },
            { id: 'rpms', name: 'Engine RPM', unit: 'rpm' },
            { id: 'gear', name: 'Current Gear' },
            { id: 'gas', name: 'Throttle Input', unit: '%' },
            { id: 'brake', name: 'Brake Input', unit: '%' },
            { id: 'clutch', name: 'Clutch Input', unit: '%' },
            { id: 'gforce', name: 'G-Force Lateral', unit: 'G' },
            { id: 'engine_torque', name: 'Engine Torque', unit: 'Nm' },
        ],
    },
    {
        category: 'Race Session & Standings',
        icon: Flag,
        fields: [
            { id: 'position', name: 'Grid Position' },
            { id: 'completed_laps', name: 'Completed Laps' },
            { id: 'remaining_laps', name: 'Remaining Laps' },
            { id: 'normalized_pos', name: 'Track Spline Progress', unit: '%' },
        ],
    },
    {
        category: 'Lap Timing & Validity',
        icon: Timer,
        fields: [
            { id: 'current_lap_time', name: 'Live Lap Time' },
            { id: 'last_lap_time', name: 'Last Lap Time' },
            { id: 'best_lap_time', name: 'Session Best Lap' },
            { id: 'is_lap_valid', name: 'Lap Validity Indicator' },
        ],
    },
    {
        category: 'Tyre Telemetry & Physics',
        icon: Activity,
        fields: [
            { id: 'tyre_temp', name: 'Tyre Temperatures', unit: '°C' },
            { id: 'tyre_pressures', name: 'Tyre Pressures', unit: 'psi' },
            { id: 'tyre_wear', name: 'Tyre Wear / Degradation', unit: '%' },
            { id: 'tyre_dirt', name: 'Tyre Dirt / Marbles', unit: '%' },
        ],
    },
    {
        category: 'Powertrain & Fluids',
        icon: Thermometer,
        fields: [
            { id: 'fuel', name: 'Remaining Fuel', unit: 'L' },
            { id: 'water_temp', name: 'Coolant / Water Temp', unit: '°C' },
            { id: 'oil_temp', name: 'Engine Oil Temp', unit: '°C' },
            { id: 'turbo_boost', name: 'Turbo Boost Pressure', unit: 'bar' },
        ],
    },
]

const ALL_FIELD_IDS = TELEM_CATEGORIES.flatMap(c => c.fields.map(f => f.id))

export const MonitorModule: React.FC = () => {
    const { rigs } = useLiveStream()
    const [activeFields, setActiveFields] = useState<string[]>([
        'velocity',
        'rpms',
        'gear',
        'gas',
        'brake',
        'position',
        'completed_laps',
        'current_lap_time',
        'last_lap_time',
        'best_lap_time',
        'is_lap_valid',
    ])
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [showConfigPanel, setShowConfigPanel] = useState<boolean>(false)
    const [statusMsg, setStatusMsg] = useState<string | null>(null)

    useEffect(() => {
        const fetchConfig = async () => {
            setIsLoading(true)
            try {
                const res = await fetch('/telem_config')
                if (res.ok) {
                    const data = await res.json()
                    if (data && Array.isArray(data.active_fields) && data.active_fields.length > 0) {
                        setActiveFields(data.active_fields)
                    }
                }
            } catch (e) {
                console.error('Failed to load telemetry config:', e)
            } finally {
                setIsLoading(false)
            }
        }
        fetchConfig()
    }, [])

    const saveFields = async (fields: string[]) => {
        setActiveFields(fields)
        try {
            await fetch('/telem_config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active_fields: fields }),
            })
            setStatusMsg('Telemetry configuration saved.')
            setTimeout(() => setStatusMsg(null), 3000)
        } catch (e) {
            console.error('Failed to save telem config:', e)
        }
    }

    const toggleField = (fieldId: string) => {
        const next = activeFields.includes(fieldId)
            ? activeFields.filter(id => id !== fieldId)
            : [...activeFields, fieldId]
        saveFields(next)
    }

    const handleSelectAll = () => saveFields([...ALL_FIELD_IDS])
    const handleDeselectAll = () => saveFields([])
    const handleResetDefaults = () =>
        saveFields([
            'velocity',
            'rpms',
            'gear',
            'gas',
            'brake',
            'position',
            'completed_laps',
            'current_lap_time',
            'last_lap_time',
            'best_lap_time',
            'is_lap_valid',
        ])

    const formatVal = (fieldId: string, val: any) => {
        if (val === undefined || val === null) return '--'
        if (fieldId === 'gas' || fieldId === 'brake' || fieldId === 'clutch') {
            return `${Math.round(Number(val) * 100)}%`
        }
        if (fieldId === 'normalized_pos') {
            return `${Math.round(Number(val) * 100)}%`
        }
        if (fieldId === 'is_lap_valid') {
            return val ? 'VALID' : 'INVALID'
        }
        if (typeof val === 'number') {
            return Number.isInteger(val) ? val.toString() : val.toFixed(1)
        }
        return String(val)
    }

    return (
        <div className="space-y-6">
            {/* Header Toolbar */}
            <div className="bg-ridge-panel border border-white/10 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-ridge-brand/10 border border-ridge-brand/20 rounded-xl text-ridge-brand">
                        <Gauge size={24} />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-white uppercase tracking-wider">
                            Live Telemetry Feed & Rig Monitoring
                        </h2>
                        <p className="text-xs text-white/50">
                            Real-time vehicle data streams. Customize and toggle active monitoring metrics.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowConfigPanel(!showConfigPanel)}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
                            showConfigPanel
                                ? 'bg-ridge-brand text-white shadow-lg shadow-ridge-brand/30'
                                : 'bg-white/10 hover:bg-white/20 text-white'
                        }`}
                    >
                        <Sliders size={16} />
                        {showConfigPanel ? 'Close Metric Toggles' : 'Configure Metrics'} ({activeFields.length})
                    </button>
                </div>
            </div>

            {/* Notification alert banner */}
            {statusMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <span>{statusMsg}</span>
                </div>
            )}

            {/* Metric Configuration Drawer / Toggles Panel */}
            {showConfigPanel && (
                <div className="bg-ridge-panel border border-white/20 rounded-2xl p-6 space-y-5 animate-in fade-in duration-200">
                    <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-white/10">
                        <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-wider">
                                Enable / Disable Real-Time Rig Telemetry Channels
                            </h3>
                            <p className="text-xs text-white/50">
                                Select which physics, timing, and powertrain metrics to stream to rig cards.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleSelectAll}
                                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-white transition-colors"
                            >
                                Select All
                            </button>
                            <button
                                onClick={handleDeselectAll}
                                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-white transition-colors"
                            >
                                Deselect All
                            </button>
                            <button
                                onClick={handleResetDefaults}
                                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-white/60 hover:text-white transition-colors flex items-center gap-1"
                            >
                                <RotateCcw size={12} /> Defaults
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {TELEM_CATEGORIES.map(cat => {
                            const Icon = cat.icon
                            return (
                                <div key={cat.category} className="bg-[#181818] rounded-xl p-4 border border-white/5 space-y-3">
                                    <div className="flex items-center gap-2 text-ridge-brand font-black text-xs uppercase tracking-wider">
                                        <Icon size={16} />
                                        <span>{cat.category}</span>
                                    </div>
                                    <div className="space-y-1.5">
                                        {cat.fields.map(field => {
                                            const isChecked = activeFields.includes(field.id)
                                            return (
                                                <button
                                                    key={field.id}
                                                    onClick={() => toggleField(field.id)}
                                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                                                        isChecked
                                                            ? 'bg-ridge-brand/15 text-white border border-ridge-brand/40'
                                                            : 'bg-white/5 text-white/40 hover:text-white hover:bg-white/10 border border-transparent'
                                                    }`}
                                                >
                                                    <span>{field.name}</span>
                                                    <div
                                                        className={`w-4 h-4 rounded flex items-center justify-center ${
                                                            isChecked ? 'bg-ridge-brand text-white' : 'border border-white/20'
                                                        }`}
                                                    >
                                                        {isChecked && <Check size={12} />}
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Live Rig Monitoring Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {rigs.length === 0 ? (
                    <div className="col-span-full py-16 text-center text-white/40">
                        <Activity size={24} className="mx-auto mb-2 opacity-30" />
                        No connected rigs available. Ensure rig agents are running on LAN.
                    </div>
                ) : (
                    rigs.map(rig => {
                        const isRacing = rig.status === 'racing'
                        const telem = rig.telemetry || {}

                        return (
                            <div
                                key={rig.rig_id}
                                className={`rounded-2xl p-5 border transition-all ${
                                    isRacing
                                        ? 'bg-ridge-panel border-ridge-brand/40 shadow-lg shadow-ridge-brand/10'
                                        : 'bg-ridge-panel border-white/10'
                                }`}
                            >
                                {/* Rig Header */}
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h3 className="text-xl font-black italic tracking-tighter text-white">
                                            {rig.rig_id}
                                        </h3>
                                        <div className="text-[11px] font-bold text-ridge-brand truncate max-w-[140px]">
                                            {rig.driver_name || 'Unassigned Driver'}
                                        </div>
                                    </div>

                                    <div
                                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                            isRacing
                                                ? 'bg-ridge-brand text-white animate-pulse'
                                                : rig.status === 'ready'
                                                ? 'bg-emerald-500 text-black'
                                                : 'bg-white/10 text-white/60'
                                        }`}
                                    >
                                        {rig.status}
                                    </div>
                                </div>

                                <div className="text-[10px] text-white/40 font-mono mb-4 truncate">
                                    {rig.selected_car || 'No car chosen'}
                                </div>

                                {/* Active Telemetry Metrics Grid */}
                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
                                    {activeFields.map(fieldId => {
                                        const catField = TELEM_CATEGORIES.flatMap(c => c.fields).find(f => f.id === fieldId)
                                        const rawVal = telem[fieldId]
                                        const label = catField?.name || fieldId
                                        const unit = catField?.unit ? ` ${catField.unit}` : ''

                                        return (
                                            <div key={fieldId} className="bg-black/40 rounded-xl p-2 border border-white/5">
                                                <span className="text-[9px] font-black uppercase text-white/40 block truncate">
                                                    {label}
                                                </span>
                                                <span className="font-mono font-bold text-white text-[11px] truncate block mt-0.5">
                                                    {formatVal(fieldId, rawVal)}{rawVal !== undefined && rawVal !== null ? unit : ''}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
