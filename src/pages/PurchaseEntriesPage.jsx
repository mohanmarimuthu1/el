import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { formatTimestamp } from '@/lib/formatTime'
import { FileText, RefreshCw, ShoppingBag, Search, X, Package, User, Calendar, Receipt, Hash, Ruler, MessageSquare, IndianRupee, Percent } from 'lucide-react'

export default function PurchaseEntriesPage() {
    const [entries, setEntries] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [selectedEntry, setSelectedEntry] = useState(null)

    useEffect(() => { fetchEntries() }, [])

    async function fetchEntries() {
        setLoading(true)
        const { data, error } = await supabase
            .from('activity_logs')
            .select('*')
            .ilike('action', 'Purchase entry:%')
            .order('created_at', { ascending: false })

        if (!error) setEntries(data || [])
        setLoading(false)
    }

    // Parse the action string into structured fields
    function parseEntry(actionText) {
        const cleaned = actionText.replace('Purchase entry: ', '')
        const parts = {}

        // Pattern: "Product × Qty | Vendor: X | Invoice: Y (date) | Amount: ₹Z | GST: W%"
        const segments = cleaned.split(' | ')

        // First segment: product × qty
        if (segments[0]) {
            const pqMatch = segments[0].match(/^(.+?)\s*×\s*(\d+)$/)
            if (pqMatch) {
                parts.product = pqMatch[1].trim()
                parts.quantity = pqMatch[2]
            } else {
                parts.product = segments[0].trim()
            }
        }

        for (const seg of segments.slice(1)) {
            const trimmed = seg.trim()
            if (trimmed.startsWith('Vendor:')) {
                parts.vendor = trimmed.replace('Vendor:', '').trim()
            } else if (trimmed.startsWith('Invoice:')) {
                const invMatch = trimmed.match(/Invoice:\s*(.+?)(?:\s*\((.+?)\))?$/)
                if (invMatch) {
                    parts.invoice = invMatch[1].trim()
                    parts.invoiceDate = invMatch[2]?.trim() || ''
                }
            } else if (trimmed.startsWith('Amount:')) {
                parts.amount = trimmed.replace('Amount:', '').trim()
            } else if (trimmed.startsWith('GST:')) {
                parts.gst = trimmed.replace('GST:', '').trim()
            }
        }

        return parts
    }

    const filteredEntries = entries.filter(entry =>
        entry.action.toLowerCase().includes(search.toLowerCase()) ||
        entry.user_name.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-surface-900 tracking-tight flex items-center gap-2">
                        <FileText size={22} className="text-brand-500" />
                        Purchase Entries
                    </h2>
                    <p className="text-sm text-surface-700/60 mt-0.5">Historical log of all inbound stock receipts</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-300" />
                        <input
                            type="text"
                            placeholder="Search entries..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all w-full sm:w-64"
                        />
                    </div>
                    <button
                        onClick={fetchEntries}
                        className="p-2 rounded-xl border border-surface-200 bg-white hover:bg-surface-50 text-surface-700 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Entries Table */}
            <div className="bg-white rounded-3xl border border-surface-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto" style={{ maxHeight: '70vh' }}>
                    <table className="w-full text-sm">
                        <thead className="bg-surface-50/80 sticky top-0 z-10 shadow-sm ring-1 ring-surface-200">
                            <tr className="border-b border-surface-200 text-[10px] font-bold text-surface-500 uppercase tracking-wider">
                                <th className="px-5 py-3.5 text-left">Date</th>
                                <th className="px-5 py-3.5 text-left">Product</th>
                                <th className="px-5 py-3.5 text-left">Vendor</th>
                                <th className="px-5 py-3.5 text-left">Invoice</th>
                                <th className="px-5 py-3.5 text-center">Qty</th>
                                <th className="px-5 py-3.5 text-right">Amount</th>
                                <th className="px-5 py-3.5 text-left">Recorded By</th>
                                <th className="px-5 py-3.5 text-center w-20">View</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-100">
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {Array.from({ length: 8 }).map((_, j) => (
                                            <td key={j} className="px-5 py-4"><div className="h-4 bg-surface-100 rounded w-20" /></td>
                                        ))}
                                    </tr>
                                ))
                            ) : filteredEntries.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="px-6 py-16 text-center">
                                        <ShoppingBag size={40} className="mx-auto mb-3 text-surface-200" />
                                        <p className="text-surface-500 font-medium">No purchase entries found</p>
                                        <p className="text-xs text-surface-400 mt-1">Records will appear here after purchase entries are submitted</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredEntries.map(entry => {
                                    const parsed = parseEntry(entry.action)
                                    return (
                                        <tr key={entry.id} className="hover:bg-brand-50/30 transition-colors cursor-pointer group" onClick={() => setSelectedEntry(entry)}>
                                            <td className="px-5 py-4 text-xs font-mono text-surface-500 whitespace-nowrap">
                                                {formatTimestamp(entry.created_at)}
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="font-semibold text-surface-800 text-sm">{parsed.product || '—'}</span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="text-xs font-medium text-surface-600">{parsed.vendor || '—'}</span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-mono font-semibold text-surface-700">{parsed.invoice || '—'}</span>
                                                    {parsed.invoiceDate && (
                                                        <span className="text-[10px] text-surface-400">{parsed.invoiceDate}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                                                    {parsed.quantity || '—'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <span className="text-sm font-semibold text-surface-800 font-mono">{parsed.amount || '—'}</span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
                                                        {entry.user_name?.charAt(0).toUpperCase() || 'U'}
                                                    </div>
                                                    <span className="text-xs font-semibold text-surface-700">{entry.user_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setSelectedEntry(entry) }}
                                                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 border border-brand-200 transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                {!loading && (
                    <div className="px-5 py-3 bg-surface-50/50 border-t border-surface-200 text-xs text-surface-700/50 font-medium">
                        Showing {filteredEntries.length} of {entries.length} entries
                    </div>
                )}
            </div>

            {/* Detail View Modal */}
            {selectedEntry && (
                <DetailModal entry={selectedEntry} parseEntry={parseEntry} onClose={() => setSelectedEntry(null)} />
            )}
        </div>
    )
}

function DetailModal({ entry, parseEntry, onClose }) {
    const parsed = parseEntry(entry.action)

    const fields = [
        { icon: Package, label: 'Product Name', value: parsed.product },
        { icon: User, label: 'Vendor', value: parsed.vendor },
        { icon: Receipt, label: 'Invoice No.', value: parsed.invoice, mono: true },
        { icon: Calendar, label: 'Invoice Date', value: parsed.invoiceDate },
        { icon: Hash, label: 'Quantity', value: parsed.quantity, badge: true },
        { icon: IndianRupee, label: 'Amount', value: parsed.amount, mono: true },
        { icon: Percent, label: 'GST', value: parsed.gst },
        { icon: User, label: 'Recorded By', value: entry.user_name },
        { icon: Calendar, label: 'Recorded At', value: formatTimestamp(entry.created_at), mono: true },
    ]

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-surface-900/30 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-surface-200 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200 bg-surface-50/50">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 shadow-md shadow-brand-500/25">
                            <ShoppingBag size={15} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-surface-900">Purchase Entry Details</h3>
                            <p className="text-[10px] text-surface-700/50">Full breakdown of this purchase record</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-1">
                    {fields.map(({ icon: Icon, label, value, mono, badge }) => (
                        value ? (
                            <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-50 transition-colors">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-100">
                                    <Icon size={14} className="text-surface-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">{label}</p>
                                    {badge ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 mt-0.5">
                                            {value}
                                        </span>
                                    ) : (
                                        <p className={`text-sm font-semibold text-surface-800 mt-0.5 ${mono ? 'font-mono' : ''}`}>
                                            {value}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : null
                    ))}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-surface-200 bg-surface-50/30 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-surface-700 rounded-xl border border-surface-200 hover:bg-surface-50 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
