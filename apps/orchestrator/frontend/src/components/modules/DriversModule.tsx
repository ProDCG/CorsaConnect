import React, { useState, useEffect } from 'react'
import { Users, UserPlus, Trash, Edit, Check, Search, Monitor, Mail, Phone } from 'lucide-react'
import { useLiveStream } from '../../context/LiveStreamContext'
import { Driver } from '../../types'

export const DriversModule: React.FC = () => {
    const { rigs, refresh: refreshRigs } = useLiveStream()
    const [drivers, setDrivers] = useState<Driver[]>([])
    const [searchQuery, setSearchQuery] = useState<string>('')
    const [showAddModal, setShowAddModal] = useState<boolean>(false)
    const [editingDriver, setEditingDriver] = useState<Driver | null>(null)
    const [formName, setFormName] = useState<string>('')
    const [formEmail, setFormEmail] = useState<string>('')
    const [formPhone, setFormPhone] = useState<string>('')
    const [assignRigId, setAssignRigId] = useState<string>('')
    const [selectedDriverForRig, setSelectedDriverForRig] = useState<Driver | null>(null)

    const fetchDrivers = async () => {
        try {
            const res = await fetch('/drivers')
            if (res.ok) {
                const data = await res.json()
                setDrivers(data)
            }
        } catch (e) {
            console.error('Failed to load drivers:', e)
        }
    }

    useEffect(() => {
        fetchDrivers()
    }, [])

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

    const filteredDrivers = drivers.filter(d => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return (
            d.display_name.toLowerCase().includes(q) ||
            (d.email && d.email.toLowerCase().includes(q)) ||
            (d.phone && d.phone.includes(q))
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
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">Driver Profiles & Account Management</h3>
                        <p className="text-xs text-white/50">Manage local racer roster, contact info, and assign drivers to physical rigs.</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
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

            {/* Search Bar */}
            <div className="relative">
                <Search size={16} className="absolute left-3.5 top-3.5 text-white/40 pointer-events-none" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by driver name, email, or phone number..."
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
                                        No registered drivers found. Click "Quick Add Driver" to create one.
                                    </td>
                                </tr>
                            ) : (
                                filteredDrivers.map(d => {
                                    const currentlyAssignedRig = rigs.find(r => r.driver_name === d.display_name)

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
                                                {d.driver_uuid}
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
