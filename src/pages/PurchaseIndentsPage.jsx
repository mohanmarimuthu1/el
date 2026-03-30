import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { formatTimestamp } from '@/lib/formatTime'
import {
    FileText, Search, RefreshCw, Plus, Loader2, PackageCheck, Trash2,
    ShoppingCart, ChevronDown, Check, X, Warehouse, Briefcase, Users,
    ToggleLeft, ToggleRight, Award, Store, MessageSquare, IndianRupee
} from 'lucide-react'
import CreateIntentModal from '@/components/CreateIntentModal'

const STATUS_STYLES = {
    Requested: 'bg-amber-100 text-amber-700 ring-amber-300',
    Approved:  'bg-emerald-100 text-emerald-700 ring-emerald-300',
    Purchased: 'bg-violet-100 text-violet-700 ring-violet-300',
    Delivered: 'bg-green-500 text-white ring-green-600 shadow-[0_0_20px_rgba(34,197,94,0.6)] font-black border-2 border-green-400',
    Received:  'bg-emerald-500 text-white ring-emerald-600',
}

// 4-Tier approval config (sequential)
const TIERS = [
    {
        key: 'approved_manager',
        label: 'Elec Manager',
        short: 'MGR',
        roles: ['manager', 'admin'],
        color: 'blue',
        unlockedWhen: () => true,
    },
    {
        key: 'approved_store',
        label: 'Store',
        short: 'STR',
        roles: ['store', 'admin'],
        color: 'indigo',
        unlockedWhen: (row) => row.approved_manager,
        needsStoreModal: true,   // Opens store approval modal
    },
    {
        key: 'approved_purchase',
        label: 'Purchase Dept',
        short: 'PUR',
        roles: ['supervisor', 'admin'],
        color: 'violet',
        unlockedWhen: (row) => row.approved_store,
        needsVendorModal: true,  // Opens vendor award modal
    },
    {
        key: 'approved_md',
        label: 'MD',
        short: 'MD',
        roles: ['owner', 'admin'],
        color: 'emerald',
        unlockedWhen: (row) => row.approved_purchase && !!row.awarded_vendor_name,
    },
]

// ─── Store Approval Modal ───────────────────────────────────────────────────
function StoreApprovalModal({ row, onClose, onSave }) {
    const [available, setAvailable] = useState(row.available_in_store || false)
    const [remark, setRemark] = useState(row.store_remark || '')
    const [saving, setSaving] = useState(false)

    async function handleSave() {
        setSaving(true)
        await onSave({ available_in_store: available, store_remark: remark.trim() })
        setSaving(false)
    }

    return (
        <>
            <div className="fixed inset-0 z-50 bg-surface-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                    className="w-full max-w-md bg-white rounded-2xl border border-surface-200 shadow-2xl overflow-hidden"
                    style={{ animation: 'slideUp 0.25s ease-out' }}
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-blue-50">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500 shadow-md shadow-indigo-500/30">
                                <Store size={16} className="text-white" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-surface-900">Store Verification</h3>
                                <p className="text-[11px] text-surface-500 mt-0.5">2nd Stage Approval — Store Department</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-indigo-100 text-surface-400 transition-colors">
                            <X size={16} />
                        </button>
                    </div>

                    {/* Items summary */}
                    <div className="px-6 py-3 bg-surface-50 border-b border-surface-100">
                        <p className="text-[10px] font-bold text-surface-400 uppercase tracking-wider mb-2">Items Requested</p>
                        <div className="space-y-1">
                            {row.items?.map((item, idx) => (
                                <div key={item.id} className="flex items-center gap-2 text-xs text-surface-700">
                                    <span className="flex h-4 w-4 items-center justify-center rounded bg-indigo-100 text-indigo-600 text-[9px] font-bold shrink-0">{idx + 1}</span>
                                    <span className="font-medium">{item.product_name}</span>
                                    <span className="text-surface-400">({item.quantity} {item.uom})</span>
                                    {item.make && <span className="text-surface-400 text-[10px]">[{item.make}]</span>}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-6 space-y-5">
                        {/* Available toggle */}
                        <div className="rounded-xl border-2 border-dashed border-surface-200 p-4 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-bold text-surface-800">Item Available in Store?</p>
                                <p className="text-xs text-surface-500 mt-0.5">Can this be fulfilled from existing stock?</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setAvailable(v => !v)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm border-2 transition-all ${
                                    available
                                        ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                                        : 'border-red-300 bg-red-50 text-red-600'
                                }`}
                            >
                                {available ? (
                                    <><ToggleRight size={20} /> Yes</>
                                ) : (
                                    <><ToggleLeft size={20} /> No</>
                                )}
                            </button>
                        </div>

                        {/* Remark */}
                        <div>
                            <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                <MessageSquare size={12} /> Store Remarks
                            </label>
                            <textarea
                                value={remark}
                                onChange={e => setRemark(e.target.value)}
                                rows={3}
                                placeholder="e.g. 'Stock insufficient, partial available', 'Exact match found in shelf C3'..."
                                className="w-full px-4 py-3 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all resize-none"
                            />
                        </div>

                        <div className="flex items-center gap-3 pt-1">
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl text-surface-700 border border-surface-200 hover:bg-surface-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl text-white bg-gradient-to-r from-indigo-500 to-blue-600 shadow-lg shadow-indigo-500/25 hover:from-indigo-600 hover:to-blue-700 transition-all disabled:opacity-60"
                            >
                                {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><Check size={14} /> Approve & Save</>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </>
    )
}

// ─── Vendor Award Modal ─────────────────────────────────────────────────────
function VendorAwardModal({ row, vendors, onClose, onSave }) {
    const [search, setSearch] = useState('')
    const [selectedVendor, setSelectedVendor] = useState(null)
    const [price, setPrice] = useState('')
    const [saving, setSaving] = useState(false)

    const filtered = vendors.filter(v => v.name?.toLowerCase().includes(search.toLowerCase()))

    async function handleSave() {
        if (!selectedVendor) return
        setSaving(true)
        await onSave({
            awarded_vendor_id: selectedVendor.id,
            awarded_vendor_name: selectedVendor.name,
            selected_vendor_id: selectedVendor.id,
            selected_vendor_name: selectedVendor.name,
            total_awarded_price: price ? parseFloat(price) : null,
        })
        setSaving(false)
    }

    return (
        <>
            <div className="fixed inset-0 z-50 bg-surface-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                    className="w-full max-w-lg bg-white rounded-2xl border border-surface-200 shadow-2xl overflow-hidden"
                    style={{ animation: 'slideUp 0.25s ease-out' }}
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-purple-50">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 shadow-md shadow-violet-500/30">
                                <Award size={16} className="text-white" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-surface-900">Award Best Vendor</h3>
                                <p className="text-[11px] text-surface-500 mt-0.5">3rd Stage — Purchase Dept Selection</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-violet-100 text-surface-400 transition-colors">
                            <X size={16} />
                        </button>
                    </div>

                    <div className="p-6 space-y-5">
                        {/* Vendor search */}
                        <div>
                            <label className="block text-xs font-bold text-surface-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Users size={12} /> Select Best Vendor <span className="text-red-400">*</span>
                            </label>
                            <div className="relative mb-3">
                                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-300" />
                                <input
                                    type="text"
                                    placeholder="Search vendors..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    autoFocus
                                    className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
                                />
                            </div>
                            <div className="max-h-44 overflow-y-auto rounded-xl border border-surface-200 divide-y divide-surface-50">
                                {filtered.length === 0 ? (
                                    <div className="px-4 py-6 text-center text-xs text-surface-400">No vendors found</div>
                                ) : filtered.map(v => (
                                    <button
                                        key={v.id}
                                        type="button"
                                        onClick={() => setSelectedVendor(v)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${
                                            selectedVendor?.id === v.id
                                                ? 'bg-violet-50 border-l-4 border-l-violet-500'
                                                : 'hover:bg-surface-50'
                                        }`}
                                    >
                                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 text-xs font-bold ${
                                            selectedVendor?.id === v.id ? 'bg-violet-500 text-white' : 'bg-surface-100 text-surface-500'
                                        }`}>
                                            {v.name?.[0]?.toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-surface-900 truncate">{v.name}</p>
                                            {v.phone && <p className="text-[11px] text-surface-500">{v.phone}</p>}
                                            {v.vendor_unique_id && <p className="text-[10px] font-mono text-violet-600">{v.vendor_unique_id}</p>}
                                        </div>
                                        {selectedVendor?.id === v.id && <Check size={16} className="text-violet-600 shrink-0" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Price */}
                        <div>
                            <label className="block text-xs font-bold text-surface-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                <IndianRupee size={12} /> Total Awarded Price (₹)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm font-bold">₹</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={price}
                                    onChange={e => setPrice(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full pl-8 pr-4 py-2.5 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all font-mono"
                                />
                            </div>
                        </div>

                        {/* Selected summary */}
                        {selectedVendor && (
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-violet-50 border border-violet-200">
                                <Award size={16} className="text-violet-600 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-violet-800">Awarding to:</p>
                                    <p className="text-sm font-bold text-violet-900 truncate">{selectedVendor.name}</p>
                                    {price && <p className="text-[11px] text-violet-600 mt-0.5">₹{parseFloat(price).toLocaleString('en-IN')}</p>}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-3 pt-1">
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl text-surface-700 border border-surface-200 hover:bg-surface-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!selectedVendor || saving}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl text-white bg-gradient-to-r from-violet-600 to-purple-700 shadow-lg shadow-violet-500/25 hover:from-violet-700 hover:to-purple-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? <><Loader2 size={14} className="animate-spin" /> Awarding...</> : <><Award size={14} /> Award & Approve</>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </>
    )
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function PurchaseIndentsPage({ selectedProjectId }) {
    const { user, role, isAdmin, isOwner } = useAuth()
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [activeTab, setActiveTab] = useState('project_intent')
    const [modalOpen, setModalOpen] = useState(false)
    const [togglingId, setTogglingId] = useState(null)
    const [deletingIntentId, setDeletingIntentId] = useState(null)
    const [confirmDeleteIntentId, setConfirmDeleteIntentId] = useState(null)

    // Modals
    const [storeModalRow, setStoreModalRow] = useState(null)
    const [vendorModalRow, setVendorModalRow] = useState(null)
    const [vendors, setVendors] = useState([])

    useEffect(() => { fetchIntents() }, [selectedProjectId])
    useEffect(() => { fetchVendors() }, [])

    async function fetchIntents() {
        setLoading(true)
        let query = supabase
            .from('purchase_intent_headers')
            .select(`
                id, project_id, intent_type, dept, raised_by, status,
                approved_manager, approved_store, approved_purchase, approved_md,
                available_in_store, store_remark,
                awarded_vendor_id, awarded_vendor_name, total_awarded_price,
                selected_vendor_id, selected_vendor_name,
                created_at, approved_at
            `)
            .order('created_at', { ascending: false })
        if (selectedProjectId) {
            query = query.eq('project_id', selectedProjectId)
        }
        const { data: headers, error } = await query
        if (!error && headers) {
            if (headers.length > 0) {
                const { data: items } = await supabase
                    .from('purchase_intent_items')
                    .select('*')
                    .in('header_id', headers.map(h => h.id))
                const enriched = headers.map(h => ({
                    ...h,
                    items: items?.filter(i => i.header_id === h.id) || []
                }))
                setData(enriched)
            } else {
                setData([])
            }
        }
        setLoading(false)
    }

    async function fetchVendors() {
        const { data } = await supabase.from('vendors').select('id, name, phone, email, vendor_unique_id').order('name')
        setVendors(data || [])
    }

    const tabData = data.filter(row => {
        const matchesTab = selectedProjectId
            ? true
            : (row.intent_type === 'General Stock' ? 'general_stock' : 'project_intent') === activeTab
        const itemsText = row.items?.map(i => `${i.product_name} ${i.make}`).join(' ') || ''
        const matchesSearch = [row.dept, itemsText, row.raised_by, row.status, row.awarded_vendor_name, row.selected_vendor_name]
            .some(v => v?.toLowerCase().includes(search.toLowerCase()))
        return matchesTab && matchesSearch
    })

    const userName = user?.user_metadata?.full_name?.toLowerCase() || user?.email?.toLowerCase() || ''
    const authorizedRaisers = ['sarath', 'gopi', 'parthiban', 'bhuvanesh', 'admin', 'owner', 'manager']
    const isAuthorizedRaiser = authorizedRaisers.some(name => userName.includes(name))

    // ─── Sequential Approval Toggle ───────────────────────────────────────
    async function handleApprovalClick(row, tier) {
        if (!tier.unlockedWhen(row)) return
        if (!tier.roles.includes(role)) return
        const isApproved = row[tier.key]
        if (isApproved) return // already approved — no un-approve

        // Store tier: open modal
        if (tier.needsStoreModal) {
            setStoreModalRow(row)
            return
        }

        // Purchase tier: open vendor award modal
        if (tier.needsVendorModal) {
            setVendorModalRow(row)
            return
        }

        // Regular approval (Manager, MD)
        setTogglingId(`${row.id}-${tier.key}`)
        const updates = { [tier.key]: true }
        const nextRow = { ...row, ...updates }

        if (nextRow.approved_md) {
            updates.status = 'Delivered'
            updates.approved_at = new Date().toISOString()
        } else if (nextRow.approved_purchase) {
            updates.status = 'Purchased'
        } else if (nextRow.approved_manager) {
            updates.status = 'Approved'
        } else {
            updates.status = 'Requested'
        }

        const { error } = await supabase
            .from('purchase_intent_headers')
            .update(updates)
            .eq('id', row.id)

        if (!error) {
            if (tier.key === 'approved_md') {
                const inventoryInserts = (row.items || []).map(item => ({
                    product_name: item.product_name,
                    manufacturer: (item.make || 'PURCHASED').toUpperCase(),
                    model_number: item.model_number || '-',
                    serial_number: null,
                    quantity: Number(item.quantity) || 1,
                    uom: item.uom || 'NOS',
                }))
                if (inventoryInserts.length > 0) {
                    await supabase.from('inventory').insert(inventoryInserts)
                }
                await supabase.from('activity_logs').insert({
                    user_name: user?.user_metadata?.full_name || user?.email || 'User',
                    user_role: role,
                    action: `Marked purchase indent as Delivered & added ${inventoryInserts.length} items to inventory`,
                    entity_type: 'inventory',
                })
            }
            setData(prev => prev.map(r => r.id === row.id ? { ...r, ...updates } : r))
        }
        setTogglingId(null)
    }

    // ─── Store Approval Save ──────────────────────────────────────────────
    async function handleStoreApprovalSave({ available_in_store, store_remark }) {
        const row = storeModalRow
        setStoreModalRow(null)
        setTogglingId(`${row.id}-approved_store`)

        const updates = {
            approved_store: true,
            available_in_store,
            store_remark,
            status: 'Approved'
        }

        const { error } = await supabase
            .from('purchase_intent_headers')
            .update(updates)
            .eq('id', row.id)

        if (!error) {
            // Optimistic local update + full re-fetch for guaranteed consistency
            setData(prev => prev.map(r => r.id === row.id ? { ...r, ...updates } : r))
            fetchIntents()
        }
        setTogglingId(null)
    }

    // ─── Vendor Award Save ────────────────────────────────────────────────
    async function handleVendorAwardSave({ awarded_vendor_id, awarded_vendor_name, selected_vendor_id, selected_vendor_name, total_awarded_price }) {
        const row = vendorModalRow
        setVendorModalRow(null)
        setTogglingId(`${row.id}-approved_purchase`)

        const updates = {
            approved_purchase: true,
            awarded_vendor_id,
            awarded_vendor_name,
            selected_vendor_id,
            selected_vendor_name,
            total_awarded_price,
            status: 'Purchased'
        }

        const { error } = await supabase
            .from('purchase_intent_headers')
            .update(updates)
            .eq('id', row.id)

        if (!error) {
            // Optimistic local update + full re-fetch for guaranteed consistency
            setData(prev => prev.map(r => r.id === row.id ? { ...r, ...updates } : r))
            fetchIntents()
        }
        setTogglingId(null)
    }

    async function deleteIntent(row) {
        if (confirmDeleteIntentId !== row.id) {
            setConfirmDeleteIntentId(row.id)
            setTimeout(() => setConfirmDeleteIntentId(null), 4000)
            return
        }
        setDeletingIntentId(row.id)
        const { error } = await supabase.from('purchase_intent_headers').delete().eq('id', row.id)
        if (!error) setData(prev => prev.filter(r => r.id !== row.id))
        setDeletingIntentId(null)
    }

    const allMDApproved = (row) => row.approved_manager && row.approved_store && row.approved_purchase && row.approved_md

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-surface-900 tracking-tight flex items-center gap-2">
                        <FileText size={22} className="text-brand-500" />
                        Purchase Indents
                    </h2>
                    <p className="text-sm text-surface-700/60 mt-0.5">4-tier sequential approval workflow</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-300" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none w-full sm:w-56"
                        />
                    </div>
                    <button onClick={fetchIntents} className="p-2 rounded-xl border border-surface-200 bg-white hover:bg-surface-50">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                    {isAuthorizedRaiser && (
                        <button
                            onClick={() => setModalOpen(true)}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl text-white bg-brand-500 hover:bg-brand-600 shadow-lg shadow-brand-500/25"
                        >
                            <Plus size={15} /> New Intent
                        </button>
                    )}
                </div>
            </div>

            {/* Tab switcher */}
            {!selectedProjectId && (
                <div className="flex gap-1 p-1.5 bg-surface-100 rounded-2xl w-fit">
                    <button
                        onClick={() => setActiveTab('project_intent')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                            activeTab === 'project_intent'
                                ? 'bg-white text-brand-600 shadow-md shadow-brand-500/10'
                                : 'text-surface-500 hover:text-surface-700'
                        }`}
                    >
                        <Briefcase size={14} /> Project Intents
                    </button>
                    <button
                        onClick={() => setActiveTab('general_stock')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                            activeTab === 'general_stock'
                                ? 'bg-white text-amber-600 shadow-md shadow-amber-500/10'
                                : 'text-surface-500 hover:text-surface-700'
                        }`}
                    >
                        <Warehouse size={14} /> General Stock
                    </button>
                </div>
            )}

            {/* Table */}
            <div className="rounded-2xl border border-surface-200 bg-white shadow-sm flex flex-col" style={{ maxHeight: '65vh' }}>
                <div className="overflow-auto flex-1">
                    <table className="w-full text-sm text-left relative">
                        <thead className="bg-surface-50 sticky top-0 z-20 shadow-sm ring-1 ring-surface-200">
                            <tr className="border-b border-surface-200">
                                <th className="px-4 py-3 font-semibold text-xs uppercase text-surface-500">Type</th>
                                <th className="px-4 py-3 font-semibold text-xs uppercase text-surface-500">Dept</th>
                                <th className="px-4 py-3 font-semibold text-xs uppercase text-surface-500 min-w-[200px]">Items Overview</th>
                                <th className="px-4 py-3 font-semibold text-xs uppercase text-surface-500">Raised By</th>
                                <th className="px-4 py-3 font-semibold text-xs uppercase text-surface-500 text-center">Status</th>
                                {TIERS.map(tier => (
                                    <th key={tier.key} className="px-3 py-3 font-semibold text-xs uppercase text-surface-500 text-center">
                                        {tier.short}
                                    </th>
                                ))}
                                <th className="px-4 py-3 font-semibold text-xs uppercase text-surface-500 min-w-[180px]">Store / Vendor</th>
                                <th className="px-4 py-3 font-semibold text-xs uppercase text-surface-500 text-center">Action</th>
                                <th className="px-4 py-3 font-semibold text-xs uppercase text-surface-500">Created</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-100">
                            {loading ? (
                                <tr><td colSpan={14} className="px-5 py-10 text-center text-surface-400">Loading...</td></tr>
                            ) : tabData.length === 0 ? (
                                <tr><td colSpan={14} className="px-5 py-10 text-center text-surface-400">No indents found</td></tr>
                            ) : (
                                tabData.map((row) => (
                                    <tr key={row.id} className={`relative transition-all duration-500 ${
                                        allMDApproved(row)
                                            ? 'bg-gradient-to-r from-emerald-50 via-green-50 to-emerald-50 ring-2 ring-inset ring-emerald-500 shadow-[0_0_30px_rgba(34,197,94,0.25)] border-l-4 border-l-emerald-500'
                                            : 'hover:bg-brand-50/20'
                                    }`}>
                                        {/* Type badge */}
                                        <td className="px-4 py-4">
                                            {row.intent_type === 'General Stock'
                                                ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700"><Warehouse size={9} />Stock</span>
                                                : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-100 text-brand-700"><Briefcase size={9} />Project</span>
                                            }
                                        </td>
                                        {/* Department */}
                                        <td className="px-4 py-4">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                row.dept === 'Electrical' ? 'bg-amber-100 text-amber-700' :
                                                row.dept === 'Mechanical' ? 'bg-blue-100 text-blue-700' :
                                                row.dept === 'Fabrication' ? 'bg-violet-100 text-violet-700' :
                                                'bg-surface-100 text-surface-600'
                                            }`}>{row.dept || '—'}</span>
                                        </td>
                                        {/* Items Overview */}
                                        <td className="px-4 py-4 max-w-[280px]">
                                            <div className="space-y-1">
                                                {row.items?.map((item, idx) => (
                                                    <div key={item.id} className="text-[11px] leading-tight flex gap-1.5 items-start">
                                                        <span className="text-surface-400 font-mono mt-0.5">{idx + 1}.</span>
                                                        <div className="flex-1">
                                                            <span className="font-semibold text-surface-800">{item.product_name}</span>
                                                            <span className="text-surface-500 ml-1">({item.quantity} {item.uom})</span>
                                                            {item.make && <span className="text-surface-400 ml-1 block text-[10px]">[{item.make}]</span>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-xs text-surface-600 font-medium">{row.raised_by || '—'}</td>
                                        <td className="px-4 py-4 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ${STATUS_STYLES[row.status] || 'bg-surface-100 text-surface-600'}`}>
                                                {row.status}
                                            </span>
                                        </td>

                                        {/* 4-Tier Approval Buttons */}
                                        {TIERS.map((tier) => {
                                            const isUnlocked = tier.unlockedWhen(row)
                                            const hasRole = tier.roles.includes(role)
                                            const isApproved = row[tier.key]
                                            const isToggling = togglingId === `${row.id}-${tier.key}`
                                            const isLocked = row.status === 'Delivered'
                                            const canClick = isUnlocked && hasRole && !isLocked && !isApproved

                                            return (
                                                <td key={tier.key} className="px-3 py-4 text-center">
                                                    <button
                                                        onClick={() => canClick && handleApprovalClick(row, tier)}
                                                        disabled={isToggling}
                                                        title={
                                                            !isUnlocked ? `Requires previous approval first` :
                                                            !hasRole ? `Only ${tier.label} can approve` :
                                                            isApproved ? `${tier.label} approved` :
                                                            `Approve as ${tier.label}`
                                                        }
                                                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full transition-all border ${
                                                            isToggling ? 'opacity-50 cursor-wait' :
                                                            isApproved ? 'bg-emerald-500 border-emerald-600 shadow-lg shadow-emerald-500/30' :
                                                            !isUnlocked ? 'bg-surface-100 border-surface-200 opacity-30 cursor-not-allowed' :
                                                            !hasRole ? 'bg-surface-100 border-surface-200 opacity-50 cursor-not-allowed' :
                                                            'bg-white border-surface-300 hover:border-brand-400 hover:bg-brand-50 cursor-pointer hover:scale-110'
                                                        }`}
                                                    >
                                                        {isToggling
                                                            ? <Loader2 size={11} className="animate-spin text-surface-400" />
                                                            : isApproved
                                                                ? <Check size={12} className="text-white" />
                                                                : <X size={12} className={!isUnlocked ? 'text-surface-200' : 'text-surface-400'} />
                                                        }
                                                    </button>
                                                </td>
                                            )
                                        })}

                                        {/* Store Info + Vendor Info */}
                                        <td className="px-3 py-3">
                                            <div className="space-y-2 min-w-[180px]">

                                                {/* ── Store Section ── */}
                                                {row.approved_store ? (
                                                    <div className={`rounded-xl p-2.5 border ${
                                                        row.available_in_store
                                                            ? 'bg-emerald-50 border-emerald-200'
                                                            : 'bg-red-50 border-red-200'
                                                    }`}>
                                                        <div className="flex items-center gap-1.5 mb-1">
                                                            <Store size={10} className={row.available_in_store ? 'text-emerald-600' : 'text-red-500'} />
                                                            <span className={`text-[10px] font-black uppercase tracking-wider ${
                                                                row.available_in_store ? 'text-emerald-700' : 'text-red-600'
                                                            }`}>
                                                                {row.available_in_store ? '✓ Available in Store' : '✗ Not in Store'}
                                                            </span>
                                                        </div>
                                                        {row.store_remark && (
                                                            <p className="text-[10px] text-surface-600 italic leading-snug" title={row.store_remark}>
                                                                &ldquo;{row.store_remark}&rdquo;
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="rounded-xl p-2 border border-dashed border-surface-200 text-[10px] text-surface-400 text-center">
                                                        Awaiting Store
                                                    </div>
                                                )}

                                                {/* ── Vendor/Award Section ── */}
                                                {row.awarded_vendor_name ? (
                                                    <div className={`rounded-xl p-2.5 border ${
                                                        allMDApproved(row)
                                                            ? 'bg-emerald-100 border-emerald-400'
                                                            : 'bg-violet-50 border-violet-200'
                                                    }`}>
                                                        <div className="flex items-center gap-1.5 mb-1">
                                                            <Award size={10} className={allMDApproved(row) ? 'text-emerald-700' : 'text-violet-600'} />
                                                            <span className={`text-[10px] font-black uppercase tracking-wider ${
                                                                allMDApproved(row) ? 'text-emerald-800' : 'text-violet-700'
                                                            }`}>Awarded Vendor</span>
                                                        </div>
                                                        <p className={`text-[11px] font-bold truncate ${
                                                            allMDApproved(row) ? 'text-emerald-900' : 'text-violet-900'
                                                        }`}>{row.awarded_vendor_name}</p>
                                                        {row.total_awarded_price && (
                                                            <p className="text-[11px] font-black text-emerald-600 mt-0.5">
                                                                ₹{parseFloat(row.total_awarded_price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : row.approved_store && !row.approved_purchase && (role === 'supervisor' || role === 'admin') ? (
                                                    <button
                                                        onClick={() => setVendorModalRow(row)}
                                                        className="w-full inline-flex items-center justify-center gap-1 px-2 py-2 rounded-xl bg-violet-50 text-violet-700 text-[10px] font-bold border border-violet-200 hover:bg-violet-100 transition-colors"
                                                    >
                                                        <Award size={10} /> Award Vendor
                                                    </button>
                                                ) : row.approved_store ? (
                                                    <div className="rounded-xl p-2 border border-dashed border-surface-200 text-[10px] text-surface-400 text-center">
                                                        Awaiting Vendor
                                                    </div>
                                                ) : null}
                                            </div>
                                        </td>

                                        {/* Action */}
                                        <td className="px-4 py-4 text-center">
                                            {row.status === 'Delivered' ? (
                                                <span className="text-emerald-500 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                                                    <PackageCheck size={13} /> Delivered
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => deleteIntent(row)}
                                                    disabled={deletingIntentId === row.id}
                                                    className={`text-red-400 hover:text-red-600 transition-colors ${confirmDeleteIntentId === row.id ? 'text-red-600 animate-pulse' : ''}`}
                                                    title={confirmDeleteIntentId === row.id ? 'Click again to confirm delete' : 'Delete indent'}
                                                >
                                                    {deletingIntentId === row.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-xs text-surface-400 font-mono whitespace-nowrap">{formatTimestamp(row.created_at)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {!loading && (
                    <div className="px-5 py-3 bg-surface-50/50 border-t border-surface-200 text-xs text-surface-700/50 font-medium">
                        Showing {tabData.length} of {data.length} indents
                    </div>
                )}
            </div>

            <CreateIntentModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSuccess={fetchIntents}
                selectedProjectId={selectedProjectId}
            />

            {/* Store Approval Modal */}
            {storeModalRow && (
                <StoreApprovalModal
                    row={storeModalRow}
                    onClose={() => setStoreModalRow(null)}
                    onSave={handleStoreApprovalSave}
                />
            )}

            {/* Vendor Award Modal */}
            {vendorModalRow && (
                <VendorAwardModal
                    row={vendorModalRow}
                    vendors={vendors}
                    onClose={() => setVendorModalRow(null)}
                    onSave={handleVendorAwardSave}
                />
            )}
        </div>
    )
}
