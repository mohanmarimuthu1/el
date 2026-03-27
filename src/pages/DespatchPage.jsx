import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { formatTimestamp } from '@/lib/formatTime'
import { Truck, Plus, Loader2, AlertTriangle, CheckCircle2, Package, X, Trash2, ArrowRight, Clock, UserCheck } from 'lucide-react'

export default function DespatchPage({ selectedProjectId }) {
    const { canManageInventory, user, role } = useAuth()
    const [inventory, setInventory] = useState([])
    const [despatches, setDespatches] = useState([])
    const [loading, setLoading] = useState(true)
    const [formOpen, setFormOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    // Form state
    const [projectName, setProjectName] = useState('')
    const [selectedProjectName, setSelectedProjectName] = useState('')
    const [receivedBy, setReceivedBy] = useState('')
    const [selectedMaterials, setSelectedMaterials] = useState([{ inventory_id: '', quantity: '' }])

    useEffect(() => {
        fetchData()
        if (selectedProjectId) {
            fetchProjectName()
        } else {
            setSelectedProjectName('')
        }
    }, [selectedProjectId])

    async function fetchProjectName() {
        const { data } = await supabase
            .from('projects_metadata')
            .select('name')
            .eq('id', selectedProjectId)
            .single()
        if (data) setSelectedProjectName(data.name)
    }

    async function fetchData() {
        setLoading(true)
        let dispQuery = supabase.from('despatches').select('*').order('created_at', { ascending: false }).limit(50)
        
        if (selectedProjectId) {
            dispQuery = dispQuery.eq('project_id', selectedProjectId)
        }

        const [invRes, dispRes] = await Promise.all([
            supabase.from('inventory').select('*').order('manufacturer'),
            dispQuery,
        ])
        if (invRes.data) setInventory(invRes.data)
        if (dispRes.data) setDespatches(dispRes.data)
        setLoading(false)
    }

    const addMaterialRow = () => {
        setSelectedMaterials([...selectedMaterials, { inventory_id: '', quantity: '' }])
    }

    const removeMaterialRow = (index) => {
        const updated = selectedMaterials.filter((_, i) => i !== index)
        setSelectedMaterials(updated)
    }

    const updateMaterial = (index, field, value) => {
        const updated = [...selectedMaterials]
        updated[index][field] = value
        setSelectedMaterials(updated)
    }

    async function handleDespatch(e) {
        e.preventDefault()
        setError('')
        setSuccess('')

        const effectiveProjectName = selectedProjectId ? selectedProjectName : projectName.trim()
        if (!effectiveProjectName) { setError('Project name is required.'); return }
        if (!receivedBy.trim()) { setError('Received by name is required.'); return }

        // Validate all rows
        for (const [idx, m] of selectedMaterials.entries()) {
            if (!m.inventory_id) { setError(`Specify an item for row ${idx + 1}.`); return }
            const qty = parseInt(m.quantity) || 0
            if (qty <= 0) { setError(`Quantity for row ${idx + 1} must be at least 1.`); return }

            const item = inventory.find(i => i.id === m.inventory_id)
            const availableStock = item.quantity ?? 0
            if (qty > availableStock) {
                setError(`Insufficient stock for ${item.model_number || item.item_name}! Available: ${availableStock}`);
                return
            }
        }

        setSubmitting(true)

        try {
            for (const m of selectedMaterials) {
                const qty = parseInt(m.quantity)
                const selectedItem = inventory.find(i => i.id === m.inventory_id)

                // 1. Insert despatch record
                const { error: insertErr } = await supabase.from('despatches').insert({
                    project_name: effectiveProjectName,
                    inventory_id: m.inventory_id,
                    item_name: selectedItem.product_name || selectedItem.model_number,
                    manufacturer: selectedItem.manufacturer,
                    quantity_despatched: qty,
                    despatched_by: user?.user_metadata?.full_name || user?.email || 'User',
                    received_by: receivedBy.trim(),
                    project_id: selectedProjectId || null,
                })
                if (insertErr) throw insertErr

                // 2. Fetch fresh stock from DB to avoid using stale local state
                const { data: freshItem, error: fetchErr } = await supabase
                    .from('inventory')
                    .select('quantity')
                    .eq('id', m.inventory_id)
                    .single()
                if (fetchErr) throw fetchErr

                const currentStock = freshItem.quantity ?? 0
                if (qty > currentStock) {
                    throw new Error(`Insufficient stock for ${selectedItem.model_number || selectedItem.item_name}. Available: ${currentStock}, Requested: ${qty}`)
                }

                const newStock = currentStock - qty
                const { error: updateErr } = await supabase
                    .from('inventory')
                    .update({ quantity: newStock, updated_at: new Date().toISOString() })
                    .eq('id', m.inventory_id)
                if (updateErr) throw updateErr

                // 3. Audit log
                await supabase.from('activity_logs').insert({
                    user_name: user?.user_metadata?.full_name || user?.email || 'User',
                    user_role: role,
                    action: `Despatched ${qty} × ${selectedItem.product_name || selectedItem.model_number} to "${effectiveProjectName}" (Received by: ${receivedBy.trim()})`,
                    entity_type: 'despatch',
                    entity_id: m.inventory_id
                })

                // 4. Log stock adjustment
                await supabase.from('stock_adjustments').insert({
                    inventory_id: m.inventory_id,
                    previous_stock: currentStock,
                    new_stock: newStock,
                    reason: `Despatch to "${effectiveProjectName}" — Received by: ${receivedBy.trim()}`,
                    changed_by: user?.name || user?.email || 'Demo User',
                })
            }

            setSuccess(`✅ Despatched ${selectedMaterials.length} items successfully!`)
            setProjectName('')
            setReceivedBy('')
            setSelectedMaterials([{ inventory_id: '', quantity: '' }])
            setFormOpen(false)
            fetchData()
        } catch (err) {
            console.error('Despatch failed:', err)
            setError(`Despatch failed: ${err.message}`)
        } finally {
            setSubmitting(false)
        }
    }

    async function handleReturn(despatchItem) {
        if (!confirm(`Return ${despatchItem.quantity_despatched} units of ${despatchItem.item_name} to inventory?`)) return
        
        setError('')
        setSuccess('')
        setSubmitting(true)

        try {
            // 1. Fetch current inventory stock fresh from DB
            const { data: item, error: fetchErr } = await supabase
                .from('inventory')
                .select('quantity')
                .eq('id', despatchItem.inventory_id)
                .single()
            
            if (fetchErr) throw fetchErr

            const currentStock = item.quantity ?? 0
            const returnQty = despatchItem.quantity_despatched
            const newStock = currentStock + returnQty

            // 2. Update inventory stock
            const { error: updateErr } = await supabase
                .from('inventory')
                .update({ quantity: newStock, updated_at: new Date().toISOString() })
                .eq('id', despatchItem.inventory_id)
            if (updateErr) throw updateErr

            // 3. Update despatch record (mark as returned by setting qty to 0 or deleting)
            // Strategy: Set quantity_despatched to 0 and update a 'returned' flag if we had one, 
            // but for now we'll just set it to 0 and log it.
            const { error: dispUpdateErr } = await supabase
                .from('despatches')
                .update({ quantity_despatched: 0, returned_at: new Date().toISOString() })
                .eq('id', despatchItem.id)
            if (dispUpdateErr) throw dispUpdateErr

            // 4. Audit log
            await supabase.from('activity_logs').insert({
                user_name: user?.user_metadata?.full_name || user?.email || 'User',
                user_role: role,
                action: `Material Return: ${returnQty} × ${despatchItem.item_name} returned from "${despatchItem.project_name}"`,
                entity_type: 'inventory',
                entity_id: despatchItem.inventory_id
            })

            setSuccess('✅ Material returned to inventory successfully!')
            fetchData()
        } catch (err) {
            console.error('Return failed:', err)
            setError(`Return failed: ${err.message}`)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-extrabold text-surface-900 tracking-tighter uppercase">Project Despatch Hub</h2>
                    <p className="text-sm text-surface-400 font-medium mt-2">
                        Execute and track project material allocations.
                    </p>
                </div>
                {canManageInventory && (
                    <button
                        onClick={() => { setFormOpen(!formOpen); setError(''); setSuccess('') }}
                        className={`flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all duration-300 active:scale-95 ${formOpen
                            ? 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                            : 'bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-xl shadow-brand-500/20 hover:shadow-brand-500/40 hover:-translate-y-1'
                            }`}
                    >
                        {formOpen ? (
                            <><X size={18} /> Cancel</>
                        ) : (
                            <><Plus size={18} /> New Despatch</>
                        )}
                    </button>
                )}
            </div>

            {/* Toasts */}
            {(success || error) && (
                <div className="space-y-3">
                    {success && (
                        <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold shadow-sm animate-in zoom-in-95">
                            <CheckCircle2 size={20} />
                            {success}
                        </div>
                    )}
                    {error && (
                        <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-bold shadow-sm animate-in zoom-in-95">
                            <AlertTriangle size={20} />
                            {error}
                        </div>
                    )}
                </div>
            )}

            {/* Form */}
            {formOpen && (
                <div className="bg-white rounded-[2.5rem] border border-surface-200/50 p-8 md:p-10 shadow-2xl shadow-surface-900/5 animate-in slide-in-from-top-4 duration-500">
                    <form onSubmit={handleDespatch} className="space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Project Name — hidden when a project is already selected */}
                            {!selectedProjectId ? (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-surface-400 uppercase tracking-[0.2em] ml-1">
                                        Project / Client Name
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Where are these materials going?"
                                        value={projectName}
                                        onChange={(e) => setProjectName(e.target.value)}
                                        className="w-full bg-surface-50 border-none rounded-2xl px-5 py-4 text-sm font-semibold text-surface-900 placeholder:text-surface-300 focus:ring-4 focus:ring-brand-500/10 focus:bg-white transition-all shadow-sm"
                                        required
                                    />
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-surface-400 uppercase tracking-[0.2em] ml-1">
                                        Project
                                    </label>
                                    <div className="w-full bg-brand-50 border border-brand-200 rounded-2xl px-5 py-4 text-sm font-bold text-brand-700 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-brand-500 inline-block"></span>
                                        {selectedProjectName || 'Loading...'}
                                    </div>
                                </div>
                            )}

                            {/* Received By */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-surface-400 uppercase tracking-[0.2em] ml-1">
                                    Received By
                                </label>
                                <input
                                    type="text"
                                    placeholder="Person receiving the materials"
                                    value={receivedBy}
                                    onChange={(e) => setReceivedBy(e.target.value)}
                                    className="w-full bg-surface-50 border-none rounded-2xl px-5 py-4 text-sm font-semibold text-surface-900 placeholder:text-surface-300 focus:ring-4 focus:ring-brand-500/10 focus:bg-white transition-all shadow-sm"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center justify-between ml-1">
                                <label className="text-[10px] font-bold text-surface-400 uppercase tracking-[0.2em]">
                                    Materials List
                                </label>
                            </div>

                            <div className="space-y-4">
                                {selectedMaterials.map((mat, index) => {
                                    const item = inventory.find(i => i.id === mat.inventory_id)
                                    return (
                                        <div key={index} className="group flex flex-col md:flex-row items-start md:items-center gap-4 p-5 rounded-3xl bg-surface-50/50 border border-surface-200/50 transition-all duration-300 hover:bg-white hover:shadow-xl">
                                            <div className="flex-1 w-full space-y-1.5">
                                                <select
                                                    value={mat.inventory_id}
                                                    onChange={(e) => updateMaterial(index, 'inventory_id', e.target.value)}
                                                    className="w-full bg-transparent border-none p-0 text-sm font-bold text-surface-900 focus:ring-0 cursor-pointer"
                                                    required
                                                >
                                                    <option value="">Select Material...</option>
                                                    {inventory.map((i) => (
                                                        <option key={i.id} value={i.id}>
                                                            {i.item_name || i.model_number} — Stock: {i.current_stock ?? i.quantity}
                                                        </option>
                                                    ))}
                                                </select>
                                                {item && (
                                                    <div className="text-[10px] text-surface-400 font-bold uppercase tracking-tight">
                                                        {item.manufacturer} — {item.description?.substring(0, 50)}...
                                                    </div>
                                                )}
                                            </div>

                                            <div className="w-full md:w-32">
                                                <input
                                                    type="number"
                                                    placeholder="Qty"
                                                    value={mat.quantity}
                                                    onChange={(e) => updateMaterial(index, 'quantity', e.target.value)}
                                                    className="w-full bg-white border border-surface-200/80 rounded-xl px-4 py-2 text-sm font-bold text-surface-900 focus:ring-4 focus:ring-brand-500/10 transition-all"
                                                    required
                                                    min="1"
                                                />
                                            </div>

                                            {selectedMaterials.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeMaterialRow(index)}
                                                    className="p-2.5 rounded-xl text-surface-400 hover:text-red-500 hover:bg-red-50 transition-all active:scale-90"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>

                            <button
                                type="button"
                                onClick={addMaterialRow}
                                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-surface-100 text-surface-600 text-xs font-bold hover:bg-surface-200 transition-all active:scale-95 border border-dashed border-surface-300"
                            >
                                <Plus size={14} /> Add Item
                            </button>
                        </div>

                        <div className="pt-6 border-t border-surface-100 flex justify-end">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="flex items-center gap-3 px-10 py-4 rounded-[2rem] bg-gradient-to-br from-brand-600 to-brand-800 text-white font-bold text-sm shadow-2xl shadow-brand-500/30 hover:shadow-brand-500/50 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {submitting ? <Loader2 size={18} className="animate-spin" /> : <Truck size={18} />}
                                {submitting ? 'Despatching...' : 'Execute Despatch'}
                                <ArrowRight size={18} />
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* History */}
            <div className="bg-white rounded-[2.5rem] border border-surface-200/50 overflow-hidden shadow-xl shadow-surface-900/[0.02]">
                <div className="px-8 py-6 border-b border-surface-100 bg-surface-50/30 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-surface-900 tracking-tight">Despatch Logs</h3>
                    <Clock size={18} className="text-surface-400" />
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-surface-50/50">
                                <th className="px-8 py-4 text-[10px] font-bold text-surface-400 uppercase tracking-[0.2em]">Material</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-surface-400 uppercase tracking-[0.2em]">Project</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-surface-400 uppercase tracking-[0.2em]">Qty</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-surface-400 uppercase tracking-[0.2em]">Received By</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-surface-400 uppercase tracking-[0.2em]">Date</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-surface-400 uppercase tracking-[0.2em] text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-100 font-medium">
                            {despatches.map((d) => (
                                <tr key={d.id} className={`group hover:bg-surface-50/50 transition-all duration-300 ${d.quantity_despatched === 0 ? 'opacity-50 grayscale bg-surface-50/20' : ''}`}>
                                    <td className="px-8 py-6">
                                        <div className="text-sm font-bold text-surface-900 group-hover:text-brand-600 transition-colors">
                                            {d.item_name}
                                        </div>
                                        <div className="text-[10px] text-surface-400 font-bold uppercase mt-0.5">{d.manufacturer}</div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-surface-100 text-[11px] font-bold text-surface-600">
                                            {d.project_name}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="text-sm font-black text-surface-900">
                                            {d.quantity_despatched === 0 ? 'Returned' : d.quantity_despatched}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        {d.received_by ? (
                                            <div className="flex items-center gap-1.5">
                                                <UserCheck size={13} className="text-brand-400 shrink-0" />
                                                <span className="text-sm font-semibold text-surface-700">{d.received_by}</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-surface-300 italic">—</span>
                                        )}
                                    </td>
                                    <td className="px-8 py-6 text-xs text-surface-500 whitespace-nowrap">
                                        {formatTimestamp(d.created_at)}
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        {canManageInventory && d.quantity_despatched > 0 && (
                                            <button
                                                onClick={() => handleReturn(d)}
                                                className="px-3 py-1.5 rounded-xl bg-surface-100 text-[10px] font-black uppercase text-surface-600 hover:bg-brand-50 hover:text-brand-600 transition-all active:scale-95"
                                            >
                                                Return
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
