import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { formatTimestamp } from '@/lib/formatTime'
import { FileText, RefreshCw, ShoppingBag, Search } from 'lucide-react'

export default function PurchaseEntriesPage() {
    const [entries, setEntries] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

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

    const filteredEntries = entries.filter(entry => 
        entry.action.toLowerCase().includes(search.toLowerCase()) || 
        entry.user_name.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500 p-4 md:p-8">
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
                            placeholder="Search logs..."
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
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-surface-50/50 border-b border-surface-200 text-[10px] font-bold text-surface-500 uppercase tracking-wider">
                                <th className="px-6 py-4 text-left">Date</th>
                                <th className="px-6 py-4 text-left">Entry Details (Product | Vendor | Invoice)</th>
                                <th className="px-6 py-4 text-left">Recorded By</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-100">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-6 py-4"><div className="h-4 bg-surface-100 rounded w-24"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-surface-100 rounded w-full"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-surface-100 rounded w-32"></div></td>
                                    </tr>
                                ))
                            ) : filteredEntries.length === 0 ? (
                                <tr>
                                    <td colSpan="3" className="px-6 py-12 text-center">
                                        <ShoppingBag size={40} className="mx-auto mb-3 text-surface-200" />
                                        <p className="text-surface-500 font-medium">No purchase entries found</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredEntries.map(entry => {
                                    const actionText = entry.action.replace('Purchase entry: ', '')
                                    return (
                                        <tr key={entry.id} className="hover:bg-surface-50/50 transition-colors">
                                            <td className="px-6 py-4 text-xs font-mono text-surface-500 whitespace-nowrap">
                                                {formatTimestamp(entry.created_at)}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-surface-800">
                                                {actionText}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
                                                        {entry.user_name?.charAt(0).toUpperCase() || 'U'}
                                                    </div>
                                                    <span className="text-xs font-semibold text-surface-700">{entry.user_name}</span>
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
        </div>
    )
}
