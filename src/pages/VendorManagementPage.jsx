import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { formatTimestamp } from '@/lib/formatTime'
import { Users, Search, RefreshCw, Trophy } from 'lucide-react'
import VendorQuoteSection from '@/components/VendorQuoteSection'

export default function VendorManagementPage() {
    const { canViewFinancials } = useAuth()
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => { fetchVendors() }, [])

    async function fetchVendors() {
        setLoading(true)
        const { data: rows, error } = await supabase
            .from('vendor_quotes')
            .select('*')
            .order('created_at', { ascending: false })
        if (!error) setData(rows || [])
        setLoading(false)
    }

    const filtered = data.filter(row =>
        [row.vendor_name, row.product_name]
            .some(v => v?.toLowerCase().includes(search.toLowerCase()))
    )

    const colCount = canViewFinancials ? 6 : 4

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-surface-900 tracking-tight flex items-center gap-2">
                        <Users size={22} className="text-brand-500" />
                        Vendor Management
                    </h2>
                    <p className="text-sm text-surface-700/60 mt-0.5">Quotes, pricing & vendor comparison engine</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-300" />
                        <input
                            type="text"
                            placeholder="Search vendors..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 text-sm rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all w-full sm:w-64"
                        />
                    </div>
                    <button
                        onClick={fetchVendors}
                        className="p-2 rounded-xl border border-surface-200 bg-white hover:bg-surface-50 text-surface-700 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Inline Vendor Quote Section */}
            <VendorQuoteSection onSuccess={fetchVendors} />

            {/* Existing Quotes Table */}
            <div className="rounded-2xl border border-surface-200 bg-white overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-surface-200 bg-surface-50/80">
                                <th className="text-left px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Vendor Name</th>
                                <th className="text-left px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Product</th>
                                {canViewFinancials && (
                                    <>
                                        <th className="text-right px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Price Quoted</th>
                                        <th className="text-left px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">GST RC</th>
                                    </>
                                )}
                                <th className="text-center px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Best Price</th>
                                <th className="text-left px-5 py-3.5 font-semibold text-surface-700/70 text-xs uppercase tracking-wider">Last Updated</th>
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
                                        <Users size={36} className="mx-auto mb-2 opacity-30" />
                                        <p className="font-medium">No vendor quotes found</p>
                                        <p className="text-xs mt-1">Use the form above to add vendor comparisons.</p>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((row) => (
                                    <tr
                                        key={row.id}
                                        className={`border-b transition-all duration-300 ${row.is_best_price
                                            ? 'bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 border-amber-200 border-l-4 border-l-amber-400'
                                            : 'border-surface-100 hover:bg-brand-50/30'
                                            }`}
                                    >
                                        <td className={`px-5 py-3.5 font-medium ${row.is_best_price ? 'text-amber-900' : 'text-surface-800'}`}>
                                            {row.vendor_name}
                                        </td>
                                        <td className={`px-5 py-3.5 ${row.is_best_price ? 'text-amber-800' : 'text-surface-700'}`}>
                                            {row.product_name || '—'}
                                        </td>
                                        {canViewFinancials && (
                                            <>
                                                <td className={`px-5 py-3.5 text-right font-mono font-semibold ${row.is_best_price ? 'text-amber-900' : 'text-surface-800'}`}>
                                                    ₹{parseFloat(row.price_quoted || 0).toLocaleString('en-IN')}
                                                </td>
                                                <td className={`px-5 py-3.5 font-mono text-xs ${row.is_best_price ? 'text-amber-700' : 'text-surface-700'}`}>
                                                    {row.gst_rc || '—'}
                                                </td>
                                            </>
                                        )}
                                        <td className="px-5 py-3.5 text-center">
                                            {row.is_best_price ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 text-white text-xs font-bold shadow-sm shadow-amber-300/40">
                                                    <Trophy size={11} className="drop-shadow-sm" />
                                                    Best Value
                                                </span>
                                            ) : (
                                                <span className="text-surface-300">—</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5 text-xs text-surface-700/50 font-mono whitespace-nowrap">{formatTimestamp(row.created_at)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {!loading && (
                    <div className="px-5 py-3 bg-surface-50/50 border-t border-surface-200 text-xs text-surface-700/50 font-medium">
                        Showing {filtered.length} of {data.length} quotes
                    </div>
                )}
            </div>
        </div>
    )
}
