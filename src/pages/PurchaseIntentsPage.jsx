import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { formatTimestamp } from '@/lib/formatTime'
import { FileText, Search, RefreshCw, Check, X, Plus, Loader2, PackageCheck, Trash2, ShoppingCart } from 'lucide-react'
import CreateIntentModal from '@/components/CreateIntentModal'

const STATUS_STYLES = {
    Requested: 'bg-amber-100 text-amber-700 ring-amber-300',
    Approved: 'bg-emerald-100 text-emerald-700 ring-emerald-300',
    Purchased: 'bg-violet-100 text-violet-700 ring-violet-300',
    Delivered: 'bg-blue-100 text-blue-700 ring-blue-300',
    Received: 'bg-emerald-500 text-white ring-emerald-600',
}

const APPROVAL_ROLE_MAP = {
    approval_1_purchase_dept: ['supervisor', 'admin'],
    approval_2_md: ['owner', 'admin'],
    approval_3_manager: ['manager', 'admin'],
}

const APPROVAL_ROLE_LABELS = {
    approval_1_purchase_dept: 'Purchase Dept (Supervisor)',
    approval_2_md: 'Managing Director (Owner)',
    approval_3_manager: 'Manager',
}

export default function PurchaseIntentsPage({ selectedProjectId }) {
    const { canViewFinancials, user, role } = useAuth()
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [modalOpen, setModalOpen] = useState(false)
    const [togglingId, setTogglingId] = useState(null)
    const [confirmingId, setConfirmingId] = useState(null)
    const [deletingIntentId, setDeletingIntentId] = useState(null)
    const [confirmDeleteIntentId, setConfirmDeleteIntentId] = useState(null)

    useEffect(() => { fetchIntents() }, [selectedProjectId])

    async function fetchIntents() {
        setLoading(true)
        let query = supabase.from('purchase_intents').select('*').order('created_at', { ascending: false })
        
        if (selectedProjectId) {
            query = query.eq('project_id', selectedProjectId)
        }

        const { data: intents, error } = await query
        if (error) { setLoading(false); return }

        let rows = intents || []

        if (canViewFinancials && rows.length > 0) {
            const ids = rows.map(r => r.id)
            const { data: quotes } = await supabase
                .from('vendor_quotes')
                .select('intent_id, vendor_name, price_quoted')
                .in('intent_id', ids)
                .eq('is_best_price', true)

            const quoteMap = {}
            quotes?.forEach(q => { quoteMap[q.intent_id] = q })
            rows = rows.map(r => ({ ...r, _bestQuote: quoteMap[r.id] || null }))
        }

        setData(rows)
        setLoading(false)
    }

    const filtered = data.filter(row =>
        [row.model_code, row.description, row.status]
            .some(v => v?.toLowerCase().includes(search.toLowerCase()))
    )

    async function toggleApproval(row, field) {
        const allowedRoles = APPROVAL_ROLE_MAP[field] || []
        if (!allowedRoles.includes(role)) return

        const newVal = !row[field]
        setTogglingId(`${row.id}-${field}`)

        const updatePayload = {
            [field]: newVal,
        }

        const { error } = await supabase
            .from('purchase_intents')
            .update(updatePayload)
            .eq('id', row.id)

        if (!error) {
            setData(prev => prev.map(r =>
                r.id === row.id ? { ...r, ...updatePayload } : r
            ))
        }
        setTogglingId(null)
    }

    async function markAsPurchased(row) {
        setConfirmingId(row.id)
        try {
            // 1. Update purchase intent status to Purchased
            const { error: statusErr } = await supabase
                .from('purchase_intents')
                .update({ status: 'Purchased', approved_at: new Date().toISOString() })
                .eq('id', row.id)
            if (statusErr) throw statusErr

            // 2. Add to inventory
            const { error: invErr } = await supabase.from('inventory').insert({
                manufacturer: (row.model_code || 'PURCHASED').toUpperCase(),
                serial_number: (row.model_code || 'PI-' + row.id.slice(0, 8)).toUpperCase(),
                model_number: (row.model_code || row.description || 'ITEM').toUpperCase(),
                stock_count: Number(row.quantity_required) || 1,
                description: row.description || null,
            })
            if (invErr) throw invErr

            // 3. Audit log
            await supabase.from('activity_logs').insert({
                user_name: user?.name || user?.email || 'Demo User',
                user_role: role,
                action: `Marked purchase intent as Purchased & added to inventory: ${row.model_code} × ${row.quantity_required}`,
                entity_type: 'inventory',
            })

            setData(prev => prev.map(r =>
                r.id === row.id ? { ...r, status: 'Purchased' } : r
            ))
        } catch (err) {
            console.error('Mark as purchased failed:', err)
        } finally {
            setConfirmingId(null)
        }
    }

    async function confirmReceipt(row) {
        setConfirmingId(row.id)
        const { error } = await supabase
            .from('purchase_intents')
            .update({ status: 'Received', approved_at: new Date().toISOString() })
            .eq('id', row.id)

        if (!error) {
            setData(prev => prev.map(r =>
                r.id === row.id ? { ...r, status: 'Received' } : r
            ))
        }
        setConfirmingId(null)
    }

    async function deleteIntent(row) {
        if (confirmDeleteIntentId !== row.id) {
            setConfirmDeleteIntentId(row.id)
            setTimeout(() => setConfirmDeleteIntentId(null), 4000)
            return
        }
        setDeletingIntentId(row.id)
        const { error } = await supabase.from('purchase_intents').delete().eq('id', row.id)
        if (!error) {
            setData(prev => prev.filter(r => r.id !== row.id))
        }
        setDeletingIntentId(null)
    }

    function ApprovalCheckbox({ row, field, label }) {
        const isChecked = row[field]
        const isToggling = togglingId === `${row.id}-${field}`
        const isLocked = row.status === 'Received' || role === 'employee'
        const allowedRoles = APPROVAL_ROLE_MAP[field] || []
        const hasPermission = allowedRoles.includes(role)
        const isDisabled = isToggling || isLocked || !hasPermission

        return (
            <button
                onClick={() => toggleApproval(row, field)}
                disabled={isDisabled}
                className={`inline-flex items-center justify-center w-7 h-7 rounded-full transition-all ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-110'} ${isChecked ? 'bg-emerald-500 shadow-md shadow-emerald-500/30' : 'bg-surface-100 ring-1 ring-surface-300'}`}
            >
                {isToggling ? <Loader2 size={12} className="animate-spin text-surface-400" /> : isChecked ? <Check size={13} className="text-white" /> : <X size={13} className="text-surface-400" />}
            </button>
        )
    }

    const colCount = canViewFinancials ? 11 : 9
    const allApproved = (row) => row.approval_1_purchase_dept && row.approval_2_md && row.approval_3_manager

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-surface-900 tracking-tight flex items-center gap-2">
                        <FileText size={22} className="text-brand-500" />
                        Purchase Intents
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-300" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none w-full sm:w-64"
                        />
                    </div>
                    <button onClick={fetchIntents} className="p-2 rounded-xl border border-surface-200 bg-white hover:bg-surface-50">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                    {role !== 'employee' && (
                        <button onClick={() => setModalOpen(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl text-white bg-brand-500 hover:bg-brand-600 shadow-lg shadow-brand-500/25">
                            <Plus size={15} /> New Intent
                        </button>
                    )}
                </div>
            </div>

            <div className="rounded-2xl border border-surface-200 bg-white overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-surface-50">
                            <tr className="border-b border-surface-200">
                                <th className="px-5 py-3 font-semibold text-xs uppercase text-surface-500">Model Code</th>
                                <th className="px-5 py-3 font-semibold text-xs uppercase text-surface-500">Description</th>
                                <th className="px-5 py-3 font-semibold text-xs uppercase text-surface-500 text-center">Qty</th>
                                <th className="px-5 py-3 font-semibold text-xs uppercase text-surface-500 text-center">Status</th>
                                <th className="px-5 py-3 font-semibold text-xs uppercase text-surface-500 text-center">PD</th>
                                <th className="px-5 py-3 font-semibold text-xs uppercase text-surface-500 text-center">MD</th>
                                <th className="px-5 py-3 font-semibold text-xs uppercase text-surface-500 text-center">MGR</th>
                                {canViewFinancials && (
                                    <>
                                        <th className="px-5 py-3 font-semibold text-xs uppercase text-surface-500">Best Vendor</th>
                                        <th className="px-5 py-3 font-semibold text-xs uppercase text-surface-500 text-right">Best Price</th>
                                    </>
                                )}
                                <th className="px-5 py-3 font-semibold text-xs uppercase text-surface-500 text-center">Action</th>
                                <th className="px-5 py-3 font-semibold text-xs uppercase text-surface-500">Created At</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-100">
                            {loading ? (
                                <tr><td colSpan={colCount} className="px-5 py-10 text-center">Loading...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={colCount} className="px-5 py-10 text-center">No intents found</td></tr>
                            ) : (
                                filtered.map((row) => (
                                    <tr key={row.id} className="hover:bg-brand-50/20">
                                        <td className="px-5 py-4 font-medium">{row.model_code || '—'}</td>
                                        <td className="px-5 py-4">{row.description || '—'}</td>
                                        <td className="px-5 py-4 text-center">{row.quantity_required || '—'}</td>
                                        <td className="px-5 py-4 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ${STATUS_STYLES[row.status] || 'bg-surface-100 text-surface-600'}`}>
                                                {row.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-center"><ApprovalCheckbox row={row} field="approval_1_purchase_dept" /></td>
                                        <td className="px-5 py-4 text-center"><ApprovalCheckbox row={row} field="approval_2_md" /></td>
                                        <td className="px-5 py-4 text-center"><ApprovalCheckbox row={row} field="approval_3_manager" /></td>
                                        {canViewFinancials && (
                                            <>
                                                <td className="px-5 py-4">{row._bestQuote?.vendor_name || '—'}</td>
                                                <td className="px-5 py-4 text-right font-mono">
                                                    {row._bestQuote?.price_quoted ? '₹' + parseFloat(row._bestQuote.price_quoted).toLocaleString() : '—'}
                                                </td>
                                            </>
                                        )}
                                        <td className="px-5 py-4 text-center">
                                            {row.status === 'Received' ? (
                                                <span className="text-emerald-600 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                                                    <PackageCheck size={13} /> Received
                                                </span>
                                            ) : row.status === 'Purchased' ? (
                                                <button
                                                    onClick={() => confirmReceipt(row)}
                                                    disabled={confirmingId === row.id}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-all disabled:opacity-50"
                                                >
                                                    {confirmingId === row.id ? <Loader2 size={12} className="animate-spin" /> : <PackageCheck size={12} />}
                                                    Confirm Receipt
                                                </button>
                                            ) : allApproved(row) ? (
                                                <button
                                                    onClick={() => markAsPurchased(row)}
                                                    disabled={confirmingId === row.id}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 text-xs font-bold hover:bg-violet-100 transition-all disabled:opacity-50"
                                                >
                                                    {confirmingId === row.id ? <Loader2 size={12} className="animate-spin" /> : <ShoppingCart size={12} />}
                                                    Mark Purchased
                                                </button>
                                            ) : role !== 'employee' ? (
                                                <button onClick={() => deleteIntent(row)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                                            ) : '—'}
                                        </td>
                                        <td className="px-5 py-4 text-xs text-surface-400 font-mono whitespace-nowrap">{formatTimestamp(row.created_at)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <CreateIntentModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSuccess={fetchIntents}
                selectedProjectId={selectedProjectId}
            />
        </div>
    )
}
