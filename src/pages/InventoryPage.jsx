import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { formatTimestamp } from '@/lib/formatTime'
import { HardDrive, Search, RefreshCw, Plus, Pencil, Check, X, Loader2, Info, Trash2 } from 'lucide-react'
import AddInventoryModal from '@/components/AddInventoryModal'

const UOM_OPTIONS = ['NOS', 'MTR', 'KG', 'SET', 'ROLL', 'BOX', 'PCS', 'PAIR', 'LOT', 'LTR']

export default function InventoryPage() {
    const { canManageInventory, user, role } = useAuth()
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [modalOpen, setModalOpen] = useState(false)

    // Inline editing state
    const [editingId, setEditingId] = useState(null)
    const [editForm, setEditForm] = useState({ stock_count: '', uom: 'NOS', description: '', reason: '' })
    const [saving, setSaving] = useState(false)
    const [deletingId, setDeletingId] = useState(null)
    const [confirmDeleteId, setConfirmDeleteId] = useState(null)

    // History popover state
    const [historyId, setHistoryId] = useState(null)
    const [historyData, setHistoryData] = useState([])
    const [historyLoading, setHistoryLoading] = useState(false)
    const historyRef = useRef(null)

    useEffect(() => { fetchInventory() }, [])

    // Close history popover on outside click
    useEffect(() => {
        function handleClickOutside(e) {
            if (historyRef.current && !historyRef.current.contains(e.target)) {
                setHistoryId(null)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    async function fetchInventory() {
        setLoading(true)
        const { data: rows, error } = await supabase
            .from('inventory')
            .select('*')
            .order('updated_at', { ascending: false })
        if (!error) setData(rows || [])
        setLoading(false)
    }

    const filtered = data.filter(row =>
        [row.manufacturer, row.serial_number, row.model_number, row.description]
            .some(v => v?.toLowerCase().includes(search.toLowerCase()))
    )

    function startEdit(row) {
        setEditingId(row.id)
        setEditForm({
            stock_count: String(row.stock_count ?? 0),
            uom: row.uom || 'NOS',
            description: row.description || '',
            reason: '',
        })
    }

    function cancelEdit() {
        setEditingId(null)
        setEditForm({ stock_count: '', uom: 'NOS', description: '', reason: '' })
    }

    async function saveEdit(row) {
        const newStock = parseInt(editForm.stock_count) || 0
        const newUom = editForm.uom || 'NOS'
        const newDesc = editForm.description.trim()
        const stockChanged = newStock !== row.stock_count
        const uomChanged = newUom !== (row.uom || 'NOS')

        // If stock changed, reason is required
        if (stockChanged && !editForm.reason.trim()) {
            return // Don't save without reason
        }

        const changes = []
        if (stockChanged) changes.push(`Stock: ${row.stock_count} → ${newStock}`)
        if (uomChanged) changes.push(`UOM: ${row.uom || 'NOS'} → ${newUom}`)
        if (newDesc !== (row.description || '')) changes.push(`Description updated`)

        if (changes.length === 0) {
            cancelEdit()
            return
        }

        setSaving(true)

        const { error } = await supabase
            .from('inventory')
            .update({
                stock_count: newStock,
                uom: newUom,
                description: newDesc || null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', row.id)

        if (!error) {
            // If stock changed, log the adjustment
            if (stockChanged) {
                await supabase.from('stock_adjustments').insert({
                    inventory_id: row.id,
                    previous_stock: row.stock_count,
                    new_stock: newStock,
                    reason: editForm.reason.trim(),
                    changed_by: user?.name || 'Demo User',
                })
            }

            // Audit log
            const reasonSuffix = stockChanged ? ` — Reason: ${editForm.reason.trim()}` : ''
            await supabase.from('activity_logs').insert({
                user_name: user?.name || 'Demo User',
                user_role: role,
                action: `Edited inventory ${row.model_number}: ${changes.join(', ')}${reasonSuffix}`,
                entity_type: 'inventory',
                entity_id: row.id,
            })

            // Optimistic update
            setData(prev => prev.map(r =>
                r.id === row.id
                    ? { ...r, stock_count: newStock, uom: newUom, description: newDesc || null, updated_at: new Date().toISOString() }
                    : r
            ))
        }

        setEditingId(null)
        setSaving(false)
    }

    async function deleteItem(row) {
        // Two-step confirmation: first click sets confirmDeleteId, second click deletes
        if (confirmDeleteId !== row.id) {
            setConfirmDeleteId(row.id)
            // Auto-cancel after 4 seconds
            setTimeout(() => setConfirmDeleteId(prev => prev === row.id ? null : prev), 4000)
            return
        }

        setConfirmDeleteId(null)
        setDeletingId(row.id)
        const { error } = await supabase.from('inventory').delete().eq('id', row.id)

        if (error) {
            console.error('Delete failed:', error)
            setDeletingId(null)
            return
        }

        await supabase.from('activity_logs').insert({
            user_name: user?.name || 'Demo User',
            user_role: role,
            action: `Deleted inventory item: ${row.model_number} (${row.manufacturer})`,
            entity_type: 'inventory',
            entity_id: row.id,
        })
        setData(prev => prev.filter(r => r.id !== row.id))
        setDeletingId(null)
    }

    async function showHistory(inventoryId) {
        if (historyId === inventoryId) {
            setHistoryId(null)
            return
        }
        setHistoryId(inventoryId)
        setHistoryLoading(true)
        const { data: adjustments } = await supabase
            .from('stock_adjustments')
            .select('*')
            .eq('inventory_id', inventoryId)
            .order('created_at', { ascending: false })
            .limit(3)
        setHistoryData(adjustments || [])
        setHistoryLoading(false)
    }

    const colCount = canManageInventory ? 8 : 7

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-surface-900 tracking-tight flex items-center gap-2">
                        <HardDrive size={22} className="text-brand-500" />
                        Inventory
                    </h2>
                    <p className="text-sm text-surface-700/60 mt-0.5">Hardware tracking & stock management</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-300" />
                        <input
                            type="text"
                            placeholder="Search inventory..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all w-full sm:w-64"
                        />
                    </div>
                    <button
                        onClick={fetchInventory}
                        className="p-2 rounded-xl border border-surface-200 bg-white hover:bg-surface-50 text-surface-700 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                    {canManageInventory && (
                        <button
                            onClick={() => setModalOpen(true)}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 transition-all"
                        >
                            <Plus size={15} />
                            <span className="hidden sm:inline">Add Item</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-surface-200 bg-white overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-surface-200 bg-surface-50/80">
                                <th className="text-left px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Manufacturer</th>
                                <th className="text-left px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Serial No.</th>
                                <th className="text-left px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Model No.</th>
                                <th className="text-center px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Stock</th>
                                <th className="text-left px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider w-24">UOM</th>
                                <th className="text-left px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Description</th>
                                <th className="text-left px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Last Updated</th>
                                {canManageInventory && (
                                    <th className="text-center px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider w-20">Edit</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="border-b border-surface-100">
                                        {Array.from({ length: colCount }).map((_, j) => (
                                            <td key={j} className="px-5 py-3.5">
                                                <div className="h-4 bg-surface-200 rounded animate-pulse w-24" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={colCount} className="px-5 py-12 text-center text-surface-700/40">
                                        <HardDrive size={36} className="mx-auto mb-2 opacity-30" />
                                        <p className="font-medium">No inventory items found</p>
                                        <p className="text-xs mt-1">
                                            {canManageInventory
                                                ? 'Click "+ Add Item" to add your first product.'
                                                : 'Items will appear here once added to the database.'}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((row) => {
                                    const isEditing = editingId === row.id
                                    const stockChanged = isEditing && parseInt(editForm.stock_count) !== row.stock_count
                                    const reasonMissing = stockChanged && !editForm.reason.trim()

                                    return (
                                        <tr
                                            key={row.id}
                                            className={`border-b transition-colors ${isEditing
                                                ? 'bg-brand-50/50 border-brand-200'
                                                : 'border-surface-100 hover:bg-brand-50/30'
                                                }`}
                                        >
                                            <td className="px-5 py-3.5 font-medium text-surface-800">{row.manufacturer}</td>
                                            <td className="px-5 py-3.5 font-mono text-xs text-surface-700">{row.serial_number || '—'}</td>
                                            <td className="px-5 py-3.5 text-surface-700 font-mono">{row.model_number}</td>

                                            {/* Stock — editable + history icon */}
                                            <td className="px-5 py-3.5 text-center">
                                                <div className="flex flex-col items-center gap-1.5">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {isEditing ? (
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={editForm.stock_count}
                                                                onChange={e => setEditForm(prev => ({ ...prev, stock_count: e.target.value }))}
                                                                className="w-16 px-2 py-1 text-sm text-center rounded-lg border border-brand-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all"
                                                                autoFocus
                                                            />
                                                        ) : (
                                                            <>
                                                                <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-bold ${row.stock_count > 0
                                                                    ? 'bg-emerald-100 text-emerald-700'
                                                                    : 'bg-red-100 text-red-700'
                                                                    }`}>
                                                                    {row.stock_count}
                                                                </span>
                                                                {/* History info icon */}
                                                                <div className="relative" ref={historyId === row.id ? historyRef : null}>
                                                                    <button
                                                                        onClick={() => showHistory(row.id)}
                                                                        className="p-0.5 rounded text-surface-300 hover:text-brand-500 transition-colors"
                                                                        title="View stock history"
                                                                    >
                                                                        <Info size={12} />
                                                                    </button>

                                                                    {/* History Popover */}
                                                                    {historyId === row.id && (
                                                                        <div className="absolute z-50 top-7 left-1/2 -translate-x-1/2 w-72 bg-white rounded-xl border border-surface-200 shadow-2xl shadow-surface-900/15 overflow-hidden"
                                                                            style={{ animation: 'popIn 0.15s ease-out' }}>
                                                                            <div className="px-3 py-2 bg-surface-50 border-b border-surface-200">
                                                                                <p className="text-[10px] font-bold text-surface-700/70 uppercase tracking-wider">Stock Adjustment History</p>
                                                                            </div>
                                                                            {historyLoading ? (
                                                                                <div className="px-3 py-4 text-center">
                                                                                    <Loader2 size={14} className="animate-spin text-surface-300 mx-auto" />
                                                                                </div>
                                                                            ) : historyData.length === 0 ? (
                                                                                <div className="px-3 py-4 text-center text-xs text-surface-400">
                                                                                    No adjustments recorded yet
                                                                                </div>
                                                                            ) : (
                                                                                <div className="divide-y divide-surface-100">
                                                                                    {historyData.map((adj) => (
                                                                                        <div key={adj.id} className="px-3 py-2.5">
                                                                                            <div className="flex items-center justify-between">
                                                                                                <div className="flex items-center gap-1.5">
                                                                                                    <span className="text-xs font-mono bg-red-50 text-red-600 px-1.5 py-0.5 rounded">{adj.previous_stock}</span>
                                                                                                    <span className="text-[10px] text-surface-400">→</span>
                                                                                                    <span className="text-xs font-mono bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded">{adj.new_stock}</span>
                                                                                                </div>
                                                                                                <span className="text-[10px] text-surface-400 font-mono">{formatTimestamp(adj.created_at)}</span>
                                                                                            </div>
                                                                                            <p className="text-[11px] text-surface-600 mt-1 leading-relaxed">
                                                                                                <span className="font-semibold text-surface-500">Reason:</span> {adj.reason}
                                                                                            </p>
                                                                                            <p className="text-[10px] text-surface-400 mt-0.5">by {adj.changed_by}</p>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                    {/* Reason input — shown directly below stock input when stock value changes */}
                                                    {stockChanged && (
                                                        <input
                                                            type="text"
                                                            value={editForm.reason}
                                                            onChange={e => setEditForm(prev => ({ ...prev, reason: e.target.value }))}
                                                            className={`w-44 px-2 py-1 text-xs rounded-lg border bg-amber-50/50 focus:outline-none focus:ring-2 transition-all ${reasonMissing
                                                                ? 'border-red-300 focus:ring-red-500/30 placeholder:text-red-300'
                                                                : 'border-amber-300 focus:ring-amber-500/30'
                                                                }`}
                                                            placeholder="⚠ Change reason required..."
                                                        />
                                                    )}
                                                </div>
                                            </td>

                                            {/* UOM — editable */}
                                            <td className="px-5 py-3.5">
                                                {isEditing ? (
                                                    <select
                                                        value={editForm.uom}
                                                        onChange={e => setEditForm(prev => ({ ...prev, uom: e.target.value }))}
                                                        className="w-full px-2 py-1 text-sm rounded-lg border border-brand-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all cursor-pointer"
                                                    >
                                                        {UOM_OPTIONS.map(u => (
                                                            <option key={u} value={u}>{u}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface-100 text-surface-600 text-xs font-semibold tracking-wide">
                                                        {row.uom || 'NOS'}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Description — editable */}
                                            <td className="px-5 py-3.5">
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        value={editForm.description}
                                                        onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                                        className="w-full px-2 py-1 text-sm rounded-lg border border-brand-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all"
                                                        placeholder="Description..."
                                                    />
                                                ) : (
                                                    <span className="text-surface-700 max-w-[200px] truncate block">{row.description || '—'}</span>
                                                )}
                                            </td>

                                            <td className="px-5 py-3.5 text-xs text-surface-700/50 font-mono whitespace-nowrap">{formatTimestamp(row.updated_at)}</td>

                                            {/* Edit Actions */}
                                            {canManageInventory && (
                                                <td className="px-5 py-3.5 text-center">
                                                    {isEditing ? (
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button
                                                                onClick={() => saveEdit(row)}
                                                                disabled={saving || reasonMissing}
                                                                className="p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                                                title={reasonMissing ? 'Enter a change reason first' : 'Save'}
                                                            >
                                                                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                                            </button>
                                                            <button
                                                                onClick={cancelEdit}
                                                                className="p-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-600 transition-colors"
                                                                title="Cancel"
                                                            >
                                                                <X size={13} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button
                                                                onClick={() => startEdit(row)}
                                                                className="p-1.5 rounded-lg hover:bg-brand-100 text-surface-400 hover:text-brand-600 transition-colors"
                                                                title="Edit stock & description"
                                                            >
                                                                <Pencil size={13} />
                                                            </button>
                                                            {confirmDeleteId === row.id ? (
                                                                <button
                                                                    onClick={() => deleteItem(row)}
                                                                    disabled={deletingId === row.id}
                                                                    className="px-2 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold shadow-sm transition-all disabled:opacity-40 animate-pulse"
                                                                    title="Click again to confirm delete"
                                                                >
                                                                    {deletingId === row.id ? <Loader2 size={11} className="animate-spin" /> : 'Confirm?'}
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => deleteItem(row)}
                                                                    className="p-1.5 rounded-lg hover:bg-red-100 text-surface-400 hover:text-red-600 transition-colors"
                                                                    title="Delete item"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                {!loading && (
                    <div className="px-5 py-3 bg-surface-50/50 border-t border-surface-200 text-xs text-surface-700/50 font-medium">
                        Showing {filtered.length} of {data.length} items
                    </div>
                )}
            </div>

            {/* Add Item Modal */}
            <AddInventoryModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSuccess={fetchInventory}
            />

            {/* Popover animation */}
            <style>{`
                @keyframes popIn {
                    from { transform: translateX(-50%) scale(0.95) translateY(-4px); opacity: 0; }
                    to { transform: translateX(-50%) scale(1) translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    )
}
