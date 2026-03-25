import { useState, useEffect } from 'react'
import { Users, Plus, Trash2, UserPlus, UserMinus, Play, Power, Server, Car } from 'lucide-react'

interface RigGroup {
    id: string
    name: string
    mode: 'multiplayer' | 'solo'
    rig_ids: string[]
}

interface ServerInfo {
    group_id: string
    group_name: string
    port: number
    http_port: number
    track: string
    cars: string[]
    status: string
}

interface Rig {
    rig_id: string
    ip: string
    status: string
    selected_car?: string | null
    group_id?: string | null
}

interface GroupManagerProps {
    rigs: Rig[]
    raceSettings: {
        selected_track: string
        selected_weather: string
        practice_time: number
        qualy_time: number
        race_laps: number
        race_time: number
        allow_drs: boolean
        useMultiplayer: boolean
    }
    allCars: { id: string; name: string }[]
}

export default function GroupManager({ rigs, raceSettings, allCars }: GroupManagerProps) {
    const [groups, setGroups] = useState<RigGroup[]>([])
    const [servers, setServers] = useState<ServerInfo[]>([])
    const [newGroupName, setNewGroupName] = useState('')
    const [newGroupMode, setNewGroupMode] = useState<'multiplayer' | 'solo'>('multiplayer')
    const [groupCars, setGroupCars] = useState<Record<string, string[]>>({})

    const fetchGroups = async () => {
        try {
            const res = await fetch('/api/groups/')
            const data = await res.json()
            if (Array.isArray(data)) setGroups(data)
        } catch (err) {
            console.error('Failed to fetch groups:', err)
        }
    }

    const fetchServers = async () => {
        try {
            const res = await fetch('/api/server/list')
            const data = await res.json()
            if (Array.isArray(data)) setServers(data)
        } catch (err) {
            console.error('Failed to fetch servers:', err)
        }
    }

    useEffect(() => {
        fetchGroups()
        fetchServers()
        const interval = setInterval(() => { fetchGroups(); fetchServers() }, 3000)
        return () => clearInterval(interval)
    }, [])

    const createGroup = async () => {
        if (!newGroupName.trim()) return
        try {
            await fetch('/api/groups/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newGroupName, mode: newGroupMode })
            })
            setNewGroupName('')
            fetchGroups()
        } catch (err) {
            console.error('Failed to create group:', err)
        }
    }

    const deleteGroup = async (groupId: string) => {
        try {
            await fetch(`/api/groups/${groupId}`, { method: 'DELETE' })
            fetchGroups()
        } catch (err) {
            console.error('Failed to delete group:', err)
        }
    }

    const addRigToGroup = async (groupId: string, rigId: string) => {
        try {
            await fetch(`/api/groups/${groupId}/rigs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rig_id: rigId })
            })
            fetchGroups()
        } catch (err) {
            console.error('Failed to add rig:', err)
        }
    }

    const removeRigFromGroup = async (groupId: string, rigId: string) => {
        try {
            await fetch(`/api/groups/${groupId}/rigs/${rigId}`, { method: 'DELETE' })
            fetchGroups()
        } catch (err) {
            console.error('Failed to remove rig:', err)
        }
    }

    const sendGroupCommand = async (groupId: string, action: string) => {
        try {
            await fetch(`/api/command/group/${groupId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rig_id: 'GROUP',
                    action,
                    track: raceSettings.selected_track,
                    weather: raceSettings.selected_weather,
                    practice_time: raceSettings.practice_time,
                    qualy_time: raceSettings.qualy_time,
                    race_laps: raceSettings.race_laps,
                    race_time: raceSettings.race_time,
                    allow_drs: raceSettings.allow_drs,
                    use_server: raceSettings.useMultiplayer
                })
            })
        } catch (err) {
            console.error('Group command failed:', err)
        }
    }

    const startServerForGroup = async (groupId: string) => {
        const cars = groupCars[groupId] || allCars.slice(0, 3).map(c => c.id)
        try {
            const res = await fetch('/api/server/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    group_id: groupId,
                    track: raceSettings.selected_track,
                    cars,
                    race_laps: raceSettings.race_laps,
                    practice_time: raceSettings.practice_time,
                    qualy_time: raceSettings.qualy_time,
                    weather: raceSettings.selected_weather,
                    max_clients: 10,
                })
            })
            const data = await res.json()
            if (data.status === 'error') {
                alert(`Server start failed: ${data.message}`)
            }
            fetchServers()
        } catch (err) {
            console.error('Failed to start server:', err)
        }
    }

    const stopServerForGroup = async (groupId: string) => {
        try {
            await fetch(`/api/server/stop/${groupId}`, { method: 'POST' })
            fetchServers()
        } catch (err) {
            console.error('Failed to stop server:', err)
        }
    }

    const toggleCarInGroup = (groupId: string, carId: string) => {
        setGroupCars(prev => {
            const current = prev[groupId] || []
            const updated = current.includes(carId)
                ? current.filter(c => c !== carId)
                : [...current, carId]
            return { ...prev, [groupId]: updated }
        })
    }

    const setRigCar = async (rigId: string, carId: string) => {
        try {
            await fetch(`/api/rigs/${rigId}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ selected_car: carId })
            })
        } catch (err) {
            console.error('Failed to set rig car:', err)
        }
    }

    const assignedRigIds = new Set(groups.flatMap(g => g.rig_ids))
    const unassignedRigs = rigs.filter(r => !assignedRigIds.has(r.rig_id))

    const getServerForGroup = (groupId: string) => servers.find(s => s.group_id === groupId)

    return (
        <div className="space-y-8 max-w-6xl">
            {/* Create Group */}
            <div className="glass rounded-3xl p-8 border border-white/10">
                <h2 className="text-xl font-black italic uppercase mb-6 flex items-center gap-2">
                    <Users className="text-ridge-brand" size={20} /> Rig Groups
                </h2>
                <div className="flex gap-4 mb-6">
                    <input
                        type="text"
                        placeholder="Group name..."
                        value={newGroupName}
                        onChange={e => setNewGroupName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && createGroup()}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-ridge-brand transition-all font-bold"
                    />
                    <select
                        value={newGroupMode}
                        onChange={e => setNewGroupMode(e.target.value as 'multiplayer' | 'solo')}
                        className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-ridge-brand transition-all font-bold appearance-none"
                    >
                        <option value="multiplayer">Multiplayer</option>
                        <option value="solo">Solo</option>
                    </select>
                    <button
                        onClick={createGroup}
                        className="bg-ridge-brand hover:bg-orange-600 px-6 py-3 rounded-xl font-black uppercase text-xs flex items-center gap-2 transition-all"
                    >
                        <Plus size={16} /> Create
                    </button>
                </div>
            </div>

            {/* Group Cards */}
            <div className="grid grid-cols-1 gap-6">
                {groups.map(group => {
                    const serverInfo = getServerForGroup(group.id)
                    const isServerRunning = serverInfo?.status === 'running'
                    const carsForGroup = groupCars[group.id] || allCars.slice(0, 3).map(c => c.id)

                    return (
                        <div key={group.id} className="bg-white/5 border border-white/10 rounded-3xl p-6 relative">
                            {/* Header */}
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-black italic uppercase tracking-tighter">{group.name}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                                            group.mode === 'multiplayer'
                                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                        }`}>
                                            {group.mode}
                                        </span>
                                        <span className="text-[10px] text-white/30 font-mono">{group.rig_ids.length} rigs</span>
                                        {isServerRunning && (
                                            <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                Server :{serverInfo?.port}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {group.mode === 'multiplayer' && (
                                        isServerRunning ? (
                                            <button
                                                onClick={() => stopServerForGroup(group.id)}
                                                className="bg-red-500/20 hover:bg-red-500/40 text-red-400 p-2 rounded-lg transition-all"
                                                title="Stop Server"
                                            >
                                                <Server size={16} />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => startServerForGroup(group.id)}
                                                className="bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 p-2 rounded-lg transition-all"
                                                title="Deploy Server"
                                            >
                                                <Server size={16} />
                                            </button>
                                        )
                                    )}
                                    <button
                                        onClick={() => sendGroupCommand(group.id, 'LAUNCH_RACE')}
                                        className="bg-ridge-brand/20 hover:bg-ridge-brand/40 text-ridge-brand p-2 rounded-lg transition-all"
                                        title="Start Race for Group"
                                    >
                                        <Play size={16} />
                                    </button>
                                    <button
                                        onClick={() => sendGroupCommand(group.id, 'KILL_RACE')}
                                        className="bg-red-500/20 hover:bg-red-500/40 text-red-400 p-2 rounded-lg transition-all"
                                        title="Kill Race for Group"
                                    >
                                        <Power size={16} />
                                    </button>
                                    <button
                                        onClick={() => deleteGroup(group.id)}
                                        className="bg-white/5 hover:bg-red-500/20 text-white/30 hover:text-red-400 p-2 rounded-lg transition-all"
                                        title="Delete Group"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Rigs in Group */}
                            <div className="space-y-2 mb-4">
                                {group.rig_ids.map(rigId => {
                                    const rig = rigs.find(r => r.rig_id === rigId)
                                    return (
                                        <div key={rigId} className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${
                                                    rig?.status === 'racing' ? 'bg-ridge-brand animate-pulse' :
                                                    rig?.status === 'ready' ? 'bg-green-500' :
                                                    rig ? 'bg-white/30' : 'bg-red-500'
                                                }`} />
                                                <span className="font-black italic text-sm">{rigId}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {/* Per-rig car selector */}
                                                <select
                                                    value={rig?.selected_car || ''}
                                                    onChange={e => setRigCar(rigId, e.target.value)}
                                                    className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-bold outline-none focus:border-ridge-brand appearance-none max-w-40"
                                                >
                                                    <option value="">Auto</option>
                                                    {allCars.map(car => (
                                                        <option key={car.id} value={car.id}>{car.name}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={() => removeRigFromGroup(group.id, rigId)}
                                                    className="text-white/20 hover:text-red-400 transition-colors"
                                                >
                                                    <UserMinus size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                                {group.rig_ids.length === 0 && (
                                    <div className="text-center py-4 text-white/10 text-[10px] uppercase font-black tracking-widest border border-dashed border-white/5 rounded-xl">
                                        No rigs assigned — use the dropdown below
                                    </div>
                                )}
                            </div>

                            {/* Add Rig Dropdown */}
                            {unassignedRigs.length > 0 && (
                                <div className="flex gap-2 mb-4">
                                    <select
                                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-ridge-brand appearance-none"
                                        defaultValue=""
                                        onChange={e => {
                                            if (e.target.value) {
                                                addRigToGroup(group.id, e.target.value)
                                                e.target.value = ''
                                            }
                                        }}
                                    >
                                        <option value="" disabled>Add rig...</option>
                                        {unassignedRigs.map(r => (
                                            <option key={r.rig_id} value={r.rig_id}>{r.rig_id}</option>
                                        ))}
                                    </select>
                                    <button className="bg-white/5 hover:bg-white/10 p-2 rounded-lg transition-all text-white/30 hover:text-white">
                                        <UserPlus size={14} />
                                    </button>
                                </div>
                            )}

                            {/* Car Selection for Server */}
                            {group.mode === 'multiplayer' && (
                                <div className="border-t border-white/5 pt-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2 flex items-center gap-1">
                                        <Car size={12} /> Server Car Pool
                                    </h4>
                                    <div className="flex flex-wrap gap-1">
                                        {allCars.map(car => (
                                            <button
                                                key={car.id}
                                                onClick={() => toggleCarInGroup(group.id, car.id)}
                                                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all border ${
                                                    carsForGroup.includes(car.id)
                                                        ? 'bg-ridge-brand/10 border-ridge-brand/40 text-ridge-brand'
                                                        : 'bg-white/5 border-white/5 text-white/20 hover:text-white/40'
                                                }`}
                                            >
                                                {car.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {groups.length === 0 && (
                <div className="col-span-full py-16 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-3xl">
                    <Users size={48} className="mb-4 text-white/10" />
                    <p className="text-xl font-black italic tracking-tighter uppercase opacity-20 text-center">
                        No Groups Created
                    </p>
                    <p className="text-[10px] font-mono text-white/20 mt-2">
                        Create a group to pair rigs for multiplayer or designate solo drivers
                    </p>
                </div>
            )}

            {/* Unassigned Rigs */}
            {unassignedRigs.length > 0 && groups.length > 0 && (
                <div className="glass rounded-3xl p-6 border border-white/10">
                    <h3 className="text-sm font-black italic uppercase tracking-tighter mb-4 flex items-center gap-2">
                        <UserPlus size={16} className="text-amber-400" /> Unassigned Rigs ({unassignedRigs.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {unassignedRigs.map(rig => (
                            <div key={rig.rig_id} className="bg-black/20 px-4 py-2 rounded-xl border border-white/5 text-xs font-bold">
                                {rig.rig_id}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
