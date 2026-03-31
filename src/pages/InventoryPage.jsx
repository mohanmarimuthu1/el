import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { formatTimestamp } from '@/lib/formatTime'
import { HardDrive, Search, RefreshCw, Plus, Pencil, Check, X, Loader2, Info, Trash2, ShoppingBag, AlertTriangle } from 'lucide-react'
import AddInventoryModal from '@/components/AddInventoryModal'
import PurchaseEntryModal from '@/components/PurchaseEntryModal'
import CreateIntentModal from '@/components/CreateIntentModal'
import { FileText } from 'lucide-react'

const UOM_OPTIONS = ['NOS', 'MTR', 'KG', 'SET', 'ROLL', 'BOX', 'PCS', 'PAIR', 'LOT', 'LTR']

export default function InventoryPage() {
    const { canManageInventory, user, role, isAdmin, isOwner } = useAuth()
    const canDelete = isAdmin || isOwner || role === 'manager' // Added manager for testing
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [modalOpen, setModalOpen] = useState(false)
    const [purchaseModalOpen, setPurchaseModalOpen] = useState(false)
    const [indentModalOpen, setIndentModalOpen] = useState(false)

    // Multi-select state
    const [selectedIds, setSelectedIds] = useState(new Set())
    const [bulkDeleting, setBulkDeleting] = useState(false)
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)

    // Inline editing state
    const [editingId, setEditingId] = useState(null)
    const [editForm, setEditForm] = useState({ product_name: '', manufacturer: '', model_number: '', serial_number: '', quantity: '', uom: 'NOS', description: '', reason: '', maintain_stock: false, min_stock_level: '', max_stock_level: '' })
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
        setSelectedIds(new Set())
    }

    const filtered = data.filter(row =>
        [row.manufacturer, row.serial_number, row.model_number, row.description, row.product_name]
            .some(v => v?.toLowerCase().includes(search.toLowerCase()))
    )

    // ─── Multi-Select ───
    function toggleSelect(id) {
        setSelectedIds(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    function toggleSelectAll() {
        if (selectedIds.size === filtered.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(filtered.map(r => r.id)))
        }
    }

    async function handleBulkDelete() {
        if (!confirmBulkDelete) {
            setConfirmBulkDelete(true)
            setTimeout(() => setConfirmBulkDelete(false), 4000)
            return
        }
        setBulkDeleting(true)
        setConfirmBulkDelete(false)
        const ids = [...selectedIds]

        // Explicitly remove dependent foreign key records first
        await supabase.from('stock_adjustments').delete().in('inventory_id', ids)

        const { error } = await supabase.from('inventory').delete().in('id', ids)
        if (error) {
            alert(`Delete failed: ${error.message}`)
            setBulkDeleting(false)
            return
        }

        await supabase.from('activity_logs').insert({
            user_name: user?.user_metadata?.full_name || user?.email || 'User',
            user_role: role,
            action: `Bulk deleted ${ids.length} inventory item(s)`,
            entity_type: 'inventory',
        })
        setData(prev => prev.filter(r => !ids.includes(r.id)))
        setSelectedIds(new Set())
        setBulkDeleting(false)
    }

    // ─── Inline Edit ───
    function startEdit(row) {
        setEditingId(row.id)
        setEditForm({
            product_name: row.product_name || '',
            manufacturer: row.manufacturer || '',
            model_number: row.model_number || '',
            serial_number: row.serial_number || '',
            quantity: String(row.quantity ?? 0),
            uom: row.uom || 'NOS',
            description: row.description || '',
            reason: '',
            maintain_stock: row.maintain_stock ?? false,
            min_stock_level: String(row.min_stock_level ?? 0),
            max_stock_level: String(row.max_stock_level ?? 0),
        })
    }

    function cancelEdit() {
        setEditingId(null)
        setEditForm({ product_name: '', manufacturer: '', model_number: '', serial_number: '', quantity: '', uom: 'NOS', description: '', reason: '', maintain_stock: false, min_stock_level: '', max_stock_level: '' })
    }

    async function saveEdit(row) {
        const newStock = parseInt(editForm.quantity) || 0
        const newUom = editForm.uom || 'NOS'
        const newDesc = editForm.description.trim()
        const newProductName = editForm.product_name.trim()
        const newManufacturer = editForm.manufacturer.trim()
        const newModelNumber = editForm.model_number.trim()
        const newSerialNumber = editForm.serial_number.trim()
        const newMaintainStock = editForm.maintain_stock
        const newMinStock = newMaintainStock ? (parseInt(editForm.min_stock_level) || 0) : 0
        const newMaxStock = newMaintainStock ? (parseInt(editForm.max_stock_level) || 0) : 0

        const stockChanged = newStock !== row.quantity
        const uomChanged = newUom !== (row.uom || 'NOS')

        if (stockChanged && !editForm.reason.trim()) return

        const changes = []
        if (stockChanged) changes.push(`Stock: ${row.quantity} → ${newStock}`)
        if (uomChanged) changes.push(`UOM: ${row.uom || 'NOS'} → ${newUom}`)
        if (newDesc !== (row.description || '')) changes.push(`Description updated`)
        if (newProductName !== (row.product_name || '')) changes.push(`Product Name updated`)
        if (newManufacturer !== (row.manufacturer || '')) changes.push(`Manufacturer updated`)
        if (newModelNumber !== (row.model_number || '')) changes.push(`Model Number updated`)
        if (newSerialNumber !== (row.serial_number || '')) changes.push(`Serial No updated`)
        if (newMaintainStock !== (row.maintain_stock ?? false)) changes.push(`Maintain Stock: ${newMaintainStock ? 'Enabled' : 'Disabled'}`)
        if (newMinStock !== (row.min_stock_level ?? 0)) changes.push(`Min Stock: ${row.min_stock_level ?? 0} → ${newMinStock}`)
        if (newMaxStock !== (row.max_stock_level ?? 0)) changes.push(`Max Stock: ${row.max_stock_level ?? 0} → ${newMaxStock}`)

        if (changes.length === 0) { cancelEdit(); return }

        setSaving(true)

        const updatePayload = {
            product_name: newProductName || null,
            manufacturer: newManufacturer || null,
            model_number: newModelNumber || null,
            serial_number: newSerialNumber || null,
            quantity: newStock,
            uom: newUom,
            description: newDesc || null,
            maintain_stock: newMaintainStock,
            min_stock_level: newMinStock,
            max_stock_level: newMaxStock,
            updated_at: new Date().toISOString(),
        }

        const { error } = await supabase
            .from('inventory')
            .update(updatePayload)
            .eq('id', row.id)

        if (!error) {
            if (stockChanged) {
                await supabase.from('stock_adjustments').insert({
                    inventory_id: row.id,
                    previous_stock: row.quantity,
                    new_stock: newStock,
                    reason: editForm.reason.trim(),
                    changed_by: user?.user_metadata?.full_name || user?.email || 'User',
                })
            }
            const reasonSuffix = stockChanged ? ` — Reason: ${editForm.reason.trim()}` : ''
            await supabase.from('activity_logs').insert({
                user_name: user?.user_metadata?.full_name || user?.email || 'User',
                user_role: role,
                action: `Edited inventory ${row.model_number}: ${changes.join(', ')}${reasonSuffix}`,
                entity_type: 'inventory',
                entity_id: row.id,
            })
            setData(prev => prev.map(r =>
                r.id === row.id
                    ? { ...r, ...updatePayload }
                    : r
            ))
        }

        setEditingId(null)
        setSaving(false)
    }

    async function deleteItem(row) {
        if (confirmDeleteId !== row.id) {
            setConfirmDeleteId(row.id)
            setTimeout(() => setConfirmDeleteId(prev => prev === row.id ? null : prev), 4000)
            return
        }
        setConfirmDeleteId(null)
        setDeletingId(row.id)

        // Explicitly remove dependent foreign key records first
        await supabase.from('stock_adjustments').delete().eq('inventory_id', row.id)

        const { error } = await supabase.from('inventory').delete().eq('id', row.id)
        if (error) {
            console.error('Delete failed:', error)
            
            if (error.code === '23503' || error.message?.includes('dispatches_inventory_id_fkey')) {
                alert(`Cannot delete "${row.product_name || row.model_number || 'item'}": This item is linked to existing dispatch records. You must completely delete its dispatch history first.`)
            } else {
                alert(`Failed to delete item: ${error.message || 'Unknown error'}`)
            }
            
            setDeletingId(null)
            return
        }

        await supabase.from('activity_logs').insert({
            user_name: user?.user_metadata?.full_name || user?.email || 'User',
            user_role: role,
            action: `Deleted inventory item: ${row.product_name || row.model_number} (${row.manufacturer})`,
            entity_type: 'inventory',
            entity_id: row.id,
        })
        setData(prev => prev.filter(r => r.id !== row.id))
        setDeletingId(null)
    }

    async function showHistory(inventoryId) {
        if (historyId === inventoryId) { setHistoryId(null); return }
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

    // Column count
    const colCount = canManageInventory ? (canDelete ? 11 : 10) : 9

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
                <div className="flex items-center gap-2 flex-wrap">
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

                    {/* Bulk Delete Button — only shown when items are selected + admin/owner */}
                    {canDelete && selectedIds.size > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            disabled={bulkDeleting}
                            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
                                confirmBulkDelete
                                    ? 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-500/30'
                                    : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                            }`}
                        >
                            {bulkDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            {confirmBulkDelete ? `Confirm Delete (${selectedIds.size})` : `Delete (${selectedIds.size})`}
                        </button>
                    )}

                    {canManageInventory && (
                        <>
                            <button
                                onClick={() => setIndentModalOpen(true)}
                                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-all"
                            >
                                <FileText size={15} />
                                <span className="hidden sm:inline">New Intent</span>
                            </button>
                            <button
                                onClick={() => setPurchaseModalOpen(true)}
                                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 transition-all"
                            >
                                <ShoppingBag size={15} />
                                <span className="hidden sm:inline">Purchase Entry</span>
                            </button>
                            <button
                                onClick={() => setModalOpen(true)}
                                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 transition-all"
                            >
                                <Plus size={15} />
                                <span className="hidden sm:inline">Add Product</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-surface-200 bg-white shadow-sm flex flex-col" style={{ maxHeight: '65vh' }}>
                <div className="overflow-auto flex-1">
                    <table className="w-full text-sm relative">
                        <thead className="bg-surface-50/80 sticky top-0 z-20 shadow-sm ring-1 ring-surface-200">
                            <tr className="border-b border-surface-200">
                                {/* Checkbox column for admin/owner */}
                                {canDelete && (
                                    <th className="px-4 py-3.5 w-10">
                                        <input
                                            type="checkbox"
                                            checked={filtered.length > 0 && selectedIds.size === filtered.length}
                                            onChange={toggleSelectAll}
                                            className="rounded border-surface-300 text-brand-500 focus:ring-brand-500/20 cursor-pointer"
                                        />
                                    </th>
                                )}
                                <th className="text-left px-4 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Name</th>
                                <th className="text-left px-4 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Manufacturer</th>
                                <th className="text-left px-4 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Model No.</th>

                                <th className="text-center px-4 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Qty</th>
                                <th className="text-left px-4 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider w-20">UOM</th>
                                <th className="text-left px-4 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Description</th>
                                <th className="text-center px-4 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Maintain</th>
                                <th className="text-center px-4 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Min Qty</th>
                                <th className="text-center px-4 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Max Qty</th>
                                {canManageInventory && (
                                    <th className="text-center px-4 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider w-24">Actions</th>
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
                                                ? 'Click "+ Add Product" to add your first item.'
                                                : 'Items will appear here once added to the database.'}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((row) => {
                                    const isEditing = editingId === row.id
                                    const stockChanged = isEditing && parseInt(editForm.quantity) !== row.quantity
                                    const reasonMissing = stockChanged && !editForm.reason.trim()
                                    const isSelected = selectedIds.has(row.id)
                                    const isBelowMin = row.maintain_stock && row.quantity < row.min_stock_level
                                    const isAboveMax = row.maintain_stock && row.max_stock_level > 0 && row.quantity > row.max_stock_level

                                    return (
                                        <tr
                                            key={row.id}
                                            className={`border-b transition-colors ${isEditing
                                                ? 'bg-brand-50/50 border-brand-200'
                                                : isSelected
                                                    ? 'bg-blue-50/60 border-blue-100'
                                                    : 'border-surface-100 hover:bg-brand-50/30'
                                                }`}
                                        >
                                            {/* Checkbox */}
                                            {canDelete && (
                                                <td className="px-4 py-3.5">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleSelect(row.id)}
                                                        className="rounded border-surface-300 text-brand-500 focus:ring-brand-500/20 cursor-pointer"
                                                    />
                                                </td>
                                            )}

                                            <td className="px-5 py-3.5">
                                                {isEditing ? (
                                                    <input type="text" value={editForm.product_name} onChange={e => setEditForm(prev => ({ ...prev, product_name: e.target.value }))} className="w-full min-w-[120px] px-2 py-1 text-sm rounded-lg border border-brand-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all font-semibold" placeholder="Name" />
                                                ) : (
                                                    <p className="font-semibold text-surface-800 text-sm whitespace-nowrap">{row.product_name || '—'}</p>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                {isEditing ? (
                                                    <input type="text" value={editForm.manufacturer} onChange={e => setEditForm(prev => ({ ...prev, manufacturer: e.target.value }))} className="w-full min-w-[100px] px-2 py-1 text-xs rounded-lg border border-brand-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all uppercase tracking-wide" placeholder="Manufacturer" />
                                                ) : (
                                                    <p className="text-[11px] text-surface-600 font-medium uppercase tracking-wide whitespace-nowrap">{row.manufacturer || '—'}</p>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                {isEditing ? (
                                                    <input type="text" value={editForm.model_number} onChange={e => setEditForm(prev => ({ ...prev, model_number: e.target.value }))} className="w-full min-w-[80px] px-2 py-1 text-xs rounded-lg border border-brand-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all font-mono" placeholder="Model No." />
                                                ) : (
                                                    <span className="text-surface-700 font-mono text-xs">{row.model_number || '—'}</span>
                                                )}
                                            </td>


                                            {/* Quantity */}
                                            <td className="px-5 py-3.5 text-center">
                                                <div className="flex flex-col items-center gap-1.5">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {isEditing ? (
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={editForm.quantity}
                                                                onChange={e => setEditForm(prev => ({ ...prev, quantity: e.target.value }))}
                                                                className="w-16 px-2 py-1 text-sm text-center rounded-lg border border-brand-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all"
                                                                autoFocus
                                                            />
                                                        ) : (
                                                            <>
                                                                <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-bold ${
                                                                    isBelowMin
                                                                        ? 'bg-red-100 text-red-700 ring-1 ring-red-300'
                                                                        : isAboveMax
                                                                            ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-300'
                                                                            : row.quantity > 0
                                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                                : 'bg-red-100 text-red-700'
                                                                }`}>
                                                                    {row.quantity}
                                                                </span>
                                                                {isBelowMin && (
                                                                    <span title={`Below min stock: ${row.min_stock_level}`}>
                                                                        <AlertTriangle size={12} className="text-red-500" />
                                                                    </span>
                                                                )}
                                                                {isAboveMax && !isBelowMin && (
                                                                    <span title={`Above max stock: ${row.max_stock_level}`}>
                                                                        <AlertTriangle size={12} className="text-orange-500" />
                                                                    </span>
                                                                )}
                                                                {/* History icon */}
                                                                <div className="relative" ref={historyId === row.id ? historyRef : null}>
                                                                    <button
                                                                        onClick={() => showHistory(row.id)}
                                                                        className="p-0.5 rounded text-surface-300 hover:text-brand-500 transition-colors"
                                                                        title="View stock history"
                                                                    >
                                                                        <Info size={12} />
                                                                    </button>
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
                                                                                <div className="px-3 py-4 text-center text-xs text-surface-400">No adjustments recorded yet</div>
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
                                                    {/* Reason input */}
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

                                            {/* UOM */}
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

                                            {/* Description */}
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

                                            {/* Maintain Stock */}
                                            <td className="px-5 py-3.5 text-center">
                                                {isEditing ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditForm(prev => ({ ...prev, maintain_stock: !prev.maintain_stock }))}
                                                        className={`mx-auto transition-colors ${editForm.maintain_stock ? 'text-brand-500' : 'text-surface-300'}`}
                                                        title={editForm.maintain_stock ? 'Click to disable' : 'Click to enable'}
                                                    >
                                                        {editForm.maintain_stock
                                                            ? <Check size={16} className="text-brand-500" />
                                                            : <X size={16} className="text-surface-300" />
                                                        }
                                                    </button>
                                                ) : (
                                                    row.maintain_stock ? <Check size={16} className="text-brand-500 mx-auto" /> : <X size={16} className="text-surface-300 mx-auto" />
                                                )}
                                            </td>

                                            {/* Min Qty */}
                                            <td className="px-5 py-3.5 text-center">
                                                {isEditing && editForm.maintain_stock ? (
                                                    <input type="number" min="0" value={editForm.min_stock_level} onChange={e => setEditForm(prev => ({ ...prev, min_stock_level: e.target.value }))} className="w-16 mx-auto px-2 py-1 text-xs text-center rounded-lg border border-brand-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all font-mono text-surface-600" placeholder="0" />
                                                ) : (
                                                    <span className="text-xs font-mono text-surface-600">{row.maintain_stock ? row.min_stock_level : '—'}</span>
                                                )}
                                            </td>

                                            {/* Max Qty */}
                                            <td className="px-5 py-3.5 text-center">
                                                {isEditing && editForm.maintain_stock ? (
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={editForm.max_stock_level}
                                                        onChange={e => setEditForm(prev => ({ ...prev, max_stock_level: e.target.value }))}
                                                        className="w-16 px-2 py-1 text-xs text-center rounded-lg border border-brand-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all font-mono"
                                                        placeholder="0"
                                                    />
                                                ) : (
                                                    <span className={`text-xs font-mono ${isAboveMax ? 'text-orange-600 font-bold' : 'text-surface-600'}`}>
                                                        {row.maintain_stock ? (row.max_stock_level > 0 ? row.max_stock_level : '—') : '—'}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Edit/Delete Actions */}
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
                                                            {canDelete && (
                                                                confirmDeleteId === row.id ? (
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
                                                                )
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
                    <div className="px-5 py-3 bg-surface-50/50 border-t border-surface-200 text-xs text-surface-700/50 font-medium flex items-center justify-between">
                        <span>Showing {filtered.length} of {data.length} items</span>
                        {selectedIds.size > 0 && (
                            <span className="text-blue-600 font-semibold">{selectedIds.size} selected</span>
                        )}
                    </div>
                )}
            </div>

            {/* Add Product Modal */}
            <AddInventoryModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSuccess={fetchInventory}
            />

            {/* Purchase Entry Modal */}
            <PurchaseEntryModal
                open={purchaseModalOpen}
                onClose={() => setPurchaseModalOpen(false)}
                onSuccess={fetchInventory}
            />

            {/* Create Intent Modal for General Stock */}
            <CreateIntentModal
                open={indentModalOpen}
                onClose={() => setIndentModalOpen(false)}
            />

            <style>{`
                @keyframes popIn {
                    from { transform: translateX(-50%) scale(0.95) translateY(-4px); opacity: 0; }
                    to { transform: translateX(-50%) scale(1) translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    )
}
