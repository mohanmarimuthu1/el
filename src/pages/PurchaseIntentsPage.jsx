import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { formatTimestamp } from '@/lib/formatTime'
import { FileText, Search, RefreshCw, Check, X, Plus, Loader2, PackageCheck, Trash2 } from 'lucide-react'
import CreateIntentModal from '@/components/CreateIntentModal'

const STATUS_STYLES = {
    Pending: 'bg-amber-100 text-amber-700 ring-amber-300',
    Approved: 'bg-emerald-100 text-emerald-700 ring-emerald-300',
    Delivered: 'bg-blue-100 text-blue-700 ring-blue-300',
    Received: 'bg-emerald-500 text-white ring-emerald-600',
}

// Maps each approval field to the roles allowed to toggle it
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

export default function PurchaseIntentsPage() {
    const { canViewFinancials, user, role } = useAuth()
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [modalOpen, setModalOpen] = useState(false)
    const [togglingId, setTogglingId] = useState(null)
    const [confirmingId, setConfirmingId] = useState(null)
    const [deletingIntentId, setDeletingIntentId] = useState(null)
    const [confirmDeleteIntentId, setConfirmDeleteIntentId] = useState(null)

    useEffect(() => { fetchIntents() }, [])

    async function fetchIntents() {
        setLoading(true)
        let query = supabase.from('purchase_intents').select('*').order('created_at', { ascending: false })
        const { data: intents, error } = await query
        if (error) { setLoading(false); return }

        let rows = intents || []

        // If owner/manager, also fetch the best vendor quote for each intent
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

    // Toggle an approval checkbox
    async function toggleApproval(row, field) {
        // Role-based guard: only the designated role can toggle this field
        const allowedRoles = APPROVAL_ROLE_MAP[field] || []
        if (!allowedRoles.includes(role)) {
            return
        }

        const newVal = !row[field]
        setTogglingId(`${row.id}-${field}`)

        // Calculate new approval state
        const newApprovals = {
            approval_1_purchase_dept: field === 'approval_1_purchase_dept' ? newVal : row.approval_1_purchase_dept,
            approval_2_md: field === 'approval_2_md' ? newVal : row.approval_2_md,
            approval_3_manager: field === 'approval_3_manager' ? newVal : row.approval_3_manager,
        }

        const allApproved = newApprovals.approval_1_purchase_dept && newApprovals.approval_2_md && newApprovals.approval_3_manager
        const newStatus = allApproved ? 'Delivered' : 'Pending'

        const updatePayload = {
            [field]: newVal,
            status: newStatus,
        }

        if (allApproved) {
            updatePayload.approved_at = new Date().toISOString()
        } else {
            updatePayload.approved_at = null
        }

        const { error } = await supabase
            .from('purchase_intents')
            .update(updatePayload)
            .eq('id', row.id)

        if (!error) {
            // Optimistic update
            setData(prev => prev.map(r =>
                r.id === row.id
                    ? { ...r, ...updatePayload }
                    : r
            ))

            // Audit log
            const fieldLabels = {
                approval_1_purchase_dept: 'PD',
                approval_2_md: 'MD',
                approval_3_manager: 'MGR',
            }
            const actionVerb = newVal ? 'Approved' : 'Unapproved'
            await supabase.from('activity_logs').insert({
                user_name: user?.name || 'Demo User',
                user_role: role,
                action: `${fieldLabels[field]} ${actionVerb} Intent ${row.model_code}`,
                entity_type: 'purchase_intent',
                entity_id: row.id,
            })
        }

        setTogglingId(null)
    }

    // Confirm Receipt: updates status to Received, increments inventory
    async function confirmReceipt(row) {
        setConfirmingId(row.id)

        // Update status to Received
        const { error } = await supabase
            .from('purchase_intents')
            .update({ status: 'Received', approved_at: new Date().toISOString() })
            .eq('id', row.id)

        if (!error) {
            // Increment stock in inventory (by model_code match)
            const { data: invItems } = await supabase
                .from('inventory')
                .select('id, stock_count')
                .eq('model_number', row.model_code)
                .limit(1)

            if (invItems && invItems.length > 0) {
                await supabase
                    .from('inventory')
                    .update({ stock_count: invItems[0].stock_count + (row.quantity_required || 0) })
                    .eq('id', invItems[0].id)
            }

            // Audit log
            await supabase.from('activity_logs').insert({
                user_name: user?.name || 'Demo User',
                user_role: role,
                action: `Confirmed receipt for Intent ${row.model_code} (Qty: ${row.quantity_required} ${row.unit || ''})`,
                entity_type: 'purchase_intent',
                entity_id: row.id,
            })

            // Optimistic update
            setData(prev => prev.map(r =>
                r.id === row.id ? { ...r, status: 'Received' } : r
            ))
        }

        setConfirmingId(null)
    }

    async function deleteIntent(row) {
        // Two-step confirmation
        if (confirmDeleteIntentId !== row.id) {
            setConfirmDeleteIntentId(row.id)
            setTimeout(() => setConfirmDeleteIntentId(prev => prev === row.id ? null : prev), 4000)
            return
        }

        setConfirmDeleteIntentId(null)
        setDeletingIntentId(row.id)

        // Delete linked vendor quotes first
        await supabase.from('vendor_quotes').delete().eq('intent_id', row.id)

        const { error } = await supabase.from('purchase_intents').delete().eq('id', row.id)

        if (error) {
            console.error('Delete intent failed:', error)
            setDeletingIntentId(null)
            return
        }

        await supabase.from('activity_logs').insert({
            user_name: user?.name || 'Demo User',
            user_role: role,
            action: `Deleted intent: ${row.model_code} (${row.description || 'No description'})`,
            entity_type: 'purchase_intent',
            entity_id: row.id,
        })
        setData(prev => prev.filter(r => r.id !== row.id))
        setDeletingIntentId(null)
    }

    function ApprovalCheckbox({ row, field, label }) {
        const isChecked = row[field]
        const isToggling = togglingId === `${row.id}-${field}`
        const allApproved = row.approval_1_purchase_dept && row.approval_2_md && row.approval_3_manager
        const isLocked = row.status === 'Received'

        // Role-based permission: only designated roles can toggle this field
        const allowedRoles = APPROVAL_ROLE_MAP[field] || []
        const hasPermission = allowedRoles.includes(role)

        // Approval hierarchy: Owner/MD approval requires Manager approval first
        const needsManagerFirst = field === 'approval_2_md' && !row.approval_3_manager
        const isDisabled = isToggling || isLocked || needsManagerFirst || !hasPermission

        let tooltipText = ''
        if (isLocked) tooltipText = `${label}: Locked (Received)`
        else if (!hasPermission) tooltipText = `Only ${APPROVAL_ROLE_LABELS[field]} can approve this`
        else if (needsManagerFirst) tooltipText = `${label}: Manager must approve first`
        else tooltipText = `${label}: Click to ${isChecked ? 'revoke' : 'approve'}`

        return (
            <button
                onClick={() => toggleApproval(row, field)}
                disabled={isDisabled}
                title={tooltipText}
                className={`
                    inline-flex items-center justify-center w-7 h-7 rounded-full transition-all duration-200
                    ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-110'}
                    ${isChecked
                        ? (allApproved
                            ? 'bg-emerald-500 shadow-md shadow-emerald-500/30'
                            : 'bg-emerald-100 ring-1 ring-emerald-300')
                        : !hasPermission
                            ? 'bg-surface-100 ring-1 ring-surface-200'
                            : needsManagerFirst
                                ? 'bg-surface-100 ring-1 ring-orange-300'
                                : 'bg-surface-100 ring-1 ring-surface-300 hover:ring-brand-300 hover:bg-brand-50'
                    }
                `}
            >
                {isToggling ? (
                    <Loader2 size={12} className="animate-spin text-surface-400" />
                ) : isChecked ? (
                    <Check size={13} className={allApproved ? 'text-white' : 'text-emerald-600'} />
                ) : (
                    <X size={13} className={!hasPermission ? 'text-surface-300' : needsManagerFirst ? 'text-orange-400' : 'text-surface-400'} />
                )}
            </button>
        )
    }

    const colCount = canViewFinancials ? 12 : 10

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-surface-900 tracking-tight flex items-center gap-2">
                        <FileText size={22} className="text-brand-500" />
                        Purchase Intents
                    </h2>
                    <p className="text-sm text-surface-700/60 mt-0.5">Digital Intent Ledger — requests & approvals</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-300" />
                        <input
                            type="text"
                            placeholder="Search intents..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all w-full sm:w-64"
                        />
                    </div>
                    <button
                        onClick={fetchIntents}
                        className="p-2 rounded-xl border border-surface-200 bg-white hover:bg-surface-50 text-surface-700 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={() => setModalOpen(true)}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 transition-all"
                    >
                        <Plus size={15} />
                        <span className="hidden sm:inline">New Intent</span>
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-surface-200 bg-white overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-surface-200 bg-surface-50/80">
                                <th className="text-left px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Model Code</th>
                                <th className="text-left px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Description</th>
                                <th className="text-center px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Unit</th>
                                <th className="text-center px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Qty</th>
                                <th className="text-center px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Status</th>
                                <th className="text-center px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider" title="Purchase Dept">PD</th>
                                <th className="text-center px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider" title="Managing Director">MD</th>
                                <th className="text-center px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider" title="Manager">MGR</th>
                                {canViewFinancials && (
                                    <>
                                        <th className="text-left px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Best Vendor</th>
                                        <th className="text-right px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Best Price</th>
                                    </>
                                )}
                                <th className="text-center px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Action</th>
                                <th className="text-left px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Created At</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="border-b border-surface-100">
                                        {Array.from({ length: colCount }).map((_, j) => (
                                            <td key={j} className="px-5 py-3.5">
                                                <div className="h-4 bg-surface-200 rounded animate-pulse w-20" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={colCount} className="px-5 py-12 text-center text-surface-700/40">
                                        <FileText size={36} className="mx-auto mb-2 opacity-30" />
                                        <p className="font-medium">No purchase intents found</p>
                                        <p className="text-xs mt-1">Click "+ New Intent" to create your first purchase request.</p>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((row) => {
                                    const allApproved = row.approval_1_purchase_dept && row.approval_2_md && row.approval_3_manager
                                    const isReceived = row.status === 'Received'
                                    return (
                                        <tr
                                            key={row.id}
                                            className={`border-b transition-all duration-300 ${isReceived
                                                ? 'bg-emerald-100/60 border-emerald-300 border-l-4 border-l-emerald-600 opacity-80'
                                                : allApproved
                                                    ? 'bg-emerald-50/70 border-emerald-200 border-l-4 border-l-emerald-500'
                                                    : 'border-surface-100 hover:bg-brand-50/30'
                                                }`}
                                        >
                                            <td className="px-5 py-3.5 font-medium font-mono text-surface-800">{row.model_code || '—'}</td>
                                            <td className="px-5 py-3.5 text-surface-700 max-w-[200px] truncate">{row.description || '—'}</td>
                                            <td className="px-5 py-3.5 text-center text-xs font-semibold text-surface-600">{row.unit || '—'}</td>
                                            <td className="px-5 py-3.5 text-center font-semibold text-surface-800">{row.quantity_required || '—'}</td>
                                            <td className="px-5 py-3.5 text-center">
                                                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ring-1 ring-inset ${STATUS_STYLES[row.status] || 'bg-surface-100 text-surface-600 ring-surface-300'}`}>
                                                    {row.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                <ApprovalCheckbox row={row} field="approval_1_purchase_dept" label="Purchase Dept" />
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                <ApprovalCheckbox row={row} field="approval_2_md" label="Managing Director" />
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                <ApprovalCheckbox row={row} field="approval_3_manager" label="Manager" />
                                            </td>
                                            {canViewFinancials && (
                                                <>
                                                    <td className="px-5 py-3.5 text-surface-700">{row._bestQuote?.vendor_name || '—'}</td>
                                                    <td className="px-5 py-3.5 text-right font-mono font-semibold text-surface-800">
                                                        {row._bestQuote?.price_quoted ? '₹' + parseFloat(row._bestQuote.price_quoted).toLocaleString('en-IN') : '—'}
                                                    </td>
                                                </>
                                            )}
                                            <td className="px-5 py-3.5 text-center">
                                                {isReceived ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-sm">
                                                        <PackageCheck size={10} />
                                                        Received
                                                    </span>
                                                ) : allApproved ? (
                                                    <button
                                                        onClick={() => confirmReceipt(row)}
                                                        disabled={confirmingId === row.id}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-md shadow-emerald-500/25 transition-all disabled:opacity-60"
                                                    >
                                                        {confirmingId === row.id ? (
                                                            <><Loader2 size={10} className="animate-spin" /> Confirming...</>
                                                        ) : (
                                                            <><PackageCheck size={10} /> Confirm Receipt</>
                                                        )}
                                                    </button>
                                                ) : canViewFinancials ? (
                                                    confirmDeleteIntentId === row.id ? (
                                                        <button
                                                            onClick={() => deleteIntent(row)}
                                                            disabled={deletingIntentId === row.id}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-red-500 hover:bg-red-600 shadow-md shadow-red-500/25 transition-all disabled:opacity-40 animate-pulse"
                                                            title="Click again to confirm delete"
                                                        >
                                                            {deletingIntentId === row.id ? (
                                                                <><Loader2 size={10} className="animate-spin" /> Deleting...</>
                                                            ) : (
                                                                'Confirm Delete?'
                                                            )}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => deleteIntent(row)}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 hover:border-red-300 transition-all"
                                                            title="Delete intent"
                                                        >
                                                            <Trash2 size={10} /> Delete
                                                        </button>
                                                    )
                                                ) : (
                                                    <span className="text-xs text-surface-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 text-xs text-surface-700/50 font-mono whitespace-nowrap">{formatTimestamp(row.created_at)}</td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                {!loading && (
                    <div className="px-5 py-3 bg-surface-50/50 border-t border-surface-200 text-xs text-surface-700/50 font-medium">
                        Showing {filtered.length} of {data.length} intents
                    </div>
                )}
            </div>

            {/* Create Intent Modal */}
            <CreateIntentModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSuccess={fetchIntents}
            />
        </div>
    )
}
