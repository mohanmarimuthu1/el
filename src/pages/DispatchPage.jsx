import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { formatTimestamp } from '@/lib/formatTime'
import { Truck, Plus, Loader2, AlertTriangle, CheckCircle2, Package, ChevronDown } from 'lucide-react'

export default function DispatchPage() {
    const { canManageInventory, user, role } = useAuth()
    const [inventory, setInventory] = useState([])
    const [dispatches, setDispatches] = useState([])
    const [loading, setLoading] = useState(true)
    const [formOpen, setFormOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    // Form state
    const [projectName, setProjectName] = useState('')
    const [selectedItemId, setSelectedItemId] = useState('')
    const [quantity, setQuantity] = useState('')

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        setLoading(true)
        const [invRes, dispRes] = await Promise.all([
            supabase.from('inventory').select('id, manufacturer, model_number, description, stock_count').order('manufacturer'),
            supabase.from('dispatches').select('*').order('created_at', { ascending: false }).limit(50),
        ])
        if (invRes.data) setInventory(invRes.data)
        if (dispRes.data) setDispatches(dispRes.data)
        setLoading(false)
    }

    const selectedItem = inventory.find(i => i.id === selectedItemId)

    async function handleDispatch(e) {
        e.preventDefault()
        setError('')
        setSuccess('')

        const qty = parseInt(quantity) || 0
        if (!projectName.trim()) { setError('Project name is required.'); return }
        if (!selectedItemId) { setError('Select an item from inventory.'); return }
        if (qty <= 0) { setError('Quantity must be at least 1.'); return }

        // Safety check — re-fetch latest stock to avoid stale data
        const { data: liveItem, error: fetchErr } = await supabase
            .from('inventory')
            .select('stock_count')
            .eq('id', selectedItemId)
            .single()

        if (fetchErr || !liveItem) {
            setError('Failed to verify stock. Try again.')
            return
        }

        if (qty > liveItem.stock_count) {
            setError(`🔒 SUPER SECURE — Insufficient stock! Available: ${liveItem.stock_count}, Requested: ${qty}. Cannot dispatch more than current stock.`)
            return
        }

        setSubmitting(true)

        // 1. Insert dispatch record
        const { error: insertErr } = await supabase.from('dispatches').insert({
            project_name: projectName.trim(),
            inventory_id: selectedItemId,
            item_name: selectedItem.model_number,
            manufacturer: selectedItem.manufacturer,
            quantity_dispatched: qty,
            dispatched_by: user?.name || 'Demo User',
        })

        if (insertErr) {
            console.error('Dispatch insert failed:', insertErr)
            setError('Dispatch failed. Please try again.')
            setSubmitting(false)
            return
        }

        // 2. Subtract from inventory stock
        const newStock = liveItem.stock_count - qty
        const { error: updateErr } = await supabase
            .from('inventory')
            .update({ stock_count: newStock, updated_at: new Date().toISOString() })
            .eq('id', selectedItemId)

        if (updateErr) {
            console.error('Stock update failed:', updateErr)
        }

        // 3. Audit log
        await supabase.from('activity_logs').insert({
            user_name: user?.name || 'Demo User',
            user_role: role,
            action: `Dispatched ${qty} × ${selectedItem.model_number} (${selectedItem.manufacturer}) to project "${projectName.trim()}" — Stock: ${liveItem.stock_count} → ${newStock}`,
            entity_type: 'dispatch',
            entity_id: selectedItemId,
        })

        // 4. Log stock adjustment
        await supabase.from('stock_adjustments').insert({
            inventory_id: selectedItemId,
            previous_stock: liveItem.stock_count,
            new_stock: newStock,
            reason: `Dispatched to project: ${projectName.trim()}`,
            changed_by: user?.name || 'Demo User',
        })

        setSuccess(`✅ Dispatched ${qty} × ${selectedItem.model_number} to "${projectName.trim()}"`)
        setProjectName('')
        setSelectedItemId('')
        setQuantity('')
        setFormOpen(false)
        setSubmitting(false)
        fetchData()
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-surface-900 tracking-tight flex items-center gap-2">
                        <Truck size={22} className="text-brand-500" />
                        Dispatch
                    </h2>
                    <p className="text-sm text-surface-700/60 mt-0.5">Outbound material dispatch & tracking</p>
                </div>
                {canManageInventory && (
                    <button
                        onClick={() => { setFormOpen(!formOpen); setError(''); setSuccess('') }}
                        className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${formOpen
                            ? 'bg-surface-200 text-surface-700 hover:bg-surface-300'
                            : 'text-white bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40'
                            }`}
                    >
                        <Plus size={15} className={formOpen ? 'rotate-45 transition-transform' : 'transition-transform'} />
                        {formOpen ? 'Cancel' : 'New Dispatch'}
                    </button>
                )}
            </div>

            {/* Success/Error toasts */}
            {success && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium animate-slide-in">
                    <CheckCircle2 size={16} />
                    {success}
                </div>
            )}
            {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium animate-slide-in">
                    <AlertTriangle size={16} />
                    {error}
                </div>
            )}

            {/* Dispatch Form */}
            {formOpen && canManageInventory && (
                <form onSubmit={handleDispatch} className="rounded-2xl border border-brand-200 bg-gradient-to-br from-white to-brand-50/30 p-6 shadow-sm space-y-5"
                    style={{ animation: 'slideDown 0.2s ease-out' }}>
                    <div className="flex items-center gap-2 pb-3 border-b border-surface-200">
                        <Package size={18} className="text-brand-500" />
                        <h3 className="text-sm font-bold text-surface-800 uppercase tracking-wider">Dispatch Material</h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Project Name */}
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">Project Name</label>
                            <input
                                type="text"
                                value={projectName}
                                onChange={e => setProjectName(e.target.value)}
                                placeholder="e.g. Furnace Installation — Phase 2"
                                className="w-full px-3 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                                required
                            />
                        </div>

                        {/* Item Selection */}
                        <div>
                            <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">Select Item</label>
                            <div className="relative">
                                <select
                                    value={selectedItemId}
                                    onChange={e => setSelectedItemId(e.target.value)}
                                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all appearance-none pr-8"
                                    required
                                >
                                    <option value="">— Select from inventory —</option>
                                    {inventory.filter(i => i.stock_count > 0).map(item => (
                                        <option key={item.id} value={item.id}>
                                            {item.model_number} — {item.description || item.manufacturer} (Stock: {item.stock_count})
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
                            </div>
                        </div>

                        {/* Manufacturer (auto-filled) */}
                        <div>
                            <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">Manufacturer</label>
                            <div className="w-full px-3 py-2.5 text-sm rounded-xl border border-surface-200 bg-surface-50 text-surface-600 font-medium">
                                {selectedItem?.manufacturer || '—'}
                                {selectedItem && (
                                    <span className="text-[10px] text-surface-400 ml-2">Auto-filled</span>
                                )}
                            </div>
                        </div>

                        {/* Quantity */}
                        <div>
                            <label className="block text-xs font-semibold text-surface-700/70 uppercase tracking-wider mb-1.5">
                                Quantity (NOS)
                                {selectedItem && (
                                    <span className="ml-2 text-[10px] font-normal text-surface-400">
                                        Available: <span className={selectedItem.stock_count > 0 ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>{selectedItem.stock_count}</span>
                                    </span>
                                )}
                            </label>
                            <input
                                type="number"
                                min="1"
                                max={selectedItem?.stock_count || 9999}
                                value={quantity}
                                onChange={e => setQuantity(e.target.value)}
                                placeholder="Enter quantity"
                                className="w-full px-3 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
                                required
                            />
                        </div>

                        {/* Stock Warning */}
                        <div className="flex items-end">
                            {selectedItem && parseInt(quantity) > selectedItem.stock_count && (
                                <div className="flex items-center gap-1.5 text-red-600 text-xs font-semibold bg-red-50 px-3 py-2.5 rounded-xl border border-red-200">
                                    <AlertTriangle size={13} />
                                    Exceeds available stock!
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="flex justify-end pt-2">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl text-white bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 transition-all disabled:opacity-50"
                        >
                            {submitting ? (
                                <><Loader2 size={15} className="animate-spin" /> Dispatching...</>
                            ) : (
                                <><Truck size={15} /> Dispatch</>
                            )}
                        </button>
                    </div>
                </form>
            )}

            {/* Dispatch History Table */}
            <div className="rounded-2xl border border-surface-200 bg-white overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-surface-200 bg-surface-50/80">
                                <th className="text-left px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Project</th>
                                <th className="text-left px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Item</th>
                                <th className="text-left px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Manufacturer</th>
                                <th className="text-center px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Qty</th>
                                <th className="text-left px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Dispatched At</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <tr key={i} className="border-b border-surface-100">
                                        {Array.from({ length: 5 }).map((_, j) => (
                                            <td key={j} className="px-5 py-3.5">
                                                <div className="h-4 bg-surface-200 rounded animate-pulse w-24" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : dispatches.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-5 py-12 text-center text-surface-700/40">
                                        <Truck size={36} className="mx-auto mb-2 opacity-30" />
                                        <p className="font-medium">No dispatches yet</p>
                                        <p className="text-xs mt-1">Click "New Dispatch" to send material to a project.</p>
                                    </td>
                                </tr>
                            ) : (
                                dispatches.map(d => (
                                    <tr key={d.id} className="border-b border-surface-100 hover:bg-brand-50/30 transition-colors">
                                        <td className="px-5 py-3.5 font-medium text-surface-800">{d.project_name}</td>
                                        <td className="px-5 py-3.5 font-mono text-surface-700">{d.item_name || '—'}</td>
                                        <td className="px-5 py-3.5 text-surface-700">{d.manufacturer || '—'}</td>
                                        <td className="px-5 py-3.5 text-center">
                                            <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                                                {d.quantity_dispatched}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-xs text-surface-700/50 font-mono whitespace-nowrap">{formatTimestamp(d.created_at)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {!loading && (
                    <div className="px-5 py-3 bg-surface-50/50 border-t border-surface-200 text-xs text-surface-700/50 font-medium">
                        Showing {dispatches.length} dispatch{dispatches.length !== 1 ? 'es' : ''}
                    </div>
                )}
            </div>

            {/* Animations */}
            <style>{`
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-slide-in {
                    animation: slideDown 0.2s ease-out;
                }
            `}</style>
        </div>
    )
}
