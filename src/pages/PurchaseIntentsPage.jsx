import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { formatTimestamp } from '@/lib/formatTime'
import {
    FileText, Search, RefreshCw, Plus, Loader2, PackageCheck, Trash2,
    ShoppingCart, ChevronDown, Check, X, Warehouse, Briefcase, Users
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
        // Unlocks always (first tier)
        unlockedWhen: () => true,
    },
    {
        key: 'approved_store',
        label: 'Store',
        short: 'STR',
        roles: ['store', 'admin'],
        color: 'indigo',
        unlockedWhen: (row) => row.approved_manager,
    },
    {
        key: 'approved_purchase',
        label: 'Purchase Dept',
        short: 'PUR',
        roles: ['supervisor', 'admin'],
        color: 'violet',
        unlockedWhen: (row) => row.approved_store,
        needsVendor: true,  // This tier requires vendor selection
    },
    {
        key: 'approved_md',
        label: 'MD',
        short: 'MD',
        roles: ['owner', 'admin'],
        color: 'emerald',
        unlockedWhen: (row) => row.approved_purchase && !!row.selected_vendor_id,
    },
]

export default function PurchaseIntentsPage({ selectedProjectId }) {
    const { user, role, isAdmin, isOwner } = useAuth()
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [activeTab, setActiveTab] = useState('project_intent')
    const [modalOpen, setModalOpen] = useState(false)
    const [togglingId, setTogglingId] = useState(null)
    const [confirmingId, setConfirmingId] = useState(null)
    const [deletingIntentId, setDeletingIntentId] = useState(null)
    const [confirmDeleteIntentId, setConfirmDeleteIntentId] = useState(null)

    // Vendor picker state
    const [vendorPickerRowId, setVendorPickerRowId] = useState(null)
    const [vendors, setVendors] = useState([])
    const [vendorSearch, setVendorSearch] = useState('')
    const vendorPickerRef = useRef(null)

    useEffect(() => { fetchIntents() }, [selectedProjectId])
    useEffect(() => {
        fetchVendors()
        function handleClick(e) {
            if (vendorPickerRef.current && !vendorPickerRef.current.contains(e.target)) {
                setVendorPickerRowId(null)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    async function fetchIntents() {
        setLoading(true)
        let query = supabase.from('purchase_intent_headers').select('*').order('created_at', { ascending: false })
        if (selectedProjectId) {
            query = query.eq('project_id', selectedProjectId)
        }
        const { data: headers, error } = await query
        if (!error && headers?.length > 0) {
            const { data: items } = await supabase.from('purchase_intent_items').select('*').in('header_id', headers.map(h => h.id))
            const enriched = headers.map(h => ({
                ...h,
                items: items?.filter(i => i.header_id === h.id) || []
            }))
            setData(enriched)
        } else {
            setData([])
        }
        setLoading(false)
    }

    async function fetchVendors() {
        const { data } = await supabase.from('vendors').select('id, name, phone, email').order('name')
        setVendors(data || [])
    }

    const tabData = data.filter(row => {
        const matchesTab = selectedProjectId
            ? true  // Inside project workspace — show all project intents
            : (row.intent_type === 'General Stock' ? 'general_stock' : 'project_intent') === activeTab
        const itemsText = row.items?.map(i => `${i.product_name} ${i.make}`).join(' ') || ''
        const matchesSearch = [row.dept, itemsText, row.raised_by, row.status, row.selected_vendor_name]
            .some(v => v?.toLowerCase().includes(search.toLowerCase()))
        return matchesTab && matchesSearch
    })

    const userName = user?.user_metadata?.full_name?.toLowerCase() || user?.email?.toLowerCase() || ''
    const authorizedRaisers = ['sarath', 'gopi', 'parthiban', 'bhuvanesh', 'admin', 'owner']
    const isAuthorizedRaiser = authorizedRaisers.some(name => userName.includes(name))

    // ─── Sequential Approval Toggle ───
    async function handleApprovalClick(row, tier) {
        // Check sequential unlock
        if (!tier.unlockedWhen(row)) return
        if (!tier.roles.includes(role)) return

        // If Purchase tier — open vendor picker first (if no vendor yet)
        if (tier.needsVendor && !row.selected_vendor_id) {
            setVendorPickerRowId(row.id)
            setVendorSearch('')
            return
        }

        const newVal = !row[tier.key]
        setTogglingId(`${row.id}-${tier.key}`)

        const updates = { [tier.key]: newVal }
        const nextRow = { ...row, ...updates }

        if (nextRow.approved_md) {
            updates.status = 'Delivered'
            if (tier.key === 'approved_md' && newVal) {
                updates.approved_at = new Date().toISOString()
            }
        } else if (nextRow.approved_purchase) {
            updates.status = 'Purchased'
        } else if (nextRow.approved_manager || nextRow.approved_store) {
            updates.status = 'Approved'
        } else {
            updates.status = 'Requested'
        }

        const { error } = await supabase
            .from('purchase_intent_headers')
            .update(updates)
            .eq('id', row.id)

        if (!error) {
            if (tier.key === 'approved_md' && newVal) {
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
                    action: `Marked purchase intent as Delivered & added ${inventoryInserts.length} items to inventory`,
                    entity_type: 'inventory',
                })
            }
            setData(prev => prev.map(r => r.id === row.id ? { ...r, ...updates } : r))
        }
        setTogglingId(null)
    }

    // ─── Set vendor from picker, then approve Purchase tier ───
    async function selectVendorAndApprove(row, vendor) {
        setVendorPickerRowId(null)
        setTogglingId(`${row.id}-approved_purchase`)

        const { error } = await supabase
            .from('purchase_intent_headers')
            .update({
                selected_vendor_id: vendor.id,
                selected_vendor_name: vendor.name,
                approved_purchase: true,
                status: 'Purchased' // also update status here
            })
            .eq('id', row.id)

        if (!error) {
            setData(prev => prev.map(r =>
                r.id === row.id ? { ...r, selected_vendor_id: vendor.id, selected_vendor_name: vendor.name, approved_purchase: true, status: 'Purchased' } : r
            ))
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

    const filteredVendors = vendors.filter(v => v.name?.toLowerCase().includes(vendorSearch.toLowerCase()))

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-surface-900 tracking-tight flex items-center gap-2">
                        <FileText size={22} className="text-brand-500" />
                        Purchase Intents
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

            {/* Tab switcher — only shown at global level (no project selected) */}
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
            <div className="rounded-2xl border border-surface-200 bg-white shadow-sm flex flex-col" style={{ maxHeight: '60vh' }}>
                <div className="overflow-auto flex-1">
                    <table className="w-full text-sm text-left relative">
                        <thead className="bg-surface-50 sticky top-0 z-20 shadow-sm ring-1 ring-surface-200">
                            <tr className="border-b border-surface-200">
                                <th className="px-4 py-3 font-semibold text-xs uppercase text-surface-500">Type</th>
                                <th className="px-4 py-3 font-semibold text-xs uppercase text-surface-500">Dept</th>
                                <th className="px-4 py-3 font-semibold text-xs uppercase text-surface-500 min-w-[200px]">Items Overview</th>
                                <th className="px-4 py-3 font-semibold text-xs uppercase text-surface-500">Raised By</th>
                                <th className="px-4 py-3 font-semibold text-xs uppercase text-surface-500 text-center">Status</th>

                                {/* 4 Approval columns */}
                                {TIERS.map(tier => (
                                    <th key={tier.key} className="px-3 py-3 font-semibold text-xs uppercase text-surface-500 text-center">
                                        {tier.short}
                                    </th>
                                ))}

                                <th className="px-4 py-3 font-semibold text-xs uppercase text-surface-500">Vendor</th>
                                <th className="px-4 py-3 font-semibold text-xs uppercase text-surface-500 text-center">Action</th>
                                <th className="px-4 py-3 font-semibold text-xs uppercase text-surface-500">Created</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-100">
                            {loading ? (
                                <tr><td colSpan={14} className="px-5 py-10 text-center text-surface-400">Loading...</td></tr>
                            ) : tabData.length === 0 ? (
                                <tr><td colSpan={14} className="px-5 py-10 text-center text-surface-400">No intents found</td></tr>
                            ) : (
                                tabData.map((row) => (
                                    <tr key={row.id} className="hover:bg-brand-50/20 relative">
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
                                        {TIERS.map((tier, idx) => {
                                            const isUnlocked = tier.unlockedWhen(row)
                                            const hasRole = tier.roles.includes(role)
                                            const isApproved = row[tier.key]
                                            const isToggling = togglingId === `${row.id}-${tier.key}`
                                            const isLocked = row.status === 'Delivered'
                                            const canClick = isUnlocked && hasRole && !isLocked && !isApproved

                                            return (
                                                <td key={tier.key} className="px-3 py-4 text-center">
                                                    <div className="flex flex-col items-center gap-0.5">
                                                        <button
                                                            onClick={() => canClick && handleApprovalClick(row, tier)}
                                                            disabled={isToggling}
                                                            title={
                                                                !isUnlocked ? `Requires previous approval first` :
                                                                !hasRole ? `Only ${tier.label} can approve` :
                                                                isApproved ? `${tier.label} approved` :
                                                                tier.needsVendor && !row.selected_vendor_id ? 'Select a vendor first' :
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
                                                    </div>
                                                </td>
                                            )
                                        })}

                                        {/* Vendor */}
                                        <td className="px-4 py-4 relative">
                                            {row.selected_vendor_name ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
                                                    <Users size={10} />
                                                    {row.selected_vendor_name}
                                                </span>
                                            ) : row.approved_store && !row.approved_purchase ? (
                                                <button
                                                    onClick={() => {
                                                        if (role === 'supervisor' || role === 'admin') {
                                                            setVendorPickerRowId(row.id)
                                                            setVendorSearch('')
                                                        }
                                                    }}
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-50 text-violet-700 text-xs font-semibold border border-violet-200 hover:bg-violet-100 transition-colors"
                                                >
                                                    <Plus size={10} /> Select Vendor
                                                </button>
                                            ) : (
                                                <span className="text-surface-300 text-xs">—</span>
                                            )}

                                            {/* Vendor Picker Popover */}
                                            {vendorPickerRowId === row.id && (
                                                <div
                                                    ref={vendorPickerRef}
                                                    className="absolute z-50 top-full mt-1 left-0 w-72 bg-white rounded-xl border border-surface-200 shadow-2xl shadow-surface-900/15 overflow-hidden"
                                                    style={{ animation: 'popIn 0.15s ease-out' }}
                                                >
                                                    <div className="px-3 py-2 border-b border-surface-100 bg-surface-50">
                                                        <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-2">Select Vendor</p>
                                                        <div className="relative">
                                                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-300" />
                                                            <input
                                                                type="text"
                                                                placeholder="Search vendors..."
                                                                value={vendorSearch}
                                                                onChange={e => setVendorSearch(e.target.value)}
                                                                autoFocus
                                                                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="max-h-52 overflow-y-auto divide-y divide-surface-50">
                                                        {filteredVendors.length === 0 ? (
                                                            <div className="px-3 py-4 text-center text-xs text-surface-400">No vendors found</div>
                                                        ) : filteredVendors.map(v => (
                                                            <button
                                                                key={v.id}
                                                                onClick={() => selectVendorAndApprove(row, v)}
                                                                className="w-full flex items-start gap-2 px-3 py-2.5 hover:bg-brand-50 transition-colors text-left"
                                                            >
                                                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-100 text-surface-500 shrink-0 mt-0.5">
                                                                    <Users size={12} />
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs font-semibold text-surface-900">{v.name}</p>
                                                                    {v.phone && <p className="text-[10px] text-surface-500">{v.phone}</p>}
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
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
                                                    title={confirmDeleteIntentId === row.id ? 'Click again to confirm delete' : 'Delete intent'}
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
                        Showing {tabData.length} of {data.length} intents
                    </div>
                )}
            </div>

            <CreateIntentModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSuccess={fetchIntents}
                selectedProjectId={selectedProjectId}
            />

            <style>{`
                @keyframes popIn {
                    from { transform: scale(0.95) translateY(-4px); opacity: 0; }
                    to { transform: scale(1) translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    )
}
